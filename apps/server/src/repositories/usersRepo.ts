import {
  type User,
  type UpsertUser,
  type UpdateProfile,
  type UpdateFullProfile,
  type UpdatePersonality,
  type RegisterUser,
  type InterestsTopics,
  users,
} from "@shared/schema";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";

export interface UsersRepository {
  getUser(id: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserByPhone(phoneNumber: string): Promise<User[]>;
  createUserWithPhone(data: { phoneNumber: string; email: string; firstName: string; lastName: string }): Promise<User>;
  getUserByWechatOpenId(openId: string): Promise<User | undefined>;
  createUserWithWechat(data: { wechatOpenId: string; wechatSessionKey?: string; wechatNickname?: string; wechatAvatarUrl?: string }): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateProfile(id: string, profile: UpdateProfile): Promise<User>;
  updateFullProfile(id: string, profile: UpdateFullProfile): Promise<User>;
  updatePersonality(id: string, personality: UpdatePersonality): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User>;
  markProfileSetupComplete(id: string): Promise<void>;
  markVoiceQuizComplete(id: string): Promise<void>;
  registerUser(id: string, data: RegisterUser): Promise<User>;
  markRegistrationComplete(id: string): Promise<void>;
  markPersonalityTestComplete(id: string): Promise<void>;
  updateUserProfile(id: string, profileData: Partial<User>): Promise<User>;
  updateInterestsTopics(id: string, data: InterestsTopics): Promise<User>;
}

export const usersRepo: UsersRepository = {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  },

  async getAllUsers(): Promise<User[]> {
    const result = await db.execute(sql`SELECT * FROM users`);
    return result.rows as unknown as User[];
  },

  async getUserByPhone(phoneNumber: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
  },

  async createUserWithPhone(data: { phoneNumber: string; email: string; firstName: string; lastName: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        phoneNumber: data.phoneNumber,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        hasCompletedRegistration: false,
        hasCompletedInterestsTopics: false,
        hasCompletedPersonalityTest: false,
        hasCompletedProfileSetup: false,
        hasCompletedVoiceQuiz: false,
      })
      .returning();
    return user;
  },

  async getUserByWechatOpenId(openId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.wechatOpenId, openId));
    return user;
  },

  async createUserWithWechat(data: { wechatOpenId: string; wechatSessionKey?: string; wechatNickname?: string; wechatAvatarUrl?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        wechatOpenId: data.wechatOpenId,
        wechatSessionKey: data.wechatSessionKey,
        wechatNickname: data.wechatNickname,
        wechatAvatarUrl: data.wechatAvatarUrl,
        hasCompletedRegistration: false,
        hasCompletedInterestsTopics: false,
        hasCompletedPersonalityTest: false,
        hasCompletedProfileSetup: false,
        hasCompletedVoiceQuiz: false,
      })
      .returning();
    return user;
  },

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingById = userData.id ? await db.select().from(users).where(eq(users.id, userData.id)) : [];
    const existingByEmail = userData.email
      ? await db.select().from(users).where(eq(users.email, userData.email))
      : [];

    if (existingById.length > 0) {
      const [user] = await db
        .update(users)
        .set({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userData.id!))
        .returning();
      return user;
    }

    if (existingByEmail.length > 0) {
      const [user] = await db
        .update(users)
        .set({
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.email, userData.email!))
        .returning();
      return user;
    }

    const [user] = await db.insert(users).values(userData).returning();
    return user;
  },

  async updateProfile(id: string, profile: UpdateProfile): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async updateFullProfile(id: string, profile: UpdateFullProfile): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...profile, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async updatePersonality(id: string, personality: UpdatePersonality): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...personality, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  },

  async markProfileSetupComplete(id: string): Promise<void> {
    await db
      .update(users)
      .set({ hasCompletedProfileSetup: true, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  async markVoiceQuizComplete(id: string): Promise<void> {
    await db
      .update(users)
      .set({ hasCompletedVoiceQuiz: true, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  async registerUser(id: string, data: RegisterUser): Promise<User> {
    console.log("[Storage] Updating user registration:", { id, data });

    const [user] = await db
      .update(users)
      .set({
        displayName: data.displayName,
        birthdate: data.birthdate,
        ageVisibility: data.ageVisibility,
        gender: data.gender,
        pronouns: data.pronouns,
        relationshipStatus: data.relationshipStatus,
        educationLevel: data.educationLevel,
        educationVisibility: data.educationVisibility,
        industry: data.industry,
        roleTitleShort: data.roleTitleShort,
        seniority: data.seniority,
        workVisibility: data.workVisibility,
        hometownRegionCity: data.hometownRegionCity,
        hometownAffinityOptin: data.hometownAffinityOptin,
        accessibilityNeeds: data.accessibilityNeeds,
        safetyNoteHost: data.safetyNoteHost,
        wechatId: data.wechatId,
        hasCompletedRegistration: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    console.log("[Storage] User updated result:", { id: user.id, displayName: user.displayName, gender: user.gender, birthdate: user.birthdate });
    return user;
  },

  async markRegistrationComplete(id: string): Promise<void> {
    await db
      .update(users)
      .set({ hasCompletedRegistration: true, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  async markPersonalityTestComplete(id: string): Promise<void> {
    await db
      .update(users)
      .set({
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
  },

  async updateUserProfile(id: string, profileData: Partial<User>): Promise<User> {
    const { id: _ignoredId, createdAt: _createdAt, updatedAt: _updatedAt, ...updateData } = profileData as any;

    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    return user;
  },

  async updateInterestsTopics(id: string, data: InterestsTopics): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        interestsTop: data.interestsTop,
        primaryInterests: data.primaryInterests,
        topicAvoidances: data.topicAvoidances,
        interestFavorite: data.primaryInterests?.[0] || data.interestFavorite,
        topicsHappy: data.topicsHappy,
        topicsAvoid: data.topicsAvoid,
        hasCompletedInterestsTopics: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  },
};
