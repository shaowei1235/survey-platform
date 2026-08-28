"use client";

import { Alert, Button, Space, Typography, message } from "antd";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AnswerField } from "../../../components/AnswerField";
import { apiMessageKey, getSurvey, submitSurvey, type ComponentItem } from "../../../lib/api";
import { getAccess } from "../../../lib/session";
import { t } from "../../../lib/i18n";

const ANSWERABLE = new Set(["radio", "checkbox", "input", "textarea"]);

export default function FillPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccess()) {
      router.replace("/login");
      return;
    }
    void getSurvey(id)
      .then((data) => {
        setTitle(data.title);
        setComponents(data.component_list);
      })
      .catch((e) => {
        message.error(t(apiMessageKey(e)));
        router.replace("/surveys");
      })
      .finally(() => setReady(true));
  }, [id, router]);

  const onSubmit = async () => {
    for (const c of components) {
      if (!ANSWERABLE.has(c.type)) continue;
      if (!c.props.required) continue;
      const v = values[c.fe_id];
      const empty = v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) {
        message.error(t("answer.required"));
        return;
      }
    }
    const answers = components
      .filter((c) => ANSWERABLE.has(c.type) && values[c.fe_id] !== undefined)
      .map((c) => ({ fe_id: c.fe_id, type: c.type, value: values[c.fe_id] }));
    try {
      await submitSurvey(id, answers);
      router.replace(`/surveys/${id}/done`);
    } catch (e) {
      message.error(t(apiMessageKey(e)));
    }
  };

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <Typography.Title level={3}>{title}</Typography.Title>
      <Alert style={{ marginBottom: 24 }} message={t("answer.attrBound")} />
      {components.map((c) => (
        <AnswerField
          key={c.fe_id}
          item={c}
          value={values[c.fe_id]}
          onChange={(v) => setValues((prev) => ({ ...prev, [c.fe_id]: v }))}
        />
      ))}
      <Space>
        <Button type="primary" onClick={() => void onSubmit()}>
          {t("answer.submit")}
        </Button>
        <Button onClick={() => router.push("/surveys")}>{t("answer.back")}</Button>
      </Space>
    </div>
  );
}
