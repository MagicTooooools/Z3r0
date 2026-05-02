import type { AgentContentEvent } from "../../shared/api/types";

export type AgentItem =
  | { kind: "thinking"; id: string; text: string; complete: boolean }
  | { kind: "text"; id: string; text: string; complete: boolean }
  | {
      kind: "tool";
      id: string;
      callId: string;
      name: string;
      arguments: Record<string, unknown>;
      output: string;
      isError: boolean;
      resolved: boolean;
      nested?: NestedTranscript;
    }
  | { kind: "error"; id: string; message: string };

export type NestedTranscript = {
  agentName: string;
  items: AgentItem[];
};

export type ChatNode =
  | { kind: "user"; id: string; text: string; targetAgentCode: string }
  | { kind: "agent"; id: string; agentName: string; items: AgentItem[] };

export type ChatState = {
  nodes: ChatNode[];
  streaming: boolean;
};

export const initialChatState: ChatState = { nodes: [], streaming: false };

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type AgentNode = Extract<ChatNode, { kind: "agent" }>;

// shape compatible with both AgentNode and NestedTranscript so the same
// reducer primitives can drive top-level and nested transcripts
type ItemScope = { agentName: string; items: AgentItem[] };

export function appendUserMessage(state: ChatState, text: string, targetAgentCode = ""): ChatState {
  // idempotent w.r.t. the server echo: if the last node already matches, just refresh attribution
  const lastNode = state.nodes[state.nodes.length - 1];
  if (lastNode?.kind === "user" && lastNode.text === text) {
    if (!targetAgentCode || lastNode.targetAgentCode === targetAgentCode) {
      return { ...state, streaming: true };
    }
    const nodes = state.nodes.slice();
    nodes[nodes.length - 1] = { ...lastNode, targetAgentCode };
    return { ...state, nodes, streaming: true };
  }
  return {
    ...state,
    nodes: [...state.nodes, { kind: "user", id: newId(), text, targetAgentCode }],
    streaming: true,
  };
}

export function finishChatTurn(state: ChatState): ChatState {
  return { ...state, streaming: false };
}

export function chatReduce(state: ChatState, event: AgentContentEvent): ChatState {
  if (event.type === "user_message") {
    return appendUserMessage(state, event.text, event.target_agent_code);
  }

  const nestedCallId = "nested_call_id" in event ? event.nested_call_id : "";
  if (nestedCallId) {
    return routeToNested(state, event, nestedCallId);
  }
  return routeToTopLevel(state, event);
}

export function chatReplay(events: readonly AgentContentEvent[]): ChatState {
  const replayed = events.reduce<ChatState>(chatReduce, initialChatState);
  return finishChatTurn(replayed);
}

// ----------------------------------------------------------- routing

function routeToTopLevel(state: ChatState, event: AgentContentEvent): ChatState {
  const nodes = state.nodes.slice();
  const lastIndex = nodes.length - 1;
  const lastNode = nodes[lastIndex];

  let agent: AgentNode;
  if (lastNode?.kind === "agent") {
    agent = { ...lastNode, items: lastNode.items.slice() };
    nodes[lastIndex] = agent;
  } else {
    agent = { kind: "agent", id: newId(), agentName: "", items: [] };
    nodes.push(agent);
  }
  const finished = applyEventToScope(agent, event);
  return finished ? finishChatTurn({ ...state, nodes }) : { ...state, nodes };
}

function routeToNested(state: ChatState, event: AgentContentEvent, nestedCallId: string): ChatState {
  // nested events attach to the latest tool card whose callId matches; we
  // walk agent nodes in reverse so we always target the in-flight delegation
  const nodes = state.nodes.slice();
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.kind !== "agent") continue;
    const itemIndex = findToolItemIndex(node.items, nestedCallId);
    if (itemIndex === -1) continue;

    const items = node.items.slice();
    const tool = { ...(items[itemIndex] as Extract<AgentItem, { kind: "tool" }>) };
    const nested: NestedTranscript = tool.nested
      ? { agentName: tool.nested.agentName, items: tool.nested.items.slice() }
      : { agentName: "", items: [] };
    applyEventToScope(nested, event);
    tool.nested = nested;
    items[itemIndex] = tool;
    nodes[i] = { ...node, items };
    return { ...state, nodes };
  }
  // no matching ToolCard found; drop the event defensively
  return state;
}

function findToolItemIndex(items: AgentItem[], callId: string): number {
  return items.findIndex((item) => item.kind === "tool" && item.callId === callId);
}

// ----------------------------------------------------------- primitives

function applyEventToScope(scope: ItemScope, event: AgentContentEvent): boolean {
  // returns true when the event should also flip streaming off (final error)
  switch (event.type) {
    case "user_message":
      return false;

    case "thinking_delta":
      setAgentName(scope, event.agent_name);
      upsertStreamingItem(scope.items, "thinking", event.item_id, { delta: event.delta });
      return false;

    case "thinking_complete":
      setAgentName(scope, event.agent_name);
      upsertStreamingItem(scope.items, "thinking", event.item_id, { text: event.text, complete: true });
      return false;

    case "text_delta":
      setAgentName(scope, event.agent_name);
      upsertStreamingItem(scope.items, "text", event.item_id, { delta: event.delta });
      return false;

    case "text_complete":
      setAgentName(scope, event.agent_name);
      upsertStreamingItem(scope.items, "text", event.item_id, { text: event.text, complete: true });
      return false;

    case "tool_call":
      setAgentName(scope, event.agent_name);
      scope.items.push({
        kind: "tool",
        id: newId(),
        callId: event.call_id,
        name: event.name,
        arguments: (event.arguments as Record<string, unknown>) ?? {},
        output: "",
        isError: false,
        resolved: false,
      });
      return false;

    case "tool_result": {
      setAgentName(scope, event.agent_name);
      const index = findToolItemIndex(scope.items, event.call_id);
      if (index === -1) {
        scope.items.push({
          kind: "tool",
          id: newId(),
          callId: event.call_id,
          name: "",
          arguments: {},
          output: event.output,
          isError: event.is_error,
          resolved: true,
        });
        return false;
      }
      const existing = scope.items[index] as Extract<AgentItem, { kind: "tool" }>;
      scope.items[index] = {
        ...existing,
        output: event.output,
        isError: event.is_error,
        resolved: true,
      };
      return false;
    }

    case "error":
      setAgentName(scope, event.agent_name);
      scope.items.push({ kind: "error", id: newId(), message: event.message || "agent run failed" });
      return true;
  }
}

function setAgentName(scope: ItemScope, name: string) {
  if (name && !scope.agentName) scope.agentName = name;
}

function upsertStreamingItem(
  items: AgentItem[],
  kind: "text" | "thinking",
  itemId: string,
  patch: { delta?: string; text?: string; complete?: boolean },
) {
  const index = items.findIndex((item) => item.kind === kind && item.id === itemId);
  if (index === -1) {
    items.push({
      kind,
      id: itemId,
      text: patch.text ?? patch.delta ?? "",
      complete: Boolean(patch.complete),
    });
    return;
  }
  const existing = items[index] as Extract<AgentItem, { kind: "text" | "thinking" }>;
  items[index] = {
    ...existing,
    text: patch.text ?? existing.text + (patch.delta ?? ""),
    complete: patch.complete ?? existing.complete,
  };
}
