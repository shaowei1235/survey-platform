export type DeptOptionInput = {
  id: string;
  name: string;
  parent_id?: string | null;
  sort_order?: number;
};

export function deptSelectOptions(items: DeptOptionInput[]): { value: string; label: string }[] {
  const ids = new Set(items.map((d) => d.id));
  const byParent = new Map<string | null, DeptOptionInput[]>();
  for (const d of items) {
    const parent = d.parent_id && ids.has(d.parent_id) ? d.parent_id : null;
    const list = byParent.get(parent) ?? [];
    list.push(d);
    byParent.set(parent, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, "ja"));
  }
  const out: { value: string; label: string }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const d of byParent.get(parent) ?? []) {
      out.push({ value: d.id, label: `${"　".repeat(depth)}${d.name}` });
      walk(d.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
