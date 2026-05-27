import { clearStoredAccessToken, getStoredAccessToken } from "../auth/session";
import type { CommonResponsePayload } from "./types";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
};

type RawRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  headers?: HeadersInit;
  body?: BodyInit;
  auth?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly response?: CommonResponsePayload;

  constructor(status: number, response?: CommonResponsePayload) {
    super(response?.message || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.response = response;
  }
}

export function isCommonResponsePayload(value: unknown): value is CommonResponsePayload {
  return typeof value === "object" && value !== null && "message" in value;
}

export async function parseJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }
  return response.json() as Promise<unknown>;
}

export async function apiRequest<ResponsePayload>(path: string, options: RequestOptions = {}) {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  addAuthHeader(headers, options.auth);

  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new ApiError(0, {
      code: 0,
      message: error instanceof Error ? error.message : "Network request failed",
    });
  }

  const parsed = await parseJsonResponse(response);
  const payload = isCommonResponsePayload(parsed) ? parsed : undefined;
  const payloadCode = typeof payload?.code === "number" ? payload.code : response.status;

  if (!response.ok || payloadCode >= 400) {
    handleAuthExpired(response.status, payloadCode);
    throw new ApiError(response.status, payload);
  }

  return parsed as ResponsePayload;
}

export function apiGet<ResponsePayload>(path: string) {
  return apiRequest<ResponsePayload>(path);
}

export function apiPost<ResponsePayload>(path: string, body?: unknown, auth?: boolean) {
  return apiRequest<ResponsePayload>(path, { method: "POST", body, auth });
}

export function apiPatch<ResponsePayload>(path: string, body: unknown) {
  return apiRequest<ResponsePayload>(path, { method: "PATCH", body });
}

export function apiDelete<ResponsePayload>(path: string) {
  return apiRequest<ResponsePayload>(path, { method: "DELETE" });
}

export async function rawApiRequest(path: string, options: RawRequestOptions = {}) {
  const headers = new Headers(options.headers);
  addAuthHeader(headers, options.auth);

  try {
    return await fetch(path, {
      method: options.method || "GET",
      headers,
      body: options.body,
    });
  } catch (error) {
    throw new ApiError(0, {
      code: 0,
      message: error instanceof Error ? error.message : "Network request failed",
    });
  }
}

export function handleAuthExpired(status: number, payloadCode: number) {
  if (status !== 401 && payloadCode !== 401) return;
  clearStoredAccessToken();
  window.dispatchEvent(new Event("z3r0:auth-expired"));
}

export function buildAuthenticatedWebSocketUrl(path: string, token = getStoredAccessToken()) {
  if (!token) throw new Error("missing access token");
  const wsScheme = window.location.protocol === "https:" ? "wss" : "ws";
  return `${wsScheme}://${window.location.host}${path}?token=${encodeURIComponent(token)}`;
}

function addAuthHeader(headers: Headers, auth = true) {
  if (!auth) return;
  const token = getStoredAccessToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
}
