import axios, { AxiosError } from "axios";
import { clearTokens, getAccess, setTokens } from "./session";

export type ApiErrorBody = { error_code: string; message_key: string };

export const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiMessageKey(error: unknown): string {
  const body = (error as AxiosError<ApiErrorBody>).response?.data;
  if (body?.message_key) return body.message_key;
  return "error.generic";
}

export async function login(employee_no: string, password: string) {
  const { data } = await api.post("/auth/login", { employee_no, password });
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
