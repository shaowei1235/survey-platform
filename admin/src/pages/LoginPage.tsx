import { Button, Form, Input, Typography, message } from "antd";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { apiMessageKey, fetchMe, login } from "../api";
import { clearTokens, isAdminRole } from "../session";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const onFinish = async (values: { employee_no: string; password: string }) => {
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
