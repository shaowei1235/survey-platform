const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
  sessionStorage.setItem(TOKEN_KEY, access);
  sessionStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
}

export type Me = {
  id: string;
  employee_no: string;
  display_name: string;
  roles: { role: string; department_id: string | null }[];
};

export function hasEmployeeRole(me: Me): boolean {
  return me.roles.some((r) => r.role === "employee");
}
