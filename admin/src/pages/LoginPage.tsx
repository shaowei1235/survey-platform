import { Button, Card, Form, Input, Typography, message } from "antd";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiMessageKey, fetchMe, login } from "../api";
import { clearTokens, isAdminRole } from "../session";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const onFinish = async (values: { employee_no: string; password: string }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(values.employee_no, values.password);
      const me = await fetchMe();
      if (!isAdminRole(me)) {
        clearTokens();
        message.error(t("login.useClientApp"));
        return;
      }
      navigate("/");
    } catch (error) {
      message.error(t(apiMessageKey(error)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-login-wrap">
      <Card className="admin-login-card">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          {t("appName")}
        </Typography.Title>
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
      </Card>
    </div>
  );
}
