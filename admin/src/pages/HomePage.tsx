import { Button, Table, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { api, apiMessageKey, isReauthRedirecting } from "../api";
import { DataPanel } from "../components/DataPanel";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { StatusTag } from "../components/StatusTag";
import { canAnalyze, canWriteOrg, canWriteSurvey, type Me, type RoleCode } from "../session";

const ROLE_I18N: Record<RoleCode, string> = {
  system_admin: "role.systemAdmin",
  hr_planner: "role.hrPlanner",
  executive: "role.executive",
  dept_manager: "role.deptManager",
  employee: "role.employee",
};

type SurveyRow = { id: string; title: string; status: string; updated_at: string | null };

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

function StatLink({
  to,
  value,
  label,
}: {
  to: string;
  value: number;
  label: string;
}) {
  return (
    <Link to={to} className="home-stat">
      <div className="home-stat-value">{value}</div>
      <div className="home-stat-label">{label}</div>
    </Link>
  );
}

export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seeSurveys = canWriteSurvey(me) || canAnalyze(me);
  const seeOrg = canWriteOrg(me);
  const writable = canWriteSurvey(me);
  const [surveys, setSurveys] = useState<SurveyRow[]>([]);
  const [deptCount, setDeptCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const requests: Array<Promise<unknown>> = [];
      if (seeSurveys) requests.push(api.get("/surveys"));
      if (seeOrg) {
        requests.push(api.get("/departments"));
        requests.push(api.get("/users", { params: { page: 1, page_size: 1 } }));
      }
      const results = await Promise.all(requests);
      let index = 0;
      if (seeSurveys) {
        const data = (results[index] as { data: { items: SurveyRow[] } }).data;
        setSurveys(data.items);
        index += 1;
      } else {
        setSurveys([]);
      }
      if (seeOrg) {
        const depts = (results[index] as { data: { items: unknown[] } }).data;
        setDeptCount(depts.items.length);
        const users = (results[index + 1] as { data: { total?: number; items: unknown[] } }).data;
        setUserCount(typeof users.total === "number" ? users.total : users.items.length);
      } else {
        setDeptCount(0);
        setUserCount(0);
      }
    } catch (e) {
      if (isReauthRedirecting()) return;
      setLoadError(apiMessageKey(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [t, seeSurveys, seeOrg]);

  const draftCount = surveys.filter((s) => s.status === "draft").length;
  const publishedCount = surveys.filter((s) => s.status === "published").length;
  const closedCount = surveys.filter((s) => s.status === "closed").length;
  const recent = useMemo(() => surveys.slice(0, 5), [surveys]);

  const nextItems = useMemo(() => {
    const items: { to: string; label: string }[] = [];
    if (writable && surveys.length === 0 && !loading && !loadError) {
      items.push({ to: "/surveys", label: t("home.next.createFirst") });
    }
    if (writable && draftCount > 0) {
      items.push({ to: "/surveys", label: t("home.next.drafts", { count: draftCount }) });
    }
    if (canAnalyze(me) && publishedCount > 0) {
      items.push({ to: "/analytics/intent", label: t("home.next.analyze") });
    }
    return items.slice(0, 3);
  }, [writable, surveys.length, loading, loadError, draftCount, publishedCount, me, t]);

  const roleLabels = [...new Set(me.roles.map((r) => t(ROLE_I18N[r.role])))];

  return (
    <>
      <PageHeader title={t("nav.home")} description={t("home.description")} />
      <Typography.Paragraph className="home-greeting">{t("home.greeting", { name: me.display_name })}</Typography.Paragraph>
      {roleLabels.length > 0 ? (
        <Typography.Paragraph type="secondary" className="home-role-hint">
          {t("home.roles")}: {roleLabels.join(" / ")}
        </Typography.Paragraph>
      ) : null}
      {loadError ? (
        <ErrorState message={t(loadError)} onRetry={() => void load()} retryLabel={t("common.retry")} />
      ) : null}
      {loading && !loadError ? <LoadingState /> : null}
      {!loading && !loadError ? (
        <>
          <div className="home-stats">
            {seeSurveys ? (
              <>
                <StatLink to="/surveys" value={draftCount} label={t("home.stats.draft")} />
                <StatLink to="/surveys" value={publishedCount} label={t("home.stats.published")} />
                <StatLink to="/surveys" value={closedCount} label={t("home.stats.closed")} />
              </>
            ) : null}
            {seeOrg ? (
              <>
                <StatLink to="/org/departments" value={deptCount} label={t("home.stats.departments")} />
                <StatLink to="/org/users" value={userCount} label={t("home.stats.users")} />
              </>
            ) : null}
          </div>
          {nextItems.length > 0 ? (
            <DataPanel title={t("home.next.title")}>
              <ul className="home-next-list">
                {nextItems.map((item) => (
                  <li key={`${item.to}-${item.label}`}>
                    <Link to={item.to}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </DataPanel>
          ) : null}
          {seeSurveys ? (
            <DataPanel
              title={t("home.recent")}
              extra={
                <Button type="link" onClick={() => navigate("/surveys")}>
                  {t("home.openList")}
                </Button>
              }
            >
              {recent.length === 0 ? (
                <EmptyState
                  description={t("home.recentEmpty")}
                  extra={
                    writable ? (
                      <Button type="primary" onClick={() => navigate("/surveys")}>
                        {t("survey.create")}
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <Table
                  rowKey="id"
                  size="small"
                  pagination={false}
                  dataSource={recent}
                  scroll={{ x: 560 }}
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
                      width: 100,
                      render: (_: unknown, row: SurveyRow) => (
                        <Button
                          size="small"
                          type="primary"
                          ghost={!(writable && row.status === "draft")}
                          onClick={() => navigate(`/surveys/${row.id}/edit`)}
                        >
                          {writable && row.status === "draft" ? t("breadcrumb.edit") : t("survey.view")}
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </DataPanel>
          ) : null}
        </>
      ) : null}
    </>
  );
}
