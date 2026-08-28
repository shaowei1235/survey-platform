"use client";

import { Button, Result } from "antd";
import { useRouter } from "next/navigation";
import { t } from "../../../../lib/i18n";

export default function DonePage() {
  const router = useRouter();
  return (
    <Result
      status="success"
      title={t("answer.thanks")}
      extra={
        <Button type="primary" onClick={() => router.push("/surveys")}>
          {t("answer.back")}
        </Button>
      }
    />
  );
}
