import { eq } from "drizzle-orm";
import { db } from "../db";
import { referralCodes } from "@shared/schema";

/**
 * Shared lazy referral-code provisioning.
 *
 * Extracted from routes/domains/referrals.ts (2026-10-14) so both the stats
 * endpoint and the share-QR route mint codes with identical semantics:
 * one permanent 6-char code per user, confusing chars excluded.
 */
function generateCode(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // No confusing chars
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function getOrCreateUserReferralCode(userId: string): Promise<string> {
  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, userId))
    .limit(1);

  if (existing) return existing.code;

  let code = generateCode();
  let attempts = 0;
  while (attempts < 5) {
    const [conflict] = await db
      .select({ id: referralCodes.id })
      .from(referralCodes)
      .where(eq(referralCodes.code, code))
      .limit(1);
    if (!conflict) break;
    code = generateCode();
    attempts++;
  }

  const [created] = await db.insert(referralCodes).values({ userId, code }).returning();
  return created.code;
}
