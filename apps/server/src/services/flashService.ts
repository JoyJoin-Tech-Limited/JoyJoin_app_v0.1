import {
  FLASH_ARRIVAL_RADIUS_METERS,
  FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS,
  FLASH_CITY,
  FLASH_ENCOUNTER_TTL_HOURS,
  FLASH_STORY_PERSONALIZATION_CONSENT_VERSION,
  type FlashAssignmentResponse,
  type FlashCanonicalScreen,
  type FlashEncounterResponse,
  type FlashHomeResponse,
  type FlashLocateResponse,
  type FlashPreferenceDto,
  type FlashPreferenceUpdateRequest,
  type FlashReadinessResponse,
  type FlashTaskDto,
} from "@shared/alang/flashTypes";
import { alangHaversineDistanceMeters } from "@shared/alang/testPointValidation";
import type { FlashTaskSnapshot } from "@shared/schema";
import { getFlashInvitationDefinition } from "@shared/alang/flashInvitationCatalog";
import { FLASH_STORY_ENDING_COPY, type FlashStoryEndingCode } from "@joyjoin/shared/alang/parallelUniverse";

import {
  abandonFlashAssignment,
  retryFlashAssignment,
  acceptFlashAssignment,
  appendFlashEncounterAnswer,
  consumeFlashLocateBudget,
  declineFlashEncounter,
  deleteFlashUserTag,
  deliverFlashAssignment,
  expireFlashEncounterIfNeeded,
  getFlashAssignmentOwned,
  getFlashEncounterOwned,
  getLatestResumableFlashEncounter,
  getFlashPreferences,
  getFlashReadiness,
  getFlashTaskOffer,
  getFlashUserIndustrySignal,
  getFlashUserInterestSignal,
  getFlashUserPersonalitySignal,
  getLiveFlashAppearance,
  getOrCreateFlashEncounter,
  getPendingFlashDelivery,
  getRecentDeliveredFlashCategories,
  getUserActiveFlashTemplateIds,
  getUserFlashCompletionCounts,
  insertFlashUserTags,
  isFlashSchemaReady,
  listFlashTaskCandidates,
  listOnlineFlashAppearances,
  listUserFlashAssignments,
  markFlashAssignmentArrived,
  setFlashEncounterOffer,
  submitFlashAssignmentFeedback,
  updateFlashPreferences,
} from "../repositories/flashRepo";
import {
  completeFlashStoryEpisode,
  ensureFlashStoryEpisodeForEncounter,
  getCompletedFlashStorySeason,
  getFlashStoryEncounterState,
  getFlashStoryReadiness,
  getFlashStoryEndingRecap,
  getReadyFlashStoryChoiceIntent,
  listFlashUserStoryFragments,
  finalizeFlashStoryChoiceIntent,
  prepareFlashStoryChoiceIntent,
} from "../repositories/flashStoryRepo";
import {
  generateFlashPersonalizedResponse,
  type FlashPersonalizationContext,
} from "./flashPersonalizedNarrativeService";
import {
  isFlashShenzhenBoundaryAssetValid,
  isFlashShenzhenBoundaryLicenseApproved,
} from "../lib/flashShenzhenBoundary";
import { getFeatureFlag } from "../lib/featureFlags";

export class FlashServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "FlashServiceError";
  }
}

type MapCoordinate = { latitude: number; longitude: number };

export function calculateFlashMapFrame(
  current: MapCoordinate,
  target: MapCoordinate,
): Pick<FlashLocateResponse, "distanceMeters" | "targetBearingDegrees" | "proximityBand"> {
  const distanceMeters = Math.max(0, Math.round(alangHaversineDistanceMeters(current, target)));
  const currentLatitude = current.latitude * Math.PI / 180;
  const targetLatitude = target.latitude * Math.PI / 180;
  const longitudeDelta = (target.longitude - current.longitude) * Math.PI / 180;
  const y = Math.sin(longitudeDelta) * Math.cos(targetLatitude);
  const x = Math.cos(currentLatitude) * Math.sin(targetLatitude)
    - Math.sin(currentLatitude) * Math.cos(targetLatitude) * Math.cos(longitudeDelta);
  const targetBearingDegrees = Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
  const proximityBand = distanceMeters <= FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS
    ? "arrived"
    : distanceMeters <= 100
      ? "near"
      : distanceMeters <= 300
        ? "approaching"
        : "far";
  return { distanceMeters, targetBearingDegrees, proximityBand };
}

export function isLaterFlashDeliveryEncounter(
  assignment: { encounterId: string; feedbackSubmittedAt: Date | null } | null,
  encounter: { id: string; unlockedAt: Date },
): boolean {
  return Boolean(
    assignment
    && assignment.encounterId !== encounter.id
    && assignment.feedbackSubmittedAt
    && assignment.feedbackSubmittedAt <= encounter.unlockedAt,
  );
}

const DEFAULT_PREFERENCES = {
  personalizationEnabled: false,
  usePersonality: false,
  useInterests: false,
  useIndustry: false,
  useDistrict: false,
  useTaskBehavior: false,
  consentVersion: null as string | null,
  consentedAt: null as Date | null,
};

export type UserPreferenceState = typeof DEFAULT_PREFERENCES;

type FlashReadinessCounts = FlashReadinessResponse["counts"];
type FlashBoundaryReadiness = {
  assetValid: boolean;
  licenseApproved: boolean;
};

const EMPTY_FLASH_READINESS_COUNTS: FlashReadinessCounts = {
  activeNpcs: 0,
  canonicalNpcs: 0,
  schedulableNpcs: 0,
  taskReadyNpcs: 0,
  reviewedTasks: 0,
  approvedEncounterLocations: 0,
  approvedTaskDestinations: 0,
  linkedTasks: 0,
  readyTaskCategoryCounts: {},
  publishedStorySeasons: 0,
  currentStoryReleases: 0,
  reviewedStoryEpisodes: 0,
  storyCoveredNpcs: 0,
};

const BLOCKED_FLASH_BOUNDARY: FlashBoundaryReadiness = { assetValid: false, licenseApproved: false };

export function evaluateFlashFeatureReadiness(
  schemaReady: boolean,
  counts: FlashReadinessCounts = EMPTY_FLASH_READINESS_COUNTS,
  boundary: FlashBoundaryReadiness = BLOCKED_FLASH_BOUNDARY,
): FlashReadinessResponse {
  if (!schemaReady) {
    return {
      schemaReady: false,
      ready: false,
      counts: EMPTY_FLASH_READINESS_COUNTS,
      blockers: ["schema_not_ready"],
    };
  }
  const blockers: string[] = [];
  if (!boundary.assetValid) blockers.push("shenzhen_boundary_asset_not_ready");
  if (!boundary.licenseApproved) blockers.push("shenzhen_boundary_license_not_approved");
  if (counts.canonicalNpcs < 5) blockers.push("five_builtin_seed_npcs_required");
  if (counts.schedulableNpcs !== counts.activeNpcs) blockers.push("all_active_npcs_require_approved_locations");
  if (counts.approvedEncounterLocations < 1) blockers.push("approved_encounter_location_required");
  if ((counts.publishedStorySeasons ?? 0) !== 1) blockers.push("one_published_story_season_required");
  if ((counts.currentStoryReleases ?? 0) !== 1) blockers.push("one_current_story_release_required");
  if ((counts.reviewedStoryEpisodes ?? 0) !== 15) blockers.push("fifteen_reviewed_story_episodes_required");
  if ((counts.storyCoveredNpcs ?? 0) < 5) blockers.push("five_story_npcs_required");
  return { schemaReady: true, ready: blockers.length === 0, counts, blockers };
}

export async function getFlashFeatureReadiness(): Promise<FlashReadinessResponse> {
  const schemaReady = await isFlashSchemaReady();
  if (!schemaReady) return evaluateFlashFeatureReadiness(false);
  const [catalogCounts, storyCounts] = await Promise.all([getFlashReadiness(), getFlashStoryReadiness()]);
  return evaluateFlashFeatureReadiness(
    true,
    {
      ...catalogCounts,
      publishedStorySeasons: storyCounts.publishedSeasons,
      currentStoryReleases: storyCounts.currentReleases,
      reviewedStoryEpisodes: storyCounts.reviewedEpisodes,
      storyCoveredNpcs: storyCounts.coveredNpcs,
    },
    {
      assetValid: isFlashShenzhenBoundaryAssetValid(),
      licenseApproved: isFlashShenzhenBoundaryLicenseApproved(),
    },
  );
}

export async function assertFlashRuntimeReady(): Promise<void> {
  const readiness = await getFlashFeatureReadiness();
  if (!readiness.schemaReady) {
    throw new FlashServiceError("FLASH_SCHEMA_NOT_READY", 503, "闪现正在准备中");
  }
  if (!readiness.ready) {
    throw new FlashServiceError("FLASH_CATALOG_NOT_READY", 503, "闪现内容仍在审核中");
  }
}

function preferenceDto(input: Awaited<ReturnType<typeof getFlashPreferences>>): FlashPreferenceDto {
  const preference = input.preference ?? DEFAULT_PREFERENCES;
  return {
    personalizationEnabled: preference.personalizationEnabled,
    usePersonality: preference.usePersonality,
    useInterests: preference.useInterests,
    useIndustry: preference.useIndustry,
    useDistrict: preference.useDistrict,
    useTaskBehavior: preference.useTaskBehavior,
    consentVersion: preference.consentVersion,
    consentedAt: preference.consentedAt?.toISOString() ?? null,
    tags: input.tags.map((tag: any) => ({
      id: tag.id,
      source: tag.source as FlashPreferenceDto["tags"][number]["source"],
      label: tag.label,
    })),
  };
}

function assignmentScreen(status: string): FlashCanonicalScreen {
  if (status === "accepted") return "task";
  if (status === "arrived") return "feedback";
  if (status === "ready_to_deliver") return "delivery";
  if (status === "delivered") return "completed";
  return "unavailable";
}

function taskDto(row: any): FlashTaskDto {
  const snapshot = row.contentSnapshot as FlashTaskSnapshot;
  const invitationType = snapshot.invitationType ?? "destination_exploration";
  return {
    id: row.id,
    npc: {
      id: row.npcId,
      slug: row.npcSlug ?? snapshot.npcSlug,
      name: row.npcName ?? snapshot.npcName,
      avatarUrl: row.npcAvatarUrl ?? null,
    },
    code: snapshot.code,
    category: snapshot.category,
    title: snapshot.title,
    brief: snapshot.brief,
    instructions: snapshot.instructions,
    invitationType,
    followUpTargetNpc: snapshot.followUpTargetNpcSlug && snapshot.followUpTargetNpcName
      ? { slug: snapshot.followUpTargetNpcSlug, name: snapshot.followUpTargetNpcName }
      : null,
    followUpPrompts: snapshot.feedbackPrompts,
    destination: invitationType === "destination_exploration" ? snapshot.destination : null,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    arrivedAt: row.arrivedAt?.toISOString() ?? null,
    feedbackSubmittedAt: row.feedbackSubmittedAt?.toISOString() ?? null,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    canonicalScreen: assignmentScreen(row.status),
  };
}

export async function getFlashHome(input: {
  userId: string;
  latitude: number;
  longitude: number;
  now?: Date;
}): Promise<FlashHomeResponse> {
  const now = input.now ?? new Date();
  const [appearances, preference, resumable] = await Promise.all([
    listOnlineFlashAppearances(now),
    getFlashPreferences(input.userId),
    getLatestResumableFlashEncounter(input.userId, now),
  ]);
  // Never let home-list ordering become a relative-distance oracle for hidden
  // encounter points. The one-shot coordinate is used only by the route's
  // Shenzhen participation gate; the list itself is ordered by time/name.
  appearances.sort((left: any, right: any) => (
    left.shiftEndsAt.getTime() - right.shiftEndsAt.getTime()
    || left.npcName.localeCompare(right.npcName, "zh-CN")
  ));
  const resume = resumable
    ? await getFlashEncounter({ encounterId: resumable.id, userId: input.userId, now })
    : null;
  return {
    serverNow: now.toISOString(),
    city: FLASH_CITY,
    digitalNpcDisclosure: "闪现中的角色都是虚构的数字动物 NPC，现场没有真人工作人员。",
    onlineNpcs: appearances.map((row: any) => ({
      appearanceId: row.appearanceId,
      npc: {
        id: row.npcId,
        slug: row.npcSlug,
        name: row.npcName,
        species: row.species,
        personalitySummary: row.personalitySummary,
        inviteLine: row.inviteLine,
        themeColor: row.themeColor,
        avatarUrl: row.avatarUrl,
      },
      district: row.district,
      locationAddress: row.locationAddress,
      endsAt: row.shiftEndsAt.toISOString(),
      remainingMinutes: Math.max(0, Math.ceil((row.shiftEndsAt.getTime() - now.getTime()) / 60_000)),
      canonicalScreen: "map" as const,
    })),
    // Legacy assignments remain in storage for audit/history, but the formal
    // story flow no longer exposes or creates task cards.
    myTasks: [],
    preferenceSummary: preferenceDto(preference),
    canonicalScreen: resume?.canonicalScreen ?? "home",
    encounterId: resume?.id ?? null,
    assignmentId: null,
  };
}

export async function locateFlashAppearance(input: {
  userId: string;
  appearanceId: string;
  latitude: number;
  longitude: number;
  now?: Date;
  forceArrivalForTesting?: boolean;
}): Promise<FlashLocateResponse> {
  const now = input.now ?? new Date();
  const appearance = await getLiveFlashAppearance(input.appearanceId, now);
  if (!appearance) {
    throw new FlashServiceError("FLASH_APPEARANCE_ENDED", 410, "这次闪现已经结束了");
  }
  const locateBudget = await consumeFlashLocateBudget({
    userId: input.userId,
    shiftId: input.appearanceId,
    now,
  });
  if (!locateBudget.allowed) {
    throw new FlashServiceError("FLASH_LOCATE_RATE_LIMITED", 429, "寻找得太频繁了，稍后再试");
  }
  const mapFrame = calculateFlashMapFrame(input, appearance);
  if (!input.forceArrivalForTesting && mapFrame.distanceMeters > FLASH_ENCOUNTER_ARRIVAL_RADIUS_METERS) {
    return {
      appearanceId: input.appearanceId,
      destination: {
        latitude: appearance.latitude,
        longitude: appearance.longitude,
        coordinateSystem: "gcj02",
      },
      ...mapFrame,
      signal: "searching",
      arrived: false,
      encounterId: null,
      canonicalScreen: "map",
    };
  }

  const encounter = await getOrCreateFlashEncounter({
    userId: input.userId,
    appearance,
    contextDistrict: appearance.district,
    now,
    expiresAt: new Date(now.getTime() + FLASH_ENCOUNTER_TTL_HOURS * 60 * 60 * 1000),
  });
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 409, "这次相遇没有解锁成功");
  const storyPreference = effectivePreference(await getFlashPreferences(input.userId));
  await ensureFlashStoryEpisodeForEncounter({
    encounterId: encounter.id,
    userId: input.userId,
    npcId: appearance.npcId,
    now,
    mode: storyPreference.personalizationEnabled ? "personalized" : "standard",
    consentVersion: storyPreference.consentVersion,
  });
  return {
    appearanceId: input.appearanceId,
    destination: {
      latitude: appearance.latitude,
      longitude: appearance.longitude,
      coordinateSystem: "gcj02",
    },
    ...mapFrame,
    signal: "arrived",
    arrived: true,
    encounterId: encounter.id,
    canonicalScreen: "dialogue",
  };
}

function extractInterestTags(selections: unknown): Array<{ tagKey: string; label: string }> {
  if (!Array.isArray(selections)) return [];
  return selections.flatMap((selection) => {
    if (!selection || typeof selection !== "object") return [];
    const item = selection as Record<string, unknown>;
    const label = typeof item.label === "string" ? item.label : typeof item.fullName === "string" ? item.fullName : null;
    if (!label) return [];
    const key = typeof item.topicId === "string" ? item.topicId : label;
    return [{ tagKey: `interest:${key}`, label }];
  }).slice(0, 12);
}

export type FlashPreferenceSignalReaders = {
  personality: typeof getFlashUserPersonalitySignal;
  interests: typeof getFlashUserInterestSignal;
  industry: typeof getFlashUserIndustrySignal;
  taskCategories: typeof getRecentDeliveredFlashCategories;
  insertTags: typeof insertFlashUserTags;
};

const DEFAULT_FLASH_PREFERENCE_SIGNAL_READERS: FlashPreferenceSignalReaders = {
  personality: getFlashUserPersonalitySignal,
  interests: getFlashUserInterestSignal,
  industry: getFlashUserIndustrySignal,
  taskCategories: getRecentDeliveredFlashCategories,
  insertTags: insertFlashUserTags,
};

export async function syncEnabledPreferenceTags(
  userId: string,
  preference: UserPreferenceState,
  contextDistrict?: string | null,
  readers: FlashPreferenceSignalReaders = DEFAULT_FLASH_PREFERENCE_SIGNAL_READERS,
) {
  if (!preference.personalizationEnabled) return;
  const tags: Array<{
    source: "personality" | "interests" | "industry" | "district" | "task_behavior";
    tagKey: string;
    label: string;
  }> = [];
  const [personality, interests, industry, deliveredCategories] = await Promise.all([
    preference.usePersonality ? readers.personality(userId) : Promise.resolve(null),
    preference.useInterests ? readers.interests(userId) : Promise.resolve(null),
    preference.useIndustry ? readers.industry(userId) : Promise.resolve(null),
    preference.useTaskBehavior ? readers.taskCategories(userId) : Promise.resolve([]),
  ]);
  if (preference.usePersonality && personality?.primaryArchetype) {
    tags.push({ source: "personality", tagKey: `archetype:${personality.primaryArchetype}`, label: personality.primaryArchetype });
  }
  if (preference.useInterests) {
    tags.push(...extractInterestTags(interests?.interestSelections).map((tag) => ({ source: "interests" as const, ...tag })));
  }
  if (preference.useIndustry && industry?.industryCategory) {
    tags.push({
      source: "industry",
      tagKey: `industry:${industry.industryCategory}`,
      label: industry.industryCategoryLabel ?? industry.industryCategory,
    });
  }
  if (preference.useDistrict && contextDistrict) {
    tags.push({ source: "district", tagKey: `district:${contextDistrict}`, label: contextDistrict });
  }
  if (preference.useTaskBehavior) {
    for (const category of [...new Set<string>(deliveredCategories as string[])]) {
      tags.push({ source: "task_behavior", tagKey: `category:${category}`, label: category });
    }
  }
  await readers.insertTags(userId, tags);
}

function effectivePreference(raw: Awaited<ReturnType<typeof getFlashPreferences>>): UserPreferenceState {
  const preference = raw.preference ?? DEFAULT_PREFERENCES;
  return {
    personalizationEnabled: preference.personalizationEnabled,
    usePersonality: preference.usePersonality,
    useInterests: preference.useInterests,
    useIndustry: preference.useIndustry,
    useDistrict: preference.useDistrict,
    useTaskBehavior: preference.useTaskBehavior,
    consentVersion: preference.consentVersion,
    consentedAt: preference.consentedAt,
  };
}

export function calculateFlashCandidateWeight(input: {
  baseWeight: number;
  npcWeight: number;
  destinationWeight: number;
  candidateTags: string[];
  answerTags: string[];
  userTagLabels: string[];
  completionCount: number;
  destinationDistrict: string;
  contextDistrict: string | null;
  useDistrict: boolean;
}): number {
  let weight = Math.max(1, input.baseWeight)
    * Math.max(0.01, input.npcWeight / 100)
    * Math.max(0.01, input.destinationWeight / 100);
  const normalizedCandidateTags = new Set(input.candidateTags.map((tag) => tag.toLowerCase()));
  const answerMatches = input.answerTags.filter((tag) => normalizedCandidateTags.has(tag.toLowerCase())).length;
  const userMatches = input.userTagLabels.filter((tag) => normalizedCandidateTags.has(tag.toLowerCase())).length;
  weight *= 1 + Math.min(0.5, answerMatches * 0.15);
  weight *= 1 + Math.min(0.45, userMatches * 0.15);
  if (input.useDistrict && input.contextDistrict === input.destinationDistrict) weight *= 1.2;
  // Completion decay is a functional anti-repeat rule, not personalization.
  // Declined/expired/abandoned assignments are excluded by the repository.
  weight *= Math.max(0.05, 0.35 ** input.completionCount);
  return Math.max(0.0001, weight);
}

function weightedCandidate<T extends { calculatedWeight: number }>(candidates: T[], random: () => number): T | null {
  const total = candidates.reduce((sum, candidate) => sum + candidate.calculatedWeight, 0);
  if (!candidates.length || total <= 0) return null;
  let cursor = random() * total;
  for (const candidate of candidates) {
    cursor -= candidate.calculatedWeight;
    if (cursor <= 0) return candidate;
  }
  return candidates[candidates.length - 1];
}

async function chooseFlashOffer(encounter: Awaited<ReturnType<typeof getFlashEncounterOwned>>, excludeTemplateId?: string) {
  if (!encounter) return null;
  const now = new Date();
  const [candidates, activeTemplateIds, preferenceRows] = await Promise.all([
    listFlashTaskCandidates(encounter.npcId),
    getUserActiveFlashTemplateIds(encounter.userId, now),
    getFlashPreferences(encounter.userId),
  ]);
  const preference = effectivePreference(preferenceRows);
  await syncEnabledPreferenceTags(encounter.userId, preference, encounter.contextDistrict);
  const refreshedPreferences = await getFlashPreferences(encounter.userId);
  const enabledSources = new Set<string>();
  if (preference.personalizationEnabled) {
    if (preference.usePersonality) enabledSources.add("personality");
    if (preference.useInterests) enabledSources.add("interests");
    if (preference.useIndustry) enabledSources.add("industry");
    if (preference.useDistrict) enabledSources.add("district");
    if (preference.useTaskBehavior) enabledSources.add("task_behavior");
  }
  const userTagLabels = refreshedPreferences.tags
    .filter((tag: any) => enabledSources.has(tag.source))
    .map((tag: any) => tag.label);
  const completionCounts = await getUserFlashCompletionCounts(encounter.userId) as Map<string, number>;
  const active = new Set(activeTemplateIds);
  const answerTags = preference.personalizationEnabled
    ? encounter.answers.flatMap((answer: any) => answer.tags)
    : [];
  const weighted = candidates
    .filter((candidate: any) => !active.has(candidate.taskTemplateId) && candidate.taskTemplateId !== excludeTemplateId)
    .map((candidate: any) => ({
      ...candidate,
      calculatedWeight: calculateFlashCandidateWeight({
        baseWeight: candidate.baseWeight,
        npcWeight: candidate.npcWeight,
        destinationWeight: candidate.destinationLinkWeight,
        candidateTags: [...candidate.tags, ...candidate.destinationTags],
        answerTags,
        userTagLabels,
        completionCount: completionCounts.get(candidate.taskTemplateId) ?? 0,
        destinationDistrict: candidate.destinationDistrict,
        contextDistrict: encounter.contextDistrict,
        useDistrict: preference.personalizationEnabled && preference.useDistrict,
      }),
    }));
  return weightedCandidate<any>(weighted, Math.random);
}

export async function getFlashEncounter(input: {
  encounterId: string;
  userId: string;
  now?: Date;
  allowSameEncounterDeliveryForTesting?: boolean;
}): Promise<FlashEncounterResponse> {
  const now = input.now ?? new Date();
  await expireFlashEncounterIfNeeded(input.encounterId, input.userId, now);
  const encounter = await getFlashEncounterOwned(input.encounterId, input.userId);
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 404, "没有找到这次相遇");
  let storyState = await getFlashStoryEncounterState(input.encounterId, input.userId);
  if (storyState && !storyState.completion) {
    const intent = await getReadyFlashStoryChoiceIntent(input.userId, storyState.episode.id);
    const option = intent
      ? storyState.episode.content.question.options.find((candidate: { id: string }) => candidate.id === intent.optionId)
      : null;
    if (intent && option && intent.responseSnapshot && intent.renderKind) {
      await completeFlashStoryEpisode({
        encounterId: intent.encounterId,
        userId: input.userId,
        episodeId: storyState.episode.id,
        optionId: intent.optionId,
        configuredEffects: storyState.episode.content.effectsByOption?.[intent.optionId],
        responseSnapshot: intent.responseSnapshot,
        renderKind: intent.renderKind as "template" | "ai" | "fallback",
        promptVersion: intent.promptVersion,
        now,
      });
      storyState = await getFlashStoryEncounterState(input.encounterId, input.userId);
    }
  }
  const completedSeason = await getCompletedFlashStorySeason(input.userId);
  if (storyState && !completedSeason) {
    const content = storyState.episode.content;
    const selectedOptionId = storyState.completion?.selectedOptionId ?? null;
    return {
      id: encounter.id,
      npc: {
        id: encounter.npcId,
        slug: encounter.npcSlug,
        name: encounter.npcName,
        species: encounter.species,
        personalitySummary: encounter.personalitySummary,
        themeColor: encounter.themeColor,
        avatarUrl: encounter.avatarUrl,
      },
      expiresAt: encounter.expiresAt.toISOString(),
      status: storyState.completion ? "completed" : "dialogue",
      pendingDelivery: null,
      question: storyState.completion ? null : {
        id: content.question.id,
        prompt: content.question.prompt,
        options: content.question.options.map((option: { id: string; label: string }) => ({ id: option.id, label: option.label })),
      },
      questionPosition: storyState.completion ? null : { current: 1, total: 1 },
      offer: null,
      storyEpisode: {
        id: storyState.episode.id,
        code: storyState.episode.code,
        seasonTitle: storyState.seasonTitle,
        phase: storyState.episode.phase,
        title: storyState.episode.title,
        objectCode: storyState.episode.objectCode,
        opening: content.opening,
        action: content.action,
        discovery: content.discovery,
        response: selectedOptionId
          ? storyState.completion?.responseSnapshot ?? content.responseByOption[selectedOptionId] ?? null
          : null,
        echo: storyState.completion?.echoSnapshot ?? null,
        storyMode: storyState.universeRun?.mode ?? "standard",
        renderKind: storyState.completion?.renderKind ?? "template",
        closing: storyState.completion ? content.closing : null,
        motion: storyState.episode.motion,
        fragment: storyState.completion && storyState.fragment ? {
          id: storyState.fragment.id,
          code: storyState.fragment.code,
          category: storyState.fragment.category as "object" | "past" | "relationship" | "key",
          title: storyState.fragment.title,
          fact: storyState.fragment.fact,
          assetUrl: storyState.fragment.assetUrl,
        } : null,
        progress: {
          completedInPhase: storyState.completedInPhase,
          totalInPhase: 5,
          completedTotal: storyState.completedTotal,
          total: 15,
        },
      },
      canonicalScreen: "dialogue",
    };
  }
  if (completedSeason) {
    const endingCode = (completedSeason.run?.endingCode ?? "parallel_mixed") as FlashStoryEndingCode;
    const recap = completedSeason.run ? await getFlashStoryEndingRecap(input.userId, completedSeason.run.id) : null;
    const ending = recap?.ending ?? FLASH_STORY_ENDING_COPY[endingCode];
    return {
      id: encounter.id,
      npc: { id: encounter.npcId, slug: encounter.npcSlug, name: encounter.npcName, species: encounter.species, personalitySummary: encounter.personalitySummary, themeColor: encounter.themeColor, avatarUrl: encounter.avatarUrl },
      expiresAt: encounter.expiresAt.toISOString(),
      status: "completed",
      pendingDelivery: null,
      question: null,
      questionPosition: null,
      offer: null,
      storyEpisode: {
        id: `${completedSeason.season.id}-finale`,
        code: "season-finale",
        seasonTitle: completedSeason.season.title,
        phase: 3,
        title: ending.title,
        objectCode: "old-key",
        opening: "交换箱重新合上了。",
        action: "五件旧物已经被认领、处理或重新交给重要的人。",
        discovery: "那把没有锁孔的旧钥匙仍留在夹层里。",
        response: ending.summary,
        ending: recap ? { code: endingCode, vector: recap.vector, highlights: recap.highlights } : null,
        closing: "这是你抵达的宇宙。相同的旧物，在另一条时间线里，也许会得到不同的回答。",
        echo: null,
        storyMode: completedSeason.run?.mode ?? "standard",
        renderKind: "template",
        motion: { ambient: "breathe" },
        fragment: null,
        progress: { completedInPhase: 5, totalInPhase: 5, completedTotal: 15, total: 15 },
      },
      canonicalScreen: "dialogue",
    };
  }
  throw new FlashServiceError("FLASH_STORY_NOT_AVAILABLE", 409, "这次旧相遇已经结束，请从当前在线角色重新开始");
  const pendingCandidate = await getPendingFlashDelivery(
    input.userId,
    encounter.npcId,
    encounter.npcSlug,
    undefined,
    input.allowSameEncounterDeliveryForTesting ? encounter.id : undefined,
  );
  const pendingDelivery = (input.allowSameEncounterDeliveryForTesting || isLaterFlashDeliveryEncounter(pendingCandidate, encounter))
    ? pendingCandidate
    : null;
  let offer = null;
  if (encounter.status === "offered" && encounter.offeredTaskTemplateId && encounter.offeredDestinationId) {
    const row = await getFlashTaskOffer({
      npcId: encounter.npcId,
      taskTemplateId: encounter.offeredTaskTemplateId,
      destinationId: encounter.offeredDestinationId,
    });
    if (row) {
      const invitation = getFlashInvitationDefinition(row.code);
      const targetNpcSlug = invitation?.targetNpcSlug;
      const targetNpcName = invitation?.targetNpcName;
      const followUpTargetNpc = targetNpcSlug && targetNpcName
        ? { slug: targetNpcSlug, name: targetNpcName }
        : null;
      const invitationType: "destination_exploration" | "life_invitation" | "npc_message" =
        invitation?.kind ?? "destination_exploration";
      offer = {
        templateId: row.taskTemplateId,
        code: row.code,
        category: row.category,
        title: row.title,
        brief: row.brief,
        requestCopy: row.requestCopy,
        invitationType,
        followUpTargetNpc,
        destinationPreview: invitation ? null : { name: row.destinationName, district: row.destinationDistrict },
        canReroll: encounter.rerollCount === 0,
      };
    }
  }
  const questionRow = encounter.status === "dialogue"
    ? encounter.dialogueQuestions[encounter.currentQuestionIndex] ?? null
    : null;
  const status = encounter.status as FlashEncounterResponse["status"];
  let canonicalScreen: FlashCanonicalScreen = "dialogue";
  if (pendingDelivery) canonicalScreen = "delivery";
  else if (status === "offered") canonicalScreen = "dialogue";
  else if (status === "accepted") canonicalScreen = "completed";
  else if (["declined", "completed"].includes(status)) canonicalScreen = "completed";
  else if (status === "expired") canonicalScreen = "unavailable";
  return {
    id: encounter.id,
    npc: {
      id: encounter.npcId,
      slug: encounter.npcSlug,
      name: encounter.npcName,
      species: encounter.species,
      personalitySummary: encounter.personalitySummary,
      themeColor: encounter.themeColor,
      avatarUrl: encounter.avatarUrl,
    },
    expiresAt: encounter.expiresAt.toISOString(),
    status,
    pendingDelivery: pendingDelivery ? taskDto(pendingDelivery) : null,
    question: questionRow ? {
      id: questionRow.id,
      prompt: questionRow.prompt,
      options: questionRow.options.map((option: any) => ({ id: option.id, label: option.label })),
    } : null,
    questionPosition: questionRow ? {
      current: encounter.currentQuestionIndex + 1,
      total: Math.min(2, encounter.dialogueQuestions.length),
    } : null,
    offer,
    storyEpisode: null,
    canonicalScreen,
  };
}

export async function answerFlashEncounter(input: {
  encounterId: string;
  userId: string;
  questionId: string;
  optionId: string;
  now?: Date;
}): Promise<FlashEncounterResponse> {
  const now = input.now ?? new Date();
  const encounter = await getFlashEncounterOwned(input.encounterId, input.userId);
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 404, "没有找到这次相遇");
  if (encounter.expiresAt <= now) {
    await expireFlashEncounterIfNeeded(input.encounterId, input.userId, now);
    throw new FlashServiceError("FLASH_ENCOUNTER_EXPIRED", 410, "这次对话已经结束了");
  }
  const storyState = await getFlashStoryEncounterState(input.encounterId, input.userId);
  if (storyState) {
    if (storyState.completion) {
      return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
    }
    const question = storyState.episode.content.question;
    const option = question.options.find((candidate: { id: string }) => candidate.id === input.optionId);
    if (question.id !== input.questionId || !option) {
      throw new FlashServiceError("FLASH_INVALID_DIALOGUE_OPTION", 400, "这个选择已经失效，请刷新后再选一次");
    }
    const intentResult = await prepareFlashStoryChoiceIntent({
      encounterId: input.encounterId,
      userId: input.userId,
      episodeId: storyState.episode.id,
      questionId: question.id,
      optionId: option.id,
      now,
    });
    if (intentResult.state === "conflict") {
      throw new FlashServiceError("FLASH_INVALID_DIALOGUE_OPTION", 409, "这次相遇已经记录了另一个选择");
    }
    if (intentResult.state === "pending") {
      throw new FlashServiceError("FLASH_STORY_GENERATION_PENDING", 409, "正在整理这条时间线，请稍后再试");
    }
    const templateResponse = storyState.episode.content.responseByOption[option.id] ?? storyState.episode.content.closing;
    const baseResponse = storyState.universeRun?.mode === "personalized"
      ? storyState.episode.content.personalizedFallbackByOption?.[option.id] ?? templateResponse
      : templateResponse;
    let responseSnapshot = intentResult.state === "ready" ? intentResult.intent.responseSnapshot! : baseResponse;
    let renderKind: "template" | "ai" | "fallback" = intentResult.state === "ready"
      ? intentResult.intent.renderKind as "template" | "ai" | "fallback"
      : "template";
    let promptVersion: string | null = intentResult.state === "ready" ? intentResult.intent.promptVersion : null;
    if (intentResult.state === "claimed" && storyState.universeRun?.mode === "personalized") {
      const preference = effectivePreference(await getFlashPreferences(input.userId));
      if (preference.personalizationEnabled && preference.consentVersion === FLASH_STORY_PERSONALIZATION_CONSENT_VERSION) {
        const [personality, interests, industry] = await Promise.all([
          preference.usePersonality ? getFlashUserPersonalitySignal(input.userId) : Promise.resolve(null),
          preference.useInterests ? getFlashUserInterestSignal(input.userId) : Promise.resolve(null),
          preference.useIndustry ? getFlashUserIndustrySignal(input.userId) : Promise.resolve(null),
        ]);
        const hour = now.getHours();
        const configuredWeather = process.env.FLASH_WEATHER_CONTEXT;
        const weather = (["clear", "cloudy", "rain", "hot", "cool"] as const)
          .find((value) => value === configuredWeather) ?? null;
        const context: FlashPersonalizationContext = {
          archetype: personality?.primaryArchetype ?? null,
          interests: extractInterestTags(interests?.interestSelections).map((item) => item.label).slice(0, 3),
          broadIndustry: industry?.industryCategoryLabel ?? industry?.industryCategory ?? null,
          weather,
          timeBand: hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening",
          echo: storyState.universeRun.echoQueue?.[0]?.copy ?? null,
        };
        const generated = await generateFlashPersonalizedResponse({ baseResponse, npcName: encounter.npcName, context });
        responseSnapshot = generated.response;
        renderKind = generated.renderKind;
        promptVersion = generated.promptVersion;
      } else {
        renderKind = "fallback";
      }
    }
    if (intentResult.state === "claimed") {
      const finalized = await finalizeFlashStoryChoiceIntent({
        intentId: intentResult.intent.id,
        leaseToken: intentResult.leaseToken,
        responseSnapshot,
        renderKind,
        promptVersion,
        now: new Date(),
      });
      if (!finalized) {
        throw new FlashServiceError("FLASH_STORY_GENERATION_PENDING", 409, "这条时间线正在由另一次请求完成");
      }
    }
    await completeFlashStoryEpisode({
      encounterId: input.encounterId,
      userId: input.userId,
      episodeId: storyState.episode.id,
      optionId: option.id,
      configuredEffects: storyState.episode.content.effectsByOption?.[option.id],
      responseSnapshot,
      renderKind,
      promptVersion,
      now,
    });
    return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
  }
  throw new FlashServiceError("FLASH_STORY_NOT_AVAILABLE", 409, "这次旧相遇已经结束，请从当前在线角色重新开始");
  if (await getPendingFlashDelivery(input.userId, encounter.npcId, encounter.npcSlug)) {
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "先把上次的委托交给它吧");
  }
  if (encounter.status !== "dialogue") {
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "当前不需要回答这个问题");
  }
  const question = encounter.dialogueQuestions[encounter.currentQuestionIndex];
  const option = question?.options.find((candidate: any) => candidate.id === input.optionId);
  if (!question || question.id !== input.questionId || !option) {
    throw new FlashServiceError("FLASH_INVALID_DIALOGUE_OPTION", 400, "这个回答已经失效，请刷新后再试");
  }
  const updated = await appendFlashEncounterAnswer({
    encounterId: input.encounterId,
    userId: input.userId,
    expectedQuestionIndex: encounter.currentQuestionIndex,
    answer: { questionId: question.id, optionId: option.id, tags: option.tags },
    now,
  });
  if (!updated) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "回答得有点快，请刷新后再试");

  if (updated.currentQuestionIndex >= encounter.dialogueQuestions.length) {
    const refreshed = await getFlashEncounterOwned(input.encounterId, input.userId);
    const offer = await chooseFlashOffer(refreshed);
    if (!offer) {
      await declineFlashEncounter(input.encounterId, input.userId, now);
      return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
    }
    await setFlashEncounterOffer({
      encounterId: input.encounterId,
      userId: input.userId,
      taskTemplateId: offer.taskTemplateId,
      destinationId: offer.destinationId,
      isReroll: false,
      now,
    });
  }
  return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
}

export async function rerollFlashEncounterOffer(input: {
  encounterId: string;
  userId: string;
  now?: Date;
}): Promise<FlashEncounterResponse> {
  const now = input.now ?? new Date();
  const encounter = await getFlashEncounterOwned(input.encounterId, input.userId);
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 404, "没有找到这次相遇");
  if (encounter.expiresAt <= now) throw new FlashServiceError("FLASH_ENCOUNTER_EXPIRED", 410, "这次对话已经结束了");
  if (encounter.status !== "offered" || encounter.rerollCount !== 0 || !encounter.offeredTaskTemplateId) {
    throw new FlashServiceError("FLASH_REROLL_ALREADY_USED", 409, "这次已经换过一次委托了");
  }
  const offer = await chooseFlashOffer(encounter, encounter.offeredTaskTemplateId);
  if (!offer) throw new FlashServiceError("FLASH_NO_TASK_AVAILABLE", 409, "暂时没有另一件合适的委托");
  const updated = await setFlashEncounterOffer({
    encounterId: input.encounterId,
    userId: input.userId,
    taskTemplateId: offer.taskTemplateId,
    destinationId: offer.destinationId,
    isReroll: true,
    now,
  });
  if (!updated) throw new FlashServiceError("FLASH_REROLL_ALREADY_USED", 409, "这次已经换过一次委托了");
  return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
}

export async function getFlashStoryFragments(userId: string) {
  const fragments = await listFlashUserStoryFragments(userId);
  return {
    fragments: fragments.map((fragment: any) => ({
      ...fragment,
      unlockedAt: fragment.unlockedAt.toISOString(),
    })),
  };
}

function assignmentResponse(row: any): FlashAssignmentResponse {
  const snapshot = row.contentSnapshot as FlashTaskSnapshot;
  return {
    task: taskDto(row),
    feedbackPrompts: snapshot.feedbackPrompts,
    canonicalScreen: assignmentScreen(row.status),
  };
}

export async function respondToFlashOffer(input: {
  encounterId: string;
  userId: string;
  accepted: boolean;
  now?: Date;
}): Promise<FlashAssignmentResponse | FlashEncounterResponse> {
  const now = input.now ?? new Date();
  const encounter = await getFlashEncounterOwned(input.encounterId, input.userId);
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 404, "没有找到这次相遇");
  if (!input.accepted) {
    const declined = await declineFlashEncounter(input.encounterId, input.userId, now);
    if (!declined) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这个委托已经处理过了");
    return getFlashEncounter({ encounterId: input.encounterId, userId: input.userId, now });
  }
  if (
    encounter.status !== "offered"
    || !encounter.offeredTaskTemplateId
    || !encounter.offeredDestinationId
    || encounter.expiresAt <= now
  ) {
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这个委托已经失效了");
  }
  const offer = await getFlashTaskOffer({
    npcId: encounter.npcId,
    taskTemplateId: encounter.offeredTaskTemplateId,
    destinationId: encounter.offeredDestinationId,
  });
  if (!offer) throw new FlashServiceError("FLASH_NO_TASK_AVAILABLE", 409, "这个委托暂时不能接取");
  const invitation = getFlashInvitationDefinition(offer.code);
  const snapshot: FlashTaskSnapshot = {
    templateVersion: offer.contentVersion,
    invitationType: invitation?.kind ?? "destination_exploration",
    followUpTargetNpcSlug: invitation?.targetNpcSlug,
    followUpTargetNpcName: invitation?.targetNpcName,
    messageCopy: invitation?.messageCopy,
    code: offer.code,
    category: offer.category,
    title: offer.title,
    brief: offer.brief,
    instructions: offer.instructions,
    dialogueIntro: offer.requestCopy,
    feedbackPrompts: offer.feedbackPrompts,
    npcName: encounter.npcName,
    npcSlug: encounter.npcSlug,
    destination: {
      name: offer.destinationName,
      city: "深圳",
      district: offer.destinationDistrict,
      address: offer.destinationAddress,
      latitude: offer.destinationLatitude,
      longitude: offer.destinationLongitude,
      coordinateSystem: "gcj02",
    },
  };
  const result = await acceptFlashAssignment({
    userId: input.userId,
    encounterId: input.encounterId,
    now,
  });
  if (!result.ok) {
    if (result.reason === "task_limit") {
      throw new FlashServiceError("FLASH_TASK_LIMIT_REACHED", 409, "手上已经有三个委托了，先完成一个吧");
    }
    if (result.reason === "npc_limit") {
      throw new FlashServiceError("FLASH_NPC_TASK_LIMIT_REACHED", 409, "你已经有这个角色的一件委托了");
    }
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这个委托已经处理过了");
  }
  const assignment = await getFlashAssignmentOwned(result.assignmentId, input.userId, now);
  if (!assignment) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到刚接下的委托");
  if (invitation) {
    return assignmentResponse(assignment);
  }
  return assignmentResponse(assignment);
}

export async function getFlashAssignment(input: {
  assignmentId: string;
  userId: string;
  now?: Date;
}): Promise<FlashAssignmentResponse> {
  const now = input.now ?? new Date();
  const assignment = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!assignment) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个委托");
  return assignmentResponse(assignment);
}

export async function arriveAtFlashAssignment(input: {
  assignmentId: string;
  userId: string;
  latitude: number;
  longitude: number;
  now?: Date;
  forceArrivalForTesting?: boolean;
}): Promise<FlashAssignmentResponse & { distanceMeters: number; arrived: boolean }> {
  const now = input.now ?? new Date();
  const assignment = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!assignment) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个委托");
  if (assignment.status === "expired") throw new FlashServiceError("FLASH_TASK_EXPIRED", 410, "这个委托已经过期了");
  if (assignment.status !== "accepted") throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "当前不能再次确认到达");
  const target = (assignment.contentSnapshot as FlashTaskSnapshot).destination;
  if (!target) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这个旧任务没有地图目的地");
  const distanceMeters = alangHaversineDistanceMeters(input, target);
  if (!input.forceArrivalForTesting && distanceMeters > FLASH_ARRIVAL_RADIUS_METERS) {
    return { ...assignmentResponse(assignment), distanceMeters: Math.round(distanceMeters), arrived: false };
  }
  const arrived = await markFlashAssignmentArrived(input.assignmentId, input.userId, now);
  if (!arrived) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "到达状态已经变化，请刷新后再试");
  const updated = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!updated) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个委托");
  return { ...assignmentResponse(updated), distanceMeters: Math.round(distanceMeters), arrived: true };
}

export async function feedbackFlashAssignment(input: {
  assignmentId: string;
  userId: string;
  answers: Array<{ promptId: string; optionId: string }>;
  privateReply?: string;
  now?: Date;
}): Promise<FlashAssignmentResponse> {
  const now = input.now ?? new Date();
  const assignment = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!assignment) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个委托");
  if (assignment.status !== "arrived") throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "请先到达任务地点");
  const prompts = (assignment.contentSnapshot as FlashTaskSnapshot).feedbackPrompts;
  const answerByPrompt = new Map(input.answers.map((answer) => [answer.promptId, answer.optionId]));
  const valid = prompts.every((prompt) => {
    const selected = answerByPrompt.get(prompt.id);
    return selected && prompt.options.some((option) => option.id === selected);
  }) && input.answers.every((answer) => prompts.some((prompt) => prompt.id === answer.promptId));
  if (!valid) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 400, "请选择有效的到达感受");
  const saved = await submitFlashAssignmentFeedback({
    assignmentId: input.assignmentId,
    userId: input.userId,
    answers: input.answers,
    privateReply: input.privateReply,
    privateReplyDeleteAfter: input.privateReply
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null,
    now,
  });
  if (!saved) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "反馈已经提交过了");
  const updated = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!updated) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个委托");
  return assignmentResponse(updated);
}

export async function deliverFlashTaskToNpc(input: {
  encounterId: string;
  assignmentId: string;
  userId: string;
  answers?: Array<{ promptId: string; optionId: string }>;
  now?: Date;
  allowSameEncounterDeliveryForTesting?: boolean;
}): Promise<FlashEncounterResponse> {
  const now = input.now ?? new Date();
  const encounter = await getFlashEncounterOwned(input.encounterId, input.userId);
  if (!encounter) throw new FlashServiceError("FLASH_ENCOUNTER_NOT_FOUND", 404, "没有找到这次相遇");
  if (encounter.expiresAt <= now) throw new FlashServiceError("FLASH_ENCOUNTER_EXPIRED", 410, "这次对话已经结束了");
  const pending = await getPendingFlashDelivery(
    input.userId,
    encounter.npcId,
    encounter.npcSlug,
    undefined,
    input.allowSameEncounterDeliveryForTesting ? encounter.id : undefined,
  );
  if (!pending || pending.id !== input.assignmentId) {
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这件委托现在不能交付");
  }
  const delivered = await deliverFlashAssignment({
    assignmentId: input.assignmentId,
    encounterId: input.encounterId,
    userId: input.userId,
    npcId: encounter.npcId,
    npcSlug: encounter.npcSlug,
    answers: input.answers,
    deliveryEncounterUnlockedAt: encounter.unlockedAt,
    now,
    privateReplyDeleteAfter: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    allowSameEncounterForTesting: input.allowSameEncounterDeliveryForTesting,
  });
  if (!delivered) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这件委托已经交付过了");
  return getFlashEncounter({
    encounterId: input.encounterId,
    userId: input.userId,
    now,
    allowSameEncounterDeliveryForTesting: input.allowSameEncounterDeliveryForTesting,
  });
}

export async function abandonFlashTask(input: {
  assignmentId: string;
  userId: string;
  now?: Date;
}): Promise<{ ok: true; canonicalScreen: "completed" }> {
  const row = await abandonFlashAssignment(input.assignmentId, input.userId, input.now ?? new Date());
  if (!row) throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "这个委托已经结束了");
  return { ok: true, canonicalScreen: "completed" };
}

export async function retryFlashTask(input: {
  assignmentId: string;
  userId: string;
  now?: Date;
}): Promise<FlashAssignmentResponse> {
  const now = input.now ?? new Date();
  const reset = await retryFlashAssignment(input.assignmentId, input.userId, now);
  if (!reset) {
    throw new FlashServiceError("FLASH_INVALID_TASK_STATE", 409, "当前任务不能重新开始");
  }
  const assignment = await getFlashAssignmentOwned(input.assignmentId, input.userId, now);
  if (!assignment) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个任务");
  return assignmentResponse(assignment);
}

export async function getFlashPreferenceSettings(userId: string): Promise<FlashPreferenceDto> {
  return preferenceDto(await getFlashPreferences(userId));
}

export async function patchFlashPreferenceSettings(input: {
  userId: string;
  update: FlashPreferenceUpdateRequest;
  now?: Date;
}): Promise<FlashPreferenceDto> {
  const now = input.now ?? new Date();
  const currentRows = await getFlashPreferences(input.userId);
  const current = effectivePreference(currentRows);
  const merged = {
    ...current,
    ...Object.fromEntries(Object.entries(input.update).filter(([, value]) => value !== undefined)),
  };
  await updateFlashPreferences({
    userId: input.userId,
    personalizationEnabled: merged.personalizationEnabled,
    usePersonality: merged.usePersonality,
    useInterests: merged.useInterests,
    useIndustry: merged.useIndustry,
    useDistrict: merged.useDistrict,
    useTaskBehavior: merged.useTaskBehavior,
    consentVersion: input.update.consentVersion,
    deleteTagIds: input.update.deleteTagIds,
    now,
  });
  if (merged.personalizationEnabled) await syncEnabledPreferenceTags(input.userId, merged);
  return getFlashPreferenceSettings(input.userId);
}

export async function removeFlashPreferenceTag(input: {
  userId: string;
  tagId: string;
  now?: Date;
}): Promise<FlashPreferenceDto> {
  const deleted = await deleteFlashUserTag(input.userId, input.tagId, input.now ?? new Date());
  if (!deleted) throw new FlashServiceError("FLASH_TASK_NOT_FOUND", 404, "没有找到这个标签");
  return getFlashPreferenceSettings(input.userId);
}
