import { Button, Card, Form, Progress, Select, Table, Tabs, Typography, message } from "antd";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api, apiMessageKey, streamAnalytics } from "../api";

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
    <>
      <Typography.Title level={5}>{t("analyze.quotes")}</Typography.Title>
      {quotes.map((q) => (
        <Typography.Paragraph key={`${q.fe_id}-${q.text}`}>{q.text}</Typography.Paragraph>
      ))}
    </>
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

export function AnalyzePage() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [tab, setTab] = useState<PaneKind>("intent");
  const [intentCache, setIntentCache] = useState<Record<string, IntentResult>>({});
  const [summaryCache, setSummaryCache] = useState<Record<string, SummaryResult>>({});
  const [busyKind, setBusyKind] = useState<PaneKind | null>(null);
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const surveyId = Form.useWatch("survey_id", form) as string | undefined;
  const departmentId = Form.useWatch("department_id", form) as string | undefined;
  const key = surveyId && departmentId ? cacheKey(surveyId, departmentId) : "";
  const intentOut = key ? intentCache[key] : undefined;
  const summaryOut = key ? summaryCache[key] : undefined;

  useEffect(() => {
    void Promise.all([api.get("/surveys"), api.get("/departments")])
      .then(([s, d]) => {
        setSurveys(s.data.items.filter((i: { status: string }) => i.status !== "draft"));
        setDepts(d.data.items);
      })
      .catch((e) => message.error(t(apiMessageKey(e))));
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
            message.error(t(err.message_key));
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
      message.error(t(apiMessageKey(e)));
    } finally {
      if (gen === genRef.current) setBusyKind(null);
    }
  };

  const lows = intentOut?.evidence?.low_questions ?? [];
  const intentQuotes = intentOut?.evidence?.quotes ?? [];
  const summaryQuotes = summaryOut?.quotes ?? [];
  const intentBusy = busyKind === "intent";
  const summaryBusy = busyKind === "summary";

  const intentPane = (
    <>
      <Button
        type="primary"
        loading={intentBusy}
        disabled={summaryBusy}
        title={t("analyze.runHint")}
        onClick={() => void runPane("intent")}
      >
        {intentOut?.ai_run_id || intentOut?.message_key ? t("analyze.rerun") : t("analyze.run")}
      </Button>
      {intentBusy ? (
        <div style={{ marginTop: 12 }}>
          <Progress percent={100} status="active" showInfo={false} />
          <Typography.Text type="secondary">{t("analyze.running")}</Typography.Text>
        </div>
      ) : null}
      {!intentOut && !intentBusy ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          {t("analyze.emptyIntent")}
        </Typography.Paragraph>
      ) : null}
      {intentOut ? (
        <Card style={{ marginTop: 16 }}>
          {intentOut.message_key ? <Typography.Paragraph>{t(intentOut.message_key)}</Typography.Paragraph> : null}
          <MarkdownBody text={intentOut.markdown} streaming={intentBusy} />
          {lows.length > 0 ? (
            <>
              <Typography.Title level={5}>{t("analyze.lowQuestions")}</Typography.Title>
              <Table
                size="small"
                rowKey="fe_id"
                pagination={false}
                dataSource={lows}
                columns={[
                  { title: t("survey.title"), dataIndex: "title" },
                  {
                    title: t("analyze.avgScore"),
                    render: (_: unknown, row: LowQuestion) => (row.masked ? t("dash.masked") : row.avg_score),
                  },
                ]}
              />
            </>
          ) : null}
          <Quotes quotes={intentQuotes} />
        </Card>
      ) : null}
    </>
  );

  const summaryPane = (
    <>
      <Button
        loading={summaryBusy}
        disabled={intentBusy}
        title={t("analyze.summaryHint")}
        onClick={() => void runPane("summary")}
      >
        {summaryOut?.ai_run_id ? t("analyze.rerun") : t("analyze.summary")}
      </Button>
      {summaryBusy ? (
        <div style={{ marginTop: 12 }}>
          <Progress percent={100} status="active" showInfo={false} />
          <Typography.Text type="secondary">{t("analyze.running")}</Typography.Text>
        </div>
      ) : null}
      {!summaryOut && !summaryBusy ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          {t("analyze.emptySummary")}
        </Typography.Paragraph>
      ) : null}
      {summaryOut ? (
        <Card style={{ marginTop: 16 }}>
          <MarkdownBody text={summaryOut.markdown} streaming={summaryBusy} />
          <Quotes quotes={summaryQuotes} />
        </Card>
      ) : null}
    </>
  );

  return (
    <>
      <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
        <Form.Item name="survey_id" label={t("analyze.survey")} rules={[{ required: true }]}>
          <Select options={surveys.map((s) => ({ value: s.id, label: s.title }))} />
        </Form.Item>
        <Form.Item name="department_id" label={t("analyze.department")} rules={[{ required: true }]}>
          <Select options={depts.map((d) => ({ value: d.id, label: d.name }))} />
        </Form.Item>
      </Form>
      <Tabs
        activeKey={tab}
        onChange={(next) => setTab(next as PaneKind)}
        items={[
          { key: "intent", label: t("analyze.tabAnalyze"), children: intentPane },
          { key: "summary", label: t("analyze.tabSummary"), children: summaryPane },
        ]}
      />
    </>
  );
}
