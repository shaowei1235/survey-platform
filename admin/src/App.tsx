import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { App as AntdApp } from "antd";
import { fetchMe, isReauthRedirecting, logout, onReauthRequired } from "./api";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/LoadingState";
import { llmEnabled } from "./config";
import i18n from "./i18n";
import { AnalyzePage } from "./pages/AnalyzePage";
import { DashboardPage } from "./pages/DashboardPage";
import { DeptPage } from "./pages/DeptPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { SurveyEditPage } from "./pages/SurveyEditPage";
import { SurveyListPage } from "./pages/SurveyListPage";
import { UserPage } from "./pages/UserPage";
import { getAccess, isAdminRole, type Me } from "./session";

function Shell() {
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
        if (isReauthRedirecting()) return;
        logout();
        setMe(null);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <LoadingState />;
  if (isReauthRedirecting()) return <LoadingState />;
  if (!getAccess() || !me || !isAdminRole(me)) {
    if (location.pathname !== "/login") return <Navigate to="/login" replace />;
    return <LoginPage />;
  }

  return (
    <AppShell
      me={me}
      onLogout={() => {
        logout();
        navigate("/login");
      }}
    >
      <Routes>
        <Route path="/" element={<HomePage me={me} />} />
        <Route path="/surveys" element={<SurveyListPage me={me} />} />
        <Route path="/surveys/:id/edit" element={<SurveyEditPage me={me} />} />
        <Route path="/org/departments" element={<DeptPage me={me} />} />
        <Route path="/org/users" element={<UserPage me={me} />} />
        <Route path="/analytics/dashboard" element={<DashboardPage />} />
        <Route
          path="/analytics/intent"
          element={llmEnabled ? <AnalyzePage /> : <Navigate to="/analytics/dashboard" replace />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();

  useEffect(() => {
    return onReauthRequired(() => {
      message.error(i18n.t("error.unauthenticated"));
      window.setTimeout(() => {
        logout();
        navigate("/login", { replace: true });
      }, 1000);
    });
  }, [message, navigate]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  );
}
