import { clearTokens, getAccess, setTokens } from "./session";
import { t } from "./i18n";

export type ApiErrorBody = { error_code: string; message_key: string };

const BASE = (process.env.NEXT_PUBLIC_API_BASE?.trim() || "/api/v1").replace(/\/+$/, "");

let reauthInFlight = false;

export function consumeUnauthenticated(
  error: unknown,
  handlers: { error: (text: string) => void; replace: (path: string) => void },
): boolean {
  if (apiMessageKey(error) !== "error.unauthenticated") return false;
  if (reauthInFlight) return true;
  reauthInFlight = true;
  handlers.error(t("error.unauthenticated"));
  window.setTimeout(() => {
    clearTokens();
    handlers.replace("/login");
  }, 1000);
  return true;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const token = getAccess();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let body: ApiErrorBody = { error_code: "ERROR", message_key: "error.generic" };
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* ignore */
    }
    const err = new Error(body.message_key) as Error & ApiErrorBody;
    err.error_code = body.error_code;
    err.message_key = body.message_key || "error.generic";
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiMessageKey(error: unknown): string {
  if (error && typeof error === "object" && "message_key" in error) {
    return String((error as ApiErrorBody).message_key);
  }
  return "error.generic";
}

export async function login(employee_no: string, password: string) {
  const data = await request<{ access_token: string; refresh_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ employee_no, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  reauthInFlight = false;
  return data;
}

export async function fetchMe() {
  return request<import("./session").Me>("/me");
}

export function logout() {
  clearTokens();
}

export type ComponentItem = { fe_id: string; type: string; props: Record<string, unknown> };

export async function listSurveys() {
  return request<{ items: { id: string; title: string }[] }>("/client/surveys");
}

export async function getSurvey(id: string) {
  return request<{ id: string; title: string; status: string; component_list: ComponentItem[] }>(
    `/client/surveys/${id}`,
  );
}

export async function submitSurvey(
  id: string,
  answers: { fe_id: string; type: string; value: unknown }[],
) {
  return request<{ id: string }>(`/client/surveys/${id}/responses`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}
