import { Spin } from "antd";

type LoadingStateProps = {
  tip?: string;
};

export function LoadingState({ tip }: LoadingStateProps) {
  return (
    <div className="loading-state">
      <Spin size="large" tip={tip}>
        <div className="loading-state-slot" />
      </Spin>
    </div>
  );
}
