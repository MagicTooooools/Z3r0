import { apiRequest } from "./client";
import { buildQuery } from "./query";
import type {
  CancelWorkProjectPathParams,
  CancelWorkProjectResponse,
  CreateWorkProjectRequest,
  CreateWorkProjectResponse,
  CreateWorkProjectSessionResponse,
  DeleteWorkProjectSessionResponse,
  DeleteWorkProjectResponse,
  GetWorkProjectResponse,
  ListWorkProjectSessionsResponse,
  QueryWorkProjectsParams,
  QueryWorkProjectsResponse,
  RetryWorkProjectPathParams,
  RetryWorkProjectResponse,
  UpdateWorkProjectMetadataRequest,
  UpdateWorkProjectMetadataResponse,
  WorkProjectPathParams,
} from "./types";

const WORK_PROJECTS_PATH = "/api/work-projects";

export function queryWorkProjects(params: QueryWorkProjectsParams) {
  return apiRequest<QueryWorkProjectsResponse>(`${WORK_PROJECTS_PATH}${buildQuery(params)}`);
}

export function createWorkProject(payload: CreateWorkProjectRequest) {
  return apiRequest<CreateWorkProjectResponse>(WORK_PROJECTS_PATH, {
    method: "POST",
    body: payload,
  });
}

export function getWorkProject(id: WorkProjectPathParams["id"]) {
  return apiRequest<GetWorkProjectResponse>(`${WORK_PROJECTS_PATH}/${id}`);
}

export function updateWorkProjectMetadata(id: WorkProjectPathParams["id"], payload: UpdateWorkProjectMetadataRequest) {
  return apiRequest<UpdateWorkProjectMetadataResponse>(`${WORK_PROJECTS_PATH}/${id}/metadata`, {
    method: "PATCH",
    body: payload,
  });
}

export function listWorkProjectSessions(id: WorkProjectPathParams["id"]) {
  return apiRequest<ListWorkProjectSessionsResponse>(`${WORK_PROJECTS_PATH}/${id}/sessions`);
}

export function createWorkProjectSession(id: WorkProjectPathParams["id"]) {
  return apiRequest<CreateWorkProjectSessionResponse>(`${WORK_PROJECTS_PATH}/${id}/sessions`, {
    method: "POST",
  });
}

export function deleteWorkProjectSession(id: WorkProjectPathParams["id"], sessionId: string) {
  return apiRequest<DeleteWorkProjectSessionResponse>(
    `${WORK_PROJECTS_PATH}/${id}/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

export function cancelWorkProject(id: CancelWorkProjectPathParams["id"]) {
  return apiRequest<CancelWorkProjectResponse>(`${WORK_PROJECTS_PATH}/${id}/cancel`, {
    method: "POST",
  });
}

export function retryWorkProject(id: RetryWorkProjectPathParams["id"]) {
  return apiRequest<RetryWorkProjectResponse>(`${WORK_PROJECTS_PATH}/${id}/retry`, {
    method: "POST",
  });
}

export function deleteWorkProject(id: WorkProjectPathParams["id"]) {
  return apiRequest<DeleteWorkProjectResponse>(`${WORK_PROJECTS_PATH}/${id}`, {
    method: "DELETE",
  });
}
