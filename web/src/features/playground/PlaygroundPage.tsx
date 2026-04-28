import { Button, Spin } from "@douyinfe/semi-ui";
import { Activity, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAdminHeaderActions } from "../../app/layouts/AdminLayout";
import { showApiError } from "../../shared/api/feedback";
import { useAgentSessionContext } from "./AgentSessionProvider";
import { ChatStream } from "./ChatStream";
import { Composer } from "./Composer";

type PlaygroundLocationState = { sessionId?: string };

const STATUS_LABEL: Record<string, string> = {
  open: "Live",
  connecting: "Connecting",
  closed: "Disconnected",
  idle: "Idle",
};

export function PlaygroundPage() {
  const setHeaderActions = useAdminHeaderActions();
  const {
    activeSessionId, selectSession,
    chatState, status, historyLoading,
    send, interrupt,
  } = useAgentSessionContext();
  const location = useLocation();
  const navigate = useNavigate();

  // consume sessionId from navigate state (e.g. project "Go") then clear so
  // back-navigation does not retrigger the jump
  useEffect(() => {
    const incoming = (location.state as PlaygroundLocationState | null)?.sessionId;
    if (incoming) {
      selectSession(incoming);
      navigate(location.pathname, { replace: true });
    }
  }, [location.pathname, location.state, navigate, selectSession]);

  const headerNode = useMemo(() => (
    <>
      <Button icon={<Plus size={16} />} theme="solid" type="primary" onClick={() => selectSession(null)}>
        New chat
      </Button>
      <span className={`stream-status stream-status-${status}`}>
        <Activity size={14} />
        <span>{STATUS_LABEL[status] ?? "Idle"}</span>
      </span>
    </>
  ), [selectSession, status]);

  useEffect(() => {
    setHeaderActions(headerNode);
    return () => setHeaderActions(null);
  }, [headerNode, setHeaderActions]);

  const handleSend = async (text: string) => {
    try {
      await send(text);
    } catch (error) {
      showApiError(error);
    }
  };

  return (
    <div className="playground-shell">
      <div className="playground-main">
        <div className="playground-canvas">
          <Spin spinning={historyLoading} wrapperClassName="playground-spin">
            <ChatStream nodes={chatState.nodes} streaming={chatState.streaming} />
          </Spin>
        </div>
        <div className="playground-composer">
          <Composer
            streaming={chatState.streaming}
            disabled={historyLoading}
            onSend={(text) => void handleSend(text)}
            onInterrupt={() => void interrupt()}
          />
        </div>
      </div>
    </div>
  );
}
