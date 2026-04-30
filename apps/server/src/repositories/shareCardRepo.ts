import { users } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";

export interface ShareCardRepository {
  calculateUserRank(userCreatedAt: Date): Promise<number>;
  calculateArchetypeRank(userId: string, archetype: string): Promise<number>;
}

export const shareCardRepo: ShareCardRepository = {
  async calculateUserRank(userCreatedAt: Date): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`${users.createdAt} < ${userCreatedAt}`);
    return (result?.count || 0) + 1;
  },

  async calculateArchetypeRank(userId: string, archetype: string): Promise<number> {
    const [currentUser] = await db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!currentUser?.createdAt) {
      return 1;
    }

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          eq(users.archetype, archetype),
          sql`${users.createdAt} < ${currentUser.createdAt}`,
        ),
      );
    return (result?.count || 0) + 1;
  },
};
