import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/auth/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ADMIN_NAV_WORKSPACES,
  DAILY_OPS_ITEMS,
  filterNavByRole,
  filterWorkspacesByRole,
  findWorkspaceForPath,
  type AdminNavItem,
  type AdminNavWorkspace,
} from "@/lib/adminNavConfig";

const STORAGE_KEY = "jj-admin-nav-expanded";
const BADGES_QUERY_KEY = ["/api/admin/nav-badges"];

type BadgeMap = Record<string, number>;

/**
 * Counts for the sidebar. The endpoint derives these from the same functions
 * that power each destination list, so a badge can never disagree with the
 * number the operator sees after clicking it. Failure is silent — a missing
 * badge must never block navigation.
 */
function useNavBadges(enabled: boolean): BadgeMap {
  const { data } = useQuery({
    queryKey: BADGES_QUERY_KEY,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/nav-badges");
      return (await res.json()) as { badges: BadgeMap };
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  return data?.badges ?? {};
}

function NavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className="ml-auto min-w-[1.25rem] rounded-full bg-primary/15 px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-primary"
      aria-label={`${count} 项待处理`}
      data-testid="nav-badge"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function DailyOpsDock({
  items,
  location,
  badges,
}: {
  items: AdminNavItem[];
  location: string;
  badges: BadgeMap;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mx-3 mt-3 rounded-lg bg-muted/60 p-2">
      <div className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        日常运营
      </div>
      <SidebarMenu>
        {items.map((item) => {
          const active = location === item.url;
          return (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                <Link href={item.url} data-testid={`nav-${item.title}`}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  <NavBadge count={item.badgeKey ? badges[item.badgeKey] : undefined} />
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}

function WorkspaceGroup({
  workspace,
  expanded,
  active,
  onToggle,
  location,
  badges,
}: {
  workspace: AdminNavWorkspace;
  expanded: boolean;
  active: boolean;
  onToggle: () => void;
  location: string;
  badges: BadgeMap;
}) {
  const contentId = useId();
  const workspaceBadge = workspace.items.reduce(
    (sum, item) => sum + (item.badgeKey ? badges[item.badgeKey] ?? 0 : 0),
    0
  );

  return (
    <SidebarGroup className="px-3 py-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={contentId}
        data-testid={`nav-group-${workspace.label}`}
        className={cn(
          "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span className="flex items-center gap-1.5">
          {workspace.label}
          {active && <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />}
        </span>
        <span className="flex items-center gap-1">
          <NavBadge count={workspaceBadge} />
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform motion-reduce:transition-none",
              expanded && "rotate-180"
            )}
          />
        </span>
      </button>
      {expanded && (
        <SidebarGroupContent id={contentId} className="mt-1">
          <SidebarMenu>
            {workspace.items.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={location === item.url}
                  tooltip={item.title}
                >
                  <Link href={item.url} data-testid={`nav-${item.title}`}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    <NavBadge count={item.badgeKey ? badges[item.badgeKey] : undefined} />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.adminRole || "viewer";

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore corrupt storage and fall back to the default state.
    }
    return Object.fromEntries(ADMIN_NAV_WORKSPACES.map((w) => [w.key, false]));
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedGroups));
    } catch {
      // Storage may be unavailable (private mode); collapsing state is not critical.
    }
  }, [expandedGroups]);

  // The workspace owning the current route is always visible. Without this an
  // operator following a deep link lands on a page whose tab bar is hidden.
  const activeWorkspace = useMemo(() => findWorkspaceForPath(location), [location]);

  useEffect(() => {
    if (!activeWorkspace) return;
    const key = activeWorkspace.workspace.key;
    setExpandedGroups((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }, [activeWorkspace]);

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const badges = useNavBadges(Boolean(user?.isAdmin));
  const filteredDailyOps = filterNavByRole(DAILY_OPS_ITEMS, role).filter((item) => {
    // 功能开关驱动的可见性（例：人工复核关闭时，排桌审批队列恒空）。
    // 只在开关明确为 false 时隐藏 —— 未加载时保持可见，避免导航闪烁。
    if (!item.featureFlag) return true;
    const flags: Record<string, boolean | undefined> = {
      matchingOperatorReviewEnabled: user?.matchingOperatorReviewEnabled,
    };
    return flags[item.featureFlag] !== false;
  });
  const workspaces = filterWorkspacesByRole(ADMIN_NAV_WORKSPACES, role);

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
        <DailyOpsDock items={filteredDailyOps} location={location} badges={badges} />
        {workspaces.map((workspace) => (
          <WorkspaceGroup
            key={workspace.key}
            workspace={workspace}
            expanded={Boolean(expandedGroups[workspace.key])}
            active={activeWorkspace?.workspace.key === workspace.key}
            onToggle={() => toggleGroup(workspace.key)}
            location={location}
            badges={badges}
          />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
