import type { ThemeConfig } from "antd";

/** Keep core tokens in sync with admin/src/theme.ts. Do not add a shared package. */
export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: "#3155A6",
    colorBgLayout: "#F5F7FA",
    colorBgContainer: "#FFFFFF",
    colorText: "#172033",
    colorTextSecondary: "#667085",
    colorBorderSecondary: "#E4E9F0",
    colorSuccess: "#17745A",
    colorWarning: "#9A6811",
    colorError: "#B13A44",
    borderRadius: 7,
    borderRadiusLG: 10,
    controlHeight: 36,
    fontFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif",
  },
};
