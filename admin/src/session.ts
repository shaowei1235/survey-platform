export type RoleCode = "system_admin" | "hr_planner" | "executive" | "dept_manager" | "employee";

export type Me = {
  id: string;
  employee_no: string;
  display_name: string;
  company_id: string;
  department_id: string;
  job_grade_id: string;
  generation: string;
  roles: { role: RoleCode; department_id: string | null }[];
  scope_department_ids: string[];
};

export type ComponentItem = {
  fe_id: string;
  type: string;
  props: Record<string, unknown>;
};

const TOKEN_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

export function getAccess(): string | null {
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

export function roleSet(me: Me | null): Set<RoleCode> {
  return new Set(me?.roles.map((r) => r.role) ?? []);
}

export function isAdminRole(me: Me | null): boolean {
  const roles = roleSet(me);
  return (
    roles.has("system_admin") ||
    roles.has("hr_planner") ||
    roles.has("executive") ||
    roles.has("dept_manager")
  );
}

export function canWriteSurvey(me: Me | null) {
  return roleSet(me).has("hr_planner");
}

export function canWriteOrg(me: Me | null) {
  const roles = roleSet(me);
  return roles.has("hr_planner") || roles.has("system_admin");
}

export function canAnalyze(me: Me | null) {
  const roles = roleSet(me);
  return roles.has("hr_planner") || roles.has("executive") || roles.has("dept_manager");
}
