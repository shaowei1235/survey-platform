export type AnalyzableSurvey = {
  id: string;
  title: string;
  status?: string;
  response_count?: number;
  published_at?: string | null;
  closed_at?: string | null;
  updated_at?: string | null;
};

function timestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function analyticsRecency(survey: AnalyzableSurvey): number {
  return timestamp(survey.closed_at) || timestamp(survey.published_at) || timestamp(survey.updated_at);
}

/** Prefer the analyzable survey with the most responses; ties use closed/published recency. */
export function pickDefaultAnalyzableSurvey<T extends AnalyzableSurvey>(surveys: T[]): T | undefined {
  if (surveys.length === 0) return undefined;
  return surveys.slice().sort((a, b) => {
    const countDelta = (b.response_count ?? 0) - (a.response_count ?? 0);
    if (countDelta !== 0) return countDelta;
    return analyticsRecency(b) - analyticsRecency(a);
  })[0];
}
