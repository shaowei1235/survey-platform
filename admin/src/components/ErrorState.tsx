import { Alert, Button } from "antd";
import type { ReactNode } from "react";

type ErrorStateProps = {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({ message, onRetry, retryLabel }: ErrorStateProps) {
  return (
    <Alert
      type="error"
      showIcon
      message={message}
      action={
        onRetry && retryLabel ? (
          <Button size="small" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : undefined
      }
    />
  );
}
