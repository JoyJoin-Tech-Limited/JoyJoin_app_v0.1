/**
 * Time-aware greeting generator for Chinese UI.
 * Returns a warm, contextual greeting based on local hour.
 */
export function getTimeGreeting(name?: string): string {
  const hour = new Date().getHours()
  const base =
    hour < 6
      ? '还没睡呀'
      : hour < 9
        ? '早上好'
        : hour < 12
          ? '上午好'
          : hour < 14
            ? '中午好'
            : hour < 18
              ? '下午好'
              : hour < 22
                ? '晚上好'
                : '夜深了'

  if (!name) return base
  return `${base}，${name}`
}

/** Returns a time-appropriate emoji or mood indicator. */
export function getTimeMood(): string {
  const hour = new Date().getHours()
  if (hour < 6) return '🌙'
  if (hour < 9) return '🌅'
  if (hour < 12) return '☀️'
  if (hour < 14) return '🍱'
  if (hour < 18) return '☕'
  if (hour < 22) return '🌆'
  return '🌙'
}
