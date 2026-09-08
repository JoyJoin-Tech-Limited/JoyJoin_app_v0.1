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
}

export interface AdminNavGroup {
  key: string;
  label: string;
  items: AdminNavItem[];
}

/** Tier 1: Daily Ops — pinned dock, always visible */
export const DAILY_OPS_ITEMS: AdminNavItem[] = [
  { title: "数据看板", url: "/admin/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { title: "今日战情", url: "/admin/war-room", icon: Radar, roles: SUPER_OPERATOR },
  { title: "活动池管理", url: "/admin/event-pools", icon: Layers, roles: ALL_ROLES },
  { title: "用户管理", url: "/admin/users", icon: Users, roles: ALL_ROLES },
  { title: "场地管理", url: "/admin/venues", icon: MapPin, roles: ALL_ROLES },
  { title: "街头盲盒运营", url: "/admin/alang", icon: Sparkles, roles: ALL_ROLES },
];

/** Tier 2+: collapsible groups */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "safety",
    label: "安全与反馈",
    items: [
      { title: "安全中心", url: "/admin/moderation", icon: ShieldAlert, roles: SUPER_OPERATOR },
      { title: "内容审核日志", url: "/admin/content-filter", icon: ShieldCheck, roles: SUPER_OPERATOR },
      { title: "反馈管理", url: "/admin/feedback", icon: MessageSquare, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "matching",
    label: "匹配",
    items: [
      { title: "匹配审核", url: "/admin/matching-reviews", icon: ClipboardCheck, roles: SUPER_OPERATOR },
      { title: "匹配配置", url: "/admin/matching-config", icon: Settings, roles: SUPER_ONLY },
      { title: "匹配实验室", url: "/admin/matching", icon: FlaskConical, roles: SUPER_ONLY },
      { title: "匹配日志", url: "/admin/matching-logs", icon: ListChecks, roles: SUPER_ONLY },
      { title: "悦仔进化", url: "/admin/evolution", icon: Brain, roles: SUPER_ONLY },
    ],
  },
  {
    key: "operations",
    label: "运营配置",
    items: [
      { title: "活动管理", url: "/admin/events", icon: CalendarDays, roles: SUPER_OPERATOR },
      { title: "活动模板", url: "/admin/templates", icon: CalendarCheck, roles: SUPER_OPERATOR },
      { title: "通知推送", url: "/admin/notifications", icon: Bell, roles: SUPER_ONLY },
      { title: "内容管理", url: "/admin/content", icon: FileText, roles: SUPER_ONLY },
      { title: "横幅管理", url: "/admin/banners", icon: Image, roles: SUPER_OPERATOR },
      { title: "订阅管理", url: "/admin/subscriptions", icon: CreditCard, roles: SUPER_ONLY },
      { title: "定价管理", url: "/admin/pricing", icon: Tags, roles: SUPER_ONLY },
      { title: "优惠券", url: "/admin/coupons", icon: Tag, roles: SUPER_ONLY },
      { title: "财务管理", url: "/admin/finance", icon: Wallet, roles: SUPER_OPERATOR },
      { title: "邀请裂变", url: "/admin/referrals", icon: Share2, roles: SUPER_OPERATOR },
      { title: "双人成行", url: "/admin/duo-invites", icon: UsersRound, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "insights",
    label: "数据与洞察",
    items: [
      { title: "数据洞察", url: "/admin/insights", icon: BarChart3, roles: SUPER_ONLY },
      { title: "成行分析", url: "/admin/outcome-analytics", icon: Database, roles: SUPER_ONLY },
      { title: "连接日志", url: "/admin/interaction-logs", icon: Link2, roles: SUPER_ONLY },
      { title: "破冰 AI 反馈", url: "/admin/icebreaker-ai-feedback", icon: Bot, roles: SUPER_OPERATOR },
    ],
  },
  {
    key: "system",
    label: "系统",
    items: [
      { title: "管理员账号", url: "/admin/accounts", icon: UserCog, roles: SUPER_ONLY },
      { title: "审计日志", url: "/admin/audit-logs", icon: ScrollText, roles: SUPER_ONLY },
      { title: "功能开关", url: "/admin/feature-flags", icon: ToggleLeft, roles: SUPER_ONLY },
    ],
  },
];

export const ALL_NAV_ITEMS: AdminNavItem[] = [
  ...DAILY_OPS_ITEMS,
  ...ADMIN_NAV_GROUPS.flatMap((g) => g.items),
];

export function filterNavByRole(items: AdminNavItem[], role?: string): AdminNavItem[] {
  return items.filter((item) => {
    if (!role) return false;
    return item.roles.includes(role as AdminRole);
  });
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
