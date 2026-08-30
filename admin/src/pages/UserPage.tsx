import { Button, Drawer, Form, Grid, Input, Modal, Select, Space, Table, Tag, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiMessageKey } from "../api";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar } from "../components/FilterBar";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { canWriteOrg, type Me } from "../session";

const GENERATIONS = ["20s", "30s", "40s", "50s", "60s_plus"] as const;
const ROLES = ["system_admin", "hr_planner", "executive", "dept_manager", "employee"] as const;
const EMPLOYEE_NO_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

type RoleRow = { role: string; department_id: string | null };
type UserRow = {
  id: string;
  employee_no: string;
  display_name: string;
  department_id: string;
  job_grade_id: string;
  generation: string;
  is_active: boolean;
  roles: RoleRow[];
};
type DeptOpt = { id: string; name: string; is_active: boolean };
type GradeOpt = { id: string; name: string };

type UserFormValues = {
  employee_no: string;
  display_name: string;
  password?: string;
  department_id: string;
  job_grade_id: string;
  generation: string;
  roles: string[];
  manager_department_id?: string;
};

function camel(role: string) {
  if (role === "system_admin") return "systemAdmin";
  if (role === "hr_planner") return "hrPlanner";
  if (role === "dept_manager") return "deptManager";
  return role;
}

function buildRoles(roleCodes: string[], departmentId: string, managerDepartmentId?: string): RoleRow[] {
  const managerDept = managerDepartmentId || departmentId;
  return roleCodes.map((role) => ({
    role,
    department_id: role === "dept_manager" ? managerDept : null,
  }));
}

export function UserPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [depts, setDepts] = useState<DeptOpt[]>([]);
  const [grades, setGrades] = useState<GradeOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [keyword, setKeyword] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [form] = Form.useForm<UserFormValues>();
  const writable = canWriteOrg(me);
  const watchedRoles = Form.useWatch("roles", form) ?? [];
  const showManagerDept = watchedRoles.includes("dept_manager");
  const drawerOpen = creating || editing != null;

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const [u, d, g] = await Promise.all([api.get("/users"), api.get("/departments"), api.get("/job-grades")]);
      setUsers(u.data.items);
      setDepts(d.data.items);
      setGrades(g.data.items);
      setLoadError(null);
    } catch (e) {
      setLoadError(apiMessageKey(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [t]);

  const deptName = useMemo(() => new Map(depts.map((d) => [d.id, d.name])), [depts]);
  const gradeName = useMemo(() => new Map(grades.map((g) => [g.id, g.name])), [grades]);

  const activeDepts = useMemo(() => depts.filter((d) => d.is_active), [depts]);

  const departmentOptions = useMemo(() => {
    const current = editing ? depts.find((d) => d.id === editing.department_id) : undefined;
    const list = current && !current.is_active ? [...activeDepts, current] : activeDepts;
    return list.map((d) => ({ value: d.id, label: d.name }));
  }, [activeDepts, depts, editing]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return users.filter((row) => {
      if (q) {
        const no = String(row.employee_no).toLowerCase();
        const name = String(row.display_name).toLowerCase();
        if (!no.includes(q) && !name.includes(q)) return false;
      }
      if (deptFilter && row.department_id !== deptFilter) return false;
      if (roleFilter && !row.roles.some((r) => r.role === roleFilter)) return false;
      return true;
    });
  }, [users, keyword, deptFilter, roleFilter]);

  const filtersActive = keyword.trim() !== "" || deptFilter !== "" || roleFilter !== "";

  const deptFilterOptions = useMemo(() => {
    const ids = new Set(users.map((u) => u.department_id));
    return depts.filter((d) => ids.has(d.id)).map((d) => ({ value: d.id, label: d.name }));
  }, [users, depts]);

  const roleFilterOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const u of users) {
      for (const r of u.roles) codes.add(r.role);
    }
    return [...codes].map((role) => ({ value: role, label: t(`role.${camel(role)}`) }));
  }, [users, t]);

  const closeDrawer = () => {
    setCreating(false);
    setEditing(null);
    form.resetFields();
  };

  const requestClose = () => {
    if (saving) return;
    if (!form.isFieldsTouched()) {
      closeDrawer();
      return;
    }
    Modal.confirm({
      title: t("survey.unsavedConfirm"),
      okText: t("editor.leave"),
      cancelText: t("common.cancel"),
      onOk: closeDrawer,
    });
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.resetFields();
  };

  const openEdit = (row: UserRow) => {
    setCreating(false);
    setEditing(row);
    const managerDept = row.roles.find((r) => r.role === "dept_manager")?.department_id ?? row.department_id;
    form.setFieldsValue({
      employee_no: row.employee_no,
      display_name: row.display_name,
      password: undefined,
      department_id: row.department_id,
      job_grade_id: row.job_grade_id,
      generation: row.generation,
      roles: row.roles.map((r) => r.role),
      manager_department_id: managerDept ?? undefined,
    });
  };

  const submit = async (values: UserFormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      const roles = buildRoles(values.roles, values.department_id, values.manager_department_id);
      if (editing) {
        const body: {
          display_name: string;
          department_id: string;
          job_grade_id: string;
          generation: string;
          roles: RoleRow[];
          password?: string;
        } = {
          display_name: values.display_name,
          department_id: values.department_id,
          job_grade_id: values.job_grade_id,
          generation: values.generation,
          roles,
        };
        const password = values.password?.trim();
        if (password) body.password = password;
        await api.patch(`/users/${editing.id}`, body);
      } else {
        await api.post("/users", {
          employee_no: values.employee_no,
          display_name: values.display_name,
          password: values.password,
          department_id: values.department_id,
          job_grade_id: values.job_grade_id,
          generation: values.generation,
          roles,
        });
      }
      closeDrawer();
      await load(true);
    } catch (e) {
      message.error(t(apiMessageKey(e)));
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setKeyword("");
    setDeptFilter("");
    setRoleFilter("");
  };

  const roleOptions = ROLES.map((role) => ({ value: role, label: t(`role.${camel(role)}`) }));

  return (
    <>
      <PageHeader
        title={t("org.userTitle")}
        description={t("org.userDescription")}
        extra={
          writable ? (
            <Button type="primary" onClick={openCreate}>
              {t("org.addUser")}
            </Button>
          ) : null
        }
      />
      {loadError ? (
        <ErrorState message={t(loadError)} onRetry={() => void load()} retryLabel={t("common.retry")} />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError ? (
        <>
          {users.length > 0 || filtersActive ? (
            <FilterBar
              extra={
                filtersActive ? (
                  <Button onClick={clearFilters}>{t("common.clearFilters")}</Button>
                ) : null
              }
            >
              <Input
                allowClear
                className="filter-control"
                placeholder={t("org.filter.keyword")}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Select
                className="filter-control-status"
                aria-label={t("org.filter.dept")}
                value={deptFilter || "all"}
                onChange={(value) => setDeptFilter(value === "all" ? "" : value)}
                options={[{ value: "all", label: t("org.filter.allDepts") }, ...deptFilterOptions]}
              />
              <Select
                className="filter-control-status"
                aria-label={t("org.filter.role")}
                value={roleFilter || "all"}
                onChange={(value) => setRoleFilter(value === "all" ? "" : value)}
                options={[{ value: "all", label: t("org.filter.allRoles") }, ...roleFilterOptions]}
              />
            </FilterBar>
          ) : null}
          <DataPanel>
            {users.length === 0 ? (
              <EmptyState
                description={t("org.empty.user")}
                extra={
                  writable ? (
                    <Button type="primary" onClick={openCreate}>
                      {t("org.addUser")}
                    </Button>
                  ) : null
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                description={t("org.empty.filtered")}
                extra={<Button onClick={clearFilters}>{t("common.clearFilters")}</Button>}
              />
            ) : (
              <div className="org-table-wrap">
                <Table
                  rowKey="id"
                  dataSource={filtered}
                  pagination={filtered.length > 10 ? { pageSize: 10 } : false}
                  scroll={{ x: 960 }}
                  columns={[
                    {
                      title: t("org.employeeNo"),
                      dataIndex: "employee_no",
                      width: 140,
                      render: (value: string) => <span className="org-employee-no">{value}</span>,
                    },
                    {
                      title: t("org.displayName"),
                      dataIndex: "display_name",
                      render: (value: string) => <span className="org-display-name">{value}</span>,
                    },
                    {
                      title: t("org.dept"),
                      dataIndex: "department_id",
                      render: (id: string) => deptName.get(id) ?? t("common.noData"),
                    },
                    {
                      title: t("org.jobGrade"),
                      dataIndex: "job_grade_id",
                      width: 120,
                      render: (id: string) => gradeName.get(id) ?? t("common.noData"),
                    },
                    {
                      title: t("org.generation"),
                      dataIndex: "generation",
                      width: 100,
                      render: (value: string) => t(`dash.gen.${value}`),
                    },
                    {
                      title: t("org.roles"),
                      dataIndex: "roles",
                      render: (roles: RoleRow[]) => (
                        <span className="org-role-tags">
                          {roles.map((r) => (
                            <Tag key={`${r.role}-${r.department_id ?? ""}`}>{t(`role.${camel(r.role)}`)}</Tag>
                          ))}
                        </span>
                      ),
                    },
                    ...(writable
                      ? [
                          {
                            title: t("survey.actions"),
                            key: "actions",
                            width: 88,
                            fixed: "right" as const,
                            render: (_: unknown, row: UserRow) => (
                              <Button size="small" type="link" onClick={() => openEdit(row)}>
                                {t("breadcrumb.edit")}
                              </Button>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            )}
          </DataPanel>
        </>
      ) : null}
      <Drawer
        className="org-drawer"
        title={editing ? t("org.editUser") : t("org.addUser")}
        open={drawerOpen}
        onClose={requestClose}
        afterOpenChange={(open) => {
          if (!open) form.resetFields();
        }}
        width={screens.md === false ? "100%" : 480}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={requestClose} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {t("survey.save")}
            </Button>
          </Space>
        }
      >
        <Form
          layout="vertical"
          form={form}
          onFinish={(v) => void submit(v)}
          onValuesChange={(changed, all) => {
            if (Array.isArray(changed.roles) && changed.roles.includes("dept_manager") && !all.manager_department_id) {
              form.setFieldValue("manager_department_id", all.department_id);
            }
          }}
        >
          <div className="org-form-section">
            <div className="org-form-section-title">{t("org.section.basic")}</div>
            <Form.Item
              name="employee_no"
              label={t("org.employeeNo")}
              rules={
                editing
                  ? []
                  : [
                      { required: true },
                      { pattern: EMPLOYEE_NO_PATTERN, message: t("org.employeeNoRule") },
                    ]
              }
            >
              <Input disabled={Boolean(editing)} autoComplete="off" />
            </Form.Item>
            <Form.Item
              name="display_name"
              label={t("org.displayName")}
              rules={[{ required: true, min: 1, max: 100, message: t("org.nameLength") }]}
            >
              <Input maxLength={100} />
            </Form.Item>
            <Form.Item
              name="password"
              label={t("login.password")}
              extra={editing ? t("org.passwordEditHint") : undefined}
              rules={
                editing
                  ? [
                      {
                        validator: async (_, value: string | undefined) => {
                          if (!value) return;
                          if (value.length < 8) throw new Error(t("org.passwordMin"));
                        },
                      },
                    ]
                  : [{ required: true, min: 8, message: t("org.passwordMin") }]
              }
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          </div>
          <div className="org-form-section">
            <div className="org-form-section-title">{t("org.section.affiliation")}</div>
            <Form.Item name="department_id" label={t("org.dept")} rules={[{ required: true }]}>
              <Select
                options={departmentOptions}
                onChange={(value) => {
                  if (form.getFieldValue("roles")?.includes("dept_manager") && !form.isFieldTouched("manager_department_id")) {
                    form.setFieldValue("manager_department_id", value);
                  }
                }}
              />
            </Form.Item>
            <Form.Item name="job_grade_id" label={t("org.jobGrade")} rules={[{ required: true }]}>
              <Select options={grades.map((g) => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="generation" label={t("org.generation")} rules={[{ required: true }]}>
              <Select options={GENERATIONS.map((g) => ({ value: g, label: t(`dash.gen.${g}`) }))} />
            </Form.Item>
          </div>
          <div className="org-form-section">
            <div className="org-form-section-title">{t("org.section.roles")}</div>
            <Form.Item
              name="roles"
              label={t("org.roles")}
              extra={t("org.rolesHint")}
              rules={[{ required: true, type: "array", min: 1 }]}
            >
              <Select mode="multiple" options={roleOptions} />
            </Form.Item>
            {showManagerDept ? (
              <Form.Item name="manager_department_id" label={t("org.managerDept")} rules={[{ required: true }]}>
                <Select options={departmentOptions} />
              </Form.Item>
            ) : null}
          </div>
        </Form>
      </Drawer>
    </>
  );
}
