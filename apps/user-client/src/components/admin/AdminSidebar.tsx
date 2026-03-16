import {
  LayoutDashboard,
  Users,
  Layers,
  Shield,
  Bell,
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

const primaryNavItems = [
  {
    title: "总览",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
    match: ["/admin", "/admin/dashboard"],
  },
  {
    title: "用户与资料",
    url: "/admin/users",
    icon: Users,
    match: ["/admin/users"],
  },
  {
    title: "活动与匹配",
    url: "/admin/event-pools",
    icon: Layers,
    match: [
      "/admin/event-pools",
      "/admin/events",
      "/admin/venues",
      "/admin/templates",
      "/admin/matching",
      "/admin/matching-config",
      "/admin/matching-logs",
    ],
  },
  {
    title: "社区安全",
    url: "/admin/moderation",
    icon: Shield,
    match: [
      "/admin/moderation",
      "/admin/reports",
      "/admin/chat-logs",
      "/admin/feedback",
      "/admin/interaction-logs",
    ],
  },
  {
    title: "内容与通知",
    url: "/admin/content",
    icon: Bell,
    match: ["/admin/content", "/admin/notifications", "/admin/insights"],
  },
];

function isNavItemActive(location: string, match: string[]): boolean {
  return match.some((path) => {
    if (path === "/admin") {
      // Treat the bare /admin path as an exact match only
      return location === "/admin";
    }

    return location === path || location.startsWith(path + "/");
  });
}

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
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isNavItemActive(location, item.match)}
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
