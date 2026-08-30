import {
  ApartmentOutlined,
  BarChartOutlined,
  FormOutlined,
  HomeOutlined,
  MenuOutlined,
  RobotOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Avatar, Breadcrumb, Button, Drawer, Grid, Layout, Menu, Tooltip, Typography, type MenuProps } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
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
  const appName = t("appName");
  const brandMark = appName.trim().slice(0, 1);

  const { groupedItems, flatItems } = useMemo(() => {
    const item = (key: string, icon: ReactNode, to: string, label: string): MenuItem => ({
      key,
      icon,
      title: label,
      label: <Link to={to}>{label}</Link>,
    });

    const mainChildren: MenuItem[] = [item("/", <HomeOutlined />, "/", t("nav.home"))];
    if (canWriteSurvey(me) || canAnalyze(me)) {
      mainChildren.push(item("/surveys", <FormOutlined />, "/surveys", t("nav.surveys")));
    }
    const orgChildren: MenuItem[] = canWriteOrg(me)
      ? [
          item("/org/departments", <ApartmentOutlined />, "/org/departments", t("nav.dept")),
          item("/org/users", <TeamOutlined />, "/org/users", t("nav.users")),
        ]
      : [];
    const analyticsChildren: MenuItem[] = canAnalyze(me)
      ? [
          item("/analytics/dashboard", <BarChartOutlined />, "/analytics/dashboard", t("nav.dashboard")),
          item("/analytics/intent", <RobotOutlined />, "/analytics/intent", t("nav.analyze")),
        ]
      : [];

    const groupedItems: MenuItem[] = [{ type: "group", label: t("nav.group.main"), children: mainChildren }];
    if (orgChildren.length > 0) {
      groupedItems.push({ type: "group", label: t("nav.group.organization"), children: orgChildren });
    }
    if (analyticsChildren.length > 0) {
      groupedItems.push({ type: "group", label: t("nav.group.analytics"), children: analyticsChildren });
    }

    return { groupedItems, flatItems: [...mainChildren, ...orgChildren, ...analyticsChildren] };
  }, [me, t]);

  const onMenuClick: MenuProps["onClick"] = ({ key }) => {
    setDrawerOpen(false);
    if (key.startsWith("/")) navigate(key);
  };

  const crumbItems = crumbsFor(location.pathname, t).map((c) => ({
    title: c.href ? <Link to={c.href}>{c.title}</Link> : c.title,
  }));

  const firstRole = me.roles[0]?.role;
  const roleText = firstRole && firstRole in ROLE_I18N ? t(ROLE_I18N[firstRole]) : null;

  const brand = (
    <div className="app-shell-brand">
      <span className="app-shell-brand-text">{appName}</span>
      <Tooltip title={appName} placement="right">
        <span className="app-shell-brand-mark" aria-label={appName}>
          {brandMark}
        </span>
      </Tooltip>
    </div>
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
          {brand}
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={collapsed}
            selectedKeys={[selected]}
            items={collapsed ? flatItems : groupedItems}
            onClick={onMenuClick}
          />
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
          {brand}
          <Menu
            theme="dark"
            mode="inline"
            inlineCollapsed={false}
            selectedKeys={[selected]}
            items={groupedItems}
            onClick={onMenuClick}
          />
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
