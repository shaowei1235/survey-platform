"use client";

import { App, Button, Card, Empty, Typography } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ClientErrorState } from "../../components/ClientErrorState";
import { ClientLoadingState } from "../../components/ClientLoadingState";
import { apiMessageKey, consumeUnauthenticated, listSurveys } from "../../lib/api";
import { getAccess } from "../../lib/session";
import { t } from "../../lib/i18n";

export default function SurveyListPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [items, setItems] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listSurveys();
      setItems(data.items);
    } catch (e) {
      if (consumeUnauthenticated(e, { error: (text) => message.error(text), replace: (path) => router.replace(path) })) {
        return;
      }
      setLoadError(apiMessageKey(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [router]);

  return (
    <div className="client-page">
      <Typography.Title level={3} style={{ marginBottom: 8 }}>
        {t("answer.list")}
      </Typography.Title>
      <Typography.Paragraph type="secondary">{t("answer.listDescription")}</Typography.Paragraph>
      {loading ? <ClientLoadingState /> : null}
      {!loading && loadError ? (
        <ClientErrorState message={t(loadError)} onRetry={() => void load()} retryLabel={t("answer.retry")} />
      ) : null}
      {!loading && !loadError && items.length === 0 ? <Empty description={t("answer.none")} /> : null}
      {!loading && !loadError && items.length > 0 ? (
        <div className="survey-card-grid">
          {items.map((s) => (
            <Card key={s.id} className="survey-card" title={s.title}>
              <Link href={`/surveys/${s.id}`}>
                <Button type="primary">{t("answer.start")}</Button>
              </Link>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
