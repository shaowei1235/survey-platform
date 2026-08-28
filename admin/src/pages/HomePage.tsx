import { Card, Col, Row, Typography } from "antd";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { canAnalyze, canWriteOrg, canWriteSurvey, type Me } from "../session";

export function HomePage({ me }: { me: Me }) {
  const { t } = useTranslation();
  const cards = [
    canWriteSurvey(me) || canAnalyze(me) ? { to: "/surveys", title: t("nav.surveys") } : null,
    canWriteOrg(me) ? { to: "/org/departments", title: t("nav.dept") } : null,
    canWriteOrg(me) ? { to: "/org/users", title: t("nav.users") } : null,
    canAnalyze(me) ? { to: "/analytics/dashboard", title: t("nav.dashboard") } : null,
    canAnalyze(me) ? { to: "/analytics/intent", title: t("nav.analyze") } : null,
  ].filter(Boolean) as { to: string; title: string }[];

  return (
    <>
      <Typography.Paragraph>{t("home.welcome")}</Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col key={c.to} xs={24} sm={12} md={8}>
            <Link to={c.to}>
              <Card hoverable title={c.title} />
            </Link>
          </Col>
        ))}
      </Row>
    </>
  );
}
