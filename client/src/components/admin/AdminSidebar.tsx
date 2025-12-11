import {
  LayoutDashboard,
  Users,
  CreditCard,
  Tag,
  MapPin,
  LayoutTemplate,
  Calendar,
  Layers,
  DollarSign,
  BarChart3,
  FileText,
  Bell,
  Flag,
  FlaskConical,
  MessageSquareWarning,
  MessageSquare,
  Settings,
  ScrollText,
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

const menuItems = [
  {
    title: "数据看板",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "用户管理",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "订阅管理",
    url: "/admin/subscriptions",
    icon: CreditCard,
  },
  {
    title: "优惠券",
    url: "/admin/coupons",
    icon: Tag,
  },
  {
    title: "场地管理",
    url: "/admin/venues",
    icon: MapPin,
  },
  {
    title: "活动模板",
    url: "/admin/templates",
    icon: LayoutTemplate,
  },
  {
    title: "活动管理",
    url: "/admin/events",
    icon: Calendar,
  },
  {
    title: "活动池管理",
    url: "/admin/event-pools",
    icon: Layers,
  },
  {
    title: "财务管理",
    url: "/admin/finance",
    icon: DollarSign,
  },
];

const analyticsItems = [
  {
    title: "数据洞察",
    url: "/admin/insights",
    icon: BarChart3,
  },
  {
    title: "反馈管理",
    url: "/admin/feedback",
    icon: MessageSquare,
  },
  {
    title: "内容管理",
    url: "/admin/content",
    icon: FileText,
  },
  {
    title: "通知推送",
    url: "/admin/notifications",
    icon: Bell,
  },
  {
    title: "举报审核",
    url: "/admin/moderation",
    icon: Flag,
  },
  {
    title: "举报管理",
    url: "/admin/reports",
    icon: MessageSquareWarning,
  },
  {
    title: "聊天日志",
    url: "/admin/chat-logs",
    icon: FileText,
  },
  {
    title: "匹配实验室",
    url: "/admin/matching",
    icon: FlaskConical,
  },
  {
    title: "匹配配置",
    url: "/admin/matching-config",
    icon: Settings,
  },
  {
    title: "匹配日志",
    url: "/admin/matching-logs",
    icon: ScrollText,
  },
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
        <SidebarGroup>
          <SidebarGroupLabel>核心管理</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>数据与优化</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analyticsItems.map((item) => (
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
      </SidebarContent>
    </Sidebar>
  );
}
