import type { ComponentItem } from "./session";

export type ChoiceOption = {
  value: string;
  label: string;
  score?: number;
};

export function parseOptions(props: Record<string, unknown>): ChoiceOption[] {
  const raw = props.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (!item || typeof item !== "object") return { value: "", label: "" };
    const opt = item as Record<string, unknown>;
    const next: ChoiceOption = {
      value: typeof opt.value === "string" || typeof opt.value === "number" ? String(opt.value) : "",
      label: typeof opt.label === "string" ? opt.label : "",
    };
    if (typeof opt.score === "number" && Number.isInteger(opt.score)) next.score = opt.score;
    return next;
  });
}

export function withoutScore(opt: ChoiceOption): ChoiceOption {
  return { value: opt.value, label: opt.label };
}

export function nextOptionValue(options: ChoiceOption[]): string {
  const used = new Set(options.map((o) => o.value));
  let n = 1;
  while (used.has(String(n))) n += 1;
  return String(n);
}

export function normalizeOptions(options: ChoiceOption[]): ChoiceOption[] {
  return options.map((opt) => {
    const next: ChoiceOption = { value: opt.value.trim(), label: opt.label.trim() };
    if (typeof opt.score === "number" && Number.isInteger(opt.score)) next.score = opt.score;
    return next;
  });
}

export function withNormalizedChoices(list: ComponentItem[]): ComponentItem[] {
  return list.map((item) => {
    if (item.type !== "radio" && item.type !== "checkbox") return item;
    return { ...item, props: { ...item.props, options: normalizeOptions(parseOptions(item.props)) } };
  });
}

/** Returns an i18n key, or null if valid. Matches api/app/services/components.py. */
export function validateComponentList(list: ComponentItem[]): string | null {
  for (const item of list) {
    if (item.type !== "radio" && item.type !== "checkbox") continue;
    const options = parseOptions(item.props);
    if (options.length < 2) return "editor.validation.minOptions";
    const values: string[] = [];
    for (const opt of options) {
      if (!opt.value.trim()) return "editor.validation.valueRequired";
      if (!opt.label.trim()) return "editor.validation.labelRequired";
      values.push(opt.value.trim());
      if (item.type === "radio" && item.props.scoreEnabled) {
        if (typeof opt.score !== "number" || !Number.isInteger(opt.score)) {
          return "editor.validation.scoreRequired";
        }
      }
    }
    if (new Set(values).size !== values.length) return "editor.validation.valueDuplicate";
  }
  return null;
}
