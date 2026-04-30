import { adminAccounts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

export interface AdminaccountsRepository {
getAdminAccountByUsername(username: string): Promise<AdminAccount | undefined>;

getAdminAccountById(id: string): Promise<AdminAccount | undefined>;

listAdminAccounts(): Promise<AdminAccount[]>;

createAdminAccount(data: { username: string; passwordHash: string; role: string; displayName?: string }): Promise<AdminAccount>;

updateAdminAccount(id: string, updates: Partial<Pick<AdminAccount, 'role' | 'status' | 'displayName' | 'passwordHash'>>): Promise<AdminAccount>;

updateAdminLastLogin(id: string): Promise<void>;

}

export const adminaccountsRepo: AdminaccountsRepository = {
async getAdminAccountByUsername(username: string): Promise<AdminAccount | undefined> {
  const [account] = await db
    .select()
    .from(adminAccounts)
    .where(eq(adminAccounts.username, username));
  return account;
}


async getAdminAccountById(id: string): Promise<AdminAccount | undefined> {
  const [account] = await db
    .select()
    .from(adminAccounts)
    .where(eq(adminAccounts.id, id));
  return account;
}


async listAdminAccounts(): Promise<AdminAccount[]> {
  return db
    .select()
    .from(adminAccounts)
    .orderBy(adminAccounts.createdAt);
}


async createAdminAccount(data: {
  username: string;
  passwordHash: string;
  role: string;
  displayName?: string;
}): Promise<AdminAccount> {
  const [account] = await db
    .insert(adminAccounts)
    .values({
      username: data.username,
      passwordHash: data.passwordHash,
      role: data.role,
      displayName: data.displayName,
      status: 'active',
    })
    .returning();
  return account;
}


async updateAdminAccount(
  id: string,
  updates: Partial<Pick<AdminAccount, 'role' | 'status' | 'displayName' | 'passwordHash'>>,
): Promise<AdminAccount> {
  const [account] = await db
    .update(adminAccounts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(adminAccounts.id, id))
    .returning();
  return account;
}


async updateAdminLastLogin(id: string): Promise<void> {
  await db
    .update(adminAccounts)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(adminAccounts.id, id));
}

};
