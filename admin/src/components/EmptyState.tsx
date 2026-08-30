import { Empty } from "antd";
import type { ReactNode } from "react";

type EmptyStateProps = {
  description: ReactNode;
  extra?: ReactNode;
};

export function EmptyState({ description, extra }: EmptyStateProps) {
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
      {extra}
    </Empty>
  );
}
