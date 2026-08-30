"use client";

import { App, Button, Card, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { fetchMe, login, apiMessageKey } from "../../lib/api";
import { clearTokens, hasEmployeeRole } from "../../lib/session";
import { t } from "../../lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { employee_no: string; password: string }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(values.employee_no, values.password);
      const me = await fetchMe();
      if (!hasEmployeeRole(me)) {
        clearTokens();
        message.error(t("login.noAnswerRole"));
        return;
      }
      router.replace("/surveys");
    } catch (error) {
      message.error(t(apiMessageKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="client-login-wrap">
      <Card className="client-login-card">
        <Typography.Text type="secondary">{t("appName")}</Typography.Text>
        <Typography.Title level={3} style={{ marginTop: 8 }}>
          {t("login.title")}
        </Typography.Title>
        <Typography.Paragraph type="secondary">{t("login.description")}</Typography.Paragraph>
        <Form layout="vertical" onFinish={(v) => void onFinish(v)}>
          <Form.Item name="employee_no" label={t("login.employeeNo")} rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label={t("login.password")} rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting} disabled={submitting}>
            {t("login.submit")}
          </Button>
        </Form>
        <Typography.Paragraph type="secondary" className="client-login-hint">
          {t("login.hint")}
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
