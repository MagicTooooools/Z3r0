import { Button, Popconfirm, Spin } from "@douyinfe/semi-ui";
import { FolderKanban, MessageCircle, Trash2 } from "lucide-react";
import type { AgentInfo, AgentSessionSummary, SessionType } from "../../shared/api/types";
import { formatDateTime } from "../../shared/lib/date";

type SessionListProps = {
  sessions: AgentSessionSummary[];
  agents: AgentInfo[];
  loading: boolean;
  activeSessionId: string | null;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
};

const SESSION_ICON: Record<SessionType, typeof MessageCircle> = {
  chat: MessageCircle,
  project: FolderKanban,
};

export function SessionList({ sessions, agents, loading, activeSessionId, onSelect, onDelete }: SessionListProps) {
  const agentNameByCode = new Map(agents.map((agent) => [agent.code, agent.name]));
  return (
    <div className="session-list">
      <div className="session-list-body">
        <Spin spinning={loading} wrapperClassName="session-list-spin">
          {sessions.length === 0 && !loading ? (
            <div className="session-empty">
              <MessageCircle size={28} />
              <p>No conversations yet.</p>
            </div>
          ) : (
            sessions.map((session) => {
              const Icon = SESSION_ICON[session.session_type] ?? MessageCircle;
              const active = session.session_id === activeSessionId;
              return (
                <div
                  key={session.session_id}
                  className={`session-row session-row-${session.session_type}${active ? " session-row-active" : ""}`}
                >
                  <button type="button" className="session-row-main" onClick={() => onSelect(session.session_id)}>
                    <span className="session-row-icon"><Icon size={14} /></span>
                    <span className="session-row-body">
                      <span className="session-row-title">{session.title || "Untitled session"}</span>
                      <span className="session-row-meta">
                        {session.agent_code ? (
                          <span className="session-row-agent">@{agentNameByCode.get(session.agent_code) ?? session.agent_code}</span>
                        ) : null}
                        <span>{session.message_count} messages</span>
                        <span>· {formatDateTime(session.updated_at)}</span>
                      </span>
                    </span>
                  </button>
                  <Popconfirm
                    title="Delete chat"
                    content="Permanently delete this conversation?"
                    okType="danger"
                    onConfirm={() => onDelete(session.session_id)}
                  >
                    <Button
                      icon={<Trash2 size={14} />}
                      theme="borderless"
                      type="danger"
                      size="small"
                      aria-label={`Delete ${session.title || session.session_id}`}
                    />
                  </Popconfirm>
                </div>
              );
            })
          )}
        </Spin>
      </div>
    </div>
  );
}
