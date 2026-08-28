"use client";

import { Button, Card, Empty, Space, Typography, message } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiMessageKey, listSurveys, logout } from "../../lib/api";
import { getAccess } from "../../lib/session";
import { t } from "../../lib/i18n";

export default function SurveyListPage() {
  const router = useRouter();
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    void listSurveys()
      .then((data) => setItems(data.items))
      .catch((e) => {
        message.error(t(apiMessageKey(e)));
        if (apiMessageKey(e) === "error.unauthenticated") router.replace("/login");
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={3}>{t("answer.list")}</Typography.Title>
        <Button
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          {t("answer.logout")}
        </Button>
      </Space>
      {items.length === 0 ? (
        <Empty description={t("answer.none")} />
      ) : (
        items.map((s) => (
          <Card key={s.id} style={{ marginBottom: 12 }} title={s.title}>
            <Link href={`/surveys/${s.id}`}>
              <Button type="primary">{t("answer.start")}</Button>
            </Link>
          </Card>
        ))
      )}
    </div>
  );
}
