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
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/auth/useAuth";

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

const coreOpsItems: NavItem[] = [
  { title: "数据看板", url: "/admin/dashboard", icon: LayoutDashboard, roles: ALL_ROLES },
  { title: "用户管理", url: "/admin/users", icon: Users, roles: ALL_ROLES },
  { title: "活动池管理", url: "/admin/event-pools", icon: Layers, roles: ALL_ROLES },
  { title: "活动模板", url: "/admin/templates", icon: CalendarDays, roles: SUPER_OPERATOR },
  { title: "场地管理", url: "/admin/venues", icon: MapPin, roles: ALL_ROLES },
];

const matchingItems: NavItem[] = [
  { title: "匹配实验室", url: "/admin/matching", icon: FlaskConical, roles: SUPER_ONLY },
  { title: "匹配配置", url: "/admin/matching-config", icon: Settings, roles: SUPER_ONLY },
  { title: "匹配日志", url: "/admin/matching-logs", icon: ScrollText, roles: SUPER_ONLY },
];

const safetyItems: NavItem[] = [
  { title: "反馈管理", url: "/admin/feedback", icon: MessageSquare, roles: SUPER_OPERATOR },
  { title: "举报审核", url: "/admin/moderation", icon: Flag, roles: SUPER_OPERATOR },
  { title: "举报管理", url: "/admin/reports", icon: ReceiptText, roles: SUPER_OPERATOR },
  { title: "连接日志", url: "/admin/interaction-logs", icon: FileText, roles: SUPER_ONLY },
];

const contentRevenueItems: NavItem[] = [
  { title: "数据洞察", url: "/admin/insights", icon: BarChart3, roles: SUPER_ONLY },
  { title: "Outcome 分析", url: "/admin/outcome-analytics", icon: Database, roles: SUPER_ONLY },
  { title: "破冰 AI 反馈", url: "/admin/icebreaker-ai-feedback", icon: Sparkles, roles: SUPER_OPERATOR },
  { title: "内容管理", url: "/admin/content", icon: FileText, roles: SUPER_ONLY },
  { title: "通知推送", url: "/admin/notifications", icon: Bell, roles: SUPER_ONLY },
  { title: "活动管理", url: "/admin/events", icon: CalendarDays, roles: SUPER_OPERATOR },
  { title: "订阅管理", url: "/admin/subscriptions", icon: CreditCard, roles: SUPER_ONLY },
  { title: "定价管理", url: "/admin/pricing", icon: DollarSign, roles: SUPER_ONLY },
  { title: "优惠券", url: "/admin/coupons", icon: Tag, roles: SUPER_ONLY },
  { title: "财务管理", url: "/admin/finance", icon: DollarSign, roles: SUPER_OPERATOR },
  { title: "悦仔进化", url: "/admin/evolution", icon: Brain, roles: SUPER_ONLY },
];

const systemItems: NavItem[] = [
  { title: "管理员账号", url: "/admin/accounts", icon: ShieldCheck, roles: SUPER_ONLY },
  { title: "审计日志", url: "/admin/audit-logs", icon: ScrollText, roles: SUPER_ONLY },
];

function filterByRole(items: NavItem[], role?: string): NavItem[] {
  return items.filter((item) => {
    if (!item.roles) return true;
    if (!role) return false;
    return item.roles.includes(role as AdminRole);
  });
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.adminRole || "viewer";

  const groups = [
    { label: "核心运营", items: filterByRole(coreOpsItems, role) },
    { label: "盲盒匹配", items: filterByRole(matchingItems, role) },
    { label: "反馈与安全", items: filterByRole(safetyItems, role) },
    { label: "内容与收入", items: filterByRole(contentRevenueItems, role) },
    { label: "系统管理", items: filterByRole(systemItems, role) },
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
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`nav-${item.title}`}
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
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
