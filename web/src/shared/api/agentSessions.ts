import { apiDelete, apiGet, apiPatch, apiPost, buildAuthenticatedWebSocketUrl } from "./client";
import type {
  CreateAgentSessionResponse,
  DeleteAgentSessionResponse,
  ListAgentEventsResponse,
  ListAgentSessionsResponse,
  UpdateAgentSessionTitleRequest,
  UpdateAgentSessionTitleResponse,
} from "./types";

const AGENT_SESSIONS_PATH = "/api/agent-sessions";

export function listAgentSessions(limit = 100) {
  return apiGet<ListAgentSessionsResponse>(`${AGENT_SESSIONS_PATH}?limit=${limit}`);
}

export function createAgentSession() {
  return apiPost<CreateAgentSessionResponse>(AGENT_SESSIONS_PATH);
}

export function listAgentEvents(sessionId: string) {
  return apiGet<ListAgentEventsResponse>(
    `${AGENT_SESSIONS_PATH}/${encodeURIComponent(sessionId)}/events`,
  );
}

export function updateAgentSessionTitle(sessionId: string, payload: UpdateAgentSessionTitleRequest) {
  return apiPatch<UpdateAgentSessionTitleResponse>(
    `${AGENT_SESSIONS_PATH}/${encodeURIComponent(sessionId)}/title`,
    payload,
  );
}

export function deleteAgentSession(sessionId: string) {
  return apiDelete<DeleteAgentSessionResponse>(
    `${AGENT_SESSIONS_PATH}/${encodeURIComponent(sessionId)}`,
  );
}

export function buildAgentStreamUrl(sessionId: string, token: string) {
  return buildAuthenticatedWebSocketUrl(`${AGENT_SESSIONS_PATH}/${encodeURIComponent(sessionId)}/stream`, token);
}
