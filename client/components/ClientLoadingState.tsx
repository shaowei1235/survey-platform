"use client";

import { Spin } from "antd";

export function ClientLoadingState() {
  return (
    <div className="client-loading">
      <Spin />
    </div>
  );
}
