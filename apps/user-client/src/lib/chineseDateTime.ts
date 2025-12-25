import { parseISO, differenceInHours, differenceInMinutes, differenceInDays, getHours, getMinutes, getDay, getMonth, getDate, getYear, isSameYear } from "date-fns";

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export type UrgencyLevel = "calm" | "warn" | "critical" | "expired";

export interface CountdownResult {
  text: string;
  urgency: UrgencyLevel;
  shouldShow: boolean;
}

function getTimeOfDayPrefix(hour: number): string {
  if (hour >= 0 && hour < 6) return "凌晨";
  if (hour >= 6 && hour < 12) return "上午";
  if (hour >= 12 && hour < 14) return "中午";
  if (hour >= 14 && hour < 18) return "下午";
  return "晚上";
}

function formatHour12(hour: number): number {
  if (hour === 0) return 12;
  if (hour > 12) return hour - 12;
  return hour;
}

export function formatChineseTime(hour: number, minute?: number): string {
  const prefix = getTimeOfDayPrefix(hour);
  const hour12 = formatHour12(hour);
  
  if (minute && minute > 0) {
    return `${prefix}${hour12}点${minute}分`;
  }
  return `${prefix}${hour12}点`;
}

export function formatChineseDateTime(dateInput: Date | string, includeYear?: boolean): string {
  const date = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
  const now = new Date();
  
  const month = getMonth(date) + 1;
  const day = getDate(date);
  const weekday = WEEKDAY_NAMES[getDay(date)];
  const hour = getHours(date);
  const minute = getMinutes(date);
  
  const timeStr = formatChineseTime(hour, minute);
  
  const showYear = includeYear || !isSameYear(date, now);
  
  if (showYear) {
    const year = getYear(date);
    return `${year}年${month}月${day}日 (${weekday}) ${timeStr}`;
  }
  
  return `${month}月${day}日 (${weekday}) ${timeStr}`;
}

export function formatChineseDateOnly(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
  
  const month = getMonth(date) + 1;
  const day = getDate(date);
  const weekday = WEEKDAY_NAMES[getDay(date)];
  
  return `${month}月${day}日 (${weekday})`;
}

export function getCountdown(deadlineInput: Date | string): CountdownResult {
  const deadline = typeof deadlineInput === "string" ? parseISO(deadlineInput) : deadlineInput;
  const now = new Date();
  
  const minutesLeft = differenceInMinutes(deadline, now);
  const hoursLeft = differenceInHours(deadline, now);
  const daysLeft = differenceInDays(deadline, now);
  
  if (minutesLeft <= 0) {
    return {
      text: "已截止",
      urgency: "expired",
      shouldShow: true,
    };
  }
  
  if (minutesLeft < 60) {
    return {
      text: `还剩${minutesLeft}分钟`,
      urgency: "critical",
      shouldShow: true,
    };
  }
  
  if (hoursLeft < 24) {
    return {
      text: `还剩${hoursLeft}小时`,
      urgency: hoursLeft <= 6 ? "critical" : "warn",
      shouldShow: true,
    };
  }
  
  if (daysLeft <= 7) {
    return {
      text: `还剩${daysLeft}天`,
      urgency: daysLeft <= 1 ? "warn" : "calm",
      shouldShow: true,
    };
  }
  
  return {
    text: "",
    urgency: "calm",
    shouldShow: false,
  };
}

export function parseTimeString(timeStr: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = timeStr.split(":");
  return {
    hour: parseInt(hourStr, 10) || 0,
    minute: parseInt(minuteStr, 10) || 0,
  };
}

export function formatTimeStringToChinese(timeStr: string): string {
  const { hour, minute } = parseTimeString(timeStr);
  return formatChineseTime(hour, minute);
}
