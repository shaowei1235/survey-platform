import { Layout, Menu, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { fetchMe, logout } from "./api";
import { AnalyzePage } from "./pages/AnalyzePage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeptPage } from "./pages/DeptPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { SurveyEditPage } from "./pages/SurveyEditPage";
import { SurveyListPage } from "./pages/SurveyListPage";
import { UserPage } from "./pages/UserPage";
import { canAnalyze, canWriteOrg, canWriteSurvey, getAccess, isAdminRole, type Me } from "./session";

function Shell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccess()) {
      setReady(true);
      return;
    }
    void fetchMe()
      .then((data) => setMe(data))
      .catch(() => {
        logout();
        setMe(null);
      })
      .finally(() => setReady(true));
  }, []);

  const items = useMemo(() => {
    if (!me) return [];
    const out = [{ key: "/", label: <Link to="/">{t("nav.home")}</Link> }];
    if (canWriteSurvey(me) || canAnalyze(me)) {
      out.push({ key: "/surveys", label: <Link to="/surveys">{t("nav.surveys")}</Link> });
    }
    if (canWriteOrg(me)) {
      out.push({ key: "/org/departments", label: <Link to="/org/departments">{t("nav.dept")}</Link> });
      out.push({ key: "/org/users", label: <Link to="/org/users">{t("nav.users")}</Link> });
    }
    if (canAnalyze(me)) {
      out.push({ key: "/analytics/dashboard", label: <Link to="/analytics/dashboard">{t("nav.dashboard")}</Link> });
      out.push({ key: "/analytics/intent", label: <Link to="/analytics/intent">{t("nav.analyze")}</Link> });
    }
    return out;
  }, [me, t]);

  if (!ready) return null;
  if (!getAccess() || !me || !isAdminRole(me)) {
    if (location.pathname !== "/login") return <Navigate to="/login" replace />;
    return <LoginPage />;
  }

  const selected = location.pathname.startsWith("/surveys")
    ? "/surveys"
    : location.pathname.startsWith("/org/departments")
      ? "/org/departments"
      : location.pathname.startsWith("/org/users")
        ? "/org/users"
        : location.pathname.startsWith("/analytics/dashboard")
          ? "/analytics/dashboard"
          : location.pathname.startsWith("/analytics/intent")
            ? "/analytics/intent"
            : "/";

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Sider theme="light" width={220}>
        <Typography.Title level={5} style={{ padding: 16 }}>
          {t("appName")}
        </Typography.Title>
        <Menu mode="inline" selectedKeys={[selected]} items={items} />
        <div style={{ padding: 16 }}>
          <a
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            {t("nav.logout")}
          </a>
        </div>
      </Layout.Sider>
      <Layout>
        <Layout.Content style={{ padding: 24 }}>
          <Routes>
            <Route path="/" element={<HomePage me={me} />} />
            <Route path="/surveys" element={<SurveyListPage me={me} />} />
            <Route path="/surveys/:id/edit" element={<SurveyEditPage me={me} />} />
            <Route path="/org/departments" element={<DeptPage me={me} />} />
            <Route path="/org/users" element={<UserPage me={me} />} />
            <Route path="/analytics/dashboard" element={<DashboardPage />} />
            <Route path="/analytics/intent" element={<AnalyzePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
