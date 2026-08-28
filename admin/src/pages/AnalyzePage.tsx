import { Button, Card, Form, Input, Select, Typography, message } from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, apiMessageKey } from "../api";

export function AnalyzePage() {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [surveys, setSurveys] = useState<Array<{ id: string; title: string }>>([]);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [out, setOut] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void Promise.all([api.get("/surveys"), api.get("/departments")])
      .then(([s, d]) => {
        setSurveys(s.data.items.filter((i: { status: string }) => i.status !== "draft"));
        setDepts(d.data.items);
      })
      .catch((e) => message.error(t(apiMessageKey(e))));
  }, [t]);

  return (
    <>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480 }}
        initialValues={{ intent: "dept_low_score_and_causes" }}
        onFinish={async (v) => {
          try {
            const { data } = await api.post("/analytics/intent", v);
            setOut(data);
          } catch (e) {
            message.error(t(apiMessageKey(e)));
          }
        }}
      >
        <Form.Item name="survey_id" rules={[{ required: true }]}>
          <Select options={surveys.map((s) => ({ value: s.id, label: s.title }))} />
        </Form.Item>
        <Form.Item name="department_id" rules={[{ required: true }]}>
          <Select options={depts.map((d) => ({ value: d.id, label: d.name }))} />
        </Form.Item>
        <Form.Item name="intent" label={t("analyze.intent")}>
          <Select options={[{ value: "dept_low_score_and_causes", label: t("analyze.dept_low_score_and_causes") }]} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          {t("analyze.run")}
        </Button>
        <Button
          style={{ marginLeft: 8 }}
          onClick={async () => {
            try {
              const v = await form.validateFields(["survey_id", "department_id"]);
              const { data } = await api.post("/analytics/free-text-summary", {
                survey_id: v.survey_id,
                department_id: v.department_id,
              });
              setOut(data);
            } catch (e) {
              message.error(t(apiMessageKey(e)));
            }
          }}
        >
          {t("analyze.summary")}
        </Button>
      </Form>
      {out ? (
        <Card style={{ marginTop: 16 }}>
          <Typography.Paragraph>
            {String(out.conclusion ?? (typeof out.message_key === "string" ? t(out.message_key) : (out.negative_tendency ?? "")))}
          </Typography.Paragraph>
          <Input.TextArea readOnly autoSize value={JSON.stringify(out.evidence ?? out, null, 2)} />
        </Card>
      ) : null}
    </>
  );
}
