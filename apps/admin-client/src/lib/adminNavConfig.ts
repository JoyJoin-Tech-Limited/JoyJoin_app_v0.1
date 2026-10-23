import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Radar,
  Layers,
  Users,
  MapPin,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  ClipboardCheck,
  Settings,
  FlaskConical,
  ListChecks,
  Brain,
  CalendarDays,
  CalendarCheck,
  Bell,
  FileText,
  Filter,
  Image,
  CreditCard,
  Tags,
  Tag,
  Wallet,
  Share2,
  UsersRound,
  BarChart3,
  Database,
  Link2,
  Bot,
  UserCog,
  ScrollText,
  ToggleLeft,
} from "lucide-react";

export type AdminRole = "super_admin" | "operator" | "viewer";

export const ALL_ROLES: AdminRole[] = ["super_admin", "operator", "viewer"];
export const SUPER_ONLY: AdminRole[] = ["super_admin"];
export const SUPER_OPERATOR: AdminRole[] = ["super_admin", "operator"];

export interface AdminNavItem {
  title: string;
  url: string;
  icon: ComponentType<{ className?: string }>;
  roles: AdminRole[];
  /**
   * Key of a counter returned by `GET /api/admin/nav-badges`. A badge only ever
   * renders when the number is > 0, and the number is produced by the same
   * server function that powers the destination list, so a badge can never
   * disagree with the page it links to.
   */
  badgeKey?: AdminBadgeKey;
  /**
   * When set, the sidebar hides this entry while the flag resolves to an
   * explicit `false`. The route stays in `ALL_NAV_ITEMS` (so RBAC and page
   * titles are unchanged) — only the navigation stops advertising work that
   * the server will never generate.
   */
  featureFlag?: AdminItemFlag;
}

export type AdminItemFlag = "matchingOperatorReviewEnabled";

export type AdminBadgeKey =
  | "/admin/safety-center"
  | "/admin/finance"
  | "/admin/matching-reviews"
  | "/admin/event-pools"
  | "/admin/war-room"
  | "/admin/venues";

/**
 * A workspace is one sidebar entry hosting several tabs.
 *
 * Why: the console had 32 flat entries and an operator scanning for "where do I
 * approve matches" had to read all of them. Workspaces group by *the job being
 * done*, not by which engineer built the page. Every route still resolves —
 * this is a navigation re-cut, not a route deletion — so old links and the
 * `/admin/*` RBAC prefix map keep working unchanged.
 */
export interface AdminNavWorkspace {
  key: string;
  label: string;
  items: AdminNavItem[];
}

export interface AdminNavGroup {
  key: string;
  label: string;
  items: AdminNavItem[];
}

/*
 * 命名权威（single source of truth）—— nav title 就是页面标题
 *
 * 每个页面只应该有一个一级标题，而那个标题的文案来自这里。`usePageTitle`
 * 已经用 `item.title` 生成 document.title，`AdminLayout` 的面包屑也读它；页面
 * 自己的 h1 必须与它逐字一致。
 *
 * 冲突消解规则（2026-10-23，六处历史冲突已按此收敛）：
 *   1. 优先采用控制台里已经在用的名字——页面正文、交叉引用（例如
 *      EventPoolDetailDialog 的「盲盒活动管理」页面）、badge 语义。
 *   2. 其次取更短、更贴近「运营要做的事」的名字，而不是描述实现细节的名字。
 *   3. 「管理」后缀只在去掉后会产生歧义时保留（活动池管理 / 盲盒活动管理
 *      要彼此区分；活动模板、优惠券本身就是对象名，不需要后缀）。
 *
 * 结论（页面侧改名是后续 PR，本文件先定稿；页面改完后两边逐字一致）：
 *   /admin/matching-reviews  排桌审批        ← 页面 h1 仍是「匹配审核」
 *   /admin/events            盲盒活动管理    ← 页面 h1 已是同名（本条只改 nav）
 *   /admin/insights          数据洞察        ← 页面 h1 仍是「运营决策指挥中心」
 *   /admin/matching-logs     匹配日志        ← 页面 h1 仍是「匹配扫描日志」
 *   /admin/templates         活动模板        ← 页面 h1 仍是「活动模板管理」
 *   /admin/coupons           优惠券          ← 页面 h1 仍是「优惠券管理」
 *
 * 本次只收敛这六处。其余路由仍有 nav 与页面标题不一致（例如 /admin/dashboard
 * 的「运营指挥台」、/admin/matching-config 的「实时匹配配置」、/admin/notifications
 * 的「通知推送管理」），按同一规则逐页跟进，不要反过来改 nav 去迁就页面。
 *
 * 改标题时只动 `title`；`url` 与 `roles` 是路由与 RBAC 契约，改它们会静默
 * 改动权限（见 adminNavConfig.test.ts）。
 */

/**
 * Tier 1: Daily Ops — pinned dock, always visible without expanding anything.
 *
 * 2026-10-22 re-cut: 排桌审批 was promoted here (it is the single highest-volume
 * operational action) and 街头盲盒运营 was demoted into its own workspace (it is
 * weekly content authoring, not daily ops).
 */
export const DAILY_OPS_ITEMS: AdminNavItem[] = [
  { title: "数据看板", url: "/admin/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { title: "今日战情", url: "/admin/war-room", icon: Radar, roles: SUPER_OPERATOR, badgeKey: "/admin/war-room" },
  {
    title: "排桌审批",
    url: "/admin/matching-reviews",
    icon: ClipboardCheck,
    roles: SUPER_OPERATOR,
    badgeKey: "/admin/matching-reviews",
    // Only surfaced while 人工复核 is on. With the flag off, match runs commit
    // immediately and this queue is empty by construction — keeping it pinned
    // would advertise daily work that does not exist.
    featureFlag: "matchingOperatorReviewEnabled",
  },
  {
    title: "活动池管理",
    url: "/admin/event-pools",
    icon: Layers,
    roles: ALL_ROLES,
    badgeKey: "/admin/event-pools",
  },
  { title: "用户管理", url: "/admin/users", icon: Users, roles: ALL_ROLES },
  { title: "场地管理", url: "/admin/venues", icon: MapPin, roles: ALL_ROLES, badgeKey: "/admin/venues" },
];

/** Tier 2: workspaces — one sidebar entry each, tabs inside. */
export const ADMIN_NAV_WORKSPACES: AdminNavWorkspace[] = [
  {
    key: "safety",
    label: "安全中心",
    items: [
      {
        title: "安全中心",
        url: "/admin/moderation",
        icon: ShieldAlert,
        roles: SUPER_OPERATOR,
        badgeKey: "/admin/safety-center",
      },
      { title: "内容审核日志", url: "/admin/content-filter", icon: ShieldCheck, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "feedback",
    label: "反馈",
    items: [
      { title: "反馈管理", url: "/admin/feedback", icon: MessageSquare, roles: SUPER_OPERATOR },
      { title: "破冰 AI 反馈", url: "/admin/icebreaker-ai-feedback", icon: Bot, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "algorithm",
    label: "算法工作台",
    items: [
      { title: "匹配配置", url: "/admin/matching-config", icon: Settings, roles: SUPER_ONLY },
      { title: "匹配实验室", url: "/admin/matching", icon: FlaskConical, roles: SUPER_ONLY },
      { title: "匹配日志", url: "/admin/matching-logs", icon: ListChecks, roles: SUPER_ONLY },
      { title: "悦仔进化", url: "/admin/evolution", icon: Brain, roles: SUPER_ONLY },
    ],
  },
  {
    key: "events",
    label: "活动",
    items: [
      // 「活动管理」太含糊：控制台里同时有 活动池管理 / 盲盒活动 / 活动模板。
      // 采用页面正文与交叉引用已经在用的名字（EventPoolDetailDialog 两处文案
      // 都写「盲盒活动管理」页面）。
      { title: "盲盒活动管理", url: "/admin/events", icon: CalendarDays, roles: SUPER_OPERATOR },
      { title: "活动模板", url: "/admin/templates", icon: CalendarCheck, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "content",
    label: "内容与推送",
    items: [
      { title: "通知推送", url: "/admin/notifications", icon: Bell, roles: SUPER_ONLY },
      { title: "内容管理", url: "/admin/content", icon: FileText, roles: SUPER_ONLY },
      { title: "横幅管理", url: "/admin/banners", icon: Image, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "commerce",
    label: "权益与定价",
    items: [
      { title: "订阅管理", url: "/admin/subscriptions", icon: CreditCard, roles: SUPER_ONLY },
      { title: "定价管理", url: "/admin/pricing", icon: Tags, roles: SUPER_ONLY },
      { title: "优惠券", url: "/admin/coupons", icon: Tag, roles: SUPER_ONLY },
    ],
  },
  {
    key: "growth",
    label: "财务与增长",
    items: [
      {
        title: "财务管理",
        url: "/admin/finance",
        icon: Wallet,
        roles: SUPER_OPERATOR,
        badgeKey: "/admin/finance",
      },
      { title: "邀请裂变", url: "/admin/referrals", icon: Share2, roles: SUPER_OPERATOR },
      { title: "双人成行", url: "/admin/duo-invites", icon: UsersRound, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "analytics",
    label: "经营分析",
    items: [
      { title: "支付漏斗", url: "/admin/funnel", icon: Filter, roles: SUPER_ONLY },
      { title: "数据洞察", url: "/admin/insights", icon: BarChart3, roles: SUPER_ONLY },
      { title: "成行分析", url: "/admin/outcome-analytics", icon: Database, roles: SUPER_ONLY },
      { title: "连接日志", url: "/admin/interaction-logs", icon: Link2, roles: SUPER_ONLY },
    ],
  },
  {
    key: "alang",
    label: "街头盲盒",
    items: [{ title: "街头盲盒运营", url: "/admin/alang", icon: Sparkles, roles: ALL_ROLES }],
  },
  {
    key: "system",
    label: "系统设置",
    items: [
      { title: "管理员账号", url: "/admin/accounts", icon: UserCog, roles: SUPER_ONLY },
      { title: "审计日志", url: "/admin/audit-logs", icon: ScrollText, roles: SUPER_ONLY },
      { title: "功能开关", url: "/admin/feature-flags", icon: ToggleLeft, roles: SUPER_ONLY },
    ],
  },
];

/**
 * Backwards-compatible view of the workspaces as flat groups. Kept so existing
 * consumers (and the nav config tests) do not need to know about tabs.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = ADMIN_NAV_WORKSPACES.map((w) => ({
  key: w.key,
  label: w.label,
  items: w.items,
}));

export const ALL_NAV_ITEMS: AdminNavItem[] = [
  ...DAILY_OPS_ITEMS,
  ...ADMIN_NAV_WORKSPACES.flatMap((w) => w.items),
];

export function filterNavByRole(items: AdminNavItem[], role?: string): AdminNavItem[] {
  return items.filter((item) => {
    if (!role) return false;
    return item.roles.includes(role as AdminRole);
  });
}

export function filterWorkspacesByRole(
  workspaces: AdminNavWorkspace[],
  role?: string
): AdminNavWorkspace[] {
  return workspaces
    .map((workspace) => ({
      ...workspace,
      items: filterNavByRole(workspace.items, role),
    }))
    .filter((workspace) => workspace.items.length > 0);
}

/**
 * Which workspace (if any) owns the current path. Used to auto-expand the
 * active section and to render its tab bar.
 */
export function findWorkspaceForPath(
  path: string
): { workspace: AdminNavWorkspace; activeItem: AdminNavItem } | null {
  for (const workspace of ADMIN_NAV_WORKSPACES) {
    const activeItem = workspace.items
      .filter((item) => path === item.url || path.startsWith(item.url + "/"))
      .sort((a, b) => b.url.length - a.url.length)[0];
    if (activeItem) return { workspace, activeItem };
  }
  return null;
}

/**
 * Single source of truth for route-level RBAC. The sidebar and AdminGuard
 * both derive from this config so visibility and access can never drift.
 * Uses longest-prefix matching so /admin/matching-config is not shadowed by
 * /admin/matching. Routes with no nav entry default to any-admin access.
 */
export function canAccessAdminPath(path: string, role?: string): boolean {
  if (role === "super_admin") return true;
  const match = ALL_NAV_ITEMS
    .filter((item) => path === item.url || path.startsWith(item.url + "/"))
    .sort((a, b) => b.url.length - a.url.length)[0];
  if (!match) return true;
  if (!role) return false;
  return match.roles.includes(role as AdminRole);
}
