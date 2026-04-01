export function getDiscoverJoinRoute(poolId: string): string {
  return `/discover?joinPool=${encodeURIComponent(poolId)}`;
}

export function getEventPoolRegistrationRoute(poolId: string): string {
  return `/event-pool-registration/${encodeURIComponent(poolId)}`;
}

export function getJoinPoolIdFromUrl(url: string): string | null {
  const normalizedUrl = url.split("#")[0];
  const query = normalizedUrl.includes("?") ? normalizedUrl.slice(normalizedUrl.indexOf("?")) : "";
  return new URLSearchParams(query).get("joinPool");
}
