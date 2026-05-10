/**
 * Admin user badge helpers — archetype colors and stuck-user detection.
 */

import {
  ARCHETYPE_BY_NAME_CN,
  type ArchetypeDefinition,
} from "@shared/personality/archetypeNames";
import {
  getArchetypeHSL,
  type ArchetypeHSL,
} from "@shared/archetypeColors";
import type { AdminUser } from "./types";

/** Build a CSS hsl() string from archetype HSL values. */
export function hslString(hsl: ArchetypeHSL): string {
  return `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;
}

/** Get background + text color styles for an archetype badge. */
export function getArchetypeBadgeStyle(
  archetypeName: string | null | undefined
): { backgroundColor: string; color: string; borderColor: string } | null {
  if (!archetypeName) return null;

  const def: ArchetypeDefinition | undefined =
    ARCHETYPE_BY_NAME_CN[archetypeName];
  const id = def?.id ?? archetypeName; // fallback if already an ID
  const hsl = getArchetypeHSL(id);

  // Light pastel background, darker text for readability
  const bg = `hsl(${hsl.h} ${Math.min(hsl.s + 10, 60)}% ${Math.min(hsl.l + 25, 92)}%)`;
  const text = `hsl(${hsl.h} ${Math.min(hsl.s + 20, 70)}% ${Math.max(hsl.l - 30, 25)}%)`;
  const border = `hsl(${hsl.h} ${hsl.s}% ${hsl.l}%)`;

  return { backgroundColor: bg, color: text, borderColor: border };
}

/** Stuck-user reasons for admin attention. */
export type StuckReason =
  | "incomplete_profile"
  | "no_personality_test"
  | "no_registration"
  | "stuck_onboarding";

export interface StuckStatus {
  isStuck: boolean;
  reasons: StuckReason[];
  label: string;
  variant: "destructive" | "secondary" | "outline";
}

/** Determine if a user is "stuck" and needs admin attention. */
export function getStuckStatus(user: AdminUser): StuckStatus {
  const reasons: StuckReason[] = [];

  if (!user.hasCompletedRegistration) {
    reasons.push("no_registration");
  }
  if (!user.hasCompletedPersonalityTest) {
    reasons.push("no_personality_test");
  }
  if (user.profileCompleteness && user.profileCompleteness.score < 50) {
    reasons.push("incomplete_profile");
  }
  if (
    user.onboardingCheckpoint &&
    ["setup", "extended", "review"].includes(user.onboardingCheckpoint)
  ) {
    reasons.push("stuck_onboarding");
  }

  if (reasons.length === 0) {
    return { isStuck: false, reasons: [], label: "", variant: "outline" };
  }

  // Severity: destructive if no registration or very incomplete
  const variant: StuckStatus["variant"] =
    reasons.includes("no_registration") || reasons.includes("incomplete_profile")
      ? "destructive"
      : "secondary";

  const label = reasons.includes("no_registration")
    ? "未注册"
    : reasons.includes("no_personality_test")
      ? "未测人格"
      : reasons.includes("incomplete_profile")
        ? "资料不全"
        : "引导中";

  return { isStuck: true, reasons, label, variant };
}
