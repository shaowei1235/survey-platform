"use client";

import { Alert, App, Button, Empty, Progress, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnswerField } from "../../../components/AnswerField";
import { ClientErrorState } from "../../../components/ClientErrorState";
import { ClientLoadingState } from "../../../components/ClientLoadingState";
import { QuestionCard } from "../../../components/QuestionCard";
import { useSurveySession } from "../../../components/SurveySessionContext";
import { apiMessageKey, consumeUnauthenticated, getSurvey, submitSurvey, type ComponentItem } from "../../../lib/api";
import { getAccess } from "../../../lib/session";
import { t } from "../../../lib/i18n";

const ANSWERABLE = new Set(["radio", "checkbox", "input", "textarea"]);

function isEmptyValue(value: unknown) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

export default function FillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { modal, message } = App.useApp();
  const { setDirty } = useSurveySession();
  const [title, setTitle] = useState("");
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const skipLeaveRef = useRef(false);

  const load = async () => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getSurvey(id);
      setTitle(data.title);
      setComponents(data.component_list);
    } catch (e) {
      if (consumeUnauthenticated(e, { error: (text) => message.error(text), replace: (path) => router.replace(path) })) {
        return;
      }
      setLoadError(apiMessageKey(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id, router]);

  const answerableItems = useMemo(
    () => components.filter((c) => ANSWERABLE.has(c.type)),
    [components],
  );
  const total = answerableItems.length;
  const answeredCount = answerableItems.filter((c) => !isEmptyValue(values[c.fe_id])).length;
  const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);
  const hasAnswers = answerableItems.some((c) => !isEmptyValue(values[c.fe_id]));

  useEffect(() => {
    setDirty(hasAnswers && !skipLeaveRef.current);
    return () => setDirty(false);
  }, [hasAnswers, setDirty]);

  useEffect(() => {
    if (!hasAnswers) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasAnswers]);

  const setFieldValue = (feId: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [feId]: value }));
    setFieldErrors((prev) => {
      if (!(feId in prev)) return prev;
      const next = { ...prev };
      delete next[feId];
      return next;
    });
  };

  const sendAnswers = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const answers = components
      .filter((c) => ANSWERABLE.has(c.type) && values[c.fe_id] !== undefined)
      .map((c) => ({ fe_id: c.fe_id, type: c.type, value: values[c.fe_id] }));
    try {
      await submitSurvey(id, answers);
      skipLeaveRef.current = true;
      setDirty(false);
      router.replace(`/surveys/${id}/done`);
    } catch (e) {
      if (consumeUnauthenticated(e, { error: (text) => message.error(text), replace: (path) => router.replace(path) })) {
        return;
      }
      message.error(t(apiMessageKey(e)));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    if (submittingRef.current || submitting || total === 0) return;
    const errors: Record<string, string> = {};
    let firstMissing: string | null = null;
    for (const c of components) {
      if (!ANSWERABLE.has(c.type)) continue;
      if (!c.props.required) continue;
      if (isEmptyValue(values[c.fe_id])) {
        errors[c.fe_id] = t("answer.required");
        if (!firstMissing) firstMissing = c.fe_id;
      }
    }
    if (firstMissing) {
      setFieldErrors(errors);
      message.error(t("answer.required"));
      document.getElementById(`question-${firstMissing}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    modal.confirm({
      title: t("answer.submitConfirmTitle"),
      content: t("answer.submitConfirm"),
      okText: t("answer.submit"),
      cancelText: t("answer.cancel"),
      transitionName: "",
      maskTransitionName: "",
      onOk: () => sendAnswers(),
    });
  };

  const onBack = () => {
    if (!hasAnswers) {
      router.push("/surveys");
      return;
    }
    modal.confirm({
      title: t("answer.leaveConfirmTitle"),
      content: t("answer.leaveConfirm"),
      okText: t("answer.back"),
      cancelText: t("answer.cancel"),
      transitionName: "",
      maskTransitionName: "",
      onOk: () => {
        skipLeaveRef.current = true;
        setDirty(false);
        router.push("/surveys");
      },
    });
  };

  let questionNo = 0;

  return (
    <div className="client-page">
      <Button type="link" className="client-back-link" onClick={onBack}>
        {t("answer.back")}
      </Button>
      {loading ? <ClientLoadingState /> : null}
      {!loading && loadError ? (
        <ClientErrorState message={t(loadError)} onRetry={() => void load()} retryLabel={t("answer.retry")} />
      ) : null}
      {!loading && !loadError ? (
        <>
          <Typography.Title level={3}>{title}</Typography.Title>
          <Alert className="fill-attr-alert" message={t("answer.attrBound")} />
          <div className="fill-progress">
            <div className="fill-progress-label">
              {t("answer.progress")}
              {" · "}
              {t("answer.answered")} {answeredCount} / {total}
            </div>
            <Progress percent={percent} showInfo={false} />
          </div>
          {total === 0 ? <Empty description={t("answer.noQuestions")} /> : null}
          {components.map((c) => {
            if (!ANSWERABLE.has(c.type)) {
              return (
                <div key={c.fe_id} className="survey-static-block">
                  <AnswerField item={c} value={undefined} onChange={() => undefined} />
                </div>
              );
            }
            questionNo += 1;
            const error = fieldErrors[c.fe_id];
            return (
              <QuestionCard
                key={c.fe_id}
                id={`question-${c.fe_id}`}
                number={questionNo}
                answered={!isEmptyValue(values[c.fe_id])}
                error={Boolean(error)}
              >
                <AnswerField
                  item={c}
                  value={values[c.fe_id]}
                  error={error}
                  onChange={(v) => setFieldValue(c.fe_id, v)}
                />
              </QuestionCard>
            );
          })}
          <div className="fill-actions">
            <Button type="primary" loading={submitting} disabled={submitting || total === 0} onClick={onSubmit}>
              {t("answer.submit")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
