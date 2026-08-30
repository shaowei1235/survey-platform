"use client";

import { Empty, Progress, Typography } from "antd";
import { useMemo, type ReactNode } from "react";
import { AnswerField, type FillComponent } from "./AnswerField";
import { QuestionCard } from "./QuestionCard";

export const ANSWERABLE = new Set(["radio", "checkbox", "input", "textarea"]);

export function isEmptyValue(value: unknown) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

type FillLabels = {
  progress: string;
  answered: string;
  noQuestions: string;
};

type SurveyFillViewProps = {
  title: string;
  components: FillComponent[];
  values: Record<string, unknown>;
  fieldErrors?: Record<string, string>;
  onChange: (feId: string, value: unknown) => void;
  labels: FillLabels;
  banner?: ReactNode;
  footer?: ReactNode;
};

export function SurveyFillView({
  title,
  components,
  values,
  fieldErrors = {},
  onChange,
  labels,
  banner,
  footer,
}: SurveyFillViewProps) {
  const answerableItems = useMemo(
    () => components.filter((c) => ANSWERABLE.has(c.type)),
    [components],
  );
  const total = answerableItems.length;
  const answeredCount = answerableItems.filter((c) => !isEmptyValue(values[c.fe_id])).length;
  const percent = total === 0 ? 0 : Math.round((answeredCount / total) * 100);

  let questionNo = 0;

  return (
    <div className="survey-fill-view">
      <Typography.Title level={3}>{title}</Typography.Title>
      {banner}
      <div className="fill-progress">
        <div className="fill-progress-label">
          {labels.progress}
          {" · "}
          {labels.answered} {answeredCount} / {total}
        </div>
        <Progress percent={percent} showInfo={false} />
      </div>
      {total === 0 ? <Empty description={labels.noQuestions} /> : null}
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
            <AnswerField item={c} value={values[c.fe_id]} error={error} onChange={(v) => onChange(c.fe_id, v)} />
          </QuestionCard>
        );
      })}
      {footer}
    </div>
  );
}
