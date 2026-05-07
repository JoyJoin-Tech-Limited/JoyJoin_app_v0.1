export interface PreJoinVibeBriefQueryParams {
  eventType: "饭局" | "酒局";
  area?: string;
}

export function buildPreJoinVibeBriefUrl({
  eventType,
  area,
}: PreJoinVibeBriefQueryParams): string {
  const params = new URLSearchParams();
  params.set("eventType", eventType);
  if (area) params.set("area", area);
  return `/api/ai/pre-join-vibe-brief?${params.toString()}`;
}
