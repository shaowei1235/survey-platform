import {
  ApartmentOutlined,
  BarChartOutlined,
  FormOutlined,
  RightOutlined,
  RobotOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Col, Row, Typography } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { canAnalyze, canWriteOrg, canWriteSurvey, type Me, type RoleCode } from "../session";

const ROLE_I18N: Record<RoleCode, string> = {
  system_admin: "role.systemAdmin",
  hr_planner: "role.hrPlanner",
  executive: "role.executive",
  dept_manager: "role.deptManager",
  employee: "role.employee",
};

type Entry = {
  to: string;
  titleKey: string;
  descriptionKey: string;
  icon: ReactNode;
};

export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const entries: Entry[] = [];

  if (canWriteSurvey(me) || canAnalyze(me)) {
    entries.push({
      to: "/surveys",
      titleKey: "nav.surveys",
      descriptionKey: "home.entry.surveys",
      icon: <FormOutlined />,
    });
  }
  if (canWriteOrg(me)) {
    entries.push({
      to: "/org/departments",
      titleKey: "nav.dept",
      descriptionKey: "home.entry.departments",
      icon: <ApartmentOutlined />,
    });
    entries.push({
      to: "/org/users",
      titleKey: "nav.users",
      descriptionKey: "home.entry.users",
      icon: <TeamOutlined />,
    });
  }
  if (canAnalyze(me)) {
    entries.push({
      to: "/analytics/dashboard",
      titleKey: "nav.dashboard",
      descriptionKey: "home.entry.dashboard",
      icon: <BarChartOutlined />,
    });
    entries.push({
      to: "/analytics/intent",
      titleKey: "nav.analyze",
      descriptionKey: "home.entry.analyze",
      icon: <RobotOutlined />,
    });
  }

  const roleLabels = [...new Set(me.roles.map((r) => t(ROLE_I18N[r.role])))];

  return (
    <>
      <PageHeader title={t("nav.home")} description={t("home.description")} />
      {roleLabels.length > 0 ? (
        <Typography.Paragraph type="secondary" className="home-role-hint">
          {t("home.roles")}: {roleLabels.join(" / ")}
        </Typography.Paragraph>
      ) : null}
      <Row gutter={[16, 16]}>
        {entries.map((entry) => (
          <Col key={entry.to} xs={24} sm={12} xl={8}>
            <Link to={entry.to} className="home-entry-link">
              <div className="home-entry-card">
                <div className="home-entry-icon">{entry.icon}</div>
                <div className="home-entry-title">{t(entry.titleKey)}</div>
                <div className="home-entry-desc">{t(entry.descriptionKey)}</div>
                <RightOutlined className="home-entry-arrow" />
              </div>
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
