/**
 * CSV export utility for admin tables.
 *
 * Formula-injection safe: values starting with =, +, -, @, tab, or carriage
 * return are prefixed with a tab so Excel/LibreOffice treat them as text.
 */

const FORMULA_PREFIX_RE = /^[=+\-@\t\r\n]/;

function escapeCsv(value: unknown): string {
  let str = String(value ?? "");
  // Defend against CSV formula injection (Excel/LibreOffice)
  if (FORMULA_PREFIX_RE.test(str)) {
    str = "\t" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

export function downloadCsv(options: {
  filename: string;
  headers: string[];
  rows: unknown[][];
}) {
  const { filename, headers, rows } = options;
  const csvRows = rows.map((row) => row.map(escapeCsv).join(","));
  const blob = new Blob(
    ["\uFEFF" + [headers.map(escapeCsv).join(","), ...csvRows].join("\n")],
    { type: "text/csv;charset=utf-8;" }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
