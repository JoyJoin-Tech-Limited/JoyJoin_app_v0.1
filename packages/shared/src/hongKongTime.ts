/**
 * Hong Kong Timezone Utilities (UTC+8)
 * Preserve the existing JoyJoin comparison semantics across clients.
 */

export function convertToHongKongTime(date: string | Date): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const utcTime = dateObj.getTime()
  return new Date(utcTime + 8 * 60 * 60 * 1000)
}

export function formatDateInHongKong(
  date: string | Date,
  format: 'weekday-time' | 'full' = 'weekday-time'
): string {
  const dateObj = convertToHongKongTime(date)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

  if (format === 'weekday-time') {
    const weekday = weekdays[dateObj.getUTCDay()]
    const hours = dateObj.getUTCHours().toString().padStart(2, '0')
    const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0')
    return `${weekday} ${hours}:${minutes}`
  }

  const month = dateObj.getUTCMonth() + 1
  const day = dateObj.getUTCDate()
  const weekday = weekdays[dateObj.getUTCDay()]
  const hours = dateObj.getUTCHours().toString().padStart(2, '0')
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0')
  return `${month}月${day}日 ${weekday} ${hours}:${minutes}`
}

export function getHongKongDateForComparison(date: string | Date): Date {
  return convertToHongKongTime(date)
}