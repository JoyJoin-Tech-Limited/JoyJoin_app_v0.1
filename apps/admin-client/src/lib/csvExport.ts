/**
 * CSV export utility for admin tables.
 *
 * Re-exports shared formula-injection safe helpers.
 */

import { escapeCsv, buildCsvContent } from "@joyjoin/shared";

export { escapeCsv, buildCsvContent };

export function downloadCsv(options: {
  filename: string;
  headers: string[];
  rows: unknown[][];
}) {
  const { filename, headers, rows } = options;
  const csv = buildCsvContent({ headers, rows });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
