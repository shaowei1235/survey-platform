import { Button, Form, Input, InputNumber, Switch, Table, TreeSelect, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiMessageKey } from "../api";
import { canWriteOrg, type Me } from "../session";

type Dept = { id: string; parent_id: string | null; name: string; sort_order: number; is_active: boolean };

function toTree(items: Dept[]) {
  const map = new Map(items.map((d) => [d.id, { ...d, children: [] as never[] }]));
  const roots: Array<Dept & { children: unknown[] }> = [];
  for (const d of items) {
    const node = map.get(d.id)!;
    if (d.parent_id && map.has(d.parent_id)) {
      (map.get(d.parent_id) as { children: unknown[] }).children.push(node);
    } else {
      roots.push(node as never);
    }
  }
  return roots;
}

export function DeptPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Dept[]>([]);
  const writable = canWriteOrg(me);
  const load = async () => {
    const { data } = await api.get("/departments");
    setItems(data.items);
  };
  useEffect(() => {
    void load().catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  const treeData = toTree(items).map(function walk(n: Dept & { children?: Dept[] }): object {
    return { value: n.id, title: n.name, children: (n.children ?? []).map(walk) };
  });

  return (
    <>
      {writable ? (
        <Form
          layout="inline"
          style={{ marginBottom: 16 }}
          onFinish={async (v) => {
            try {
              await api.post("/departments", { name: v.name, parent_id: v.parent_id || null, sort_order: v.sort_order ?? 0 });
              await load();
            } catch (e) {
              message.error(t(apiMessageKey(e)));
            }
          }}
        >
          <Form.Item name="name" rules={[{ required: true }]}>
            <Input placeholder={t("org.name")} />
          </Form.Item>
          <Form.Item name="parent_id">
            <TreeSelect allowClear style={{ width: 200 }} treeData={treeData} placeholder={t("org.parent")} />
          </Form.Item>
          <Form.Item name="sort_order">
            <InputNumber placeholder="sort" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {t("org.create")}
          </Button>
        </Form>
      ) : null}
      <Table
        rowKey="id"
        dataSource={items}
        columns={[
          { title: t("org.name"), dataIndex: "name" },
          {
            title: t("org.parent"),
            dataIndex: "parent_id",
            render: (id: string | null) => items.find((d) => d.id === id)?.name ?? "-",
          },
          {
            title: "",
            render: (_, row) =>
              writable ? (
                <Switch
                  checked={row.is_active}
                  onChange={async (checked) => {
                    await api.patch(`/departments/${row.id}`, { is_active: checked });
                    await load();
                  }}
                />
              ) : null,
          },
        ]}
      />
    </>
  );
}
