import { shortId } from "./adminUserStatusDisplay";

export interface PersonLabelInput {
  /** Chosen display name — the primary identity across the product. */
  displayName?: string | null;
  /** WeChat nickname — present for almost every real account. */
  wechatNickname?: string | null;
  /** Legacy profile columns; still populated for older accounts. */
  firstName?: string | null;
  lastName?: string | null;
  /** Last resort: a truncated user id, never a full UUID. */
  id?: string | null;
  /** Copy used when nothing identifies the person (default 未知用户). */
  fallback?: string;
}

/**
 * One identity rule for admin surfaces: a human label first, then the WeChat
 * nickname, then the legacy name pair, and only then a truncated user id.
 * Full UUIDs are not an identity — operators cannot tell two of them apart.
 */
export function personLabel(input: PersonLabelInput): string {
  const displayName = input.displayName?.trim();
  if (displayName) return displayName;

  const wechatNickname = input.wechatNickname?.trim();
  if (wechatNickname) return wechatNickname;

  const fullName = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (fullName) return fullName;

  if (input.id) return `用户 ${shortId(input.id)}`;

  return input.fallback ?? "未知用户";
}
