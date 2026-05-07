import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatState } from "./playgroundReducer";
import {
  collectSubagentTabs,
  currentAgentTranscript,
  type SubagentSelection,
} from "./subagentView";

export function useSubagentPanel(chatState: ChatState, scopeKey: string | null) {
  const [selectedSubagent, setSelectedSubagent] = useState<SubagentSelection | null>(null);
  const knownRunsRef = useRef<Map<string, string>>(new Map());

  const currentAgent = useMemo(() => currentAgentTranscript(chatState.nodes), [chatState.nodes]);
  const tabs = useMemo(() => collectSubagentTabs(currentAgent?.transcript ?? null), [currentAgent?.transcript]);

  useEffect(() => {
    knownRunsRef.current = new Map();
    setSelectedSubagent(null);
  }, [currentAgent?.id, scopeKey]);

  useEffect(() => {
    const knownRuns = knownRunsRef.current;
    let newest: SubagentSelection | null = null;

    for (const tab of tabs) {
      if (knownRuns.get(tab.agentCode) === tab.runId) continue;
      knownRuns.set(tab.agentCode, tab.runId);
      newest = tab.selection;
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
