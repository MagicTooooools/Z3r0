import { Button } from "@douyinfe/semi-ui";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { Maximize2, Minimize2, Minus, SquareTerminal, X } from "lucide-react";
import {
  CSSProperties,
  createContext,
  Dispatch,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  MutableRefObject,
  useMemo,
  useRef,
  useState,
  SetStateAction,
} from "react";
import { buildContainerShellUrl } from "../../shared/api/sandboxContainers";
import { showApiError } from "../../shared/api/feedback";
import type { SandboxContainer } from "../../shared/api/types";

type ShellStatus = "idle" | "connecting" | "open" | "closed";
type ShellDockState = "normal" | "minimized";

type ShellWindowState = {
  connectionKey: number;
  containerHash: string;
  containerName: string;
  dockState: ShellDockState;
  status: ShellStatus;
  isMaximized: boolean;
  restoreRect: ShellRect | null;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ContainerShellContextValue = {
  openShell: (container: SandboxContainer) => void;
};

type ShellFlightState = {
  direction: "minimize" | "restore";
  containerName: string;
  status: ShellStatus;
  from: ShellRect;
  to: ShellRect;
};

type ShellRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type FitTerminalOptions = {
  snapHeight?: boolean;
};

const DEFAULT_WIDTH = 760;
const DEFAULT_HEIGHT = 460;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 260;
const MAXIMIZED_MARGIN = 12;
const DOCK_BUTTON_RIGHT = 0;
const DOCK_BUTTON_SIZE = 46;
const SHELL_DOCK_TRANSITION_MS = 420;

const ContainerShellContext = createContext<ContainerShellContextValue | null>(null);

export function useContainerShell() {
  const value = useContext(ContainerShellContext);
  if (!value) throw new Error("useContainerShell must be used inside ContainerShellProvider");
  return value;
}

export function ContainerShellProvider({ children }: { children: ReactNode }) {
  const [shell, setShell] = useState<ShellWindowState | null>(null);
  const [flight, setFlight] = useState<ShellFlightState | null>(null);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const flightRef = useRef<HTMLDivElement | null>(null);
  const flightFrameRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ width: number; height: number; startX: number; startY: number } | null>(null);
  const fitWithoutSnapRef = useRef(false);
  const connectionKeyRef = useRef(0);
  const activeContainerHash = shell?.containerHash ?? null;
  const activeConnectionKey = shell?.connectionKey ?? null;

  const disposeShellResources = useCallback(() => {
    closeSocket(socketRef.current);
    socketRef.current = null;
    terminalRef.current?.dispose();
    terminalRef.current = null;
    fitRef.current = null;
  }, []);

  const closeShell = useCallback(() => {
    cancelFlightFrame(flightFrameRef);
    setFlight(null);
    disposeShellResources();
    setShell(null);
  }, [disposeShellResources]);

  const sendResize = useCallback(() => {
    const terminal = terminalRef.current;
    const socket = socketRef.current;
    if (!terminal || !socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "resize", rows: terminal.rows, cols: terminal.cols }));
  }, []);

  const fitTerminal = useCallback((options: FitTerminalOptions = {}) => {
    if (!fitRef.current || !terminalRef.current || !terminalHostRef.current) return;
    fitRef.current.fit();
    if (options.snapHeight !== false) {
      snapShellHeightToRows(terminalHostRef.current, terminalRef.current, setShell);
    }
    sendResize();
  }, [sendResize]);

  const toggleMaximizeShell = useCallback(() => {
    cancelFlightFrame(flightFrameRef);
    dragRef.current = null;
    resizeRef.current = null;
    setFlight(null);
    fitWithoutSnapRef.current = true;
    setShell((current) => {
      if (!current) return current;
      if (current.isMaximized) {
        const restoreRect = current.restoreRect ?? getShellRect(current);
        return { ...current, ...restoreRect, isMaximized: false, restoreRect: null };
      }

      return {
        ...current,
        ...getMaximizedShellRect(),
        isMaximized: true,
        restoreRect: getShellRect(current),
      };
    });
  }, [fitTerminal]);

  const minimizeShell = useCallback(() => {
    if (!shell) return;
    cancelFlightFrame(flightFrameRef);
    setFlight(buildShellFlight(shell, "minimize"));
    setShell((current) => current ? { ...current, dockState: "minimized" } : current);
  }, [shell]);

  const restoreShell = useCallback(() => {
    if (!shell) return;
    cancelFlightFrame(flightFrameRef);
    setFlight(buildShellFlight(shell, "restore"));
  }, [shell]);

  const openShell = useCallback((container: SandboxContainer) => {
    if (!container.container_hash) return;

    const currentShell = shell;
    if (currentShell?.containerHash === container.container_hash && isSocketActive(socketRef.current)) {
      const preserveGeometry = currentShell.dockState === "minimized";
      cancelFlightFrame(flightFrameRef);
      setFlight(null);
      fitWithoutSnapRef.current = preserveGeometry;
      setShell((current) => current ? {
        ...current,
        containerName: container.container_name,
        dockState: "normal",
      } : current);
      window.setTimeout(() => {
        fitTerminal({ snapHeight: !preserveGeometry });
        terminalRef.current?.focus();
      }, 0);
      return;
    }

    cancelFlightFrame(flightFrameRef);
    setFlight(null);
    disposeShellResources();

    setShell({
      connectionKey: connectionKeyRef.current + 1,
      containerHash: container.container_hash,
      containerName: container.container_name,
      dockState: "normal",
      status: "connecting",
      isMaximized: false,
      restoreRect: null,
      x: Math.max(24, window.innerWidth - DEFAULT_WIDTH - 36),
      y: Math.max(92, window.innerHeight - DEFAULT_HEIGHT - 36),
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    });
    connectionKeyRef.current += 1;
  }, [disposeShellResources, fitTerminal, shell]);

  useEffect(() => {
    if (!activeContainerHash || activeConnectionKey === null || terminalRef.current || !terminalHostRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: "JetBrains Mono, SFMono-Regular, Consolas, monospace",
      fontSize: 13,
      theme: {
        background: "#0b111c",
        foreground: "#d8e1ec",
        cursor: "#ffffff",
        selectionBackground: "#35506e",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(terminalHostRef.current);
    terminalRef.current = terminal;
    fitRef.current = fit;
    window.setTimeout(fitTerminal, 0);

    let socket: WebSocket;
    try {
      socket = new WebSocket(buildContainerShellUrl(activeContainerHash));
    } catch (error) {
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      showApiError(error);
      setShell((current) => current ? { ...current, status: "closed" } : current);
      return;
    }

    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    const disposable = terminal.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "input", data }));
      }
    });

    socket.addEventListener("open", () => {
      setShell((current) => current ? { ...current, status: "open" } : current);
      terminal.focus();
      fitTerminal({ snapHeight: false });
    });
    socket.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        terminal.write(event.data);
        return;
      }
      const decoder = new TextDecoder();
      terminal.write(decoder.decode(event.data as ArrayBuffer));
    });
    socket.addEventListener("close", () => {
      setShell((current) => current ? { ...current, status: "closed" } : current);
    });
    socket.addEventListener("error", () => {
      setShell((current) => current ? { ...current, status: "closed" } : current);
    });

    return () => {
      disposable.dispose();
      socket.close();
      terminal.dispose();
      if (socketRef.current === socket) socketRef.current = null;
      if (terminalRef.current === terminal) terminalRef.current = null;
      if (fitRef.current === fit) fitRef.current = null;
    };
  }, [activeConnectionKey, activeContainerHash, fitTerminal]);

  useEffect(() => () => closeShell(), [closeShell]);

  useEffect(() => () => cancelFlightFrame(flightFrameRef), []);

  useEffect(() => {
    if (!flight || !flightRef.current) return;
    return animateShellFlight(flightRef.current, flight, flightFrameRef, () => {
      if (flight.direction === "restore") {
        fitWithoutSnapRef.current = true;
        setShell((current) => current ? { ...current, dockState: "normal" } : current);
      }
      setFlight(null);
    });
  }, [fitTerminal, flight]);

  useEffect(() => {
    if (!shell || shell.dockState !== "normal") return;
    const snapHeight = !fitWithoutSnapRef.current;
    fitWithoutSnapRef.current = false;
    window.setTimeout(() => fitTerminal({ snapHeight }), 0);
  }, [fitTerminal, shell?.dockState, shell?.height, shell?.width]);

  useEffect(() => {
    const onWindowResize = () => {
      setShell((current) => current?.isMaximized ? { ...current, ...getMaximizedShellRect() } : current);
      if (shell?.dockState === "normal") window.setTimeout(fitTerminal, 0);
    };
    window.addEventListener("resize", onWindowResize);
    return () => window.removeEventListener("resize", onWindowResize);
  }, [fitTerminal, shell?.dockState]);

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (drag) {
      setShell((current) => current ? {
        ...current,
        x: clamp(drag.x + event.clientX - drag.startX, 8, window.innerWidth - 80),
        y: clamp(drag.y + event.clientY - drag.startY, 8, window.innerHeight - 80),
      } : current);
      return;
    }

    const resize = resizeRef.current;
    if (resize) {
      setShell((current) => current ? {
        ...current,
        width: clamp(resize.width + event.clientX - resize.startX, MIN_WIDTH, window.innerWidth - 24),
        height: clamp(resize.height + event.clientY - resize.startY, MIN_HEIGHT, window.innerHeight - 24),
      } : current);
    }
  }, []);

  const stopPointerAction = useCallback(() => {
    dragRef.current = null;
    resizeRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopPointerAction);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", stopPointerAction);
    };
  }, [onPointerMove, stopPointerAction]);

  const contextValue = useMemo<ContainerShellContextValue>(() => ({ openShell }), [openShell]);
  const shellWindowStyle = shell ? buildShellWindowStyle(shell) : undefined;
  const shellFlightStyle = flight ? buildShellFlightStyle(flight) : undefined;
  const shellWindowClassName = shell ? `shell-window${shell.dockState === "minimized" ? " shell-window-hidden" : ""}${shell.isMaximized ? " shell-window-maximized" : ""}` : "shell-window";

  return (
    <ContainerShellContext.Provider value={contextValue}>
      {children}
      {shell ? (
        <>
          <div className={shellWindowClassName} style={shellWindowStyle}>
            <div
              className="shell-window-header"
              onPointerDown={(event) => {
                if (shell.isMaximized) return;
                dragRef.current = { x: shell.x, y: shell.y, startX: event.clientX, startY: event.clientY };
              }}
            >
              <div className="shell-window-title">
                <SquareTerminal size={16} />
                <span>{shell.containerName}</span>
                <em>{shell.status}</em>
              </div>
              <div className="shell-window-actions" onPointerDown={(event) => event.stopPropagation()}>
                <Button icon={<Minus size={14} />} theme="borderless" onClick={minimizeShell} aria-label="Minimize shell" />
                <Button icon={shell.isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />} theme="borderless" onClick={toggleMaximizeShell} aria-label={shell.isMaximized ? "Restore shell size" : "Maximize shell"} />
                <Button icon={<X size={14} />} theme="borderless" type="danger" onClick={closeShell} aria-label="Close shell" />
              </div>
            </div>
            <div ref={terminalHostRef} className="shell-terminal" />
            <div
              className="shell-resize-handle"
              onPointerDown={(event) => {
                if (shell.isMaximized) return;
                resizeRef.current = { width: shell.width, height: shell.height, startX: event.clientX, startY: event.clientY };
              }}
            />
          </div>
          {shell.dockState === "minimized" && !flight ? (
            <button className="shell-minimized-button" type="button" onClick={restoreShell}>
              <SquareTerminal size={20} />
            </button>
          ) : null}
          {flight ? (
            <div ref={flightRef} className={`shell-flight shell-flight-${flight.direction}`} style={shellFlightStyle}>
              <div className="shell-flight-header">
                <SquareTerminal size={15} />
                <span>{flight.containerName}</span>
                <em>{flight.status}</em>
              </div>
              <div className="shell-flight-body" />
            </div>
          ) : null}
        </>
      ) : null}
    </ContainerShellContext.Provider>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function buildShellWindowStyle(shell: ShellWindowState) {
  return {
    left: shell.x,
    top: shell.y,
    width: shell.width,
    height: shell.height,
  } satisfies CSSProperties;
}

function getShellRect(shell: ShellWindowState): ShellRect {
  return {
    x: shell.x,
    y: shell.y,
    width: shell.width,
    height: shell.height,
  };
}

function getMaximizedShellRect(): ShellRect {
  return {
    x: MAXIMIZED_MARGIN,
    y: MAXIMIZED_MARGIN,
    width: Math.max(MIN_WIDTH, window.innerWidth - (MAXIMIZED_MARGIN * 2)),
    height: Math.max(MIN_HEIGHT, window.innerHeight - (MAXIMIZED_MARGIN * 2)),
  };
}

function buildShellFlight(shell: ShellWindowState, direction: ShellFlightState["direction"]): ShellFlightState {
  const shellRect = { x: shell.x, y: shell.y, width: shell.width, height: shell.height };
  const dockRect = getDockRect();
  return {
    direction,
    containerName: shell.containerName,
    status: shell.status,
    from: direction === "minimize" ? shellRect : dockRect,
    to: direction === "minimize" ? dockRect : shellRect,
  };
}

function buildShellFlightStyle(flight: ShellFlightState) {
  const base = getFlightBaseRect(flight);
  return {
    left: base.x,
    top: base.y,
    width: base.width,
    height: base.height,
    opacity: getFlightOpacity(flight.direction, 0),
    transform: buildShellFlightTransform(base, flight.from),
  } satisfies CSSProperties;
}

function getDockRect(): ShellRect {
  return {
    x: window.innerWidth - DOCK_BUTTON_RIGHT - DOCK_BUTTON_SIZE,
    y: window.innerHeight / 2,
    width: DOCK_BUTTON_SIZE,
    height: DOCK_BUTTON_SIZE,
  };
}

function closeSocket(socket: WebSocket | null) {
  if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) return;
  socket.close();
}

function isSocketActive(socket: WebSocket | null) {
  return socket !== null && socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING;
}

function cancelFlightFrame(frameRef: MutableRefObject<number | null>) {
  if (frameRef.current === null) return;
  window.cancelAnimationFrame(frameRef.current);
  frameRef.current = null;
}

function animateShellFlight(
  element: HTMLDivElement,
  flight: ShellFlightState,
  frameRef: MutableRefObject<number | null>,
  onDone: () => void,
) {
  const startedAt = performance.now();
  const base = getFlightBaseRect(flight);

  const tick = (now: number) => {
    const progress = clamp((now - startedAt) / SHELL_DOCK_TRANSITION_MS, 0, 1);
    const eased = easeInOutCubic(progress);
    const rect = interpolateRect(flight.from, flight.to, eased);

    element.style.opacity = String(getFlightOpacity(flight.direction, eased));
    element.style.transform = buildShellFlightTransform(base, rect);

    if (progress < 1) {
      frameRef.current = window.requestAnimationFrame(tick);
      return;
    }

    frameRef.current = null;
    onDone();
  };

  frameRef.current = window.requestAnimationFrame(tick);
  return () => cancelFlightFrame(frameRef);
}

function getFlightBaseRect(flight: ShellFlightState) {
  return flight.direction === "restore" ? flight.to : flight.from;
}

function buildShellFlightTransform(base: ShellRect, rect: ShellRect) {
  const scaleX = rect.width / base.width;
  const scaleY = rect.height / base.height;
  const translateX = rect.x - base.x;
  const translateY = rect.y - base.y;
  return `matrix(${scaleX}, 0, 0, ${scaleY}, ${translateX}, ${translateY})`;
}

function interpolateRect(from: ShellRect, to: ShellRect, progress: number): ShellRect {
  return {
    x: lerp(from.x, to.x, progress),
    y: lerp(from.y, to.y, progress),
    width: lerp(from.width, to.width, progress),
    height: lerp(from.height, to.height, progress),
  };
}

function lerp(from: number, to: number, progress: number) {
  return from + ((to - from) * progress);
}

function easeInOutCubic(progress: number) {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - (Math.pow(-2 * progress + 2, 3) / 2);
}

function getFlightOpacity(direction: ShellFlightState["direction"], progress: number) {
  return direction === "minimize" ? 1 - (0.78 * progress) : 0.22 + (0.78 * progress);
}

function snapShellHeightToRows(
  host: HTMLDivElement,
  terminal: Terminal,
  setShell: Dispatch<SetStateAction<ShellWindowState | null>>,
) {
  const cellHeight = getTerminalCellHeight(terminal);
  if (!cellHeight || !terminal.element) return;

  const terminalStyle = window.getComputedStyle(terminal.element);
  const terminalPaddingY = cssNumber(terminalStyle, "padding-top") + cssNumber(terminalStyle, "padding-bottom");
  const visibleHostHeight = host.getBoundingClientRect().height;
  const targetHostHeight = Math.ceil((terminal.rows * cellHeight) + terminalPaddingY);
  const delta = targetHostHeight - visibleHostHeight;
  if (Math.abs(delta) < 1) return;

  setShell((current) => current && !current.isMaximized ? {
    ...current,
    height: clamp(current.height + delta, MIN_HEIGHT, window.innerHeight - 24),
  } : current);
}

function getTerminalCellHeight(terminal: Terminal) {
  const dimensions = (terminal as unknown as {
    _core?: { _renderService?: { dimensions?: { css?: { cell?: { height?: number } } } } };
  })._core?._renderService?.dimensions;
  const height = dimensions?.css?.cell?.height;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : null;
}

function cssNumber(style: CSSStyleDeclaration, property: string) {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : 0;
}
