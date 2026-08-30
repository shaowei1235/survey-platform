"use client";

import { Button, Typography } from "antd";

type ClientErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ClientErrorState({ message, onRetry, retryLabel }: ClientErrorStateProps) {
  return (
    <div className="client-error">
      <Typography.Paragraph style={{ marginBottom: onRetry ? 12 : 0 }}>{message}</Typography.Paragraph>
      {onRetry && retryLabel ? (
        <Button onClick={onRetry}>{retryLabel}</Button>
      ) : null}
    </div>
  );
}
