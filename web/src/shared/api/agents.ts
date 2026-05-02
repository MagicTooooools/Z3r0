import { apiRequest } from "./client";
import type { ListAgentsResponse } from "./types";

const AGENTS_PATH = "/api/agents";

export function listAgents() {
  return apiRequest<ListAgentsResponse>(AGENTS_PATH);
}
