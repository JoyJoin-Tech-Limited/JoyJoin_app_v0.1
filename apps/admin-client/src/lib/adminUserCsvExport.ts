import { downloadCsv } from "@/lib/csvExport";
import { fmtDate } from "@/lib/dateUtils";
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

export function exportAdminUsersCsv(users: AdminUser[]): void {
  const headers = CSV_FIELD_ORDER.map((key) => adminUserCsvLabelMap[key] ?? key);
  const rows = users.map((u) =>
    CSV_FIELD_ORDER.map((key) => {
      const renderer = CSV_FIELD_RENDERERS[key];
      if (renderer) return renderer(u);
      const value = u[key];
      return value == null ? "" : String(value);
    })
  );
  downloadCsv({ filename: `users-${fmtDate(new Date())}.csv`, headers, rows });
}
