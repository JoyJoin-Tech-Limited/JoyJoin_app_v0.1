import { type PreSignupData, preSignupData } from "@shared/schema";
import { db } from "../db";
import { eq } from "drizzle-orm";

export interface OnboardingRepository {
  savePreSignupData(sessionId: string, data: { metadata?: any; answers?: any }): Promise<PreSignupData>;
  getPreSignupData(sessionId: string): Promise<PreSignupData | undefined>;
  clearPreSignupData(sessionId: string): Promise<void>;
}

export const onboardingRepo: OnboardingRepository = {
  async savePreSignupData(sessionId: string, data: { metadata?: any; answers?: any }): Promise<PreSignupData> {
    const [record] = await db
      .insert(preSignupData)
      .values({
        temporarySessionId: sessionId,
        metadata: data.metadata ?? {},
        answers: data.answers ?? null,
      })
      .onConflictDoUpdate({
        target: preSignupData.temporarySessionId,
        set: {
          metadata: data.metadata !== undefined ? data.metadata : preSignupData.metadata,
          answers: data.answers !== undefined ? data.answers : preSignupData.answers,
          updatedAt: new Date(),
        },
      })
      .returning();
    return record;
  },

  async getPreSignupData(sessionId: string): Promise<PreSignupData | undefined> {
    const [record] = await db
      .select()
      .from(preSignupData)
      .where(eq(preSignupData.temporarySessionId, sessionId));
    return record;
  },

  async clearPreSignupData(sessionId: string): Promise<void> {
    await db.delete(preSignupData).where(eq(preSignupData.temporarySessionId, sessionId));
  },
};
