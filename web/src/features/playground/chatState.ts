import type {
  AgentContentEvent,
  AgentInputPart,
  AgentStreamEvent,
} from "../../shared/api/types";
import {
  contentSignature,
  findToolBlockIndex,
  hasToolCall,
  transcriptHasEvent,
} from "./transcriptIdentity";
import {
  applyEventToTranscript,
  cloneTranscript,
  createTranscript,
  subagentExecutionItemFromEvent,
} from "./transcriptReducer";
import type {
  AgentTranscript,
  ChatNode,
  ChatState,
  ToolExecutionItem,
} from "./transcriptTypes";

export type {
  AgentTranscript,
  ChatNode,
  ChatState,
  ErrorItem,
  ExecutionItem,
  NestedTranscript,
  StreamingItem,
  SubagentExecutionItem,
  TextItem,
  ThinkingItem,
  ToolExecutionItem,
  TranscriptBlock,
} from "./transcriptTypes";

export const initialChatState: ChatState = { nodes: [], streaming: false, pendingNested: {}, liveFrom: null };

type AgentNode = Extract<ChatNode, { kind: "agent" }>;

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function appendUserMessage(
  state: ChatState,
  content: AgentInputPart[],
  displayText: string,
  targetAgentCode: string,
  createdAt: AgentContentEvent["created_at"],
): ChatState {
  const signature = contentSignature(content);
  if (state.streaming) {
    const existingIndex = findLiveUserMessageIndex(state.nodes, signature, targetAgentCode);
    if (existingIndex !== -1) {
      const existing = state.nodes[existingIndex];
      const liveFrom = state.liveFrom ?? state.nodes.length;
      if (existing.kind !== "user" || !targetAgentCode || existing.targetAgentCode === targetAgentCode) {
        return { ...state, streaming: true, liveFrom };
      }
      const nodes = state.nodes.slice();
      nodes[existingIndex] = { ...existing, targetAgentCode };
      return { ...state, nodes, streaming: true, liveFrom };
    }
  }
  const lastNode = state.nodes[state.nodes.length - 1];
  if (lastNode?.kind === "user" && contentSignature(lastNode.content) === signature) {
    const liveFrom = state.liveFrom ?? state.nodes.length;
    if (!targetAgentCode || lastNode.targetAgentCode === targetAgentCode) {
      return { ...state, streaming: true, liveFrom };
    }
    const nodes = state.nodes.slice();
    nodes[nodes.length - 1] = { ...lastNode, targetAgentCode };
    return { ...state, nodes, streaming: true, liveFrom };
  }
  const nodes = [...state.nodes, {
    kind: "user" as const,
    id: newId(),
    createdAt,
    content,
    displayText,
    targetAgentCode,
  }];
  return { ...state, nodes, streaming: true, liveFrom: nodes.length };
}

function findLiveUserMessageIndex(nodes: ChatNode[], signature: string, targetAgentCode: string): number {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.kind !== "user") continue;
    if (contentSignature(node.content) !== signature) return -1;
    if (!targetAgentCode || !node.targetAgentCode || node.targetAgentCode === targetAgentCode) {
      return index;
    }
    return -1;
  }
  return -1;
}

export function finishChatTurn(state: ChatState): ChatState {
  return { ...state, streaming: false, liveFrom: null, pendingNested: prunePendingNested(state) };
}

export function disconnectChatTurn(state: ChatState): ChatState {
  if (!state.streaming) return state;
  const nodes = state.liveFrom === null ? state.nodes : state.nodes.slice(0, state.liveFrom);
  return { ...state, nodes, streaming: false, liveFrom: null, pendingNested: prunePendingNested({ ...state, nodes }) };
}

function chatReduce(state: ChatState, event: AgentContentEvent): ChatState {
  return applyContentEvent(state, event);
}

export function streamReduce(state: ChatState, event: AgentStreamEvent): ChatState {
  if (event.type === "done") return event.nested_call_id ? state : finishChatTurn(state);
  if (event.type === "run_state") return event.running ? startChatTurn(state) : finishChatTurn(state);
  if (stateHasContentEvent(state, event)) return state;
  return applyContentEvent(state, event);
}

export function chatReplay(events: readonly AgentContentEvent[]): ChatState {
  return finishChatTurn(events.reduce<ChatState>(chatReduce, initialChatState));
}

export function prependChatHistory(state: ChatState, events: readonly AgentContentEvent[]): ChatState {
  if (!events.length) return state;
  const prefix = chatReplay(events);
  if (!prefix.nodes.length) return state;
  return { ...state, nodes: mergeChatNodeBoundary(prefix.nodes, state.nodes) };
}

function mergeChatNodeBoundary(prefix: ChatNode[], suffix: ChatNode[]): ChatNode[] {
  if (!prefix.length) return suffix;
  if (!suffix.length) return prefix;
  const lastPrefix = prefix[prefix.length - 1];
  const firstSuffix = suffix[0];
  if (lastPrefix.kind !== "agent" || firstSuffix.kind !== "agent") {
    return [...prefix, ...suffix];
  }
  return [
    ...prefix.slice(0, -1),
    {
      ...firstSuffix,
      createdAt: lastPrefix.createdAt || firstSuffix.createdAt,
      agentName: firstSuffix.agentName || lastPrefix.agentName,
      blocks: [...lastPrefix.blocks, ...firstSuffix.blocks],
    },
    ...suffix.slice(1),
  ];
}

function startChatTurn(state: ChatState): ChatState {
  if (state.streaming && state.liveFrom !== null) return state;
  const tailIndex = state.nodes.length - 1;
  const tail = state.nodes[tailIndex];
  return { ...state, streaming: true, liveFrom: tail?.kind === "agent" ? tailIndex : state.nodes.length };
}

function applyContentEvent(state: ChatState, event: AgentContentEvent): ChatState {
  if (event.type === "user_message") {
    return appendUserMessage(state, event.content, event.display_text, event.target_agent_code, event.created_at);
  }
  if (event.type === "turn_boundary") {
    return event.nested_call_id ? state : finishChatTurn(state);
  }
  const nestedCallId = "nested_call_id" in event ? event.nested_call_id : "";
  return nestedCallId ? routeToNested(state, event, nestedCallId) : routeToTopLevel(state, event);
}

function routeToTopLevel(state: ChatState, event: AgentContentEvent): ChatState {
  const nodes = state.nodes.slice();
  const lastIndex = nodes.length - 1;
  const lastNode = nodes[lastIndex];
  let agent: AgentNode;
  if (isWritableAgentTail(state, lastNode, lastIndex)) {
    agent = cloneAgentNode(lastNode);
    if (!agent.createdAt) agent.createdAt = event.created_at;
    nodes[lastIndex] = agent;
  } else {
    const existingIndex = state.streaming ? findLiveAgentForEvent(nodes, state.liveFrom, event) : -1;
    if (existingIndex !== -1) {
      agent = cloneAgentNode(nodes[existingIndex] as AgentNode);
      if (!agent.createdAt) agent.createdAt = event.created_at;
      nodes[existingIndex] = agent;
    } else {
      agent = createAgentNode(event.created_at);
      nodes.push(agent);
    }
  }

  const finished = applyEventToTranscript(agent, event);
  const liveFrom = state.liveFrom ?? nodes.length - 1;
  const nextState = finished
    ? finishChatTurn({ ...state, nodes, liveFrom })
    : { ...state, nodes, streaming: true, liveFrom };
  if (event.type === "tool_call" || event.type === "tool_result") {
    return drainPendingNested(nextState, event.call_id);
  }
  if (event.type === "error") return clearPendingNested(nextState);
  return nextState;
}

function isWritableAgentTail(state: ChatState, node: ChatNode | undefined, index: number): node is AgentNode {
  return node?.kind === "agent" && state.streaming && state.liveFrom !== null && index >= state.liveFrom;
}

function findLiveAgentForEvent(nodes: ChatNode[], liveFrom: number | null, event: AgentContentEvent): number {
  const start = liveFrom ?? 0;
  for (let index = nodes.length - 1; index >= start; index -= 1) {
    const node = nodes[index];
    if (node.kind !== "agent") continue;
    if (transcriptHasEvent(node, event)) return index;
  }
  return -1;
}

function routeToNested(state: ChatState, event: AgentContentEvent, nestedCallId: string): ChatState {
  const routed = routeToNestedNow(state, event, nestedCallId);
  if (routed) return routed;
  const queued = state.pendingNested[nestedCallId] ?? [];
  return { ...state, pendingNested: { ...state.pendingNested, [nestedCallId]: [...queued, event] } };
}

function routeToNestedNow(state: ChatState, event: AgentContentEvent, nestedCallId: string): ChatState | null {
  if (event.type === "subagent_task") {
    return updateNestedTool(state, nestedCallId, (tool) => {
      tool.subagentTask = subagentExecutionItemFromEvent(event);
    });
  }
  return updateNestedTool(state, nestedCallId, (tool) => {
    const nested = tool.nested ? cloneTranscript(tool.nested) : createTranscript(event.created_at);
    if (!nested.createdAt) nested.createdAt = event.created_at;
    applyEventToTranscript(nested, event);
    tool.nested = nested;
  });
}

function updateNestedTool(state: ChatState, callId: string, update: (tool: ToolExecutionItem) => void): ChatState | null {
  const nodes = state.nodes.slice();
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (node.kind !== "agent") continue;
    const blockIndex = findToolBlockIndex(node.blocks, callId);
    if (blockIndex === -1) continue;

    const agent = cloneAgentNode(node);
    const tool = { ...(agent.blocks[blockIndex] as ToolExecutionItem) };
    update(tool);
    agent.blocks[blockIndex] = tool;
    nodes[index] = agent;
    return { ...state, nodes };
  }
  return null;
}

function drainPendingNested(state: ChatState, callId: string): ChatState {
  const pending = state.pendingNested[callId];
  if (!pending?.length) return state;
  let nextState = state;
  const remaining: AgentContentEvent[] = [];
  for (const event of pending) {
    const routed = routeToNestedNow(nextState, event, callId);
    if (routed) nextState = routed;
    else remaining.push(event);
  }
  const pendingNested = { ...nextState.pendingNested };
  if (remaining.length) pendingNested[callId] = remaining;
  else delete pendingNested[callId];
  return { ...nextState, pendingNested };
}

function clearPendingNested(state: ChatState): ChatState {
  return Object.keys(state.pendingNested).length ? { ...state, pendingNested: {} } : state;
}

function prunePendingNested(state: ChatState): ChatState["pendingNested"] {
  if (!Object.keys(state.pendingNested).length) return state.pendingNested;
  const pendingNested: ChatState["pendingNested"] = {};
  for (const [callId, events] of Object.entries(state.pendingNested)) {
    if (!hasToolCall(state.nodes, callId)) pendingNested[callId] = events;
  }
  return pendingNested;
}

function stateHasContentEvent(state: ChatState, event: AgentContentEvent): boolean {
  if (event.type === "user_message") {
    const signature = contentSignature(event.content);
    return findLiveUserMessageIndex(state.nodes, signature, event.target_agent_code) !== -1;
  }
  const nestedCallId = "nested_call_id" in event ? event.nested_call_id : "";
  if (nestedCallId) return stateHasNestedEvent(state, nestedCallId, event);
  return liveNodes(state).some((node) => node.kind === "agent" && transcriptHasEvent(node, event));
}

function stateHasNestedEvent(state: ChatState, callId: string, event: AgentContentEvent): boolean {
  return liveNodes(state).some((node) => {
    if (node.kind !== "agent") return false;
    const toolIndex = findToolBlockIndex(node.blocks, callId);
    if (toolIndex === -1) return false;
    const tool = node.blocks[toolIndex] as ToolExecutionItem;
    if (event.type === "subagent_task") {
      return Boolean(
        tool.subagentTask?.runId === event.run_id
        && tool.subagentTask.status === event.status
        && tool.subagentTask.progress === event.progress
        && tool.subagentTask.result === event.result
        && tool.subagentTask.error === event.error,
      );
    }
    return Boolean(tool.nested && transcriptHasEvent(tool.nested, event));
  });
}

function liveNodes(state: ChatState): ChatNode[] {
  if (!state.streaming || state.liveFrom === null) return [];
  return state.nodes.slice(state.liveFrom);
}

function createAgentNode(createdAt: AgentContentEvent["created_at"]): AgentNode {
  return { kind: "agent", id: newId(), ...createTranscript(createdAt) };
}

function cloneAgentNode(node: AgentNode): AgentNode {
  return { ...node, ...cloneTranscript(node) };
}
