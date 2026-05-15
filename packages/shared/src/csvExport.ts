/**
 * Shared CSV export utilities.
 *
 * Formula-injection safe: values starting with =, +, -, @, tab, or carriage
 * return are prefixed with a tab so Excel/LibreOffice treat them as text.
 */

const FORMULA_PREFIX_RE = /^[=+\-\@\t\r\n]/;

export function escapeCsv(value: unknown): string {
  let str = String(value ?? "");
  // Defend against CSV formula injection (Excel/LibreOffice)
  if (FORMULA_PREFIX_RE.test(str)) {
    str = "\t" + str;
  }
  // Normalize newlines so they don't break CSV row structure
  str = str.replace(/\r\n/g, "\\n").replace(/\n/g, "\\n").replace(/\r/g, "\\n");
  return `"${str.replace(/"/g, '""')}"`;
}

export function buildCsvContent(options: {
  headers: string[];
  rows: unknown[][];
}): string {
  const { headers, rows } = options;
  const csvRows = rows.map((row) => row.map(escapeCsv).join(","));
  return "\uFEFF" + [headers.map(escapeCsv).join(","), ...csvRows].join("\n");
}
