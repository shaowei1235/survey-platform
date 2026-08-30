"use client";

import "@ant-design/v5-patch-for-react-19";
import { App, ConfigProvider } from "antd";
import jaJP from "antd/locale/ja_JP";
import { appTheme } from "../theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={jaJP} theme={appTheme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
