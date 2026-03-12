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

const coreOpsItems = [
  { title: "数据看板", url: "/admin/dashboard", icon: LayoutDashboard },
  { title: "用户管理", url: "/admin/users", icon: Users },
  { title: "活动池管理", url: "/admin/event-pools", icon: Layers },
];

const matchingItems = [
  { title: "匹配实验室", url: "/admin/matching", icon: FlaskConical },
  { title: "匹配配置", url: "/admin/matching-config", icon: Settings },
  { title: "匹配日志", url: "/admin/matching-logs", icon: ScrollText },
];

const safetyItems = [
  { title: "反馈管理", url: "/admin/feedback", icon: MessageSquare },
  { title: "举报审核", url: "/admin/moderation", icon: Flag },
  { title: "聊天日志", url: "/admin/chat-logs", icon: FileText },
];

const contentRevenueItems = [
  { title: "数据洞察", url: "/admin/insights", icon: BarChart3 },
  { title: "内容管理", url: "/admin/content", icon: FileText },
  { title: "通知推送", url: "/admin/notifications", icon: Bell },
  { title: "场地管理", url: "/admin/venues", icon: MapPin },
  { title: "活动管理", url: "/admin/events", icon: CalendarDays },
  { title: "订阅管理", url: "/admin/subscriptions", icon: CreditCard },
  { title: "定价管理", url: "/admin/pricing", icon: DollarSign },
  { title: "优惠券", url: "/admin/coupons", icon: Tag },
  { title: "财务管理", url: "/admin/finance", icon: DollarSign },
  { title: "举报管理", url: "/admin/reports", icon: ReceiptText },
  { title: "小悦进化", url: "/admin/evolution", icon: Brain },
];

const groups = [
  { label: "核心运营", items: coreOpsItems },
  { label: "盲盒匹配", items: matchingItems },
  { label: "反馈与安全", items: safetyItems },
  { label: "内容与收入", items: contentRevenueItems },
];

export function AdminSidebar() {
  const [location] = useLocation();

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
