const configuredLlmEnabled = import.meta.env.VITE_LLM_ENABLED?.trim().toLowerCase();

export const llmEnabled = configuredLlmEnabled
  ? configuredLlmEnabled === "true"
  : import.meta.env.DEV;
