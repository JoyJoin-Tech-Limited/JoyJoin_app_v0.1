import { Link, useLocation } from "wouter";

import { cn } from "@/lib/utils";
import { findWorkspaceForPath } from "@/lib/adminNavConfig";

/**
 * Tab bar for the active workspace.
 *
 * Mounted once in `AdminLayout` rather than inside each page, so the 26 pages
 * that moved into workspaces did not each need an edit — and so a page added to
 * a workspace later gets its tab for free. Renders nothing outside a workspace,
 * which keeps the pinned Daily Ops pages (dashboard, war room, pools, users,
 * venues) free of chrome they never had.
 */
export function AdminWorkspaceTabs() {
  const [location] = useLocation();
  const match = findWorkspaceForPath(location);

  if (!match || match.workspace.items.length < 2) return null;

  return (
    <nav
      aria-label={`${match.workspace.label}分区`}
      className="border-b bg-background px-6"
      data-testid="admin-workspace-tabs"
    >
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {match.workspace.items.map((item) => {
          const active = item.url === match.activeItem.url;
          return (
            <li key={item.url}>
              <Link
                href={item.url}
                data-testid={`workspace-tab-${item.title}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                  active
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
