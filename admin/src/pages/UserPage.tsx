import { Button, Form, Input, Select, Table, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiMessageKey } from "../api";
import { canWriteOrg, type Me } from "../session";

const GENERATIONS = ["20s", "30s", "40s", "50s", "60s_plus"];
const ROLES = ["system_admin", "hr_planner", "executive", "dept_manager", "employee"];

export function UserPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const writable = canWriteOrg(me);

  const load = async () => {
    const [u, d, g] = await Promise.all([api.get("/users"), api.get("/departments"), api.get("/job-grades")]);
    setUsers(u.data.items);
    setDepts(d.data.items);
    setGrades(g.data.items);
  };

  useEffect(() => {
    void load().catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  return (
    <>
      {writable ? (
        <Form
          layout="inline"
          style={{ marginBottom: 16, rowGap: 8 }}
          onFinish={async (v) => {
            try {
              await api.post("/users", {
                ...v,
                roles: [{ role: v.role, department_id: v.role === "dept_manager" ? v.department_id : null }],
              });
              await load();
            } catch (e) {
              message.error(t(apiMessageKey(e)));
            }
          }}
        >
          <Form.Item name="employee_no" rules={[{ required: true }]}>
            <Input placeholder={t("org.employeeNo")} />
          </Form.Item>
          <Form.Item name="display_name" rules={[{ required: true }]}>
            <Input placeholder={t("org.displayName")} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, min: 8 }]}>
            <Input.Password placeholder={t("login.password")} />
          </Form.Item>
          <Form.Item name="department_id" rules={[{ required: true }]}>
            <Select style={{ width: 160 }} options={depts.map((d) => ({ value: d.id, label: d.name }))} placeholder={t("org.dept")} />
          </Form.Item>
          <Form.Item name="job_grade_id" rules={[{ required: true }]}>
            <Select style={{ width: 120 }} options={grades.map((g) => ({ value: g.id, label: g.name }))} placeholder={t("org.jobGrade")} />
          </Form.Item>
          <Form.Item name="generation" rules={[{ required: true }]}>
            <Select style={{ width: 120 }} options={GENERATIONS.map((g) => ({ value: g, label: g }))} placeholder={t("org.generation")} />
          </Form.Item>
          <Form.Item name="role" rules={[{ required: true }]}>
            <Select style={{ width: 160 }} options={ROLES.map((r) => ({ value: r, label: t(`role.${camel(r)}`) }))} placeholder={t("org.roles")} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {t("org.create")}
          </Button>
        </Form>
      ) : null}
      <Table
        rowKey="id"
        dataSource={users}
        columns={[
          { title: t("org.employeeNo"), dataIndex: "employee_no" },
          { title: t("org.displayName"), dataIndex: "display_name" },
          {
            title: t("org.dept"),
            dataIndex: "department_id",
            render: (id: string) => depts.find((d) => d.id === id)?.name,
          },
          {
            title: t("org.roles"),
            dataIndex: "roles",
            render: (roles: Array<{ role: string }>) => roles.map((r) => t(`role.${camel(r.role)}`)).join(", "),
          },
        ]}
      />
    </>
  );
}

function camel(role: string) {
  if (role === "system_admin") return "systemAdmin";
  if (role === "hr_planner") return "hrPlanner";
  if (role === "dept_manager") return "deptManager";
  return role;
}
