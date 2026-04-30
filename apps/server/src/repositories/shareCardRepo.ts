import { users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";

export interface SharecardRepository {
calculateUserRank(userCreatedAt: Date): Promise<number>;

calculateArchetypeRank(userId: string, archetype: string): Promise<number>;

}

export const sharecardRepo: SharecardRepository = {
async calculateUserRank(userCreatedAt: Date): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`${users.createdAt} < ${userCreatedAt}`);
  return (result?.count || 0) + 1;
}


async calculateArchetypeRank(userId: string, archetype: string): Promise<number> {
  const user = await this.getUser(userId);
  if (!user?.createdAt) {
    return 1;
  }
  
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(and(
      eq(users.archetype, archetype),
      sql`${users.createdAt} < ${user.createdAt}`
    ));
  return (result?.count || 0) + 1;
}

};
