import { apiDelete, apiGet, apiPost } from "./client";
import { buildQuery } from "./query";
import type {
  CancelSandboxImagePathParams,
  CancelSandboxImageResponse,
  CreateSandboxImageRequest,
  CreateSandboxImageResponse,
  DeleteSandboxImageResponse,
  QuerySandboxImagesParams,
  QuerySandboxImagesResponse,
  RetrySandboxImagePathParams,
  RetrySandboxImageResponse,
  SandboxImagePathParams,
} from "./types";

const SANDBOX_IMAGES_PATH = "/api/sandbox-images";

export function querySandboxImages(params: QuerySandboxImagesParams) {
  return apiGet<QuerySandboxImagesResponse>(`${SANDBOX_IMAGES_PATH}${buildQuery(params)}`);
}

export function createSandboxImage(payload: CreateSandboxImageRequest) {
  return apiPost<CreateSandboxImageResponse>(SANDBOX_IMAGES_PATH, payload);
}

export function cancelSandboxImage(id: CancelSandboxImagePathParams["id"]) {
  return apiPost<CancelSandboxImageResponse>(`${SANDBOX_IMAGES_PATH}/${id}/cancel`);
}

export function retrySandboxImage(id: RetrySandboxImagePathParams["id"]) {
  return apiPost<RetrySandboxImageResponse>(`${SANDBOX_IMAGES_PATH}/${id}/retry`);
}

export function deleteSandboxImage(id: SandboxImagePathParams["id"]) {
  return apiDelete<DeleteSandboxImageResponse>(`${SANDBOX_IMAGES_PATH}/${id}`);
}
