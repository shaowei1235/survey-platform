"use client";

import { Button, Form, Input, Typography, message } from "antd";
import { useRouter } from "next/navigation";
import { fetchMe, login, apiMessageKey } from "../../lib/api";
import { clearTokens, hasEmployeeRole } from "../../lib/session";
import { t } from "../../lib/i18n";

export default function LoginPage() {
  const router = useRouter();

  const onFinish = async (values: { employee_no: string; password: string }) => {
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
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <Typography.Title level={3}>{t("appName")}</Typography.Title>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="employee_no" label={t("login.employeeNo")} rules={[{ required: true }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label={t("login.password")} rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {t("login.submit")}
        </Button>
      </Form>
    </div>
  );
}
