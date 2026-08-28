import ja from "../messages/ja.json";

type Dict = Record<string, unknown>;

export function t(key: string): string {
  const parts = key.split(".");
  let cur: unknown = ja;
  for (const part of parts) {
    if (typeof cur !== "object" || cur === null || !(part in (cur as Dict))) return key;
    cur = (cur as Dict)[part];
  }
  return typeof cur === "string" ? cur : key;
}
