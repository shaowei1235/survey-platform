"use client";

import { App, ConfigProvider } from "antd";
import jaJP from "antd/locale/ja_JP";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={jaJP}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
