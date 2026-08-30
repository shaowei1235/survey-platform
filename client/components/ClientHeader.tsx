"use client";

import { App } from "antd";
import { useRouter } from "next/navigation";
import { logout } from "../lib/api";
import { t } from "../lib/i18n";
import { useSurveySession } from "./SurveySessionContext";

export function ClientHeader() {
  const router = useRouter();
  const { modal } = App.useApp();
  const { dirty, setDirty } = useSurveySession();

  const doLogout = () => {
    setDirty(false);
    logout();
    router.replace("/login");
  };

  return (
    <header className="client-header">
      <span className="client-header-brand">{t("appName")}</span>
      <button
        type="button"
        className="client-header-logout"
        onClick={() => {
          if (!dirty) {
            doLogout();
            return;
          }
          modal.confirm({
            title: t("answer.leaveConfirmTitle"),
            content: t("answer.logoutConfirm"),
            okText: t("answer.logout"),
            cancelText: t("answer.cancel"),
            transitionName: "",
            maskTransitionName: "",
            onOk: doLogout,
          });
        }}
      >
        {t("answer.logout")}
      </button>
    </header>
  );
}
