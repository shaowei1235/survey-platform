import en from "../messages/en.json";
import ja from "../messages/ja.json";

type Dict = Record<string, unknown>;

const catalogs = { ja, en } as const;
const locale: keyof typeof catalogs = "ja";

export function t(key: string): string {
  const parts = key.split(".");
  let cur: unknown = catalogs[locale];
  for (const part of parts) {
    if (typeof cur !== "object" || cur === null || !(part in (cur as Dict))) return key;
    cur = (cur as Dict)[part];
  }
  return typeof cur === "string" ? cur : key;
}
