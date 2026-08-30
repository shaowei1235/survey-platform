import { Button, Typography } from "antd";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
};

export function PageHeader({ title, description, extra, onBack, backLabel }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        {onBack && backLabel ? (
          <Button type="link" onClick={onBack} style={{ paddingInline: 0 }}>
            {backLabel}
          </Button>
        ) : null}
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {description}
          </Typography.Paragraph>
        ) : null}
      </div>
      {extra ? <div className="page-header-extra">{extra}</div> : null}
    </div>
  );
}
