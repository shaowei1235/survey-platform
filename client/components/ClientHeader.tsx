import type { ReactNode } from "react";
import { t } from "../lib/i18n";

type ClientHeaderProps = {
  extra?: ReactNode;
};

export function ClientHeader({ extra }: ClientHeaderProps) {
  return (
    <header className="client-header">
      <span className="client-header-brand">{t("appName")}</span>
      {extra ? <div className="client-header-extra">{extra}</div> : null}
    </header>
  );
}
