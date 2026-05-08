import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatState } from "./playgroundReducer";
import {
  collectSubagentTabs,
  type SubagentSelection,
} from "./subagentView";

export function useSubagentPanel(chatState: ChatState, scopeKey: string | null) {
  const [selectedSubagent, setSelectedSubagent] = useState<SubagentSelection | null>(null);
  const knownRunsRef = useRef<Set<string>>(new Set());

  const tabs = useMemo(() => collectSubagentTabs(chatState.nodes), [chatState.nodes]);

  useEffect(() => {
    knownRunsRef.current = new Set();
    setSelectedSubagent(null);
  }, [scopeKey]);

  useEffect(() => {
    const knownRuns = knownRunsRef.current;
    let newest: SubagentSelection | null = null;

    for (const tab of tabs) {
      for (const runId of tab.runIds) {
        if (knownRuns.has(runId)) continue;
        knownRuns.add(runId);
        newest = tab.selection;
      }
    }

    if (chatState.streaming && newest) {
      setSelectedSubagent(newest);
    }
    if (selectedSubagent && !tabs.some((tab) => tab.agentCode === selectedSubagent.agentCode)) {
      setSelectedSubagent(tabs[tabs.length - 1]?.selection ?? null);
    }
  }, [chatState.streaming, selectedSubagent, tabs]);

  return {
    selectedSubagent,
    setSelectedSubagent,
    subagentTabs: tabs,
    closeSubagentPanel: () => setSelectedSubagent(null),
  };
}
