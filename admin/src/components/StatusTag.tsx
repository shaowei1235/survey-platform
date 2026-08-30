import { Tag } from "antd";
import { useTranslation } from "react-i18next";

const STATUS_COLORS: Record<string, string> = {
  draft: "#667085",
  published: "#17745A",
  closed: "#B13A44",
};

const KNOWN = new Set(Object.keys(STATUS_COLORS));

type StatusTagProps = {
  status: string;
};

export function StatusTag({ status }: StatusTagProps) {
  const { t } = useTranslation();
  const label = KNOWN.has(status) ? t(`survey.status.${status}`) : status;
  const color = STATUS_COLORS[status] ?? "#667085";
  return <Tag color={color}>{label}</Tag>;
}
