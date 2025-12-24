/**
 * Hong Kong Timezone Utilities (UTC+8)
 * 将所有时间统一转换为香港时区显示
 */

export function convertToHongKongTime(date: string | Date): Date {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  // 获取UTC时间戳，然后添加8小时的偏移
  const utcTime = dateObj.getTime();
  const hongKongTime = new Date(utcTime + 8 * 60 * 60 * 1000);
  return hongKongTime;
}

export function formatDateInHongKong(date: string | Date, format: 'weekday-time' | 'full' = 'weekday-time'): string {
  const dateObj = convertToHongKongTime(date);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  
  if (format === 'weekday-time') {
    const weekday = weekdays[dateObj.getUTCDay()];
    const hours = dateObj.getUTCHours().toString().padStart(2, '0');
    const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
    return `${weekday} ${hours}:${minutes}`;
  }
  
  // full format: 月日 周几 HH:mm
  const month = dateObj.getUTCMonth() + 1;
  const day = dateObj.getUTCDate();
  const weekday = weekdays[dateObj.getUTCDay()];
  const hours = dateObj.getUTCHours().toString().padStart(2, '0');
  const minutes = dateObj.getUTCMinutes().toString().padStart(2, '0');
  return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
}

export function getHongKongDateForComparison(date: string | Date): Date {
  // 用于比较的函数，返回转换后的日期对象
  return convertToHongKongTime(date);
}
