import { format, type Locale } from "date-fns";
import { zhCN } from "date-fns/locale";

/**
 * Safely format a date string. Returns fallback on invalid/empty input.
 */
export function safeFormat(
  dateStr: string | Date | null | undefined,
  fmt: string,
  options?: { locale?: Locale; fallback?: string }
): string {
  if (!dateStr) return options?.fallback ?? "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (Number.isNaN(d.getTime())) return options?.fallback ?? "—";
    return format(d, fmt, options?.locale ? { locale: options.locale } : undefined);
  } catch {
    return options?.fallback ?? "—";
  }
}

/** Common admin date formats */
export const fmtDate = (d: string | Date | null | undefined) =>
  safeFormat(d, "yyyy/MM/dd", { locale: zhCN, fallback: "—" });

export const fmtDateTime = (d: string | Date | null | undefined) =>
  safeFormat(d, "yyyy-MM-dd HH:mm:ss", { locale: zhCN, fallback: "—" });

export const fmtDateTimeShort = (d: string | Date | null | undefined) =>
  safeFormat(d, "yyyy-MM-dd HH:mm", { locale: zhCN, fallback: "—" });

export const fmtCsvDate = (d: string | Date | null | undefined) =>
  safeFormat(d, "yyyy-MM-dd", { fallback: "" });

export const fmtDateTimeLocal = (d: string | Date | null | undefined) =>
  safeFormat(d, "yyyy-MM-dd'T'HH:mm", { fallback: "" });
