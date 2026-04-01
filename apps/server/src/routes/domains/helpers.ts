export function normalizeOptionalDuration(value: unknown): number | null {
  return typeof value === "number" && value >= 0 ? value : null;
}
