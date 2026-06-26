import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { AdminUserDto } from "@shared/api/adminUser";
import {
  calculateAdminProfileCompleteness,
  toAdminUserDto,
} from "../routes/domains/adminUsers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminUsersPath = join(__dirname, "../routes/domains/adminUsers.ts");
const adminUsersSource = readFileSync(adminUsersPath, "utf8");

describe("admin user data alignment", () => {
  describe("calculateAdminProfileCompleteness", () => {
    it("ignores dead columns and returns 0 for a user with only dead columns", () => {
      const user = {
        topicAvoidances: ["politics"],
        hasPets: true,
        hometown: "Beijing",
        interestsTop: ["foo"],
      };
      expect(calculateAdminProfileCompleteness({ user }).score).toBe(0);
    });

    it("returns 100 when all active fields are filled including user_interests", () => {
      const user = {
        displayName: "Joy",
        gender: "女性",
        birthdate: "1990-01-01",
        currentCity: "深圳",
        intent: ["friends"],
        archetype: "社牛柯基",
        relationshipStatus: "单身",
        educationLevel: "本科",
        lifeStage: "职场老手",
        industryRawInput: "产品经理",
        bio: "hello",
        wechatContactId: "wxid",
        dietaryRestrictions: ["素食"],
        preferredLanguages: ["中文（国语）"],
      };
      const interests = { totalSelections: 3, selections: [{ label: "阅读" }] };
      expect(calculateAdminProfileCompleteness({ user, interests }).score).toBe(100);
    });

    it("counts interests only from the user_interests record, not from interestsTop", () => {
      const user = {
        displayName: "Joy",
        gender: "女性",
        birthdate: "1990-01-01",
        currentCity: "深圳",
        intent: ["friends"],
        archetype: "社牛柯基",
      };
      const withDeadInterest = { ...user, interestsTop: ["photography"] };
      const withRecord = { ...user };
      expect(
        calculateAdminProfileCompleteness({ user: withDeadInterest }).score,
      ).toBe(calculateAdminProfileCompleteness({ user: withRecord }).score);

      const interests = { totalSelections: 1 };
      expect(
        calculateAdminProfileCompleteness({ user: withRecord, interests }).score,
      ).toBeGreaterThan(calculateAdminProfileCompleteness({ user: withRecord }).score);
    });

    it("treats any 3-tier industry label (or raw input) as the profession field", () => {
      const base = {
        displayName: "Joy",
        gender: "女性",
        birthdate: "1990-01-01",
        currentCity: "深圳",
        intent: ["friends"],
        archetype: "社牛柯基",
      };
      const rawInput = { ...base, industryRawInput: "AI researcher" };
      const labeled = { ...base, industryCategoryLabel: "科技互联网" };
      expect(calculateAdminProfileCompleteness({ user: rawInput }).score).toBe(
        calculateAdminProfileCompleteness({ user: labeled }).score,
      );
      expect(calculateAdminProfileCompleteness({ user: rawInput }).missingFields).not.toContain(
        "职业",
      );
    });

    it("treats primaryArchetype as present when archetype is absent", () => {
      const base = {
        displayName: "Joy",
        gender: "女性",
        birthdate: "1990-01-01",
        currentCity: "深圳",
        intent: ["friends"],
      };
      const withArchetype = { ...base, archetype: "社牛柯基" };
      const withPrimaryArchetype = { ...base, primaryArchetype: "社牛柯基" };
      expect(
        calculateAdminProfileCompleteness({ user: withArchetype }).missingFields,
      ).not.toContain("社交原型");
      expect(
        calculateAdminProfileCompleteness({ user: withPrimaryArchetype }).missingFields,
      ).not.toContain("社交原型");
      expect(
        calculateAdminProfileCompleteness({ user: withArchetype }).score,
      ).toBe(calculateAdminProfileCompleteness({ user: withPrimaryArchetype }).score);
    });

    it("is safe when all values are null or undefined", () => {
      const result = calculateAdminProfileCompleteness({ user: {} });
      expect(result.score).toBe(0);
      expect(result.starRating).toBe(1);
      expect(result.missingFields.length).toBeGreaterThan(0);
    });
  });

  describe("toAdminUserDto", () => {
    it("strips sensitive and internal columns from the response", () => {
      const user = {
        id: "u1",
        displayName: "Joy",
        password: "hashed",
        wechatSessionKey: "secret",
        wechatOpenId: "openid",
        dailyTokenUsed: 100,
        lastTokenResetDate: "2026-01-01",
        aiFrozenUntil: "2026-01-01",
        interestsTelemetry: {},
        vibeVector: {},
        inferredTraits: {},
        inferenceConfidence: "0.9",
        conversationMode: "express",
        primaryLinguisticStyle: "direct",
        conversationEnergy: 50,
        negationReliability: "0.5",
        insightLedger: [],
        personalityTraits: {},
        personalityChallenges: [],
        idealMatch: "...",
        energyLevel: 3,
        placeOfOrigin: "...",
        longTermBase: "...",
        wechatId: "legacy",
        firstName: "Joy",
      };
      const dto = toAdminUserDto(user, {
        profileCompleteness: calculateAdminProfileCompleteness({ user }),
      });
      const keys = Object.keys(dto);
      expect(keys).not.toContain("password");
      expect(keys).not.toContain("wechatSessionKey");
      expect(keys).not.toContain("wechatOpenId");
      expect(keys).not.toContain("dailyTokenUsed");
      expect(keys).not.toContain("lastTokenResetDate");
      expect(keys).not.toContain("aiFrozenUntil");
      expect(keys).not.toContain("interestsTelemetry");
      expect(keys).not.toContain("vibeVector");
      expect(keys).not.toContain("inferredTraits");
      expect(keys).not.toContain("insightLedger");
      expect(keys).not.toContain("placeOfOrigin");
      expect(keys).not.toContain("longTermBase");
      expect(keys).not.toContain("wechatId");
      expect(dto.displayName).toBe("Joy");
    });

    it("derives deprecated interestsTop from user_interests selections", () => {
      const user = { id: "u1", displayName: "Joy" };
      const interests = { selections: [{ label: "阅读" }, { label: "旅行" }] };
      const dto = toAdminUserDto(user, {
        profileCompleteness: calculateAdminProfileCompleteness({ user, interests }),
        interests,
      });
      expect(dto.interestsTop).toEqual(["阅读", "旅行"]);
    });

    it("falls back interestsTop to topPriorities when selections are empty", () => {
      const user = { id: "u1", displayName: "Joy" };
      const interests = { selections: [], topPriorities: [{ label: "音乐" }] };
      const dto = toAdminUserDto(user, {
        profileCompleteness: calculateAdminProfileCompleteness({ user, interests }),
        interests,
      });
      expect(dto.interestsTop).toEqual(["音乐"]);
    });

    it("only exposes keys that are in the documented allow-list", () => {
      const user = { id: "u1", displayName: "Joy" };
      const dto = toAdminUserDto(user, {
        profileCompleteness: calculateAdminProfileCompleteness({ user }),
      });
      const keys = Object.keys(dto);

      const allowList: Array<keyof AdminUserDto> = [
        "id",
        "email",
        "firstName",
        "lastName",
        "displayName",
        "wechatNickname",
        "phoneNumber",
        "profileImageUrl",
        "birthdate",
        "ageVisibility",
        "gender",
        "pronouns",
        "relationshipStatus",
        "lifeStage",
        "ageMatchPreference",
        "educationLevel",
        "educationVisibility",
        "occupationId",
        "standardizedOccupationId",
        "workMode",
        "workVisibility",
        "hometownRegionCity",
        "hometownAffinityOptin",
        "currentCity",
        "accessibilityNeeds",
        "safetyNoteHost",
        "intent",
        "hasCompletedRegistration",
        "hasCompletedInterestsTopics",
        "hasCompletedPersonalityTest",
        "hasSeenProfileReview",
        "hasCompletedInterestsCarousel",
        "onboardingCheckpoint",
        "onboardingCheckpointTimestamp",
        "interestsDeep",
        "interestsRankedTop3",
        "interestFavorite",
        "bio",
        "preferredLanguages",
        "dietaryRestrictions",
        "tableVibePreference",
        "defaultPreferenceStrictness",
        "defaultPreferredDistricts",
        "defaultGenderComposition",
        "defaultAcceptPairs",
        "defaultKolComfort",
        "socialStyle",
        "icebreakerRole",
        "venueStylePreference",
        "cuisinePreference",
        "favoriteRestaurant",
        "favoriteRestaurantReason",
        "archetype",
        "primaryArchetype",
        "secondaryArchetype",
        "roleSubtype",
        "debateComfort",
        "needsPersonalityRetake",
        "eventsAttended",
        "matchesMade",
        "experiencePoints",
        "joyCoins",
        "currentLevel",
        "activityStreak",
        "lastActivityDate",
        "streakFreezeAvailable",
        "eventCredits",
        "eventCreditsExpiry",
        "isAdmin",
        "isBanned",
        "isTestBot",
        "violationCount",
        "lastViolationReason",
        "viewedEventAnimations",
        "registrationMethod",
        "registrationCompletedAt",
        "onboardingRestartCount",
        "industryCategory",
        "industryCategoryLabel",
        "industrySegmentNew",
        "industrySegmentLabel",
        "industryNiche",
        "industryNicheLabel",
        "industryRawInput",
        "industryNormalized",
        "industrySource",
        "industryConfidence",
        "industryClassifiedAt",
        "industryLastVerifiedAt",
        "socialTag",
        "socialTagSelectedAt",
        "wechatContactId",
        "wechatContactIdSetAt",
        "createdAt",
        "updatedAt",
        "interestsTop",
        "profileCompleteness",
      ];

      for (const key of keys) {
        expect(allowList).toContain(key);
      }
      for (const key of allowList) {
        expect(keys).toContain(key);
      }
    });
  });

  describe("structural guard", () => {
    it("does not reference dead columns in the canonical completeness function", () => {
      const fnMatch = adminUsersSource.match(
        /export function calculateAdminProfileCompleteness[\s\S]*?^\}/m,
      );
      expect(fnMatch).toBeTruthy();
      const fnBody = fnMatch![0];
      expect(fnBody).not.toContain("topicAvoidances");
      expect(fnBody).not.toContain("hasPets");
      expect(fnBody).not.toContain("hometown");
      expect(fnBody).not.toContain("interestsTop");
    });

    it("does not reference removed dead columns anywhere in adminUsers.ts", () => {
      expect(adminUsersSource).not.toMatch(/\btopicAvoidances\b/);
      expect(adminUsersSource).not.toMatch(/\bhasPets\b/);
      expect(adminUsersSource).not.toMatch(/\bhometown\b/);
    });
  });
});
