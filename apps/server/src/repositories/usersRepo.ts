import {
  type User,
  type UpsertUser,
  type UpdateProfile,
  type UpdateFullProfile,
  type UpdatePersonality,
  type RegisterUser,
  type InterestsTopics,
  users,
  testResponses,
  roleResults,
  userInterests,
  userSocialTagGenerations,
  userSemanticProfiles,
  assessmentSessions,
  assessmentAnswers,
} from "@shared/schema";
import { db } from "../db";
import { eq, inArray } from "drizzle-orm";
import { computeOnboardingNextStep } from "../lib/computeOnboardingNextStep";

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
  restartOnboarding(id: string): Promise<{ user: User; action: 'restarted' | 'idempotent' | 'already_complete' }>;
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
    // Use Drizzle's query builder so column names are mapped from snake_case
    // DB columns to camelCase TypeScript keys. Raw `db.execute(sql`SELECT *`)`
    // returns snake_case keys, which breaks callers that expect camelCase.
    return db.select().from(users);
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

  async restartOnboarding(id: string): Promise<{ user: User; action: 'restarted' | 'idempotent' | 'already_complete' }> {
    return db.transaction(async (tx: typeof db) => {
      const [user] = await tx.select().from(users).where(eq(users.id, id));
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Idempotency: already in fresh state
      if (user.hasCompletedPersonalityTest === false && user.onboardingCheckpoint === null) {
        return { user, action: 'idempotent' };
      }

      const nextStep = computeOnboardingNextStep(user);

      if (nextStep === 'discover') {
        return { user, action: 'already_complete' };
      }

      const currentCount = user.onboardingRestartCount ?? 0;
      const newCount = Math.min(currentCount + 1, 5);

      const updateData: Partial<User> = {
        displayName: null,
        gender: null,
        currentCity: null,
        birthdate: null,
        relationshipStatus: null,
        educationLevel: null,
        occupationId: null,
        workMode: null,
        hometownRegionCity: null,
        intent: null,
        bio: null,
        preferredLanguages: null,
        dietaryRestrictions: null,
        tableVibePreference: null,
        hasCompletedProfileSetup: false,
        hasCompletedInterestsTopics: false,
        hasCompletedPersonalityTest: false,
        hasCompletedInterestsCarousel: false,
        hasSeenProfileReview: false,
        onboardingCheckpoint: null,
        onboardingCheckpointTimestamp: null,
        primaryArchetype: null,
        secondaryArchetype: null,
        archetype: null,
        vibeVector: null,
        roleSubtype: null,
        personalityTraits: null,
        interestsDeep: null,
        interestsTelemetry: null,
        socialTag: null,
        wechatContactId: null,
        industryCategory: null,
        industryCategoryLabel: null,
        industrySegmentNew: null,
        industrySegmentLabel: null,
        industryNiche: null,
        industryNicheLabel: null,
        industryRawInput: null,
        industryNormalized: null,
        industrySource: null,
        industryConfidence: null,
        industryClassifiedAt: null,
        industryLastVerifiedAt: null,
        conversationMode: null,
        primaryLinguisticStyle: null,
        conversationEnergy: null,
        negationReliability: null,
        inferredTraits: null,
        inferenceConfidence: null,
        insightLedger: null,
        structuredOccupation: null,
        industrySegment: null,
        profileImageUrl: null,
        hasCompletedRegistration: true,
        onboardingRestartCount: newCount,
        updatedAt: new Date(),
      };

      const [updatedUser] = await tx
        .update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();

      await tx.delete(testResponses).where(eq(testResponses.userId, id));
      await tx.delete(roleResults).where(eq(roleResults.userId, id));
      await tx.delete(userInterests).where(eq(userInterests.userId, id));
      await tx.delete(userSocialTagGenerations).where(eq(userSocialTagGenerations.userId, id));
      await tx.delete(userSemanticProfiles).where(eq(userSemanticProfiles.userId, id));

      // Clear V4 assessment data so the user gets a completely fresh test
      const sessionsToClear = await tx
        .select({ id: assessmentSessions.id })
        .from(assessmentSessions)
        .where(eq(assessmentSessions.userId, id));
      if (sessionsToClear.length > 0) {
        const sessionIds = sessionsToClear.map((s: { id: string }) => s.id);
        await tx.delete(assessmentAnswers).where(inArray(assessmentAnswers.sessionId, sessionIds));
        await tx.delete(assessmentSessions).where(inArray(assessmentSessions.id, sessionIds));
      }

      return { user: updatedUser, action: 'restarted' };
    });
  },
};
