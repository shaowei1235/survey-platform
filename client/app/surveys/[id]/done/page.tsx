"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientLoadingState } from "../../../../components/ClientLoadingState";
import { getAccess } from "../../../../lib/session";
import { t } from "../../../../lib/i18n";

export default function DonePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) return <ClientLoadingState />;

  return (
    <div className="client-page">
      <div className="client-done-panel">
        <Result
          status="success"
          title={t("answer.thanks")}
          subTitle={t("answer.thanksHint")}
          extra={
            <Button type="primary" onClick={() => router.push("/surveys")}>
              {t("answer.back")}
            </Button>
          }
        />
      </div>
    </div>
  );
}
