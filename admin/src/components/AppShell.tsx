import {
  ApartmentOutlined,
  BarChartOutlined,
  FormOutlined,
  HomeOutlined,
  MenuOutlined,
  RobotOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Button, Drawer, Grid, Layout, Menu, Typography, type MenuProps } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { canAnalyze, canWriteOrg, canWriteSurvey, type Me, type RoleCode } from "../session";

type MenuItem = NonNullable<MenuProps["items"]>[number];

const SIDER_WIDTH = 216;
const COLLAPSED_WIDTH = 80;

const ROLE_I18N: Record<RoleCode, string> = {
  system_admin: "role.systemAdmin",
  hr_planner: "role.hrPlanner",
  executive: "role.executive",
  dept_manager: "role.deptManager",
  employee: "role.employee",
};

function selectedMenuKey(pathname: string): string {
  if (pathname.startsWith("/surveys")) return "/surveys";
  if (pathname.startsWith("/org/departments")) return "/org/departments";
  if (pathname.startsWith("/org/users")) return "/org/users";
  if (pathname.startsWith("/analytics/dashboard")) return "/analytics/dashboard";
  if (pathname.startsWith("/analytics/intent")) return "/analytics/intent";
  return "/";
}

function avatarLetter(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1) : "?";
}

type Crumb = { title: ReactNode; href?: string };

function crumbsFor(pathname: string, t: (key: string) => string): Crumb[] {
  if (pathname === "/") return [{ title: t("nav.home") }];
  if (pathname === "/surveys") {
    return [{ title: t("nav.home"), href: "/" }, { title: t("nav.surveys") }];
  }
  if (/^\/surveys\/[^/]+\/edit$/.test(pathname)) {
    return [
      { title: t("nav.home"), href: "/" },
      { title: t("nav.surveys"), href: "/surveys" },
      { title: t("breadcrumb.edit") },
    ];
  }
  if (pathname.startsWith("/org/departments")) {
    return [{ title: t("nav.home"), href: "/" }, { title: t("nav.dept") }];
  }
  if (pathname.startsWith("/org/users")) {
    return [{ title: t("nav.home"), href: "/" }, { title: t("nav.users") }];
  }
  if (pathname.startsWith("/analytics/dashboard")) {
    return [{ title: t("nav.home"), href: "/" }, { title: t("nav.dashboard") }];
  }
  if (pathname.startsWith("/analytics/intent")) {
    return [{ title: t("nav.home"), href: "/" }, { title: t("nav.analyze") }];
  }
  return [{ title: t("nav.home"), href: "/" }];
}

type AppShellProps = {
  me: Me;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({ me, onLogout, children }: AppShellProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const isDesktop = screens.xl === true;
  const isTablet = screens.md === true && screens.xl === false;

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (isDesktop) setCollapsed(false);
    else if (isTablet) setCollapsed(true);
  }, [isDesktop, isTablet]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const selected = selectedMenuKey(location.pathname);

  const menuItems = useMemo((): MenuItem[] => {
    const mainChildren: MenuItem[] = [
      { key: "/", icon: <HomeOutlined />, label: <Link to="/">{t("nav.home")}</Link> },
    ];
    if (canWriteSurvey(me) || canAnalyze(me)) {
      mainChildren.push({
        key: "/surveys",
        icon: <FormOutlined />,
        label: <Link to="/surveys">{t("nav.surveys")}</Link>,
      });
    }
    const items: MenuItem[] = [{ type: "group", label: t("nav.group.main"), children: mainChildren }];

    if (canWriteOrg(me)) {
      items.push({
        type: "group",
        label: t("nav.group.organization"),
        children: [
          {
            key: "/org/departments",
            icon: <ApartmentOutlined />,
            label: <Link to="/org/departments">{t("nav.dept")}</Link>,
          },
          {
            key: "/org/users",
            icon: <TeamOutlined />,
            label: <Link to="/org/users">{t("nav.users")}</Link>,
          },
        ],
      });
    }

    if (canAnalyze(me)) {
      items.push({
        type: "group",
        label: t("nav.group.analytics"),
        children: [
          {
            key: "/analytics/dashboard",
            icon: <BarChartOutlined />,
            label: <Link to="/analytics/dashboard">{t("nav.dashboard")}</Link>,
          },
          {
            key: "/analytics/intent",
            icon: <RobotOutlined />,
            label: <Link to="/analytics/intent">{t("nav.analyze")}</Link>,
          },
        ],
      });
    }

    return items;
  }, [me, t]);

  const crumbItems = crumbsFor(location.pathname, t).map((c) => ({
    title: c.href ? <Link to={c.href}>{c.title}</Link> : c.title,
  }));

  const firstRole = me.roles[0]?.role;
  const roleText = firstRole && firstRole in ROLE_I18N ? t(ROLE_I18N[firstRole]) : null;

  const siderInner = (
    <>
      <div className="app-shell-brand">{t("appName")}</div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selected]}
        items={menuItems}
        onClick={() => setDrawerOpen(false)}
      />
    </>
  );

  const showSider = !isMobile;
  const showMenuButton = isMobile || isTablet;

  return (
    <Layout className="app-shell">
      {showSider ? (
        <Layout.Sider
          theme="dark"
          width={SIDER_WIDTH}
          collapsedWidth={COLLAPSED_WIDTH}
          collapsed={collapsed}
          trigger={null}
          collapsible
          className="app-shell-sider"
        >
          {siderInner}
        </Layout.Sider>
      ) : (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={SIDER_WIDTH}
          closable={false}
          styles={{ body: { padding: 0, background: "#1B2433" }, header: { display: "none" } }}
        >
          {siderInner}
        </Drawer>
      )}
      <Layout>
        <Layout.Header className="app-shell-header">
          {showMenuButton ? (
            <Button
              type="text"
              icon={<MenuOutlined />}
              aria-label={t("common.openMenu")}
              onClick={() => {
                if (isMobile) setDrawerOpen(true);
                else setCollapsed((v) => !v);
              }}
            />
          ) : null}
          <Breadcrumb className="app-shell-breadcrumb" items={crumbItems} />
          <div className="app-shell-user">
            <Avatar size={32} style={{ backgroundColor: "#3155A6", flexShrink: 0 }}>
              {avatarLetter(me.display_name)}
            </Avatar>
            <div className="app-shell-user-text">
              <Typography.Text ellipsis>{me.display_name}</Typography.Text>
              {roleText ? (
                <Typography.Text type="secondary" ellipsis>
                  {roleText}
                </Typography.Text>
              ) : null}
            </div>
            <Button type="text" onClick={onLogout}>
              {t("nav.logout")}
            </Button>
          </div>
        </Layout.Header>
        <Layout.Content className="app-shell-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  );
}
