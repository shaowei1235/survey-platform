import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchMe, logout } from "./api";
import { AppShell } from "./components/AppShell";
import { LoadingState } from "./components/LoadingState";
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
        logout();
        setMe(null);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <LoadingState />;
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
        <Route path="/analytics/intent" element={<AnalyzePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
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
