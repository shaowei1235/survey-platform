import { Button, Form, Grid, Progress, Segmented, Select, Table, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, apiMessageKey, isReauthRedirecting, streamAnalytics } from "../api";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";

type LowQuestion = { fe_id: string; title: string; avg_score: number | null; n: number | null; masked: boolean };
type Quote = { text: string; fe_id: string };
type IntentResult = {
  markdown: string;
  message_key?: string;
  evidence?: { low_questions?: LowQuestion[]; quotes?: Quote[] };
  ai_run_id?: string | null;
};
type SummaryResult = {
  markdown: string;
  quotes?: Quote[];
  ai_run_id?: string | null;
};
type PaneKind = "intent" | "summary";

function cacheKey(surveyId: string, departmentId: string) {
  return `${surveyId}:${departmentId}`;
}

function Quotes({ quotes }: { quotes: Quote[] }) {
  const { t } = useTranslation();
  if (quotes.length === 0) return null;
  return (
    <div className="analyze-quotes">
      <div className="analyze-section-title">{t("analyze.quotes")}</div>
      {quotes.map((q) => (
        <blockquote key={`${q.fe_id}-${q.text}`} className="analyze-quote">
          {q.text}
        </blockquote>
      ))}
    </div>
  );
}

function MarkdownBody({ text, streaming }: { text: string; streaming: boolean }) {
  if (!text) return null;
  return (
    <div className={streaming ? "analyze-md analyze-md-streaming" : "analyze-md"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function formatScore(value: number) {
  return value.toFixed(1);
}

export function AnalyzePage() {
  const { t } = useTranslation();
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm();
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [mode, setMode] = useState<PaneKind>("intent");
  const [intentCache, setIntentCache] = useState<Record<string, IntentResult>>({});
  const [summaryCache, setSummaryCache] = useState<Record<string, SummaryResult>>({});
  const [busyKind, setBusyKind] = useState<PaneKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const surveyId = Form.useWatch("survey_id", form) as string | undefined;
  const departmentId = Form.useWatch("department_id", form) as string | undefined;
  const key = surveyId && departmentId ? cacheKey(surveyId, departmentId) : "";
  const intentOut = key ? intentCache[key] : undefined;
  const summaryOut = key ? summaryCache[key] : undefined;
  const stacked = screens.xl === false;
  const compact = screens.md === false;

  const loadOptions = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, d] = await Promise.all([api.get("/surveys"), api.get("/departments")]);
      setSurveys(s.data.items.filter((i: { status: string }) => i.status !== "draft"));
      setDepts(d.data.items);
      setLoadError(null);
    } catch (e) {
      if (!isReauthRedirecting()) setLoadError(apiMessageKey(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOptions();
  }, [t]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runPane = async (kind: PaneKind) => {
    let values: { survey_id: string; department_id: string };
    try {
      values = await form.validateFields(["survey_id", "department_id"]);
    } catch {
      return;
    }
    const paneKey = cacheKey(values.survey_id, values.department_id);
    const gen = ++genRef.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setBusyKind(kind);
    if (kind === "intent") {
      setIntentCache((prev) => ({ ...prev, [paneKey]: { markdown: "", evidence: prev[paneKey]?.evidence } }));
    } else {
      setSummaryCache((prev) => ({ ...prev, [paneKey]: { markdown: "", quotes: prev[paneKey]?.quotes } }));
    }
    const path = kind === "intent" ? "/analytics/intent/stream" : "/analytics/free-text-summary/stream";
    const body =
      kind === "intent"
        ? { survey_id: values.survey_id, department_id: values.department_id, intent: "dept_low_score_and_causes" }
        : { survey_id: values.survey_id, department_id: values.department_id };
    try {
      await streamAnalytics(
        path,
        body,
        {
          onEvidence: (data) => {
            if (kind === "intent") {
              setIntentCache((prev) => ({
                ...prev,
                [paneKey]: {
                  markdown: prev[paneKey]?.markdown ?? "",
                  evidence: data as IntentResult["evidence"],
                },
              }));
            } else {
              setSummaryCache((prev) => ({
                ...prev,
                [paneKey]: {
                  markdown: prev[paneKey]?.markdown ?? "",
                  quotes: (data.quotes as Quote[]) ?? [],
                },
              }));
            }
          },
          onDelta: (text) => {
            if (kind === "intent") {
              setIntentCache((prev) => ({
                ...prev,
                [paneKey]: { ...prev[paneKey], markdown: (prev[paneKey]?.markdown ?? "") + text },
              }));
            } else {
              setSummaryCache((prev) => ({
                ...prev,
                [paneKey]: { ...prev[paneKey], markdown: (prev[paneKey]?.markdown ?? "") + text },
              }));
            }
          },
          onDone: (data) => {
            if (kind === "intent") {
              setIntentCache((prev) => ({
                ...prev,
                [paneKey]: {
                  ...prev[paneKey],
                  markdown: prev[paneKey]?.markdown ?? "",
                  ai_run_id: typeof data.ai_run_id === "string" ? data.ai_run_id : null,
                  message_key: typeof data.message_key === "string" ? data.message_key : undefined,
                },
              }));
            } else {
              setSummaryCache((prev) => ({
                ...prev,
                [paneKey]: {
                  ...prev[paneKey],
                  markdown: prev[paneKey]?.markdown ?? "",
                  ai_run_id: typeof data.ai_run_id === "string" ? data.ai_run_id : null,
                },
              }));
            }
          },
          onError: (err) => {
            if (!isReauthRedirecting()) message.error(t(err.message_key));
            if (kind === "intent") {
              setIntentCache((prev) => ({ ...prev, [paneKey]: { ...prev[paneKey], markdown: "" } }));
            } else {
              setSummaryCache((prev) => ({ ...prev, [paneKey]: { ...prev[paneKey], markdown: "" } }));
            }
          },
        },
        ac.signal,
      );
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      if (gen === genRef.current) setBusyKind(null);
    }
  };

  const lows = intentOut?.evidence?.low_questions ?? [];
  const intentQuotes = intentOut?.evidence?.quotes ?? [];
  const summaryQuotes = summaryOut?.quotes ?? [];
  const intentBusy = busyKind === "intent";
  const summaryBusy = busyKind === "summary";
  const modeBusy = busyKind === mode;
  const otherBusy = busyKind !== null && busyKind !== mode;
  const surveyTitle = surveys.find((s) => s.id === surveyId)?.title;
  const deptName = depts.find((d) => d.id === departmentId)?.name;
  const intentHasResult = Boolean(intentOut?.ai_run_id || intentOut?.message_key);
  const summaryHasResult = Boolean(summaryOut?.ai_run_id);
  const runLabel =
    mode === "intent"
      ? intentHasResult
        ? t("analyze.runAgain")
        : t("analyze.runExecute")
      : summaryHasResult
        ? t("analyze.summaryAgain")
        : t("analyze.summaryGenerate");

  const conditions = (
    <DataPanel title={t("analyze.conditions")}>
      <dl className="analyze-meta">
        <div>
          <dt>{t("analyze.survey")}</dt>
          <dd>{surveyTitle ?? t("common.noData")}</dd>
        </div>
        <div>
          <dt>{t("analyze.department")}</dt>
          <dd>{deptName ?? t("common.noData")}</dd>
        </div>
        <div>
          <dt>{t("analyze.intent")}</dt>
          <dd>{mode === "intent" ? t("analyze.dept_low_score_and_causes") : t("analyze.tabSummary")}</dd>
        </div>
        <div>
          <dt>{t("analyze.status")}</dt>
          <dd>
            {busyKind === mode
              ? t("analyze.statusRunning")
              : mode === "intent"
                ? intentHasResult
                  ? t("analyze.statusDone")
                  : t("analyze.statusIdle")
                : summaryHasResult
                  ? t("analyze.statusDone")
                  : t("analyze.statusIdle")}
          </dd>
        </div>
      </dl>
    </DataPanel>
  );

  const intentResult = intentOut ? (
    <DataPanel title={t("analyze.result")}>
      {intentOut.message_key ? <Typography.Paragraph>{t(intentOut.message_key)}</Typography.Paragraph> : null}
      <MarkdownBody text={intentOut.markdown} streaming={intentBusy} />
      {lows.length > 0 ? (
        <div className="analyze-evidence">
          <div className="analyze-section-title">{t("analyze.lowQuestions")}</div>
          <Table
            size="small"
            rowKey="fe_id"
            pagination={false}
            scroll={{ x: 360 }}
            dataSource={lows}
            columns={[
              { title: t("survey.title"), dataIndex: "title", ellipsis: true },
              {
                title: t("analyze.avgScore"),
                width: 120,
                render: (_: unknown, row: LowQuestion) =>
                  row.masked ? t("dash.masked") : row.avg_score == null ? t("common.noData") : formatScore(row.avg_score),
              },
            ]}
          />
        </div>
      ) : null}
      <Quotes quotes={intentQuotes} />
    </DataPanel>
  ) : null;

  const summaryResult = summaryOut ? (
    <DataPanel title={t("analyze.result")}>
      <MarkdownBody text={summaryOut.markdown} streaming={summaryBusy} />
      <Quotes quotes={summaryQuotes} />
    </DataPanel>
  ) : null;

  const emptyIntent = (
    <EmptyState
      description={
        <>
          <span>{t("analyze.emptyIntent")}</span>
          <span className="analyze-empty-hint">{t("analyze.emptyIntentHint")}</span>
        </>
      }
    />
  );

  const emptySummary = (
    <EmptyState
      description={
        <>
          <span>{t("analyze.emptySummary")}</span>
          <span className="analyze-empty-hint">{t("analyze.emptySummaryHint")}</span>
        </>
      }
    />
  );

  return (
    <>
      <PageHeader title={t("analyze.title")} description={t("analyze.pageDescription")} />
      {loadError ? (
        <ErrorState message={t(loadError)} onRetry={() => void loadOptions()} retryLabel={t("common.retry")} />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError ? (
        <>
          <Form form={form} layout="vertical" className="analyze-filters">
            <Form.Item name="survey_id" label={t("analyze.survey")} rules={[{ required: true }]} className="analyze-filter-survey">
              <Select
                showSearch
                optionFilterProp="label"
                options={surveys.map((s) => ({ value: s.id, label: s.title }))}
              />
            </Form.Item>
            <Form.Item name="department_id" label={t("analyze.department")} rules={[{ required: true }]} className="analyze-filter-dept">
              <Select options={depts.map((d) => ({ value: d.id, label: d.name }))} />
            </Form.Item>
            <Form.Item label={t("analyze.mode")} className="analyze-filter-mode">
              <Segmented
                block={compact}
                value={mode}
                onChange={(next) => setMode(next as PaneKind)}
                options={[
                  { value: "intent", label: t("analyze.modeIntent") },
                  { value: "summary", label: t("analyze.tabSummary") },
                ]}
              />
            </Form.Item>
            <Form.Item label={<span className="analyze-run-label-spacer" />} colon={false} className="analyze-filter-run">
              <Button
                type="primary"
                loading={modeBusy}
                disabled={otherBusy}
                title={mode === "intent" ? t("analyze.runHint") : t("analyze.summaryHint")}
                onClick={() => void runPane(mode)}
              >
                {runLabel}
              </Button>
            </Form.Item>
          </Form>
          <div className={stacked ? "analyze-layout is-stacked" : "analyze-layout"}>
            <div className="analyze-main">
              {modeBusy ? (
                <div className="analyze-progress">
                  <Progress percent={100} status="active" showInfo={false} />
                  <Typography.Text type="secondary">{t("analyze.running")}</Typography.Text>
                </div>
              ) : null}
              {mode === "intent"
                ? intentOut
                  ? intentResult
                  : intentBusy
                    ? null
                    : emptyIntent
                : summaryOut
                  ? summaryResult
                  : summaryBusy
                    ? null
                    : emptySummary}
            </div>
            <aside className="analyze-side">{conditions}</aside>
          </div>
        </>
      ) : null}
    </>
  );
}
