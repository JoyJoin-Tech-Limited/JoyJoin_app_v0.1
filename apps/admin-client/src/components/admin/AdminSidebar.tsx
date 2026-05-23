import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  MapPin,
  Layers,
  DollarSign,
  BarChart3,
  FileText,
  Bell,
  Flag,
  FlaskConical,
  MessageSquare,
  Settings,
  ScrollText,
  Brain,
  CalendarDays,
  Tag,
  ReceiptText,
  ShieldCheck,
  Database,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/auth/useAuth";
import { cn } from "@/lib/utils";

type AdminRole = "super_admin" | "operator" | "viewer";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AdminRole[];
}

const ALL_ROLES: AdminRole[] = ["super_admin", "operator", "viewer"];
const SUPER_ONLY: AdminRole[] = ["super_admin"];
const SUPER_OPERATOR: AdminRole[] = ["super_admin", "operator"];

/** ═══════════════════════════════════════════════════════════
 *  TIER 1: Daily Ops — pinned dock, always visible
 *  ═══════════════════════════════════════════════════════════ */
const dailyOpsItems: NavItem[] = [
  { title: "数据看板", url: "/admin/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { title: "活动池管理", url: "/admin/event-pools", icon: Layers, roles: ALL_ROLES },
  { title: "用户管理", url: "/admin/users", icon: Users, roles: ALL_ROLES },
  { title: "场地管理", url: "/admin/venues", icon: MapPin, roles: ALL_ROLES },
];

/** ═══════════════════════════════════════════════════════════
 *  TIER 2: Review & Tune — weekly rituals, collapsed by default
 *  ═══════════════════════════════════════════════════════════ */
const reviewTuneItems: NavItem[] = [
  { title: "反馈管理", url: "/admin/feedback", icon: MessageSquare, roles: SUPER_OPERATOR },
  { title: "用户举报", url: "/admin/moderation", icon: Flag, roles: SUPER_OPERATOR },
  { title: "聊天举报", url: "/admin/reports", icon: ReceiptText, roles: SUPER_OPERATOR },
  { title: "匹配实验室", url: "/admin/matching", icon: FlaskConical, roles: SUPER_ONLY },
  { title: "匹配配置", url: "/admin/matching-config", icon: Settings, roles: SUPER_ONLY },
  { title: "数据洞察", url: "/admin/insights", icon: BarChart3, roles: SUPER_ONLY },
];

/** ═══════════════════════════════════════════════════════════
 *  TIER 3: Config & System — set-it-and-forget-it, collapsed by default
 *  ═══════════════════════════════════════════════════════════ */
const configSystemItems: NavItem[] = [
  { title: "活动模板", url: "/admin/templates", icon: CalendarDays, roles: SUPER_OPERATOR },
  { title: "活动管理", url: "/admin/events", icon: CalendarDays, roles: SUPER_OPERATOR },
  { title: "通知推送", url: "/admin/notifications", icon: Bell, roles: SUPER_ONLY },
  { title: "内容管理", url: "/admin/content", icon: FileText, roles: SUPER_ONLY },
  { title: "订阅管理", url: "/admin/subscriptions", icon: CreditCard, roles: SUPER_ONLY },
  { title: "定价管理", url: "/admin/pricing", icon: DollarSign, roles: SUPER_ONLY },
  { title: "优惠券", url: "/admin/coupons", icon: Tag, roles: SUPER_ONLY },
  { title: "财务管理", url: "/admin/finance", icon: DollarSign, roles: SUPER_OPERATOR },
  { title: "匹配日志", url: "/admin/matching-logs", icon: ScrollText, roles: SUPER_ONLY },
  { title: "管理员账号", url: "/admin/accounts", icon: ShieldCheck, roles: SUPER_ONLY },
  { title: "审计日志", url: "/admin/audit-logs", icon: ScrollText, roles: SUPER_ONLY },
];

/** ═══════════════════════════════════════════════════════════
 *  TIER 4: Labs — experimental / rare, super_admin only, collapsed by default
 *  ═══════════════════════════════════════════════════════════ */
const labItems: NavItem[] = [
  { title: "悦仔进化", url: "/admin/evolution", icon: Brain, roles: SUPER_ONLY },
  { title: "Outcome 分析", url: "/admin/outcome-analytics", icon: Database, roles: SUPER_ONLY },
  { title: "连接日志", url: "/admin/interaction-logs", icon: FileText, roles: SUPER_ONLY },
  { title: "破冰 AI 反馈", url: "/admin/icebreaker-ai-feedback", icon: Sparkles, roles: SUPER_OPERATOR },
];

function filterByRole(items: NavItem[], role?: string): NavItem[] {
  return items.filter((item) => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role as AdminRole);
  });
}

const STORAGE_KEY = "jj-admin-nav-expanded";

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.adminRole || "viewer";

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // localStorage unavailable or corrupt — fall back to defaults
    }
    return {
      "审核与调优": false,
      "配置与系统": false,
      "实验室": false,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedGroups));
    } catch {
      // localStorage unavailable — silent fail
    }
  }, [expandedGroups]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const filteredDailyOps = filterByRole(dailyOpsItems, role);

  const groups: NavGroup[] = [
    { label: "审核与调优", items: filterByRole(reviewTuneItems, role) },
    { label: "配置与系统", items: filterByRole(configSystemItems, role) },
    { label: "实验室", items: filterByRole(labItems, role) },
  ].filter((g) => g.items.length > 0);

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <span className="text-lg font-bold text-primary-foreground">悦</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">悦聚·Joy</h2>
            <p className="text-xs text-muted-foreground">管理后台</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {/* ═══════════════════════════════════════════════════════════
            PINNED DAILY OPS DOCK
            ═══════════════════════════════════════════════════════════ */}
        {filteredDailyOps.length > 0 && (
          <div className="mx-3 mt-3 rounded-lg bg-muted/60 p-2">
            <div className="px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              日常运营
            </div>
            <SidebarMenu>
              {filteredDailyOps.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`nav-${item.title}`}
                    tooltip={item.title}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            COLLAPSIBLE GROUPS
            ═══════════════════════════════════════════════════════════ */}
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="px-3 py-2">
            <button
              onClick={() => toggleGroup(group.label)}
              className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider transition-colors hover:bg-muted hover:text-foreground"
              aria-expanded={expandedGroups[group.label]}
              data-testid={`nav-group-${group.label}`}
            >
              <span>{group.label}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-200",
                  expandedGroups[group.label] && "rotate-180"
                )}
              />
            </button>

            {expandedGroups[group.label] && (
              <SidebarGroupContent className="mt-1">
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={location === item.url}
                        data-testid={`nav-${item.title}`}
                        tooltip={item.title}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            )}
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
