import { useEffect } from "react";
import { ALL_NAV_ITEMS } from "@/lib/adminNavConfig";

/** Route → page title mapping derived from the shared nav config (single
 *  source of truth), plus aliases that have no sidebar entry. */
const ROUTE_TITLES: Record<string, string> = {
  ...Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.url, item.title])),
  "/admin": "数据看板",
};

const DEFAULT_TITLE = "悦聚·Joy - 管理后台";

export function getPageTitle(path: string): string {
  // Exact match first
  if (ROUTE_TITLES[path]) {
    return `${ROUTE_TITLES[path]} · ${DEFAULT_TITLE}`;
  }
  // Fallback: try to find a parent route (e.g., /admin/users/123 → 用户管理)
  const segments = path.split("/").filter(Boolean);
  if (segments.length >= 2 && segments[0] === "admin") {
    const base = `/${segments[0]}/${segments[1]}`;
    if (ROUTE_TITLES[base]) {
      return `${ROUTE_TITLES[base]} · ${DEFAULT_TITLE}`;
    }
  }
  return DEFAULT_TITLE;
}

/** Set document.title based on current route. Call from layout level. */
export function usePageTitle(path: string) {
  useEffect(() => {
    document.title = getPageTitle(path);
  }, [path]);
}
