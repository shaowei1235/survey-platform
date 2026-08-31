import axios, { AxiosError } from "axios";
import { clearTokens, getAccess, setTokens } from "./session";

export type ApiErrorBody = { error_code: string; message_key: string };

let reauthInFlight = false;
let reauthHandler: (() => void) | null = null;

export function isReauthRedirecting(): boolean {
  return reauthInFlight;
}

export function notifyReauthRequired() {
  if (reauthInFlight) return;
  if (window.location.pathname.endsWith("/login")) return;
  reauthInFlight = true;
  reauthHandler?.();
}

export function onReauthRequired(handler: () => void) {
  reauthHandler = handler;
  return () => {
    if (reauthHandler === handler) reauthHandler = null;
  };
}

function isLoginRequest(url: string | undefined) {
  return typeof url === "string" && url.includes("/auth/login");
}

function isUnauthenticatedError(error: AxiosError<ApiErrorBody>) {
  const status = error.response?.status;
  const key = error.response?.data?.message_key;
  return key === "error.unauthenticated" || (status === 401 && !key);
}

const apiBase = `${import.meta.env.BASE_URL}api/v1`.replace(/\/{2,}/g, "/");

export const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    if (!isLoginRequest(error.config?.url) && isUnauthenticatedError(error)) {
      notifyReauthRequired();
    }
    return Promise.reject(error);
  },
);

export function apiMessageKey(error: unknown): string {
  if (isReauthRedirecting()) return "error.unauthenticated";
  const body = (error as AxiosError<ApiErrorBody>).response?.data;
  if (body?.message_key) return body.message_key;
  return "error.generic";
}

export type SseHandlers = {
  onEvidence: (data: Record<string, unknown>) => void;
  onDelta: (text: string) => void;
  onDone: (data: Record<string, unknown>) => void;
  onError: (data: ApiErrorBody) => void;
};

function dispatchSseBlock(block: string, handlers: SseHandlers) {
  let event = "message";
  let payload = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) payload += line.slice(5).trim();
  }
  if (!payload) return;
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return;
  }
  if (event === "evidence") handlers.onEvidence(data);
  else if (event === "delta") handlers.onDelta(typeof data.text === "string" ? data.text : "");
  else if (event === "done") handlers.onDone(data);
  else if (event === "error") {
    handlers.onError({
      error_code: typeof data.error_code === "string" ? data.error_code : "AI_UPSTREAM_FAILED",
      message_key: typeof data.message_key === "string" ? data.message_key : "error.generic",
    });
  }
}

export async function streamAnalytics(path: string, body: object, handlers: SseHandlers, signal?: AbortSignal) {
  const token = getAccess();
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    let data: ApiErrorBody | undefined;
    try {
      data = (await res.json()) as ApiErrorBody;
    } catch {
      data = undefined;
    }
    if (res.status === 401 || data?.message_key === "error.unauthenticated") {
      notifyReauthRequired();
    }
    throw { response: { data } };
  }
  if (!res.body) {
    throw { response: { data: { error_code: "AI_UPSTREAM_FAILED", message_key: "error.ai_upstream" } } };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminal = false;
  const wrapped: SseHandlers = {
    onEvidence: handlers.onEvidence,
    onDelta: handlers.onDelta,
    onDone: (data) => {
      sawTerminal = true;
      handlers.onDone(data);
    },
    onError: (data) => {
      sawTerminal = true;
      if (data.message_key === "error.unauthenticated") notifyReauthRequired();
      handlers.onError(data);
    },
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let sep = buffer.indexOf("\n\n");
    while (sep >= 0) {
      dispatchSseBlock(buffer.slice(0, sep), wrapped);
      buffer = buffer.slice(sep + 2);
      sep = buffer.indexOf("\n\n");
    }
  }
  if (buffer.trim()) dispatchSseBlock(buffer, wrapped);
  if (!sawTerminal) {
    throw { response: { data: { error_code: "AI_UPSTREAM_FAILED", message_key: "error.ai_upstream" } } };
  }
}

export async function login(employee_no: string, password: string) {
  const { data } = await api.post("/auth/login", { employee_no, password });
  reauthInFlight = false;
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function fetchMe() {
  const { data } = await api.get("/me");
  return data;
}

export function logout() {
  clearTokens();
}
