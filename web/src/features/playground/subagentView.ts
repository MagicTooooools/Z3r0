import type {
  AgentTranscript,
  ChatNode,
  NestedTranscript,
  SubagentExecutionItem,
} from "./playgroundReducer";

export type SubagentSelection = { kind: "agent"; agentCode: string };

export type SubagentTab = {
  selection: SubagentSelection;
  runId: string;
  agentCode: string;
  status: SubagentExecutionItem["status"];
};

export type SubagentTarget =
  | { kind: "task"; item: SubagentExecutionItem; live: boolean }
  | { kind: "transcript"; transcript: NestedTranscript; task: SubagentExecutionItem; live: boolean };

export function collectSubagentTabs(transcript: AgentTranscript | null): SubagentTab[] {
  const byAgentCode = new Map<string, SubagentTab>();
  if (!transcript) return [];

  for (const item of transcript.executionItems) {
    const task = item.kind === "subagent" ? item : item.subagentTask;
    if (!task?.agentCode) continue;
    byAgentCode.set(task.agentCode, {
      selection: { kind: "agent", agentCode: task.agentCode },
      runId: task.runId,
      agentCode: task.agentCode,
      status: task.status,
    });
  }
  return Array.from(byAgentCode.values());
}

export function currentAgentTranscript(nodes: ChatNode[]): { id: string; transcript: AgentTranscript; live: boolean } | null {
  const last = nodes[nodes.length - 1];
  if (last?.kind !== "agent") return null;
  return { id: last.id, transcript: last, live: true };
}

export function findSubagentTarget(nodes: ChatNode[], streaming: boolean, selection: SubagentSelection): SubagentTarget | null {
  const current = currentAgentTranscript(nodes);
  return current ? findSubagentTargetInTranscript(current.transcript, streaming && current.live, selection) : null;
}

export function isSelectedSubagent(current: SubagentSelection | null | undefined, next: SubagentSelection) {
  return Boolean(current && current.kind === next.kind && current.agentCode === next.agentCode);
}

export function subagentStatusColor(status: SubagentExecutionItem["status"]): "red" | "green" | "amber" {
  if (status === "failed" || status === "canceled") return "red";
  return status === "completed" ? "green" : "amber";
}

export function subordinateStatusLabel(status: SubagentExecutionItem["status"]) {
  switch (status) {
    case "running":
      return "Running";
    case "completed":
      return "Completed";
    case "canceled":
      return "Canceled";
    case "failed":
      return "Failed";
  }
}

function findSubagentTargetInTranscript(
  transcript: AgentTranscript,
  live: boolean,
  selection: SubagentSelection,
): SubagentTarget | null {
  for (let i = transcript.executionItems.length - 1; i >= 0; i -= 1) {
    const item = transcript.executionItems[i];
    if (item.kind === "subagent") {
      if (item.agentCode === selection.agentCode) return { kind: "task", item, live };
      continue;
    }

    if (item.subagentTask?.agentCode === selection.agentCode) {
      if (item.nested) return { kind: "transcript", transcript: item.nested, task: item.subagentTask, live };
      return { kind: "task", item: item.subagentTask, live };
    }
  }
  return null;
}
