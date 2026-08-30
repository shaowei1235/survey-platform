"use client";

import { ClientHeader } from "./ClientHeader";
import { SurveySessionProvider } from "./SurveySessionContext";

export function SurveysShell({ children }: { children: React.ReactNode }) {
  return (
    <SurveySessionProvider>
      <ClientHeader />
      {children}
    </SurveySessionProvider>
  );
}
