import { Button, Form, Input, Modal, Switch, Table, Tag, TreeSelect, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiMessageKey, isReauthRedirecting } from "../api";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { canWriteOrg, type Me } from "../session";

type Dept = { id: string; parent_id: string | null; name: string; sort_order: number; is_active: boolean };
type DeptNode = Dept & { children?: DeptNode[] };

type DeptFormValues = {
  name: string;
  parent_id?: string;
  is_active?: boolean;
};

function toTree(items: Dept[]): DeptNode[] {
  const map = new Map(items.map((d) => [d.id, { ...d, children: [] as DeptNode[] }]));
  const roots: DeptNode[] = [];
  for (const d of items) {
    const node = map.get(d.id)!;
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots.map(function prune(n: DeptNode): DeptNode {
    const children = n.children?.length ? n.children.map(prune) : undefined;
    return children ? { ...n, children } : { ...n, children: undefined };
  });
}

function descendantIds(items: Dept[], id: string): Set<string> {
  const byParent = new Map<string, string[]>();
  for (const d of items) {
    if (!d.parent_id) continue;
    const list = byParent.get(d.parent_id) ?? [];
    list.push(d.id);
    byParent.set(d.parent_id, list);
  }
  const out = new Set<string>();
  const walk = (nid: string) => {
    out.add(nid);
    for (const child of byParent.get(nid) ?? []) walk(child);
  };
  walk(id);
  return out;
}

function toSelectTree(nodes: DeptNode[]): { value: string; title: string; children?: ReturnType<typeof toSelectTree> }[] {
  return nodes.map((n) => ({
    value: n.id,
    title: n.name,
    children: n.children?.length ? toSelectTree(n.children) : undefined,
  }));
}

export function DeptPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Dept | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<DeptFormValues>();
  const writable = canWriteOrg(me);

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const { data } = await api.get("/departments");
      setItems(data.items);
      setLoadError(null);
    } catch (e) {
      if (isReauthRedirecting()) return;
      setLoadError(apiMessageKey(e));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [t]);

  const byId = useMemo(() => new Map(items.map((d) => [d.id, d])), [items]);
  const treeData = useMemo(() => toTree(items), [items]);
  const modalOpen = creating || editing != null;

  const parentTreeData = useMemo(() => {
    if (!editing) return toSelectTree(treeData);
    const blocked = descendantIds(items, editing.id);
    return toSelectTree(toTree(items.filter((d) => !blocked.has(d.id))));
  }, [editing, items, treeData]);

  const closeModal = () => {
    setCreating(false);
    setEditing(null);
    form.resetFields();
  };

  const requestClose = () => {
    if (saving) return;
    if (!form.isFieldsTouched()) {
      closeModal();
      return;
    }
    Modal.confirm({
      title: t("survey.unsavedConfirm"),
      okText: t("editor.leave"),
      cancelText: t("common.cancel"),
      onOk: closeModal,
    });
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    form.resetFields();
  };

  const openEdit = (row: Dept) => {
    setCreating(false);
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      parent_id: row.parent_id ?? undefined,
      is_active: row.is_active,
    });
  };

  const submit = async (values: DeptFormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}`, {
          name: values.name,
          parent_id: values.parent_id || null,
          is_active: values.is_active,
        });
      } else {
        await api.post("/departments", {
          name: values.name,
          parent_id: values.parent_id || null,
          sort_order: 0,
        });
      }
      await load(true);
      setSaving(false);
      closeModal();
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title={t("org.deptTitle")}
        description={t("org.deptDescription")}
        extra={
          writable ? (
            <Button type="primary" onClick={openCreate}>
              {t("org.addDept")}
            </Button>
          ) : null
        }
      />
      {loadError ? (
        <ErrorState message={t(loadError)} onRetry={() => void load()} retryLabel={t("common.retry")} />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError ? (
        <DataPanel>
          {items.length === 0 ? (
            <EmptyState
              description={t("org.empty.dept")}
              extra={
                writable ? (
                  <Button type="primary" onClick={openCreate}>
                    {t("org.addDept")}
                  </Button>
                ) : null
              }
            />
          ) : (
            <div className="org-table-wrap">
              <Table
                rowKey="id"
                dataSource={treeData}
                pagination={false}
                defaultExpandAllRows
                indentSize={20}
                scroll={{ x: 640 }}
                rowClassName={(row) => (row.is_active ? "" : "org-row-inactive")}
                columns={[
                  { title: t("org.deptName"), dataIndex: "name", ellipsis: true },
                  {
                    title: t("org.parent"),
                    dataIndex: "parent_id",
                    width: 200,
                    render: (id: string | null) => (id ? (byId.get(id)?.name ?? t("common.noData")) : t("common.noData")),
                  },
                  {
                    title: t("org.status"),
                    dataIndex: "is_active",
                    width: 100,
                    render: (active: boolean) => (
                      <Tag color={active ? "#17745A" : "#8A94A6"}>{active ? t("org.active") : t("org.inactive")}</Tag>
                    ),
                  },
                  ...(writable
                    ? [
                        {
                          title: t("survey.actions"),
                          key: "actions",
                          width: 88,
                          render: (_: unknown, row: Dept) => (
                            <Button size="small" type="link" onClick={() => openEdit(row)}>
                              {t("breadcrumb.edit")}
                            </Button>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          )}
        </DataPanel>
      ) : null}
      <Modal
        title={editing ? t("org.editDept") : t("org.addDept")}
        open={modalOpen}
        onCancel={requestClose}
        afterClose={() => form.resetFields()}
        okText={t("survey.save")}
        cancelText={t("common.cancel")}
        okButtonProps={{ loading: saving }}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form layout="vertical" form={form} onFinish={(v) => void submit(v)}>
          <Form.Item
            name="name"
            label={t("org.deptName")}
            rules={[{ required: true, min: 1, max: 100, message: t("org.nameLength") }]}
          >
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="parent_id" label={t("org.parent")}>
            <TreeSelect
              allowClear
              treeDefaultExpandAll
              treeData={parentTreeData}
              placeholder={t("org.parent")}
            />
          </Form.Item>
          {editing ? (
            <Form.Item name="is_active" label={t("org.status")} valuePropName="checked">
              <Switch checkedChildren={t("org.active")} unCheckedChildren={t("org.inactive")} />
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
    </>
  );
}
