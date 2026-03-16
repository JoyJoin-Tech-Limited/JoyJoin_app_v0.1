// Reveal threshold: venue is revealed this many hours before the event
export const REVEAL_THRESHOLD_HOURS = 24;

// Phase type for event flow
export type EventPhase = "waiting" | "revealed" | "started";

/**
 * Determines the current phase of a matched event.
 * @param eventDateTime - The event's scheduled datetime
 * @returns The current phase
 */
export function getEventPhase(eventDateTime: Date | string): EventPhase {
  const now = new Date();
  const eventTime = new Date(eventDateTime);
  const revealTime = new Date(eventTime.getTime() - REVEAL_THRESHOLD_HOURS * 60 * 60 * 1000);

  if (now >= eventTime) return "started";
  if (now >= revealTime) return "revealed";
  return "waiting";
}

/**
 * Returns a human-readable countdown string.
 * @param targetTime - The target datetime to count down to
 * @param label - Optional prefix label
 */
export function getEventCountdown(targetTime: Date | string, label?: string): string {
  const now = new Date();
  const target = new Date(targetTime);
  const diff = target.getTime() - now.getTime();

  if (diff <= 0) return label ? `${label} · 已到时` : "已到时";

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  const prefix = label ? `${label} · ` : "";

  if (days > 0) return `${prefix}${days}天${remainingHours > 0 ? remainingHours + "小时" : ""}`;
  if (hours > 0) return `${prefix}${hours}小时`;
  return `${prefix}${minutes}分钟`;
}

/**
 * Formats a datetime for display in Chinese locale.
 */
export function formatEventDateTime(dateTime: Date | string): string {
  const date = new Date(dateTime);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[date.getDay()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
}
