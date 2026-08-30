import { Button, Form, Select, Table, Tooltip as AntTooltip, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, apiMessageKey, isReauthRedirecting } from "../api";
import { deptSelectOptions } from "../deptOptions";
import { pickDefaultAnalyzableSurvey, type AnalyzableSurvey } from "../surveyPick";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar } from "../components/FilterBar";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";

const GENERATIONS = ["20s", "30s", "40s", "50s", "60s_plus"] as const;
const BAR_COLORS = ["#3155A6", "#17745A", "#9A6811", "#5B7FCF", "#B13A44", "#667085"];

type DashCell = { fe_id: string; n: number | null; avg_score: number | null; masked: boolean };
type DashRow = { department_id: string; department_name: string; cells: DashCell[] };
type DashResult = { questions: Array<{ fe_id: string; title: string }>; rows: DashRow[] };
type CompletionRow = {
  department_id: string;
  department_name: string;
  eligible: number | null;
  submitted: number | null;
  unanswered: number | null;
  rate: number | null;
  masked: boolean;
};
type CompletionResult = { rows: CompletionRow[] };
type DashFilters = {
  survey_id?: string;
  department_id?: string;
  generation?: string;
  job_grade_id?: string;
};
type TipItem = { name?: string; value?: number | string | null; color?: string };

function filenameFromDisposition(header: string | undefined, fallback: string) {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      return fallback;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

async function blobMessageKey(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } }).response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message_key?: string };
      if (parsed.message_key) return parsed.message_key;
    } catch {
      /* use generic */
    }
  }
  return apiMessageKey(error);
}

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

function formatScore(value: number) {
  return value.toFixed(1);
}

function formatRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function DashTooltip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string }) {
  if (!active || !payload) return null;
  const items = payload.filter((item) => typeof item.value === "number" && item.value >= 1);
  if (items.length === 0) return null;
  return (
    <div className="dash-tooltip">
      <div className="dash-tooltip-label">{label}</div>
      {items.map((item) => (
        <div key={String(item.name)} className="dash-tooltip-row">
          <span className="dash-tooltip-swatch" style={{ background: item.color }} />
          <span>{item.name}</span>
          <span className="dash-tooltip-value">{typeof item.value === "number" ? formatScore(item.value) : item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const [form] = Form.useForm<DashFilters>();
  const [surveys, setSurveys] = useState<AnalyzableSurvey[]>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string; parent_id: string | null; sort_order: number }>>([]);
  const [grades, setGrades] = useState<Array<{ id: string; name: string }>>([]);
  const [result, setResult] = useState<DashResult | null>(null);
  const [completion, setCompletion] = useState<CompletionResult | null>(null);
  const [lastQuery, setLastQuery] = useState<DashFilters | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [querying, setQuerying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const queryingRef = useRef(false);
  const autoQueryOnceRef = useRef(false);
  const didInitRef = useRef(false);

  const loadCrossTab = async (values: DashFilters) => {
    if (queryingRef.current) return;
    queryingRef.current = true;
    setQuerying(true);
    setQueryError(null);
    try {
      const params = compactParams(values);
      const completionParams = compactParams({ survey_id: values.survey_id, department_id: values.department_id });
      const [tab, status] = await Promise.all([
        api.get("/analytics/cross-tab", { params }),
        api.get("/analytics/completion", { params: completionParams }),
      ]);
      setResult(tab.data);
      setCompletion(status.data);
      setLastQuery(params as DashFilters);
      setQueryError(null);
    } catch (e) {
      setResult(null);
      setCompletion(null);
      setLastQuery(null);
      if (!isReauthRedirecting()) setQueryError(apiMessageKey(e));
    } finally {
      queryingRef.current = false;
      setQuerying(false);
    }
  };

  const loadOptions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, d, g] = await Promise.all([api.get("/surveys"), api.get("/departments"), api.get("/job-grades")]);
      const analyzable = (s.data.items as AnalyzableSurvey[]).filter((i) => i.status !== "draft");
      setSurveys(analyzable);
      setDepts(d.data.items);
      setGrades(g.data.items);
      setLoadError(null);
      const selected = form.getFieldValue("survey_id") as string | undefined;
      const preferred = pickDefaultAnalyzableSurvey(analyzable);
      if (!selected && preferred && !autoQueryOnceRef.current) {
        autoQueryOnceRef.current = true;
        const survey_id = preferred.id;
        form.setFieldsValue({ survey_id });
        setLoading(false);
        await loadCrossTab({ survey_id });
        return;
      }
    } catch (e) {
      if (!isReauthRedirecting()) setLoadError(apiMessageKey(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void loadOptions();
  }, []);

  const plotted = useMemo(() => (result ? chartRows(result) : []), [result]);

  const retryQuery = () => {
    void form.validateFields().then((values) => loadCrossTab(values));
  };

  const downloadExcel = async () => {
    if (!lastQuery?.survey_id || exporting) return;
    setExporting(true);
    try {
      const res = await api.get("/analytics/cross-tab.xlsx", {
        params: compactParams(lastQuery),
        responseType: "blob",
      });
      const blob = res.data as Blob;
      const filename = filenameFromDisposition(res.headers["content-disposition"], "crosstab.xlsx");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(await blobMessageKey(e)));
    } finally {
      setExporting(false);
    }
  };

  const tableScrollX = result ? Math.max(640, 160 + result.questions.length * 128) : 640;
  const chartMinWidth = result ? Math.max(480, plotted.length * 88 + result.questions.length * 20) : 480;

  return (
    <>
      <PageHeader title={t("dash.title")} description={t("dash.pageDescription")} />
      {loadError ? (
        <ErrorState message={t(loadError)} onRetry={() => void loadOptions()} retryLabel={t("common.retry")} />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError && surveys.length === 0 ? <EmptyState description={t("dash.noSurveys")} /> : null}
      {!loading && !loadError && surveys.length > 0 ? (
        <>
          <Form form={form} onFinish={(v) => void loadCrossTab(v)}>
            <FilterBar
              extra={
                <Button type="primary" htmlType="submit" loading={querying}>
                  {t("dash.load")}
                </Button>
              }
            >
              <Form.Item name="survey_id" rules={[{ required: true }]} className="filter-control">
                <Select
                  placeholder={t("analyze.survey")}
                  aria-label={t("analyze.survey")}
                  showSearch
                  optionFilterProp="label"
                  options={surveys.map((s) => ({ value: s.id, label: s.title }))}
                />
              </Form.Item>
              <Form.Item name="department_id" className="filter-control-status">
                <Select
                  allowClear
                  placeholder={t("org.dept")}
                  aria-label={t("org.dept")}
                  options={deptSelectOptions(depts)}
                />
              </Form.Item>
              <Form.Item name="generation" className="filter-control-status">
                <Select
                  allowClear
                  placeholder={t("org.generation")}
                  aria-label={t("org.generation")}
                  options={GENERATIONS.map((g) => ({ value: g, label: t(`dash.gen.${g}`) }))}
                />
              </Form.Item>
              <Form.Item name="job_grade_id" className="filter-control-status">
                <Select
                  allowClear
                  placeholder={t("org.jobGrade")}
                  aria-label={t("org.jobGrade")}
                  options={grades.map((g) => ({ value: g.id, label: g.name }))}
                />
              </Form.Item>
            </FilterBar>
          </Form>
          {queryError ? (
            <ErrorState message={t(queryError)} onRetry={retryQuery} retryLabel={t("common.retry")} />
          ) : null}
          {!queryError && !result && !querying ? <EmptyState description={t("dash.selectSurvey")} /> : null}
          {querying && !result ? <LoadingState /> : null}
          {!queryError && result && result.rows.length === 0 ? <EmptyState description={t("dash.empty")} /> : null}
          {!queryError && result && result.rows.length > 0 ? (
            <>
              <DataPanel title={t("chart.dept_scores")} description={t("dash.chartUnit")}>
                {plotted.length === 0 ? (
                  <EmptyState description={t("dash.allMasked")} />
                ) : (
                  <div className="dash-chart-wrap">
                    <div className="dash-chart-inner" style={{ minWidth: chartMinWidth, height: 320 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={plotted}
                          barSize={30}
                          barGap={8}
                          barCategoryGap={48}
                          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#E4E9F0" />
                          <XAxis dataKey="name" tick={{ fill: "#667085", fontSize: 12 }} interval={0} />
                          <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} allowDecimals={false} tick={{ fill: "#667085", fontSize: 12 }} />
                          <Tooltip content={<DashTooltip />} cursor={false} />
                          <Legend />
                          {result.questions.map((q, i) => (
                            <Bar
                              key={q.fe_id}
                              dataKey={q.fe_id}
                              name={q.title}
                              fill={BAR_COLORS[i % BAR_COLORS.length]}
                              radius={[4, 4, 0, 0]}
                            />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </DataPanel>
              <div className="dash-table-panel">
                <DataPanel
                  title={t("dash.tableTitle")}
                  extra={
                    <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => void downloadExcel()} title={t("dash.exportHint")}>
                      {t("dash.export")}
                    </Button>
                  }
                >
                  <div className="dash-table-wrap">
                    <Table
                      rowKey="department_id"
                      dataSource={result.rows}
                      pagination={false}
                      scroll={{ x: tableScrollX }}
                      columns={[
                        {
                          title: t("org.dept"),
                          dataIndex: "department_name",
                          fixed: "left",
                          width: 160,
                          ellipsis: true,
                        },
                        ...result.questions.map((q) => ({
                          title: (
                            <AntTooltip title={q.title}>
                              <span className="dash-col-title">{q.title}</span>
                            </AntTooltip>
                          ),
                          width: 128,
                          render: (_: unknown, row: DashRow) => {
                            const cell = row.cells.find((c) => c.fe_id === q.fe_id);
                            if (!cell || cell.masked) return <span className="dash-masked">{t("dash.masked")}</span>;
                            return cell.avg_score == null ? t("common.noData") : formatScore(cell.avg_score);
                          },
                        })),
                      ]}
                    />
                  </div>
                </DataPanel>
              </div>
              {completion && completion.rows.length > 0 ? (
                <div className="dash-table-panel">
                  <DataPanel title={t("dash.completionTitle")} description={t("dash.completionHint")}>
                    <div className="dash-table-wrap">
                      <Table
                        rowKey="department_id"
                        dataSource={completion.rows}
                        pagination={false}
                        columns={[
                          {
                            title: t("org.dept"),
                            dataIndex: "department_name",
                            width: 160,
                            ellipsis: true,
                          },
                          {
                            title: t("dash.eligible"),
                            width: 96,
                            render: (_: unknown, row: CompletionRow) =>
                              row.eligible == null ? <span className="dash-masked">{t("dash.masked")}</span> : row.eligible,
                          },
                          {
                            title: t("dash.submitted"),
                            width: 96,
                            render: (_: unknown, row: CompletionRow) =>
                              row.submitted == null ? <span className="dash-masked">{t("dash.masked")}</span> : row.submitted,
                          },
                          {
                            title: t("dash.unanswered"),
                            width: 96,
                            render: (_: unknown, row: CompletionRow) =>
                              row.unanswered == null ? <span className="dash-masked">{t("dash.masked")}</span> : row.unanswered,
                          },
                          {
                            title: t("dash.rate"),
                            width: 96,
                            render: (_: unknown, row: CompletionRow) =>
                              row.rate == null ? <span className="dash-masked">{t("dash.masked")}</span> : formatRate(row.rate),
                          },
                        ]}
                      />
                    </div>
                  </DataPanel>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}
