"use client";

import { useRouter } from "next/navigation";
import { logout } from "../lib/api";
import { t } from "../lib/i18n";

export function ClientHeader() {
  const router = useRouter();

  return (
    <header className="client-header">
      <span className="client-header-brand">{t("appName")}</span>
      <button
        type="button"
        className="client-header-logout"
        onClick={() => {
          logout();
          router.replace("/login");
        }}
      >
        {t("answer.logout")}
      </button>
    </header>
  );
}
