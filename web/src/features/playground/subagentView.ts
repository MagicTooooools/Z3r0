import type { ChatNode, NestedTranscript, SubagentExecutionItem } from "./playgroundReducer";

export type SubagentTab = {
  selection: SubagentSelection;
  agentCode: string;
  status: SubagentExecutionItem["status"];
  runIds: string[];
};

export type SubagentSelection = { kind: "agent"; agentCode: string };

export type SubagentRunTarget = {
  task: SubagentExecutionItem;
  transcript?: NestedTranscript;
  live: boolean;
};

export type SubagentTarget = {
  kind: "agent";
  agentCode: string;
  runs: SubagentRunTarget[];
  live: boolean;
};

export function collectSubagentTabs(nodes: ChatNode[]): SubagentTab[] {
  const byAgentCode = new Map<string, SubagentTab>();
  const runIdsByAgentCode = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.kind !== "agent") continue;
    for (const item of node.executionItems) {
      const task = item.kind === "subagent" ? item : item.subagentTask;
      if (!task?.agentCode || !task.runId) continue;
      let runIds = runIdsByAgentCode.get(task.agentCode);
      if (!runIds) {
        runIds = new Set();
        runIdsByAgentCode.set(task.agentCode, runIds);
      }
      runIds.add(task.runId);

      const current = byAgentCode.get(task.agentCode);
      byAgentCode.set(task.agentCode, {
        selection: { kind: "agent", agentCode: task.agentCode },
        agentCode: task.agentCode,
        status: mergeSubagentStatus(current?.status, task.status),
        runIds: Array.from(runIds),
      });
    }
  }
  return Array.from(byAgentCode.values());
}

export function findSubagentTarget(nodes: ChatNode[], streaming: boolean, selection: SubagentSelection): SubagentTarget | null {
  const runs = new Map<string, SubagentRunTarget>();
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.kind !== "agent") continue;
    for (let j = node.executionItems.length - 1; j >= 0; j -= 1) {
      const item = node.executionItems[j];
      const task = item.kind === "subagent" ? item : item.subagentTask;
      if (!task?.runId || task.agentCode !== selection.agentCode || runs.has(task.runId)) continue;
      runs.set(task.runId, {
        task,
        transcript: item.kind === "tool" ? item.nested : undefined,
        live: task.status === "running",
      });
    }
  }
  const orderedRuns = Array.from(runs.values()).reverse();
  if (!orderedRuns.length) return null;
  return {
    kind: "agent",
    agentCode: selection.agentCode,
    runs: orderedRuns,
    live: orderedRuns.some((run) => run.live),
  };
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

function mergeSubagentStatus(
  current: SubagentExecutionItem["status"] | undefined,
  next: SubagentExecutionItem["status"],
): SubagentExecutionItem["status"] {
  if (current === "running" || next === "running") return "running";
  return next;
}
