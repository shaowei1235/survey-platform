import { Button, Input, Popconfirm, Select, Space, Table, Tooltip, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { api, apiMessageKey, isReauthRedirecting } from "../api";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar } from "../components/FilterBar";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { canWriteSurvey, type Me } from "../session";

type Row = { id: string; title: string; status: string; updated_at: string | null };

const STATUS_FILTERS = ["draft", "published", "closed"] as const;

function formatUpdatedAt(value: string | null, emptyLabel: string): string {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function SurveyListPage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const writable = canWriteSurvey(me);

  const load = async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const { data } = await api.get("/surveys");
      setRows(data.items);
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

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const { data } = await api.post("/surveys", { title: t("survey.newTitle") });
      navigate(`/surveys/${data.id}/edit`);
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      setCreating(false);
    }
  };

  const runStatusAction = async (id: string, action: "publish" | "close") => {
    if (actingId) return;
    setActingId(id);
    try {
      await api.post(`/surveys/${id}/${action}`);
      await load(true);
    } catch (e) {
      if (!isReauthRedirecting()) message.error(t(apiMessageKey(e)));
    } finally {
      setActingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && !row.title.toLowerCase().includes(q)) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
  }, [rows, keyword, statusFilter]);

  const filtersActive = keyword.trim() !== "" || statusFilter !== "";

  const clearFilters = () => {
    setKeyword("");
    setStatusFilter("");
  };

  const openSurvey = (id: string) => {
    navigate(`/surveys/${id}/edit`);
  };

  return (
    <>
      <PageHeader
        title={t("survey.list")}
        description={t("survey.listDescription")}
        extra={
          writable ? (
            <Button type="primary" loading={creating} onClick={() => void create()}>
              {t("survey.create")}
            </Button>
          ) : null
        }
      />
      {loadError ? (
        <ErrorState
          message={t(loadError)}
          onRetry={() => void load()}
          retryLabel={t("common.retry")}
        />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError ? (
        <>
          {rows.length > 0 || filtersActive ? (
            <FilterBar>
              <Input
                allowClear
                className="filter-control"
                placeholder={t("survey.filter.keyword")}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
              <Select
                className="filter-control-status"
                aria-label={t("survey.filter.status")}
                value={statusFilter || "all"}
                onChange={(value) => setStatusFilter(value === "all" ? "" : value)}
                options={[
                  { value: "all", label: t("survey.filter.allStatus") },
                  ...STATUS_FILTERS.map((status) => ({
                    value: status,
                    label: t(`survey.status.${status}`),
                  })),
                ]}
              />
            </FilterBar>
          ) : null}
          <DataPanel>
            {rows.length === 0 ? (
              <EmptyState
                description={t("survey.empty.default")}
                extra={
                  writable ? (
                    <Button type="primary" loading={creating} onClick={() => void create()}>
                      {t("survey.create")}
                    </Button>
                  ) : null
                }
              />
            ) : filtered.length === 0 ? (
              <EmptyState
                description={t("survey.empty.filtered")}
                extra={
                  <Button onClick={clearFilters}>{t("common.clearFilters")}</Button>
                }
              />
            ) : (
              <div className="survey-table-wrap">
                <Table
                  rowKey="id"
                  dataSource={filtered}
                  pagination={filtered.length > 10 ? { pageSize: 10 } : false}
                  scroll={{ x: 720 }}
                  columns={[
                    {
                      title: t("survey.title"),
                      dataIndex: "title",
                      render: (title: string) => (
                        <Tooltip title={title}>
                          <span className="survey-title-cell">{title}</span>
                        </Tooltip>
                      ),
                    },
                    {
                      title: t("survey.statusLabel"),
                      dataIndex: "status",
                      width: 120,
                      render: (status: string) => <StatusTag status={status} />,
                    },
                    {
                      title: t("survey.updatedAt"),
                      dataIndex: "updated_at",
                      width: 180,
                      render: (value: string | null) => formatUpdatedAt(value, t("common.noData")),
                    },
                    {
                      title: t("survey.actions"),
                      key: "actions",
                      width: 220,
                      render: (_: unknown, row: Row) => {
                        const busy = actingId === row.id;
                        const canEdit = writable && row.status === "draft";
                        return (
                          <Space wrap>
                            <Button
                              size="small"
                              type="primary"
                              ghost={!canEdit}
                              onClick={() => openSurvey(row.id)}
                            >
                              {canEdit ? t("breadcrumb.edit") : t("survey.view")}
                            </Button>
                            {writable && row.status === "draft" ? (
                              <Popconfirm
                                title={t("survey.publishConfirm.title")}
                                description={t("survey.publishConfirm.description")}
                                okText={t("survey.publish")}
                                cancelText={t("common.cancel")}
                                onConfirm={() => void runStatusAction(row.id, "publish")}
                              >
                                <Button size="small" loading={busy} disabled={Boolean(actingId) && !busy}>
                                  {t("survey.publish")}
                                </Button>
                              </Popconfirm>
                            ) : null}
                            {writable && row.status === "published" ? (
                              <Popconfirm
                                title={t("survey.closeConfirm.title")}
                                description={t("survey.closeConfirm.description")}
                                okText={t("survey.close")}
                                cancelText={t("common.cancel")}
                                onConfirm={() => void runStatusAction(row.id, "close")}
                              >
                                <Button size="small" danger loading={busy} disabled={Boolean(actingId) && !busy}>
                                  {t("survey.close")}
                                </Button>
                              </Popconfirm>
                            ) : null}
                          </Space>
                        );
                      },
                    },
                  ]}
                />
              </div>
            )}
          </DataPanel>
        </>
      ) : null}
    </>
  );
}
