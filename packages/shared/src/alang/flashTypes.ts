import { z } from "zod";

export const FLASH_CITY = "深圳" as const;
export const FLASH_COORDINATE_SYSTEM = "gcj02" as const;
export const FLASH_ARRIVAL_RADIUS_METERS = 50;
export const FLASH_TASK_DURATION_DAYS = 7;
export const FLASH_ENCOUNTER_TTL_HOURS = 24;
export const FLASH_MAX_ACTIVE_TASKS = 3;
export const FLASH_MAX_ACTIVE_TASKS_PER_NPC = 1;
export const FLASH_PERSONALIZATION_CONSENT_VERSION = "flash-personalization-v1" as const;
export const FLASH_SHENZHEN_BOUNDS = {
  minLatitude: 22.35,
  maxLatitude: 22.95,
  minLongitude: 113.7,
  maxLongitude: 114.75,
} as const;

export const flashCanonicalScreenSchema = z.enum([
  "home",
  "radar",
  "dialogue",
  "task",
  "feedback",
  "delivery",
  "completed",
  "unavailable",
]);
export type FlashCanonicalScreen = z.infer<typeof flashCanonicalScreenSchema>;

export const flashCoordinateSchema = z.object({
  latitude: z.number().finite().min(FLASH_SHENZHEN_BOUNDS.minLatitude).max(FLASH_SHENZHEN_BOUNDS.maxLatitude),
  longitude: z.number().finite().min(FLASH_SHENZHEN_BOUNDS.minLongitude).max(FLASH_SHENZHEN_BOUNDS.maxLongitude),
  coordinateSystem: z.literal(FLASH_COORDINATE_SYSTEM),
});
export type FlashCoordinateRequest = z.infer<typeof flashCoordinateSchema>;

export const flashAnswerRequestSchema = z.object({
  questionId: z.string().trim().min(1).max(80),
  optionId: z.string().trim().min(1).max(80),
});
export type FlashAnswerRequest = z.infer<typeof flashAnswerRequestSchema>;

export const flashAcceptRequestSchema = z.object({
  accepted: z.boolean().default(true),
});
export type FlashAcceptRequest = z.infer<typeof flashAcceptRequestSchema>;

export const flashFeedbackRequestSchema = z.object({
  answers: z.array(z.object({
    promptId: z.string().trim().min(1).max(80),
    optionId: z.string().trim().min(1).max(80),
  })).min(1).max(2),
  privateReply: z.string().trim().max(100).optional(),
});
export type FlashFeedbackRequest = z.infer<typeof flashFeedbackRequestSchema>;

export const flashPreferenceUpdateSchema = z.object({
  personalizationEnabled: z.boolean().optional(),
  usePersonality: z.boolean().optional(),
  useInterests: z.boolean().optional(),
  useIndustry: z.boolean().optional(),
  useDistrict: z.boolean().optional(),
  useTaskBehavior: z.boolean().optional(),
  consentVersion: z.literal(FLASH_PERSONALIZATION_CONSENT_VERSION).optional(),
  deleteTagIds: z.array(z.string().uuid()).max(100).optional(),
}).superRefine((value, ctx) => {
  if (!Object.keys(value).some((key) => key !== "consentVersion")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one preference field is required" });
  }
  if (value.personalizationEnabled === true && value.consentVersion !== FLASH_PERSONALIZATION_CONSENT_VERSION) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["consentVersion"],
      message: "The current personalization consent version is required",
    });
  }
});
export type FlashPreferenceUpdateRequest = z.infer<typeof flashPreferenceUpdateSchema>;

export type FlashDialogueQuestionDto = {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
};

export type FlashOnlineNpcDto = {
  appearanceId: string;
  npc: {
    id: string;
    slug: string;
    name: string;
    species: string;
    personalitySummary: string;
    inviteLine: string;
    themeColor: string;
    avatarUrl: string | null;
  };
  district: string;
  endsAt: string;
  remainingMinutes: number;
  canonicalScreen: "radar";
};

export type FlashTaskDestinationDto = {
  name: string;
  city: typeof FLASH_CITY;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  coordinateSystem: typeof FLASH_COORDINATE_SYSTEM;
};

export type FlashTaskDto = {
  id: string;
  npc: { id: string; slug: string; name: string; avatarUrl: string | null };
  code: string;
  category: string;
  title: string;
  brief: string;
  instructions: string;
  destination: FlashTaskDestinationDto;
  status: "accepted" | "arrived" | "ready_to_deliver" | "delivered" | "expired" | "abandoned" | "withdrawn";
  expiresAt: string;
  arrivedAt: string | null;
  feedbackSubmittedAt: string | null;
  deliveredAt: string | null;
  canonicalScreen: FlashCanonicalScreen;
};

export type FlashPreferenceDto = {
  personalizationEnabled: boolean;
  usePersonality: boolean;
  useInterests: boolean;
  useIndustry: boolean;
  useDistrict: boolean;
  useTaskBehavior: boolean;
  consentVersion: string | null;
  consentedAt: string | null;
  tags: Array<{
    id: string;
    source: "personality" | "interests" | "industry" | "district" | "task_behavior";
    label: string;
  }>;
};

export type FlashHomeResponse = {
  serverNow: string;
  city: typeof FLASH_CITY;
  digitalNpcDisclosure: string;
  onlineNpcs: FlashOnlineNpcDto[];
  myTasks: FlashTaskDto[];
  preferenceSummary: FlashPreferenceDto;
  canonicalScreen: FlashCanonicalScreen;
  encounterId: string | null;
  assignmentId: string | null;
};

export type FlashLocateResponse = {
  appearanceId: string;
  /** Exact distance is intentionally omitted so the hidden NPC point cannot be triangulated. */
  signal: "searching" | "arrived";
  arrived: boolean;
  encounterId: string | null;
  canonicalScreen: "radar" | "dialogue" | "delivery" | "unavailable";
};

export type FlashTaskOfferDto = {
  templateId: string;
  code: string;
  category: string;
  title: string;
  brief: string;
  requestCopy: string;
  destinationPreview: {
    name: string;
    district: string;
  };
  canReroll: boolean;
};

export type FlashEncounterResponse = {
  id: string;
  npc: {
    id: string;
    slug: string;
    name: string;
    species: string;
    personalitySummary: string;
    themeColor: string;
    avatarUrl: string | null;
  };
  expiresAt: string;
  status: "dialogue" | "offered" | "accepted" | "declined" | "completed" | "expired";
  pendingDelivery: FlashTaskDto | null;
  question: FlashDialogueQuestionDto | null;
  questionPosition: { current: number; total: number } | null;
  offer: FlashTaskOfferDto | null;
  /** Present only on the successful delivery response; never sourced from private reply text. */
  deliveryMessage?: string | null;
  /** Optional server-owned recovery/closing copy for non-interactive states. */
  message?: string | null;
  canonicalScreen: FlashCanonicalScreen;
};

export type FlashAssignmentResponse = {
  task: FlashTaskDto;
  feedbackPrompts: Array<{
    id: string;
    prompt: string;
    options: Array<{ id: string; label: string }>;
  }>;
  canonicalScreen: FlashCanonicalScreen;
};

export type FlashReadinessResponse = {
  schemaReady: boolean;
  ready: boolean;
  counts: {
    activeNpcs: number;
    canonicalNpcs: number;
    canonicalWeekdayNpcs: number;
    schedulableNpcs: number;
    taskReadyNpcs: number;
    reviewedTasks: number;
    approvedEncounterLocations: number;
    approvedTaskDestinations: number;
    linkedTasks: number;
    readyTaskCategoryCounts: Record<string, number>;
  };
  blockers: string[];
};

export type FlashApiErrorCode =
  | "FLASH_DISABLED"
  | "FLASH_SCHEMA_NOT_READY"
  | "FLASH_CATALOG_NOT_READY"
  | "FLASH_LOCATION_REQUIRED"
  | "FLASH_LOCATION_UNAVAILABLE"
  | "FLASH_OUTSIDE_SHENZHEN"
  | "FLASH_APPEARANCE_NOT_FOUND"
  | "FLASH_APPEARANCE_ENDED"
  | "FLASH_LOCATE_RATE_LIMITED"
  | "FLASH_NOT_ARRIVED"
  | "FLASH_ENCOUNTER_NOT_FOUND"
  | "FLASH_ENCOUNTER_EXPIRED"
  | "FLASH_INVALID_DIALOGUE_OPTION"
  | "FLASH_REROLL_ALREADY_USED"
  | "FLASH_TASK_LIMIT_REACHED"
  | "FLASH_NPC_TASK_LIMIT_REACHED"
  | "FLASH_TASK_NOT_FOUND"
  | "FLASH_TASK_EXPIRED"
  | "FLASH_INVALID_TASK_STATE"
  | "FLASH_NO_TASK_AVAILABLE";
