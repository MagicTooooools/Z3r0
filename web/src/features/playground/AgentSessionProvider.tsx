import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { listAgents } from "../../shared/api/agents";
import {
  buildAgentStreamUrl,
  createAgentSession,
  deleteAgentSession,
  listAgentEvents,
  listAgentSessions,
} from "../../shared/api/agentSessions";
import { showApiError, showApiSuccess } from "../../shared/api/feedback";
import { getStoredAccessToken } from "../../shared/auth/session";
import type {
  AgentContentEvent,
  AgentInfo,
  AgentSessionSummary,
  AgentStreamCommand,
  AgentStreamEvent,
} from "../../shared/api/types";
import {
  appendUserMessage,
  chatReduce,
  chatReplay,
  finishChatTurn,
  initialChatState,
  type ChatState,
} from "./playgroundReducer";

type ConnectionStatus = "idle" | "connecting" | "open" | "closed";

type SessionRuntime = {
  state: ChatState;
  status: ConnectionStatus;
  historyLoading: boolean;
  // user-overridden agent for this session; "" => fall back to server-side sticky
  agentCodeOverride: string;
};

const DEFAULT_RUNTIME: SessionRuntime = {
  state: initialChatState,
  status: "idle",
  historyLoading: false,
  agentCodeOverride: "",
};

const IDLE_CLOSE_MS = 5 * 60 * 1000;
const CONNECT_TIMEOUT_MS = 15 * 1000;

type AgentSessionContextValue = {
  sessions: AgentSessionSummary[];
  sessionsLoading: boolean;
  refreshSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  activeSessionId: string | null;
  selectSession: (sessionId: string | null) => void;

  chatState: ChatState;
  status: ConnectionStatus;
  historyLoading: boolean;

  agents: AgentInfo[];
  defaultAgentCode: string;
  activeAgentCode: string;
  setActiveAgentCode: (code: string) => void;

  send: (text: string, sandboxContainerId?: number | null) => Promise<void>;
  interrupt: () => Promise<void>;
};

const AgentSessionContext = createContext<AgentSessionContextValue | null>(null);

export function useAgentSessionContext(): AgentSessionContextValue {
  const value = useContext(AgentSessionContext);
  if (!value) throw new Error("useAgentSessionContext must be used inside AgentSessionProvider");
  return value;
}

export function AgentSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<Map<string, SessionRuntime>>(() => new Map());

  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [defaultAgentCode, setDefaultAgentCode] = useState("");
  // pending pick for the next brand-new chat (when activeSessionId is still null)
  const [pendingAgentCode, setPendingAgentCode] = useState("");

  // sockets + timers live outside react state because their identity does not
  // drive rendering; one ws per session is kept alive across session switches
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const idleTimersRef = useRef<Map<string, number>>(new Map());
  const ensuredRef = useRef<Set<string>>(new Set());
  const pendingSendRef = useRef<{
    sessionId: string;
    text: string;
    sandboxContainerId: number | null;
    agentCode: string;
  } | null>(null);

  // ---------------------------------------------------------------- helpers
  const initRuntime = useCallback((sessionId: string) => {
    setRuntimes((prev) => {
      if (prev.has(sessionId)) return prev;
      const next = new Map(prev);
      next.set(sessionId, DEFAULT_RUNTIME);
      return next;
    });
  }, []);

  const updateRuntime = useCallback((sessionId: string, fn: (r: SessionRuntime) => SessionRuntime) => {
    setRuntimes((prev) => {
      const current = prev.get(sessionId);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(sessionId, fn(current));
      return next;
    });
  }, []);

  const dropRuntime = useCallback((sessionId: string) => {
    setRuntimes((prev) => {
      if (!prev.has(sessionId)) return prev;
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    ensuredRef.current.delete(sessionId);
  }, []);

  // ------------------------------------------------------------- agents
  useEffect(() => {
    listAgents()
      .then((response) => {
        setAgents(response.data?.items ?? []);
        setDefaultAgentCode(response.data?.default_code ?? "");
      })
      .catch(showApiError);
  }, []);

  // ------------------------------------------------------------- sessions
  const refreshSessions = useCallback(async (silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const response = await listAgentSessions();
      setSessions(response.data?.items ?? []);
    } catch (error) {
      if (!silent) showApiError(error);
    } finally {
      if (!silent) setSessionsLoading(false);
    }
  }, []);

  const refreshSessionsRef = useRef(refreshSessions);
  refreshSessionsRef.current = refreshSessions;

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  // ------------------------------------------------------------ ws + idle
  const clearIdleTimer = useCallback((sessionId: string) => {
    const timer = idleTimersRef.current.get(sessionId);
    if (timer != null) {
      window.clearTimeout(timer);
      idleTimersRef.current.delete(sessionId);
    }
  }, []);

  const closeSocket = useCallback((sessionId: string) => {
    clearIdleTimer(sessionId);
    const socket = socketsRef.current.get(sessionId);
    if (!socket) return;
    socketsRef.current.delete(sessionId);
    socket.close();
    updateRuntime(sessionId, (r) => ({
      ...r,
      status: "closed",
      state: r.state.streaming ? finishChatTurn(r.state) : r.state,
    }));
  }, [clearIdleTimer, updateRuntime]);

  const markActivity = useCallback((sessionId: string) => {
    clearIdleTimer(sessionId);
    if (!socketsRef.current.has(sessionId)) return;
    const timer = window.setTimeout(() => closeSocket(sessionId), IDLE_CLOSE_MS);
    idleTimersRef.current.set(sessionId, timer);
  }, [clearIdleTimer, closeSocket]);

  const connectFor = useCallback((sessionId: string): WebSocket => {
    const existing = socketsRef.current.get(sessionId);
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return existing;
    }

    const token = getStoredAccessToken();
    if (!token) throw new Error("missing access token");

    const socket = new WebSocket(buildAgentStreamUrl(sessionId, token));
    socketsRef.current.set(sessionId, socket);
    initRuntime(sessionId);
    updateRuntime(sessionId, (r) => ({ ...r, status: "connecting" }));

    socket.addEventListener("open", () => {
      if (socketsRef.current.get(sessionId) !== socket) return;
      updateRuntime(sessionId, (r) => ({ ...r, status: "open" }));
      markActivity(sessionId);
    });

    const onTerminate = () => {
      if (socketsRef.current.get(sessionId) !== socket) return;
      socketsRef.current.delete(sessionId);
      clearIdleTimer(sessionId);
      updateRuntime(sessionId, (r) => ({
        ...r,
        status: "closed",
        state: r.state.streaming ? finishChatTurn(r.state) : r.state,
      }));
    };
    socket.addEventListener("close", onTerminate);
    socket.addEventListener("error", onTerminate);

    socket.addEventListener("message", (event) => {
      if (socketsRef.current.get(sessionId) !== socket) return;
      markActivity(sessionId);
      try {
        const parsed = JSON.parse(event.data) as AgentStreamEvent;
        if (parsed.type === "done") {
          updateRuntime(sessionId, (r) => ({ ...r, state: finishChatTurn(r.state) }));
          void refreshSessionsRef.current(true);
          return;
        }
        // user_message echo signals the backend has materialized the session
        if (parsed.type === "user_message") {
          void refreshSessionsRef.current(true);
        }
        updateRuntime(sessionId, (r) => ({ ...r, state: chatReduce(r.state, parsed) }));
      } catch {
        // backend only emits json frames; swallow malformed payloads defensively
      }
    });
    return socket;
  }, [clearIdleTimer, initRuntime, markActivity, updateRuntime]);

  const sendCommand = useCallback(async (sessionId: string, command: AgentStreamCommand) => {
    const socket = connectFor(sessionId);
    if (socket.readyState !== WebSocket.OPEN) {
      await waitOpen(socket);
    }
    markActivity(sessionId);
    socket.send(JSON.stringify(command));
  }, [connectFor, markActivity]);

  // ---------------------------------------------------------- history load
  const ensureHistoryLoaded = useCallback((sessionId: string) => {
    if (ensuredRef.current.has(sessionId)) return;
    ensuredRef.current.add(sessionId);

    initRuntime(sessionId);
    updateRuntime(sessionId, (r) => ({ ...r, historyLoading: true }));

    listAgentEvents(sessionId)
      .then((response) => {
        const events = (response.data?.items ?? []) as AgentContentEvent[];
        updateRuntime(sessionId, (r) => ({
          ...r,
          state: chatReplay(events),
          historyLoading: false,
        }));
      })
      .catch((error) => {
        showApiError(error);
        updateRuntime(sessionId, (r) => ({ ...r, historyLoading: false }));
      });
  }, [initRuntime, updateRuntime]);

  // ----------------------------------------------------------- selection
  const selectSession = useCallback((sessionId: string | null) => {
    if (!sessionId || pendingSendRef.current?.sessionId !== sessionId) {
      pendingSendRef.current = null;
    }
    setActiveSessionId(sessionId);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    ensureHistoryLoaded(activeSessionId);
  }, [activeSessionId, ensureHistoryLoaded]);

  // ------------------------------------------------------------- agentCode
  const sessionAgentCode = useCallback(
    (sessionId: string | null): string => {
      if (!sessionId) return "";
      return sessions.find((session) => session.session_id === sessionId)?.agent_code ?? "";
    },
    [sessions],
  );

  const activeAgentCode = useMemo(() => {
    if (!activeSessionId) {
      return pendingAgentCode || defaultAgentCode;
    }
    const runtime = runtimes.get(activeSessionId);
    if (runtime?.agentCodeOverride) return runtime.agentCodeOverride;
    return sessionAgentCode(activeSessionId) || defaultAgentCode;
  }, [activeSessionId, defaultAgentCode, pendingAgentCode, runtimes, sessionAgentCode]);

  const setActiveAgentCode = useCallback((code: string) => {
    if (!agents.some((agent) => agent.code === code)) return;
    if (!activeSessionId) {
      setPendingAgentCode(code);
      return;
    }
    initRuntime(activeSessionId);
    updateRuntime(activeSessionId, (r) => ({ ...r, agentCodeOverride: code }));
  }, [activeSessionId, agents, initRuntime, updateRuntime]);

  // ------------------------------------------------------------- commands
  // drain a queued send once the lazy-created session has loaded its history
  useEffect(() => {
    const queued = pendingSendRef.current;
    if (!queued || queued.sessionId !== activeSessionId) return;
    const runtime = runtimes.get(activeSessionId);
    if (!runtime || runtime.historyLoading) return;
    pendingSendRef.current = null;
    setPendingAgentCode("");
    updateRuntime(activeSessionId, (r) => ({
      ...r,
      state: appendUserMessage(r.state, queued.text, queued.agentCode),
    }));
    sendCommand(activeSessionId, {
      action: "send",
      text: queued.text,
      sandbox_container_id: queued.sandboxContainerId,
      agent_code: queued.agentCode || null,
    }).catch(showApiError);
  }, [activeSessionId, runtimes, sendCommand, updateRuntime]);

  const send = useCallback(async (text: string, sandboxContainerId: number | null = null) => {
    const agentCode = activeAgentCode;
    if (activeSessionId) {
      updateRuntime(activeSessionId, (r) => ({
        ...r,
        state: appendUserMessage(r.state, text, agentCode),
      }));
      await sendCommand(activeSessionId, {
        action: "send",
        text,
        sandbox_container_id: sandboxContainerId,
        agent_code: agentCode || null,
      });
      return;
    }
    // lazy-create path: defer the actual send until activeSessionId + history settle
    try {
      const response = await createAgentSession();
      const id = response.data?.session_id ?? null;
      if (!id) return;
      pendingSendRef.current = { sessionId: id, text, sandboxContainerId, agentCode };
      setActiveSessionId(id);
    } catch (error) {
      showApiError(error);
    }
  }, [activeAgentCode, activeSessionId, sendCommand, updateRuntime]);

  const interrupt = useCallback(async () => {
    if (!activeSessionId) return;
    try {
      await sendCommand(activeSessionId, { action: "interrupt" });
    } catch (error) {
      showApiError(error);
    }
  }, [activeSessionId, sendCommand]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await deleteAgentSession(sessionId);
      showApiSuccess(response);
      closeSocket(sessionId);
      dropRuntime(sessionId);
      if (activeSessionId === sessionId) selectSession(null);
      await refreshSessions();
    } catch (error) {
      showApiError(error);
    }
  }, [activeSessionId, closeSocket, dropRuntime, refreshSessions, selectSession]);

  // -------------------------------------------------------------- unmount
  useEffect(() => {
    return () => {
      for (const socket of socketsRef.current.values()) socket.close();
      for (const timer of idleTimersRef.current.values()) window.clearTimeout(timer);
      socketsRef.current.clear();
      idleTimersRef.current.clear();
      ensuredRef.current.clear();
    };
  }, []);

  // -------------------------------------------------------------- derived
  const activeRuntime = activeSessionId ? runtimes.get(activeSessionId) ?? DEFAULT_RUNTIME : DEFAULT_RUNTIME;

  const value = useMemo<AgentSessionContextValue>(() => ({
    sessions, sessionsLoading, refreshSessions, deleteSession,
    activeSessionId, selectSession,
    chatState: activeRuntime.state,
    status: activeRuntime.status,
    historyLoading: activeRuntime.historyLoading,
    agents, defaultAgentCode, activeAgentCode, setActiveAgentCode,
    send, interrupt,
  }), [
    sessions, sessionsLoading, refreshSessions, deleteSession,
    activeSessionId, selectSession,
    activeRuntime,
    agents, defaultAgentCode, activeAgentCode, setActiveAgentCode,
    send, interrupt,
  ]);

  return <AgentSessionContext.Provider value={value}>{children}</AgentSessionContext.Provider>;
}

function waitOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      socket.removeEventListener("close", onClose);
    };
    const onOpen = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("websocket connection failed")); };
    const onClose = () => { cleanup(); reject(new Error("websocket connection closed")); };
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("websocket connection timed out")); }, CONNECT_TIMEOUT_MS);
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
    socket.addEventListener("close", onClose);
  });
}
