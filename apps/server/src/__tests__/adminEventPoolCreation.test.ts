import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { z } from "zod";
import {
  assertValidTransition,
  InvalidTransitionError,
  isValidTransition,
} from "../lib/stateTransitions";

// Inline insertEventPoolSchema because @shared subpath exports don't resolve at vitest runtime
const insertEventPoolSchema = z.object({
  title: z.string().min(1, "活动标题不能为空"),
  eventType: z.enum(["饭局", "酒局", "其他"]),
  city: z.enum(["深圳", "香港"]),
  dateTime: z.date(),
  registrationDeadline: z.date(),
  minGroupSize: z.number().min(2).max(10).default(4),
  maxGroupSize: z.number().min(2).max(10).default(6),
  targetGroups: z.number().min(1).default(1),
  createdBy: z.string().min(1),
  // SEC-02 (Sprint 2026-07-14): mirrors the extend() block in _definitions.ts
  genderBalanceMode: z.enum(["none", "soft", "hard"]).optional(),
  genderBalanceBonusPoints: z.number().int().min(0).max(100).optional(),
  minFemaleCount: z.number().int().min(0).max(20).optional(),
  minMaleCount: z.number().int().min(0).max(20).optional(),
});

// ── updateEventPoolSchema (inline definition matching adminEventPools.ts) ──

const updateEventPoolSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  eventType: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  dateTime: z.string().datetime().optional(),
  registrationDeadline: z.string().datetime().optional(),
  genderRestriction: z.string().optional(),
  industryRestrictions: z.array(z.string()).optional(),
  seniorityRestrictions: z.array(z.string()).optional(),
  educationLevelRestrictions: z.array(z.string()).optional(),
  ageRangeMin: z.number().int().optional(),
  ageRangeMax: z.number().int().optional(),
  minGroupSize: z.number().int().optional(),
  maxGroupSize: z.number().int().optional(),
  targetGroups: z.number().int().optional(),
  status: z.string().optional(),
  predictiveRerankEnabledOverride: z.boolean().optional(),
  // Gender-balance controls (Sprint 2026-07-14 — mirrors adminEventPools.ts)
  genderBalanceMode: z.enum(["none", "soft", "hard"]).optional(),
  genderBalanceBonusPoints: z.number().int().min(0).max(100).optional(),
  minFemaleCount: z.number().int().min(0).max(20).optional(),
  minMaleCount: z.number().int().min(0).max(20).optional(),
});

// =============================================================================
// Section 1: insertEventPoolSchema validation
// =============================================================================

describe("insertEventPoolSchema", () => {
  const validPayload = {
    title: "周末聚餐",
    eventType: "饭局",
    city: "深圳",
    dateTime: new Date("2026-07-15T18:00:00Z"),
    registrationDeadline: new Date("2026-07-10T23:59:00Z"),
    minGroupSize: 4,
    maxGroupSize: 6,
    targetGroups: 5,
    createdBy: "user-001",
  };

  it("accepts a valid full payload", () => {
    const result = insertEventPoolSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("accepts valid payload with defaults omitted", () => {
    const minimal = {
      title: "周末聚餐",
      eventType: "饭局",
      city: "深圳",
      dateTime: new Date("2026-07-15T18:00:00Z"),
      registrationDeadline: new Date("2026-07-10T23:59:00Z"),
      createdBy: "user-001",
    };
    const result = insertEventPoolSchema.safeParse(minimal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.minGroupSize).toBe(4);
      expect(result.data.maxGroupSize).toBe(6);
      expect(result.data.targetGroups).toBe(1);
    }
  });

  it("rejects empty title", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      title: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("title");
    }
  });

  it("rejects invalid eventType", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      eventType: "KTV",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("eventType");
    }
  });

  it("rejects invalid city", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      city: "广州",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("city");
    }
  });

  it("rejects dateTime as string instead of Date", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      dateTime: "2026-07-15T18:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects registrationDeadline as string instead of Date", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      registrationDeadline: "2026-07-10T23:59:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects minGroupSize below minimum", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      minGroupSize: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects maxGroupSize above maximum", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      maxGroupSize: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects targetGroups below minimum", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      targetGroups: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = insertEventPoolSchema.safeParse({});
    expect(result.success).toBe(false);
    const paths = !result.success
      ? result.error.issues.map((i) => i.path.join("."))
      : [];
    expect(paths).toContain("title");
    expect(paths).toContain("eventType");
    expect(paths).toContain("city");
    expect(paths).toContain("dateTime");
    expect(paths).toContain("registrationDeadline");
    expect(paths).toContain("createdBy");
  });

  it("rejects missing createdBy", () => {
    const { createdBy, ...noCreator } = validPayload;
    const result = insertEventPoolSchema.safeParse(noCreator);
    expect(result.success).toBe(false);
  });

  it("accepts non-integer minGroupSize (no .int() constraint on insert schema)", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validPayload,
      minGroupSize: 2.5,
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Section 2: updateEventPoolSchema validation
// =============================================================================

describe("updateEventPoolSchema", () => {
  it("valid partial update with title only", () => {
    const result = updateEventPoolSchema.safeParse({ title: "新标题" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("新标题");
      expect(Object.keys(result.data)).toHaveLength(1);
    }
  });

  it("valid full update with all fields", () => {
    const payload = {
      title: "更新活动",
      description: "更新描述",
      eventType: "酒局",
      city: "香港",
      district: "铜锣湾",
      dateTime: "2026-08-01T19:00:00Z",
      registrationDeadline: "2026-07-25T23:59:00Z",
      genderRestriction: "female",
      industryRestrictions: ["科技", "金融"],
      seniorityRestrictions: ["entry", "mid"],
      educationLevelRestrictions: ["bachelor"],
      ageRangeMin: 25,
      ageRangeMax: 40,
      minGroupSize: 3,
      maxGroupSize: 8,
      targetGroups: 10,
      status: "active",
      predictiveRerankEnabledOverride: true,
    };
    const result = updateEventPoolSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("更新活动");
      expect(result.data.industryRestrictions).toEqual(["科技", "金融"]);
      expect(result.data.predictiveRerankEnabledOverride).toBe(true);
    }
  });

  it("invalid: title empty string", () => {
    const result = updateEventPoolSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("title");
    }
  });

  it("invalid: ageRangeMin not an integer", () => {
    const result = updateEventPoolSchema.safeParse({ ageRangeMin: 25.5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("ageRangeMin");
    }
  });

  it("invalid: ageRangeMax not an integer", () => {
    const result = updateEventPoolSchema.safeParse({ ageRangeMax: 40.7 });
    expect(result.success).toBe(false);
  });

  it("invalid: minGroupSize not an integer", () => {
    const result = updateEventPoolSchema.safeParse({ minGroupSize: 3.14 });
    expect(result.success).toBe(false);
  });

  it("invalid: maxGroupSize not an integer", () => {
    const result = updateEventPoolSchema.safeParse({ maxGroupSize: 6.9 });
    expect(result.success).toBe(false);
  });

  it("invalid: targetGroups not an integer", () => {
    const result = updateEventPoolSchema.safeParse({ targetGroups: 5.1 });
    expect(result.success).toBe(false);
  });

  it("invalid: dateTime not in ISO 8601 format", () => {
    const result = updateEventPoolSchema.safeParse({
      dateTime: "2026/07/15 18:00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("dateTime");
    }
  });

  it("invalid: registrationDeadline not in ISO 8601 format", () => {
    const result = updateEventPoolSchema.safeParse({
      registrationDeadline: "15-Jul-2026",
    });
    expect(result.success).toBe(false);
  });

  it("invalid: dateTime not a valid datetime string (no timezone)", () => {
    const result = updateEventPoolSchema.safeParse({
      dateTime: "2026-07-15",
    });
    expect(result.success).toBe(false);
  });

  it("invalid: dateTime with space instead of T separator", () => {
    const result = updateEventPoolSchema.safeParse({
      dateTime: "2026-07-15 18:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("accepts negative minGroupSize (no .min() constraint on update schema)", () => {
    const result = updateEventPoolSchema.safeParse({ minGroupSize: -1 });
    expect(result.success).toBe(true);
  });

  it("invalid: industryRestrictions is not an array", () => {
    const result = updateEventPoolSchema.safeParse({
      industryRestrictions: "科技",
    });
    expect(result.success).toBe(false);
  });

  it("invalid: seniorityRestrictions is not an array", () => {
    const result = updateEventPoolSchema.safeParse({
      seniorityRestrictions: "senior",
    });
    expect(result.success).toBe(false);
  });

  it("invalid: predictiveRerankEnabledOverride is not boolean", () => {
    const result = updateEventPoolSchema.safeParse({
      predictiveRerankEnabledOverride: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("valid: optional fields omitted", () => {
    const result = updateEventPoolSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).toHaveLength(0);
    }
  });

  it("valid: only description field", () => {
    const result = updateEventPoolSchema.safeParse({
      description: "just a description update",
    });
    expect(result.success).toBe(true);
  });

  it("valid: only boolean flag", () => {
    const result = updateEventPoolSchema.safeParse({
      predictiveRerankEnabledOverride: false,
    });
    expect(result.success).toBe(true);
  });

  it("valid: only status field", () => {
    const result = updateEventPoolSchema.safeParse({ status: "matching" });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Section 3: State transitions — event_pool
// =============================================================================

describe("adminEventPoolCreation — state transitions", () => {
  describe("valid forward transitions", () => {
    it("active → matching", () => {
      expect(() =>
        assertValidTransition("event_pool", "active", "matching"),
      ).not.toThrow();
    });

    it("matching → matched", () => {
      expect(() =>
        assertValidTransition("event_pool", "matching", "matched"),
      ).not.toThrow();
    });

    it("matched → completed", () => {
      expect(() =>
        assertValidTransition("event_pool", "matched", "completed"),
      ).not.toThrow();
    });

    it("active → cancelled", () => {
      expect(() =>
        assertValidTransition("event_pool", "active", "cancelled"),
      ).not.toThrow();
    });

    it("matched → cancelled", () => {
      expect(() =>
        assertValidTransition("event_pool", "matched", "cancelled"),
      ).not.toThrow();
    });

    it("matching → active (rollback / retry)", () => {
      expect(() =>
        assertValidTransition("event_pool", "matching", "active"),
      ).not.toThrow();
    });
  });

  describe("invalid transitions", () => {
    it("active → completed: INVALID (skips matching/matched)", () => {
      expect(() =>
        assertValidTransition("event_pool", "active", "completed"),
      ).toThrow(InvalidTransitionError);
    });

    it("matching → completed: INVALID (skips matched)", () => {
      expect(() =>
        assertValidTransition("event_pool", "matching", "completed"),
      ).toThrow(InvalidTransitionError);
    });

    it("completed → active: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "completed", "active"),
      ).toThrow(InvalidTransitionError);
    });

    it("completed → matching: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "completed", "matching"),
      ).toThrow(InvalidTransitionError);
    });

    it("completed → cancelled: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "completed", "cancelled"),
      ).toThrow(InvalidTransitionError);
    });

    it("cancelled → active: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "cancelled", "active"),
      ).toThrow(InvalidTransitionError);
    });

    it("cancelled → matching: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "cancelled", "matching"),
      ).toThrow(InvalidTransitionError);
    });

    it("cancelled → completed: INVALID (terminal)", () => {
      expect(() =>
        assertValidTransition("event_pool", "cancelled", "completed"),
      ).toThrow(InvalidTransitionError);
    });

    it("active → matched: INVALID (cannot skip matching)", () => {
      expect(() =>
        assertValidTransition("event_pool", "active", "matched"),
      ).toThrow(InvalidTransitionError);
    });

    it("matched → active: INVALID (cannot go backwards)", () => {
      expect(() =>
        assertValidTransition("event_pool", "matched", "active"),
      ).toThrow(InvalidTransitionError);
    });

    it("matched → matching: INVALID (cannot go backwards)", () => {
      expect(() =>
        assertValidTransition("event_pool", "matched", "matching"),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("idempotent (same-state) transitions", () => {
    it("allows active → active", () => {
      expect(() =>
        assertValidTransition("event_pool", "active", "active"),
      ).not.toThrow();
    });

    it("allows matching → matching", () => {
      expect(() =>
        assertValidTransition("event_pool", "matching", "matching"),
      ).not.toThrow();
    });

    it("allows matched → matched", () => {
      expect(() =>
        assertValidTransition("event_pool", "matched", "matched"),
      ).not.toThrow();
    });

    it("allows completed → completed (terminal same-state)", () => {
      expect(() =>
        assertValidTransition("event_pool", "completed", "completed"),
      ).not.toThrow();
    });

    it("allows cancelled → cancelled (terminal same-state)", () => {
      expect(() =>
        assertValidTransition("event_pool", "cancelled", "cancelled"),
      ).not.toThrow();
    });
  });

  describe("null / undefined fromState (new entity)", () => {
    it("allows null → active", () => {
      expect(() =>
        assertValidTransition("event_pool", null, "active"),
      ).not.toThrow();
    });

    it("allows undefined → cancelled", () => {
      expect(() =>
        assertValidTransition("event_pool", undefined, "cancelled"),
      ).not.toThrow();
    });

    it("allows '' → matching", () => {
      expect(() =>
        assertValidTransition("event_pool", "", "matching"),
      ).not.toThrow();
    });
  });

  describe("unknown fromState", () => {
    it("rejects unknown fromState", () => {
      expect(() =>
        assertValidTransition("event_pool", "nonexistent", "active"),
      ).toThrow(InvalidTransitionError);
    });
  });

  describe("InvalidTransitionError detail fields", () => {
    it("carries domain, fromState, toState, and a descriptive message", () => {
      let caught: InvalidTransitionError | undefined;
      try {
        assertValidTransition("event_pool", "active", "completed");
      } catch (err) {
        caught = err as InvalidTransitionError;
      }
      expect(caught).toBeInstanceOf(InvalidTransitionError);
      expect(caught?.domain).toBe("event_pool");
      expect(caught?.fromState).toBe("active");
      expect(caught?.toState).toBe("completed");
      expect(caught?.message).toContain("event_pool");
      expect(caught?.message).toContain("active");
      expect(caught?.message).toContain("completed");
    });
  });
});

// =============================================================================
// Section 4: isValidTransition helper
// =============================================================================

describe("isValidTransition event_pool", () => {
  it("returns true for valid transitions", () => {
    expect(isValidTransition("event_pool", "active", "matching")).toBe(true);
    expect(isValidTransition("event_pool", "matching", "matched")).toBe(true);
    expect(isValidTransition("event_pool", "matched", "completed")).toBe(true);
    expect(isValidTransition("event_pool", "active", "cancelled")).toBe(true);
  });

  it("returns false for invalid transitions", () => {
    expect(isValidTransition("event_pool", "completed", "active")).toBe(false);
    expect(isValidTransition("event_pool", "active", "completed")).toBe(false);
    expect(isValidTransition("event_pool", "matched", "active")).toBe(false);
    expect(isValidTransition("event_pool", "cancelled", "matching")).toBe(false);
  });

  it("returns true for null fromState", () => {
    expect(isValidTransition("event_pool", null, "active")).toBe(true);
  });

  it("returns true for same-state transitions", () => {
    expect(isValidTransition("event_pool", "active", "active")).toBe(true);
    expect(isValidTransition("event_pool", "completed", "completed")).toBe(true);
  });
});

// =============================================================================
// Section 5: Gender-balance fields (Sprint 2026-07-14 — AC-01, SEC-02)
// =============================================================================

describe("updateEventPoolSchema — gender-balance fields (AC-01, SEC-02)", () => {
  it("accepts a valid hard-mode payload with all four fields", () => {
    const result = updateEventPoolSchema.safeParse({
      genderBalanceMode: "hard",
      genderBalanceBonusPoints: 15,
      minFemaleCount: 2,
      minMaleCount: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.genderBalanceMode).toBe("hard");
      expect(result.data.genderBalanceBonusPoints).toBe(15);
      expect(result.data.minFemaleCount).toBe(2);
      expect(result.data.minMaleCount).toBe(2);
    }
  });

  it("accepts every enum value for genderBalanceMode", () => {
    for (const mode of ["none", "soft", "hard"] as const) {
      const result = updateEventPoolSchema.safeParse({ genderBalanceMode: mode });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an invalid genderBalanceMode enum value", () => {
    const result = updateEventPoolSchema.safeParse({ genderBalanceMode: "strict" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("genderBalanceMode");
    }
  });

  it("rejects out-of-range and non-integer floor counts", () => {
    expect(updateEventPoolSchema.safeParse({ minFemaleCount: -1 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ minFemaleCount: 21 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ minFemaleCount: 1.5 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ minMaleCount: -1 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ minMaleCount: 21 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ minMaleCount: 2.5 }).success).toBe(false);
  });

  it("rejects out-of-range and non-integer bonus points", () => {
    expect(updateEventPoolSchema.safeParse({ genderBalanceBonusPoints: -1 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ genderBalanceBonusPoints: 101 }).success).toBe(false);
    expect(updateEventPoolSchema.safeParse({ genderBalanceBonusPoints: 15.5 }).success).toBe(false);
  });

  it("accepts boundary values (0 floors, 0 and 100 bonus)", () => {
    const result = updateEventPoolSchema.safeParse({
      genderBalanceBonusPoints: 0,
      minFemaleCount: 0,
      minMaleCount: 0,
    });
    expect(result.success).toBe(true);
    expect(updateEventPoolSchema.safeParse({ genderBalanceBonusPoints: 100 }).success).toBe(true);
    expect(updateEventPoolSchema.safeParse({ minFemaleCount: 20 }).success).toBe(true);
  });

  it("still accepts payloads with the gender fields omitted", () => {
    const result = updateEventPoolSchema.safeParse({ title: "仅改标题" });
    expect(result.success).toBe(true);
  });
});

describe("gender-balance schema drift guards (AC-01)", () => {
  it("updateEventPoolSchema mirror stays in sync with adminEventPools.ts source", () => {
    const sourcePath = path.resolve(import.meta.dirname, "../routes/domains/adminEventPools.ts");
    const source = fs.readFileSync(sourcePath, "utf-8");
    expect(source).toMatch(/genderBalanceMode:\s*z\.enum\(\["none",\s*"soft",\s*"hard"\]\)\.optional\(\)/);
    expect(source).toMatch(/genderBalanceBonusPoints:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)\.optional\(\)/);
    expect(source).toMatch(/minFemaleCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(20\)\.optional\(\)/);
    expect(source).toMatch(/minMaleCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(20\)\.optional\(\)/);
  });

  it("insertEventPoolSchema (Drizzle-derived) does not omit the four gender-balance columns", () => {
    const sourcePath = path.resolve(
      import.meta.dirname,
      "../../../../packages/shared/src/schema/_definitions.ts",
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    // Table definition must carry the four columns.
    expect(source).toMatch(/genderBalanceMode:\s*varchar\("gender_balance_mode"\)/);
    expect(source).toMatch(/genderBalanceBonusPoints:\s*integer\("gender_balance_bonus_points"\)/);
    expect(source).toMatch(/minFemaleCount:\s*integer\("min_female_count"\)/);
    expect(source).toMatch(/minMaleCount:\s*integer\("min_male_count"\)/);

    // The insertEventPoolSchema .omit({...}) block must NOT exclude any of them,
    // otherwise POST /api/admin/event-pools would silently strip the values.
    const omitMatch = source.match(
      /insertEventPoolSchema\s*=\s*createInsertSchema\(eventPools\)\.omit\(\{([\s\S]*?)\}\)/,
    );
    expect(omitMatch).toBeTruthy();
    const omitBlock = omitMatch![1];
    expect(omitBlock).not.toContain("genderBalanceMode");
    expect(omitBlock).not.toContain("genderBalanceBonusPoints");
    expect(omitBlock).not.toContain("minFemaleCount");
    expect(omitBlock).not.toContain("minMaleCount");
  });

  it("insertEventPoolSchema extend() block in _definitions.ts tightens the four fields (SEC-02)", () => {
    const sourcePath = path.resolve(
      import.meta.dirname,
      "../../../../packages/shared/src/schema/_definitions.ts",
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    // The extend() block attached to insertEventPoolSchema must carry the same
    // validators as updateEventPoolSchema — otherwise POST accepts values PATCH rejects.
    const schemaMatch = source.match(
      /insertEventPoolSchema\s*=\s*createInsertSchema\(eventPools\)[\s\S]*?\.extend\(\{([\s\S]*?)\}\);/,
    );
    expect(schemaMatch).toBeTruthy();
    const extendBlock = schemaMatch![1];
    expect(extendBlock).toMatch(/genderBalanceMode:\s*z\.enum\(\["none",\s*"soft",\s*"hard"\]\)\.optional\(\)/);
    expect(extendBlock).toMatch(/genderBalanceBonusPoints:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)\.optional\(\)/);
    expect(extendBlock).toMatch(/minFemaleCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(20\)\.optional\(\)/);
    expect(extendBlock).toMatch(/minMaleCount:\s*z\.number\(\)\.int\(\)\.min\(0\)\.max\(20\)\.optional\(\)/);
  });
});

describe("insertEventPoolSchema — gender-balance runtime validation (SEC-02)", () => {
  const validBase = {
    title: "测试活动",
    eventType: "饭局" as const,
    city: "深圳" as const,
    dateTime: new Date(Date.now() + 86_400_000),
    registrationDeadline: new Date(),
    createdBy: "admin-1",
  };

  it("accepts a valid hard-mode creation payload", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validBase,
      genderBalanceMode: "hard",
      genderBalanceBonusPoints: 15,
      minFemaleCount: 2,
      minMaleCount: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts creation with gender fields omitted (DB defaults apply)", () => {
    expect(insertEventPoolSchema.safeParse(validBase).success).toBe(true);
  });

  it("rejects an invalid genderBalanceMode on creation", () => {
    const result = insertEventPoolSchema.safeParse({
      ...validBase,
      genderBalanceMode: "banana",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("genderBalanceMode");
    }
  });

  it("rejects out-of-range floors and bonus on creation", () => {
    expect(insertEventPoolSchema.safeParse({ ...validBase, minFemaleCount: 999 }).success).toBe(false);
    expect(insertEventPoolSchema.safeParse({ ...validBase, minFemaleCount: -1 }).success).toBe(false);
    expect(insertEventPoolSchema.safeParse({ ...validBase, minMaleCount: 21 }).success).toBe(false);
    expect(insertEventPoolSchema.safeParse({ ...validBase, genderBalanceBonusPoints: 101 }).success).toBe(false);
    expect(insertEventPoolSchema.safeParse({ ...validBase, genderBalanceBonusPoints: 15.5 }).success).toBe(false);
  });
});
