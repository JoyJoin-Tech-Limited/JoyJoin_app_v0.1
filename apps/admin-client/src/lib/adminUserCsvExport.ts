import { downloadCsv } from "@/lib/csvExport";
import { fmtCsvDate, fmtDate } from "@/lib/dateUtils";
import {
  getCanonicalDisplayName,
  getDietaryRestrictionDisplay,
  getEducationDisplay,
  getIntentDisplay,
  getLanguagePreferenceDisplay,
  getLifeStageDisplay,
  getRelationshipDisplay,
  adminUserCsvLabelMap,
} from "@/lib/userFieldMappings";
import type { AdminUserDto } from "@joyjoin/shared";
import type { AdminUser } from "@/pages/admin/types";

type CsvFieldKey = keyof AdminUserDto;

/**
 * Ordered manifest of AdminUserDto fields exported to CSV.
 * The order and keys are type-checked against the shared DTO.
 */
const CSV_FIELD_ORDER: CsvFieldKey[] = [
  "id",
  "displayName",
  "email",
  "phoneNumber",
  "currentCity",
  "gender",
  "lifeStage",
  "relationshipStatus",
  "archetype",
  "intent",
  "educationLevel",
  "industryCategoryLabel",
  "industrySegmentLabel",
  "industryNicheLabel",
  "industryRawInput",
  "bio",
  "wechatContactId",
  "preferredLanguages",
  "dietaryRestrictions",
  "profileCompleteness",
  "createdAt",
  "isBanned",
];

/**
 * Per-field CSV renderers. Fields without a renderer are stringified directly.
 */
const CSV_FIELD_RENDERERS: Partial<Record<CsvFieldKey, (u: AdminUser) => string>> = {
  displayName: getCanonicalDisplayName,
  lifeStage: (u) => getLifeStageDisplay(u.lifeStage),
  relationshipStatus: (u) => getRelationshipDisplay(u.relationshipStatus),
  intent: (u) => getIntentDisplay(u.intent),
  educationLevel: (u) => getEducationDisplay(u.educationLevel),
  industryCategoryLabel: (u) => u.industryCategoryLabel || u.industryCategory || "",
  preferredLanguages: (u) => getLanguagePreferenceDisplay(u.preferredLanguages),
  dietaryRestrictions: (u) => getDietaryRestrictionDisplay(u.dietaryRestrictions),
  profileCompleteness: (u) => (u.profileCompleteness ? `${u.profileCompleteness.score}%` : ""),
  createdAt: (u) => fmtDate(u.createdAt),
  isBanned: (u) => (u.isBanned ? "已封禁" : "正常"),
};

export interface AdminUsersCsvExportOptions {
  /**
   * Scope suffix appended to the default filename, e.g. `全部12人` or
   * `前5000人-共9000人`.
   *
   * Without it the file is `users-YYYY-MM-DD.csv`, which is indistinguishable
   * between "every user" and "the first 5000 of 9000" once it is out of the
   * toast and sitting in a downloads folder next to another one from the same
   * day. The caller knows the scope — the filename is where it has to live.
   */
  filenameHint?: string;
}

/** Keeps a hint long enough to stay descriptive, short enough to stay a filename. */
const FILENAME_HINT_MAX_LENGTH = 80;

/**
 * Strip the characters that filesystems reserve (`/ : * ? " < > | \`) plus
 * whitespace, so the name the operator reads in the toast is the name that
 * lands on disk. Browsers silently rewrite an illegal `download` attribute,
 * which is how `users-2026/10/23.csv` used to arrive as `users-2026_10_23.csv`.
 */
function sanitizeFilenameHint(hint: string): string {
  return hint
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, FILENAME_HINT_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export function exportAdminUsersCsv(
  users: AdminUser[],
  options: AdminUsersCsvExportOptions = {},
): void {
  const headers = CSV_FIELD_ORDER.map((key) => adminUserCsvLabelMap[key] ?? key);
  const rows = users.map((u) =>
    CSV_FIELD_ORDER.map((key) => {
      const renderer = CSV_FIELD_RENDERERS[key];
      if (renderer) return renderer(u);
      const value = u[key];
      return value == null ? "" : String(value);
    })
  );
  const hint = options.filenameHint ? sanitizeFilenameHint(options.filenameHint) : "";
  downloadCsv({
    filename: `users-${fmtCsvDate(new Date())}${hint ? `-${hint}` : ""}.csv`,
    headers,
    rows,
  });
}
