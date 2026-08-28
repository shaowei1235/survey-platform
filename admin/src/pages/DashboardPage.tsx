import { Alert, Button, Form, Select, Table, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { api, apiMessageKey } from "../api";

export function DashboardPage() {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [result, setResult] = useState<{
    questions: Array<{ fe_id: string; title: string }>;
    rows: Array<{ department_id: string; department_name: string; cells: Array<{ fe_id: string; n: number | null; avg_score: number | null; masked: boolean }> }>;
  } | null>(null);

  useEffect(() => {
    void Promise.all([api.get("/surveys"), api.get("/departments")])
      .then(([s, d]) => {
        setSurveys(s.data.items.filter((i: { status: string }) => i.status !== "draft"));
        setDepts(d.data.items);
      })
      .catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  return (
    <>
      <Form
        layout="inline"
        onFinish={async (v) => {
          try {
            const { data } = await api.get("/analytics/cross-tab", { params: v });
            setResult(data);
          } catch (e) {
            message.error(t(apiMessageKey(e)));
          }
        }}
      >
        <Form.Item name="survey_id" rules={[{ required: true }]}>
          <Select style={{ width: 280 }} options={surveys.map((s) => ({ value: s.id, label: s.title }))} />
        </Form.Item>
        <Form.Item name="department_id">
          <Select allowClear style={{ width: 200 }} options={depts.map((d) => ({ value: d.id, label: d.name }))} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t("dash.load")}
        </Button>
      </Form>
      {result && result.rows.length === 0 ? <Alert style={{ marginTop: 16 }} message={t("dash.empty")} /> : null}
      {result && result.rows.length > 0 ? (
        <>
          <Table
            style={{ marginTop: 16 }}
            rowKey="department_id"
            dataSource={result.rows}
            columns={[
              { title: t("org.dept"), dataIndex: "department_name" },
              ...result.questions.map((q) => ({
                title: q.title,
                render: (_: unknown, row: (typeof result.rows)[0]) => {
                  const cell = row.cells.find((c) => c.fe_id === q.fe_id);
                  if (!cell || cell.masked) return t("dash.masked");
                  return cell.avg_score;
                },
              })),
            ]}
          />
          <Typography.Title level={5}>{t("chart.dept_scores")}</Typography.Title>
          <BarChart width={640} height={280} data={result.rows.map((r) => ({ name: r.department_name, score: r.cells[0]?.masked ? 0 : r.cells[0]?.avg_score }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="score" fill="#1677ff" />
          </BarChart>
        </>
      ) : null}
    </>
  );
}
