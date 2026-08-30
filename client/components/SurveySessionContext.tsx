"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type SurveySessionValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const SurveySessionContext = createContext<SurveySessionValue>({
  dirty: false,
  setDirty: () => undefined,
});

export function SurveySessionProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);
  return <SurveySessionContext.Provider value={value}>{children}</SurveySessionContext.Provider>;
}

export function useSurveySession() {
  return useContext(SurveySessionContext);
}
