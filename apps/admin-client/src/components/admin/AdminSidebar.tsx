import { useState, useEffect, useCallback, useId } from "react";
import { ChevronDown } from "lucide-react";
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
import {
  ADMIN_NAV_GROUPS,
  DAILY_OPS_ITEMS,
  filterNavByRole,
  type AdminNavItem,
  type AdminNavGroup,
} from "@/lib/adminNavConfig";

type NavItem = AdminNavItem;
type NavGroup = AdminNavGroup;

const STORAGE_KEY = "jj-admin-nav-expanded";

/* ───────────────────────────────────────────────────────────
   DailyOpsDock — pinned primary section above the fold
   ─────────────────────────────────────────────────────────── */
function DailyOpsDock({
  items,
  location,
}: {
  items: NavItem[];
  location: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mx-3 mt-3 rounded-lg bg-muted/60 p-2">
      <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
        日常运营
      </div>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.url}>
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
  );
}

/* ───────────────────────────────────────────────────────────
   CollapsibleNavGroup — accordion section with persisted state
   ─────────────────────────────────────────────────────────── */
function CollapsibleNavGroup({
  group,
  expanded,
  onToggle,
  location,
}: {
  group: NavGroup;
  expanded: boolean;
  onToggle: (label: string) => void;
  location: string;
}) {
  const contentId = useId();

  return (
    <SidebarGroup className="px-3 py-2">
      <button
        type="button"
        onClick={() => onToggle(group.label)}
        className={cn(
          "flex w-full items-center justify-between rounded-sm px-2 py-1.5",
          "text-xs font-bold text-muted-foreground uppercase tracking-wider",
          "transition-colors hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        )}
        aria-expanded={expanded}
        aria-controls={contentId}
        data-testid={`nav-group-${group.label}`}
      >
        <span>{group.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
            expanded && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <SidebarGroupContent id={contentId} className="mt-1">
          <SidebarMenu>
            {group.items.map((item) => (
              <SidebarMenuItem key={item.url}>
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
  );
}

/* ───────────────────────────────────────────────────────────
   AdminSidebar — tiered navigation with role-aware filtering
   ─────────────────────────────────────────────────────────── */
export function AdminSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const role = user?.adminRole || "viewer";

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch {
        // localStorage unavailable or corrupt — fall back to defaults
      }
      return Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.label, false]));
    }
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedGroups));
    } catch {
      // localStorage unavailable — silent fail
    }
  }, [expandedGroups]);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  const filteredDailyOps = filterNavByRole(DAILY_OPS_ITEMS, role);

  const groups: NavGroup[] = ADMIN_NAV_GROUPS.map((group) => ({
    ...group,
    items: filterNavByRole(group.items, role),
  })).filter((g) => g.items.length > 0);

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
        <DailyOpsDock items={filteredDailyOps} location={location} />

        {groups.map((group) => (
          <CollapsibleNavGroup
            key={group.label}
            group={group}
            expanded={!!expandedGroups[group.label]}
            onToggle={toggleGroup}
            location={location}
          />
        ))}
      </SidebarContent>
    </Sidebar>
  );
}
