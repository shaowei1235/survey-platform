"use client";

import type { ReactNode } from "react";

type QuestionCardProps = {
  id: string;
  number?: number;
  answered?: boolean;
  error?: boolean;
  children: ReactNode;
};

export function QuestionCard({ id, number, answered, error, children }: QuestionCardProps) {
  const className = [
    "question-card",
    answered ? "is-answered" : "",
    error ? "is-error" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section id={id} className={className}>
      {number != null ? <div className="question-card-num">Q{number}</div> : null}
      {children}
    </section>
  );
}
