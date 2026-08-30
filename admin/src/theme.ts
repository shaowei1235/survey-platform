import type { ThemeConfig } from "antd";

/** Keep core tokens in sync with client/theme.ts. Do not add a shared package. */
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
  components: {
    Layout: {
      siderBg: "#1B2433",
      headerBg: "#FFFFFF",
      headerHeight: 58,
      headerPadding: "0 20px",
      bodyBg: "#F5F7FA",
    },
    Menu: {
      darkItemBg: "#1B2433",
      darkSubMenuItemBg: "#1B2433",
      darkItemSelectedBg: "#3155A6",
      darkItemHoverBg: "rgba(255,255,255,0.08)",
      darkGroupTitleColor: "rgba(255,255,255,0.45)",
    },
    Table: {
      headerBg: "#F8FAFC",
    },
    Card: {
      paddingLG: 20,
    },
    Tag: {
      defaultBg: "#F8FAFC",
    },
  },
};
