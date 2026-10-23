import type { QueryClient } from "@tanstack/react-query";

/**
 * Sidebar badge counts (`GET /api/admin/nav-badges`).
 *
 * Kept in `lib/` instead of inside `AdminSidebar` so an action surface can
 * invalidate the counts without importing the navigation component — importing
 * a component module from a page pulls the whole nav tree (and its route config)
 * into that page's chunk, and the reverse import would be a cycle.
 */
export const NAV_BADGES_QUERY_KEY = ["/api/admin/nav-badges"] as const;

/**
 * Refresh the sidebar counts after an action that changes what is pending
 * (approving matches, processing refunds, resolving reports…).
 *
 * Fire-and-forget on purpose: badges are decoration, so a failed refresh must
 * never turn an action that actually succeeded into an error. The sidebar's own
 * 30s poll is the safety net for any surface that does not call this.
 */
export function invalidateNavBadges(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: NAV_BADGES_QUERY_KEY });
}
