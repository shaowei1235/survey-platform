import { Alert, Button, Form, Select, Table, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, apiMessageKey } from "../api";

const GENERATIONS = ["20s", "30s", "40s", "50s", "60s_plus"] as const;
const BAR_COLORS = ["#1677ff", "#52c41a", "#faad14", "#eb2f96", "#13c2c2", "#722ed1"];

type DashCell = { fe_id: string; n: number | null; avg_score: number | null; masked: boolean };
type DashRow = { department_id: string; department_name: string; cells: DashCell[] };
type DashResult = { questions: Array<{ fe_id: string; title: string }>; rows: DashRow[] };

function compactParams(values: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v != null && v !== ""));
}

function chartRows(result: DashResult) {
  return result.rows.flatMap((row) => {
    const point: Record<string, string | number | null> = { name: row.department_name };
    let visible = false;
    for (const q of result.questions) {
      const cell = row.cells.find((c) => c.fe_id === q.fe_id);
      if (cell && !cell.masked && cell.avg_score != null) {
        point[q.fe_id] = cell.avg_score;
        visible = true;
      } else {
        point[q.fe_id] = null;
      }
    }
    return visible ? [point] : [];
  });
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [result, setResult] = useState<DashResult | null>(null);

  useEffect(() => {
    void Promise.all([api.get("/surveys"), api.get("/departments"), api.get("/job-grades")])
      .then(([s, d, g]) => {
        setSurveys(s.data.items.filter((i: { status: string }) => i.status !== "draft"));
        setDepts(d.data.items);
        setGrades(g.data.items);
      })
      .catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  const plotted = useMemo(() => (result ? chartRows(result) : []), [result]);

  return (
    <>
      <Form
        layout="inline"
        style={{ rowGap: 8 }}
        onFinish={async (v) => {
          try {
            const { data } = await api.get("/analytics/cross-tab", { params: compactParams(v) });
            setResult(data);
          } catch (e) {
            message.error(t(apiMessageKey(e)));
          }
        }}
      >
        <Form.Item name="survey_id" rules={[{ required: true }]}>
          <Select
            style={{ width: 280 }}
            placeholder={t("analyze.survey")}
            showSearch
            optionFilterProp="label"
            options={surveys.map((s) => ({ value: s.id, label: s.title }))}
          />
        </Form.Item>
        <Form.Item name="department_id">
          <Select
            allowClear
            style={{ width: 160 }}
            placeholder={t("org.dept")}
            options={depts.map((d) => ({ value: d.id, label: d.name }))}
          />
        </Form.Item>
        <Form.Item name="generation">
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder={t("org.generation")}
            options={GENERATIONS.map((g) => ({ value: g, label: t(`dash.gen.${g}`) }))}
          />
        </Form.Item>
        <Form.Item name="job_grade_id">
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder={t("org.jobGrade")}
            options={grades.map((g) => ({ value: g.id, label: g.name }))}
          />
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
                render: (_: unknown, row: DashRow) => {
                  const cell = row.cells.find((c) => c.fe_id === q.fe_id);
                  if (!cell || cell.masked) return t("dash.masked");
                  return cell.avg_score;
                },
              })),
            ]}
          />
          <Typography.Title level={5}>{t("chart.dept_scores")}</Typography.Title>
          {plotted.length === 0 ? (
            <Alert message={t("dash.empty")} />
          ) : (
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={plotted} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  {result.questions.map((q, i) => (
                    <Bar key={q.fe_id} dataKey={q.fe_id} name={q.title} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
