import { z } from "zod";
import type { FlashFeedbackPrompt } from "../schema/flash.js";
import { atuanFirstActSubmissionSchema } from "./atuanFirstAct.js";

export const FLASH_CITY = "深圳" as const;
export const FLASH_COORDINATE_SYSTEM = "gcj02" as const;
/** NPC encounter unlock radius for the foreground map flow. */
export const FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS = 10;
/** Accepted-task destination arrival radius. */
export const FLASH_ARRIVAL_RADIUS_METERS = 50;
export const FLASH_TASK_DURATION_DAYS = 7;
export const FLASH_ENCOUNTER_TTL_HOURS = 24;
export const FLASH_MAX_ACTIVE_TASKS = 3;
export const FLASH_MAX_ACTIVE_TASKS_PER_NPC = 1;
export const FLASH_PERSONALIZATION_CONSENT_VERSION = "flash-personalization-v1" as const;
export const FLASH_STORY_PERSONALIZATION_CONSENT_VERSION = "flash-story-personalization-v1" as const;
export const FLASH_SHENZHEN_BOUNDS = {
  minLatitude: 22.35,
  maxLatitude: 22.95,
  minLongitude: 113.7,
  maxLongitude: 114.75,
} as const;

export const flashCanonicalScreenSchema = z.enum([
  "home",
  "map",
  /** @deprecated Accepted only when parsing snapshots from older clients. */
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
  storyPath: atuanFirstActSubmissionSchema.optional(),
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
  consentVersion: z.enum([FLASH_PERSONALIZATION_CONSENT_VERSION, FLASH_STORY_PERSONALIZATION_CONSENT_VERSION]).optional(),
  deleteTagIds: z.array(z.string().uuid()).max(100).optional(),
}).superRefine((value, ctx) => {
  if (!Object.keys(value).some((key) => key !== "consentVersion")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one preference field is required" });
  }
  if (value.personalizationEnabled === true && ![
    FLASH_PERSONALIZATION_CONSENT_VERSION,
    FLASH_STORY_PERSONALIZATION_CONSENT_VERSION,
  ].includes(value.consentVersion as typeof FLASH_PERSONALIZATION_CONSENT_VERSION)) {
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
  /** Operator-reviewed public-area description; never includes coordinates. */
  locationAddress?: string;
  endsAt?: string | null;
  remainingMinutes?: number | null;
  availabilityMode?: "scheduled" | "manual_hold";
  canonicalScreen: "map";
  story?: {
    phase: number;
    state: "available" | "completed_in_phase" | "season_completed";
    episodeTitle: string | null;
  } | null;
};

export type FlashStoryFragmentDto = {
  id: string;
  code: string;
  category: "object" | "past" | "relationship" | "key";
  title: string;
  fact: string;
  assetUrl: string | null;
};

export type FlashStoryEpisodeDto = {
  id: string;
  code: string;
  seasonTitle: string;
  phase: number;
  title: string;
  objectCode: string;
  opening: string;
  action: string;
  discovery: string;
  closing: string | null;
  response: string | null;
  echo?: string | null;
  storyMode?: "standard" | "personalized";
  renderKind?: "template" | "ai" | "fallback";
  ending?: {
    code: string;
    vector: { trust: number; attachment: number; intervention: number; truth: number };
    highlights: Array<{ episodeTitle: string; optionLabel: string }>;
  } | null;
  motion: {
    ambient: "none" | "breathe" | "drift";
    blinkAssetUrl?: string;
    blinkIntervalSeconds?: number;
  };
  fragment: FlashStoryFragmentDto | null;
  progress: { completedInPhase: number; totalInPhase: number; completedTotal: number; total: number };
  storyV2?: FlashStoryV2ViewDto | null;
};

export type FlashStoryV2ViewDto = {
  nodeId: string;
  type: "prose" | "choice" | "callback" | "closure" | "ending";
  segments: Array<{ speaker?: string; text: string }>;
  choices: Array<{ id: string; text: string }>;
  next: string | null;
  unlockFragment: string | null;
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
  invitationType?: "destination_exploration" | "life_invitation" | "npc_message";
  followUpTargetNpc?: { slug: string; name: string } | null;
  followUpPrompts?: FlashFeedbackPrompt[];
  destination: FlashTaskDestinationDto | null;
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
  /** Fixed, operator-approved destination for this currently active appearance. */
  destination: {
    latitude: number;
    longitude: number;
    coordinateSystem: typeof FLASH_COORDINATE_SYSTEM;
  };
  distanceMeters: number;
  targetBearingDegrees: number;
  proximityBand: "far" | "approaching" | "near" | "arrived";
  signal: "searching" | "arrived";
  arrived: boolean;
  encounterId: string | null;
  canonicalScreen: "map" | "dialogue" | "delivery" | "completed" | "unavailable";
};

export type FlashTaskOfferDto = {
  templateId: string;
  code: string;
  category: string;
  title: string;
  brief: string;
  requestCopy: string;
  invitationType?: "destination_exploration" | "life_invitation" | "npc_message";
  followUpTargetNpc?: { slug: string; name: string } | null;
  destinationPreview: {
    name: string;
    district: string;
  } | null;
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
  storyEpisode?: FlashStoryEpisodeDto | null;
  isReplay?: boolean;
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
    schedulableNpcs: number;
    taskReadyNpcs: number;
    reviewedTasks: number;
    approvedEncounterLocations: number;
    approvedTaskDestinations: number;
    linkedTasks: number;
    readyTaskCategoryCounts: Record<string, number>;
    publishedStorySeasons?: number;
    currentStoryReleases?: number;
    reviewedStoryEpisodes?: number;
    storyCoveredNpcs?: number;
  };
  blockers: string[];
};

export type FlashApiErrorCode =
  | "FLASH_DISABLED"
  | "FLASH_SCHEMA_NOT_READY"
  | "FLASH_CATALOG_NOT_READY"
  | "FLASH_LOCATION_REQUIRED"
  | "FLASH_OUTSIDE_SHENZHEN"
  | "FLASH_APPEARANCE_NOT_FOUND"
  | "FLASH_APPEARANCE_ENDED"
  | "FLASH_LOCATE_RATE_LIMITED"
  | "FLASH_NOT_ARRIVED"
  | "FLASH_ENCOUNTER_NOT_FOUND"
  | "FLASH_ENCOUNTER_EXPIRED"
  | "FLASH_STORY_NOT_AVAILABLE"
  | "FLASH_STORY_GENERATION_PENDING"
  | "FLASH_INVALID_DIALOGUE_OPTION"
  | "FLASH_REROLL_ALREADY_USED"
  | "FLASH_TASK_LIMIT_REACHED"
  | "FLASH_NPC_TASK_LIMIT_REACHED"
  | "FLASH_TASK_NOT_FOUND"
  | "FLASH_TASK_EXPIRED"
  | "FLASH_INVALID_TASK_STATE"
  | "FLASH_NO_TASK_AVAILABLE";
