import type {
  FlashAvailabilityWindow,
  FlashEncounterLocation,
  FlashNpc,
  FlashShift,
} from "@shared/schema";
import { createHash, randomUUID } from "node:crypto";

import { getFeatureFlag } from "../lib/featureFlags";
import { logger } from "../lib/logger";
import {
  createFlashScheduleDraft,
  expireAllFlashAssignments,
  getFlashSchedulePlanByDate,
  getFlashSchedulePlanById,
  isFlashSchemaReady,
  listFlashEncounterLocations,
  listFlashSchedulingInputs,
  listRecentPublishedFlashPlans,
  publishFlashSchedulePlan,
  purgeExpiredFlashLocateBudgets,
  purgeExpiredFlashPrivateReplies,
  runWithFlashScheduleAdvisoryLock,
  updatePublishedFlashScheduleInPlace,
  replacePublishedFlashSchedule,
  updateUpcomingFlashShift,
  replaceFlashScheduleShifts,
} from "../repositories/flashRepo";

const SHENZHEN_OFFSET_MS = 8 * 60 * 60 * 1000;
const JOB_INTERVAL_MS = 15 * 60 * 1000;
const FLASH_SHIFT_MIN_MINUTES = 180;
const FLASH_SHIFT_MAX_MINUTES = 300;
const DAYPARTS = [
  { key: "morning", start: 9 * 60, end: 13 * 60 },
  { key: "afternoon", start: 13 * 60, end: 17 * 60 },
  { key: "evening", start: 17 * 60, end: 21 * 60 },
] as const;

type SchedulingNpc = FlashNpc;
type SchedulingLocation = Pick<
  FlashEncounterLocation,
  "id" | "name" | "district" | "availabilityWindows"
> & { weight: number };

export type FlashDraftShift = {
  npcId: string;
  locationId: string;
  startsAt: Date;
  endsAt: Date;
  source: "generated" | "fallback" | "manual";
};

export type FlashDraftValidation = {
  valid: boolean;
  errors: string[];
};

export type FlashEmergencyAdjustmentShift = FlashDraftShift & { id: string };

export function flashSchedulePreviewDigest(shifts: FlashDraftShift[]): string {
  const canonical = shifts.map((shift) => ({
    npcId: shift.npcId,
    locationId: shift.locationId,
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    source: shift.source,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function flashEmergencyAdjustmentDigest(shifts: FlashEmergencyAdjustmentShift[]): string {
  const canonical = shifts.map((shift) => ({
    id: shift.id,
    npcId: shift.npcId,
    locationId: shift.locationId,
    startsAt: shift.startsAt.toISOString(),
    endsAt: shift.endsAt.toISOString(),
    source: shift.source,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function effectiveShiftDurationRange(npc: SchedulingNpc): {
  minShiftMinutes: number;
  maxShiftMinutes: number;
} {
  if (
    npc.minShiftMinutes < FLASH_SHIFT_MIN_MINUTES
    || npc.maxShiftMinutes < FLASH_SHIFT_MIN_MINUTES
  ) {
    return {
      minShiftMinutes: FLASH_SHIFT_MIN_MINUTES,
      maxShiftMinutes: FLASH_SHIFT_MAX_MINUTES,
    };
  }
  return {
    minShiftMinutes: npc.minShiftMinutes,
    maxShiftMinutes: npc.maxShiftMinutes,
  };
}

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string): () => number {
  let state = hashSeed(seed) || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function parseLocalMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isoWeekdayForServiceDate(serviceDate: string): number {
  const [year, month, day] = serviceDate.split("-").map(Number);
  const utcDay = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return utcDay === 0 ? 7 : utcDay;
}

export function shenzhenDateString(now: Date): string {
  const local = new Date(now.getTime() + SHENZHEN_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

export function addServiceDays(serviceDate: string, days: number): string {
  const [year, month, day] = serviceDate.split("-").map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

export function canRegeneratePublishedFlashSchedule(
  plan: { status: string; serviceDate: string },
  now = new Date(),
): boolean {
  return plan.status === "published"
    && plan.serviceDate === addServiceDays(shenzhenDateString(now), 1);
}

export function canAdjustUpcomingFlashShift(
  plan: { status: string; serviceDate: string },
  shift: { status: string; startsAt: Date | string },
  now = new Date(),
): boolean {
  return (plan.status === "published" || plan.status === "draft")
    && plan.serviceDate === shenzhenDateString(now)
    && shift.status === plan.status
    && new Date(shift.startsAt).getTime() > now.getTime();
}

export function canEmergencyAdjustPublishedFlashSchedule(
  plan: { city: string; status: string; serviceDate: string },
  now = new Date(),
): boolean {
  return plan.city === "深圳"
    && plan.status === "published"
    && plan.serviceDate === shenzhenDateString(now);
}

function localDateAtMinutes(serviceDate: string, minutes: number): Date {
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return new Date(`${serviceDate}T${String(hours).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`);
}

function localMinutes(date: Date): number {
  const local = new Date(date.getTime() + SHENZHEN_OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function validateFlashCoverageWindow(
  shifts: Array<{ startsAt: Date; endsAt: Date }>,
  requiredStartMinutes: number,
  requiredEndMinutes: number,
): string[] {
  const ordered = shifts
    .map((shift) => ({ start: localMinutes(shift.startsAt), end: localMinutes(shift.endsAt) }))
    .sort((left, right) => left.start - right.start);
  if (!ordered.length || ordered[0].start > requiredStartMinutes) return ["COVERAGE_START_MISSING"];
  let coveredUntil = requiredStartMinutes;
  for (const shift of ordered) {
    if (shift.end <= coveredUntil) continue;
    if (shift.start > coveredUntil) return ["COVERAGE_GAP"];
    coveredUntil = Math.max(coveredUntil, shift.end);
    if (coveredUntil >= requiredEndMinutes) return [];
  }
  return ["COVERAGE_END_MISSING"];
}

function localDateString(date: Date): string {
  return shenzhenDateString(date);
}

function availabilityCovers(
  windows: FlashAvailabilityWindow[],
  weekday: number,
  startMinutes: number,
  endMinutes: number,
): boolean {
  return windows.some((window) => {
    if (window.weekday !== weekday) return false;
    const windowStart = parseLocalMinutes(window.startTime);
    const windowEnd = parseLocalMinutes(window.endTime);
    return windowStart !== null && windowEnd !== null && windowStart <= startMinutes && windowEnd >= endMinutes;
  });
}

function overlaps(a: { startsAt: Date; endsAt: Date }, b: { startsAt: Date; endsAt: Date }): boolean {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
}

function hasNpcGap(
  existing: FlashDraftShift[],
  candidate: FlashDraftShift,
  minGapMinutes: number,
): boolean {
  const gapMs = minGapMinutes * 60_000;
  return existing.filter((shift) => shift.npcId === candidate.npcId).every((shift) => (
    candidate.startsAt.getTime() >= shift.endsAt.getTime() + gapMs
    || shift.startsAt.getTime() >= candidate.endsAt.getTime() + gapMs
  ));
}

function pickWeighted<T extends { weight: number }>(items: T[], random: () => number): T | null {
  if (!items.length) return null;
  const total = items.reduce((sum, item) => sum + Math.max(1, item.weight), 0);
  let cursor = random() * total;
  for (const item of items) {
    cursor -= Math.max(1, item.weight);
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

export function generateFlashScheduleDraft(input: {
  serviceDate: string;
  npcs: SchedulingNpc[];
  locationsByNpc: Map<string, SchedulingLocation[]>;
  seed: string;
}): { shifts: FlashDraftShift[]; skippedNpcIds: string[] } {
  const random = createSeededRandom(input.seed);
  const weekday = isoWeekdayForServiceDate(input.serviceDate);
  const shifts: FlashDraftShift[] = [];
  const skippedNpcIds: string[] = [];
  const daypartUse = new Map(DAYPARTS.map((part) => [part.key, 0]));

  for (const npc of input.npcs.filter((candidate) => candidate.eligibleWeekdays.includes(weekday))) {
    const locations = input.locationsByNpc.get(npc.id) ?? [];
    if (!locations.some((location) => location.availabilityWindows.some((window) => window.weekday === weekday))) {
      skippedNpcIds.push(npc.id);
      continue;
    }
    const shiftCount = random() * 100 < npc.oneShiftProbability ? 1 : 2;
    let createdForNpc = 0;
    const durationRange = effectiveShiftDurationRange(npc);
    for (let shiftIndex = 0; shiftIndex < shiftCount; shiftIndex += 1) {
      const duration = durationRange.minShiftMinutes
        + Math.floor(random() * (durationRange.maxShiftMinutes - durationRange.minShiftMinutes + 1));
      const dayparts = shuffled([...DAYPARTS], random).sort((a, b) => (
        (daypartUse.get(a.key) ?? 0) - (daypartUse.get(b.key) ?? 0)
      ));
      let selected: FlashDraftShift | null = null;
      for (const daypart of dayparts) {
        for (let attempt = 0; attempt < 24; attempt += 1) {
          const latestStart = Math.min(daypart.end - 1, 21 * 60 - duration);
          if (latestStart < daypart.start) continue;
          const stepCount = Math.floor((latestStart - daypart.start) / 5);
          const startMinutes = daypart.start + Math.floor(random() * (stepCount + 1)) * 5;
          const endMinutes = startMinutes + duration;
          const validLocations = locations.filter((location) => (
            availabilityCovers(location.availabilityWindows, weekday, startMinutes, endMinutes)
          ));
          const location = pickWeighted(validLocations, random);
          if (!location) continue;
          const candidate: FlashDraftShift = {
            npcId: npc.id,
            locationId: location.id,
            startsAt: localDateAtMinutes(input.serviceDate, startMinutes),
            endsAt: localDateAtMinutes(input.serviceDate, endMinutes),
            source: "generated",
          };
          const locationFree = shifts.every((shift) => shift.locationId !== candidate.locationId || !overlaps(shift, candidate));
          if (!locationFree || !hasNpcGap(shifts, candidate, npc.minGapMinutes)) continue;
          selected = candidate;
          daypartUse.set(daypart.key, (daypartUse.get(daypart.key) ?? 0) + 1);
          break;
        }
        if (selected) break;
      }
      if (selected) {
        shifts.push(selected);
        createdForNpc += 1;
      }
    }
    if (createdForNpc === 0) skippedNpcIds.push(npc.id);
  }
  return { shifts: shifts.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()), skippedNpcIds };
}

export function validateFlashScheduleDraft(input: {
  serviceDate: string;
  shifts: FlashDraftShift[];
  npcsById: Map<string, SchedulingNpc>;
  locationsByNpc: Map<string, SchedulingLocation[]>;
  allowLocationOverlap?: boolean;
}): FlashDraftValidation {
  const errors: string[] = [];
  const weekday = isoWeekdayForServiceDate(input.serviceDate);
  const shiftCountByNpc = new Map<string, number>();
  for (const shift of input.shifts) {
    const npc = input.npcsById.get(shift.npcId);
    const location = (input.locationsByNpc.get(shift.npcId) ?? []).find((candidate) => candidate.id === shift.locationId);
    const duration = (shift.endsAt.getTime() - shift.startsAt.getTime()) / 60_000;
    const start = localMinutes(shift.startsAt);
    const end = localMinutes(shift.endsAt);
    if (shift.startsAt.getTime() % 60_000 !== 0 || shift.endsAt.getTime() % 60_000 !== 0) {
      errors.push(`TIME_NOT_MINUTE_ALIGNED:${shift.npcId}`);
    }
    if (!npc || !npc.eligibleWeekdays.includes(weekday)) errors.push(`NPC_NOT_ELIGIBLE:${shift.npcId}`);
    if (!location) errors.push(`LOCATION_NOT_ALLOWED:${shift.locationId}`);
    if (npc) {
      const durationRange = effectiveShiftDurationRange(npc);
      if (duration < durationRange.minShiftMinutes || duration > durationRange.maxShiftMinutes) {
        errors.push(`DURATION_OUT_OF_RANGE:${shift.npcId}`);
      }
    }
    if (start < 9 * 60 || end > 21 * 60 || end <= start) errors.push(`TIME_OUT_OF_RANGE:${shift.npcId}`);
    if (localDateString(shift.startsAt) !== input.serviceDate || localDateString(shift.endsAt) !== input.serviceDate) {
      errors.push(`CROSS_SERVICE_DATE:${shift.npcId}`);
    }
    if (location && !availabilityCovers(location.availabilityWindows, weekday, start, end)) {
      errors.push(`LOCATION_UNAVAILABLE:${shift.locationId}`);
    }
    shiftCountByNpc.set(shift.npcId, (shiftCountByNpc.get(shift.npcId) ?? 0) + 1);
  }
  for (const [npcId, count] of shiftCountByNpc) {
    if (count > 2) errors.push(`NPC_SHIFT_COUNT_EXCEEDED:${npcId}`);
  }
  for (let left = 0; left < input.shifts.length; left += 1) {
    for (let right = left + 1; right < input.shifts.length; right += 1) {
      const a = input.shifts[left];
      const b = input.shifts[right];
      if (!input.allowLocationOverlap && a.locationId === b.locationId && overlaps(a, b)) {
        errors.push(`LOCATION_OVERLAP:${a.locationId}`);
      }
      if (a.npcId === b.npcId) {
        const npc = input.npcsById.get(a.npcId);
        if (npc && !hasNpcGap([a], b, npc.minGapMinutes)) errors.push(`NPC_GAP_TOO_SHORT:${a.npcId}`);
      }
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

export async function previewPublishedFlashScheduleEmergencyAdjustmentForAdmin(input: {
  planId: string;
  expectedVersion: number;
  shifts: FlashEmergencyAdjustmentShift[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const existing = await getFlashSchedulePlanById(input.planId);
  if (!existing) return { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
  if (!canEmergencyAdjustPublishedFlashSchedule(existing.plan, now)) {
    return { ok: false as const, code: "FLASH_SCHEDULE_NOT_EMERGENCY_ADJUSTABLE" as const };
  }
  if (existing.plan.version !== input.expectedVersion) {
    return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  }

  const current = (existing.shifts as FlashShift[]).filter((shift) => shift.status === "published");
  const currentById = new Map<string, FlashShift>(current.map((shift) => [shift.id, shift]));
  const identityIsStable = input.shifts.length === current.length && input.shifts.every((shift) => (
    currentById.get(shift.id)?.npcId === shift.npcId
  ));
  if (!identityIsStable) {
    return { ok: false as const, code: "FLASH_SCHEDULE_SHIFT_SET_CHANGED" as const };
  }

  const schedulingInputs = await listFlashSchedulingInputs();
  const schedulingNpcs = schedulingInputs.npcs as SchedulingNpc[];
  const emergencyLocations = (await listFlashEncounterLocations() as FlashEncounterLocation[]).filter((location) => (
    location.city === "深圳" && location.isActive && location.approvalStatus === "approved"
  ));
  const emergencyLocationRows: SchedulingLocation[] = emergencyLocations.map((location) => ({
    id: location.id,
    name: location.name,
    district: location.district,
    availabilityWindows: location.availabilityWindows,
    weight: 1,
  }));
  const locationsByNpc = new Map(schedulingNpcs.map((npc) => [npc.id, emergencyLocationRows]));
  const validation = validateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    shifts: input.shifts,
    npcsById: new Map(schedulingNpcs.map((npc) => [npc.id, npc])),
    locationsByNpc,
    allowLocationOverlap: true,
  });
  validation.errors.push(...validateFlashCoverageWindow(input.shifts, 12 * 60, 21 * 60));
  validation.errors = [...new Set(validation.errors)];
  validation.valid = validation.errors.length === 0;
  if (!validation.valid) {
    return { ok: false as const, code: "FLASH_SCHEDULE_INVALID" as const, validation };
  }
  return {
    ok: true as const,
    plan: existing.plan,
    shifts: input.shifts,
    previewDigest: flashEmergencyAdjustmentDigest(input.shifts),
    validation,
  };
}

export async function applyPublishedFlashScheduleEmergencyAdjustmentForAdmin(input: {
  planId: string;
  expectedVersion: number;
  actor: string;
  shifts: FlashEmergencyAdjustmentShift[];
  previewDigest: string;
  now?: Date;
}) {
  const preview = await previewPublishedFlashScheduleEmergencyAdjustmentForAdmin(input);
  if (!preview.ok) return preview;
  if (preview.previewDigest !== input.previewDigest) {
    return { ok: false as const, code: "FLASH_SCHEDULE_PREVIEW_STALE" as const };
  }
  const updated = await updatePublishedFlashScheduleInPlace({
    planId: input.planId,
    expectedVersion: input.expectedVersion,
    updatedBy: input.actor,
    shifts: input.shifts,
    now: input.now ?? new Date(),
  });
  return updated
    ? { ok: true as const, plan: updated.plan, shifts: updated.shifts, validation: preview.validation }
    : { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
}

export function buildFlashSchedulingContext(inputs: Awaited<ReturnType<typeof listFlashSchedulingInputs>>) {
  const locationsByNpc = new Map<string, SchedulingLocation[]>();
  for (const link of inputs.links as any[]) {
    const list = locationsByNpc.get(link.npcId) ?? [];
    list.push({
      id: link.locationId,
      name: link.locationName,
      district: link.district,
      availabilityWindows: link.availabilityWindows,
      weight: link.weight,
    });
    locationsByNpc.set(link.npcId, list);
  }
  return locationsByNpc;
}

function buildFallbackDraft(input: {
  serviceDate: string;
  prior: { shifts: FlashShift[] } | null;
  npcsById: Map<string, SchedulingNpc>;
  locationsByNpc: Map<string, SchedulingLocation[]>;
  random: () => number;
}): FlashDraftShift[] {
  if (!input.prior) return [];
  const weekday = isoWeekdayForServiceDate(input.serviceDate);
  const result: FlashDraftShift[] = [];
  for (const oldShift of input.prior.shifts) {
    const npc = input.npcsById.get(oldShift.npcId);
    if (!npc?.eligibleWeekdays.includes(weekday)) continue;
    const oldStart = localMinutes(oldShift.startsAt);
    const duration = Math.round((oldShift.endsAt.getTime() - oldShift.startsAt.getTime()) / 60_000);
    const locations = (input.locationsByNpc.get(oldShift.npcId) ?? []).filter((location) => (
      availabilityCovers(location.availabilityWindows, weekday, oldStart, oldStart + duration)
    ));
    const location = pickWeighted(locations, input.random);
    if (!location) continue;
    const candidate: FlashDraftShift = {
      npcId: oldShift.npcId,
      locationId: location.id,
      startsAt: localDateAtMinutes(input.serviceDate, oldStart),
      endsAt: localDateAtMinutes(input.serviceDate, oldStart + duration),
      source: "fallback",
    };
    if (result.every((shift) => shift.locationId !== candidate.locationId || !overlaps(shift, candidate))) {
      result.push(candidate);
    }
  }
  return result;
}

function autoPublishTimeFor(serviceDate: string): Date {
  return new Date(`${addServiceDays(serviceDate, -1)}T21:30:00+08:00`);
}

type StoredFlashSchedule = NonNullable<Awaited<ReturnType<typeof getFlashSchedulePlanByDate>>>;

async function autoPublishUntouchedDraft(input: {
  serviceDate: string;
  schedule: StoredFlashSchedule;
  now: Date;
  npcsById: Map<string, SchedulingNpc>;
  locationsByNpc: Map<string, SchedulingLocation[]>;
  executor: any;
}): Promise<"not_due" | "empty" | "published" | "cas_miss" | "publish_blocked"> {
  if (
    input.schedule.plan.status !== "draft"
    || input.schedule.plan.updatedBy !== null
    || input.schedule.plan.autoPublishAfter > input.now
  ) {
    return "not_due";
  }
  // An empty plan intentionally remains unpublished and therefore exposes no
  // appearance. This is the fail-closed result when no safe shift exists.
  if (input.schedule.shifts.length === 0) return "empty";
  const validation = validateFlashScheduleDraft({
    serviceDate: input.serviceDate,
    shifts: input.schedule.shifts.map((shift: any) => ({
      npcId: shift.npcId,
      locationId: shift.locationId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      source: shift.source,
    })),
    npcsById: input.npcsById,
    locationsByNpc: input.locationsByNpc,
  });
  if (!validation.valid) {
    logger.warn("[FlashSchedule] automatic publish blocked by validation", {
      serviceDate: input.serviceDate,
      planId: input.schedule.plan.id,
      errors: validation.errors,
    });
    return "publish_blocked";
  }
  const published = await publishFlashSchedulePlan({
    planId: input.schedule.plan.id,
    expectedVersion: input.schedule.plan.version,
    now: input.now,
  }, input.executor);
  return published ? "published" : "cas_miss";
}

export async function runFlashScheduleAutomation(now = new Date()) {
  return runWithFlashScheduleAdvisoryLock(async (executor) => {
    const today = shenzhenDateString(now);
    const targetDate = addServiceDays(today, 1);
    const inputs = await listFlashSchedulingInputs(executor);
    const locationsByNpc = buildFlashSchedulingContext(inputs);
    const schedulingNpcs = inputs.npcs as SchedulingNpc[];
    const npcsById = new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc]));

    // If the process was unavailable at the prior-day cutoff, recover today's
    // untouched draft before preparing tomorrow. Without this catch-up, a
    // restart after midnight would strand valid shifts in draft forever.
    const todaySchedule = await getFlashSchedulePlanByDate(today, executor);
    const todayCatchUp = todaySchedule
      ? await autoPublishUntouchedDraft({
        serviceDate: today,
        schedule: todaySchedule,
        now,
        npcsById,
        locationsByNpc,
        executor,
      })
      : "not_due" as const;

    let schedule = await getFlashSchedulePlanByDate(targetDate, executor);

    if (!schedule) {
      const seed = `flash:${targetDate}:v1`;
      let generated = generateFlashScheduleDraft({
        serviceDate: targetDate,
        npcs: schedulingNpcs,
        locationsByNpc,
        seed,
      });
      let source: "generated" | "fallback" = "generated";
      if (generated.shifts.length === 0) {
        const weekday = isoWeekdayForServiceDate(targetDate);
        const priorPlans = await listRecentPublishedFlashPlans(21, executor);
        const prior = priorPlans.find((candidate) => isoWeekdayForServiceDate(candidate.plan.serviceDate) === weekday) ?? null;
        generated = {
          shifts: buildFallbackDraft({
            serviceDate: targetDate,
            prior,
            npcsById,
            locationsByNpc,
            random: createSeededRandom(`${seed}:fallback`),
          }),
          skippedNpcIds: [],
        };
        source = "fallback";
      }
      const validation = validateFlashScheduleDraft({
        serviceDate: targetDate,
        shifts: generated.shifts,
        npcsById,
        locationsByNpc,
      });
      if (!validation.valid) {
        logger.warn("[FlashSchedule] draft validation failed", { serviceDate: targetDate, errors: validation.errors });
        return {
          status: "invalid" as const,
          serviceDate: targetDate,
          errors: validation.errors,
          todayCatchUp,
        };
      }
      schedule = await createFlashScheduleDraft({
        serviceDate: targetDate,
        generationSeed: seed,
        autoPublishAfter: autoPublishTimeFor(targetDate),
        source,
        shifts: generated.shifts,
      }, executor);
      if (generated.skippedNpcIds.length) {
        logger.warn("[FlashSchedule] eligible NPC skipped because no safe slot was available", {
          serviceDate: targetDate,
          npcIds: generated.skippedNpcIds,
        });
      }
    }

    if (!schedule) return { status: "no_plan" as const, serviceDate: targetDate, todayCatchUp };
    const targetPublish = await autoPublishUntouchedDraft({
      serviceDate: targetDate,
      schedule,
      now,
      npcsById,
      locationsByNpc,
      executor,
    });
    if (targetPublish === "published" || targetPublish === "cas_miss" || targetPublish === "publish_blocked") {
      return { status: targetPublish, serviceDate: targetDate, todayCatchUp };
    }
    return {
      status: "ready" as const,
      serviceDate: targetDate,
      planStatus: schedule.plan.status,
      todayCatchUp,
    };
  });
}

export async function generateOrReplaceFlashScheduleDraftForAdmin(
  serviceDate: string,
  actor: string,
  now = new Date(),
) {
  const tomorrow = addServiceDays(shenzhenDateString(now), 1);
  if (serviceDate !== tomorrow) {
    return { ok: false as const, code: "FLASH_SCHEDULE_DATE_NOT_TOMORROW" as const };
  }
  const inputs = await listFlashSchedulingInputs();
  const schedulingNpcs = inputs.npcs as SchedulingNpc[];
  const locationsByNpc = buildFlashSchedulingContext(inputs);
  const npcsById = new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc]));
  const seed = `flash:${serviceDate}:admin:${randomUUID()}`;
  const generated = generateFlashScheduleDraft({
    serviceDate,
    npcs: schedulingNpcs,
    locationsByNpc,
    seed,
  });
  const validation = validateFlashScheduleDraft({
    serviceDate,
    shifts: generated.shifts,
    npcsById,
    locationsByNpc,
  });
  if (!validation.valid || generated.shifts.length === 0) {
    return {
      ok: false as const,
      code: "FLASH_SCHEDULE_INVALID" as const,
      validation: {
        valid: false,
        errors: generated.shifts.length === 0
          ? [...validation.errors, "NO_SAFE_SHIFTS"]
          : validation.errors,
      },
      skippedNpcIds: generated.skippedNpcIds,
    };
  }

  const existing = await getFlashSchedulePlanByDate(serviceDate);
  if (existing?.plan.status === "published") {
    return { ok: false as const, code: "FLASH_SCHEDULE_PUBLISHED" as const };
  }
  if (!existing) {
    const created = await createFlashScheduleDraft({
      serviceDate,
      generationSeed: seed,
      autoPublishAfter: autoPublishTimeFor(serviceDate),
      source: "generated",
      actor,
      shifts: generated.shifts,
    });
    if (!created) return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
    return {
      ok: true as const,
      plan: created.plan,
      shifts: created.shifts,
      validation,
      skippedNpcIds: generated.skippedNpcIds,
    };
  }

  const replaced = await replaceFlashScheduleShifts({
    planId: existing.plan.id,
    expectedVersion: existing.plan.version,
    updatedBy: actor,
    shifts: generated.shifts,
    now,
    generationSeed: seed,
    source: "generated",
    autoPublishAfter: autoPublishTimeFor(serviceDate),
  });
  if (!replaced) return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  const refreshed = await getFlashSchedulePlanById(existing.plan.id);
  if (!refreshed) return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  return {
    ok: true as const,
    plan: refreshed.plan,
    shifts: refreshed.shifts,
    validation,
    skippedNpcIds: generated.skippedNpcIds,
  };
}

export async function previewPublishedFlashScheduleRegenerationForAdmin(
  planId: string,
  expectedVersion: number,
  now = new Date(),
) {
  const existing = await getFlashSchedulePlanById(planId);
  if (!existing) return { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
  if (!canRegeneratePublishedFlashSchedule(existing.plan, now)) {
    return { ok: false as const, code: "FLASH_SCHEDULE_NOT_REGENERATABLE" as const };
  }
  if (existing.plan.version !== expectedVersion) {
    return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  }

  const inputs = await listFlashSchedulingInputs();
  const schedulingNpcs = inputs.npcs as SchedulingNpc[];
  const locationsByNpc = buildFlashSchedulingContext(inputs);
  const seed = `flash:${existing.plan.serviceDate}:admin-preview:${randomUUID()}`;
  const generated = generateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    npcs: schedulingNpcs,
    locationsByNpc,
    seed,
  });
  const validation = validateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    shifts: generated.shifts,
    npcsById: new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc])),
    locationsByNpc,
  });
  if (!validation.valid || generated.shifts.length === 0) {
    return {
      ok: false as const,
      code: "FLASH_SCHEDULE_INVALID" as const,
      validation: {
        valid: false,
        errors: generated.shifts.length === 0
          ? [...validation.errors, "NO_SAFE_SHIFTS"]
          : validation.errors,
      },
    };
  }
  return {
    ok: true as const,
    plan: existing.plan,
    generationSeed: seed,
    previewDigest: flashSchedulePreviewDigest(generated.shifts),
    shifts: generated.shifts.map((shift) => ({
      ...shift,
      id: randomUUID(),
      planId: existing.plan.id,
      status: "draft" as const,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })),
  };
}

export async function replacePublishedFlashScheduleForAdmin(input: {
  planId: string;
  expectedVersion: number;
  actor: string;
  generationSeed: string;
  previewDigest: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const existing = await getFlashSchedulePlanById(input.planId);
  if (!existing) return { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
  if (!canRegeneratePublishedFlashSchedule(existing.plan, now)) {
    return { ok: false as const, code: "FLASH_SCHEDULE_NOT_REGENERATABLE" as const };
  }
  if (existing.plan.version !== input.expectedVersion) {
    return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  }

  const schedulingInputs = await listFlashSchedulingInputs();
  const schedulingNpcs = schedulingInputs.npcs as SchedulingNpc[];
  const locationsByNpc = buildFlashSchedulingContext(schedulingInputs);
  const regenerated = generateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    npcs: schedulingNpcs,
    locationsByNpc,
    seed: input.generationSeed,
  });
  const validation = validateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    shifts: regenerated.shifts,
    npcsById: new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc])),
    locationsByNpc,
  });
  if (!validation.valid || regenerated.shifts.length === 0) {
    return { ok: false as const, code: "FLASH_SCHEDULE_INVALID" as const, validation };
  }
  if (flashSchedulePreviewDigest(regenerated.shifts) !== input.previewDigest) {
    return { ok: false as const, code: "FLASH_SCHEDULE_PREVIEW_STALE" as const };
  }

  const replaced = await replacePublishedFlashSchedule({
    planId: input.planId,
    expectedVersion: input.expectedVersion,
    updatedBy: input.actor,
    shifts: regenerated.shifts,
    now,
    generationSeed: input.generationSeed,
  });
  return replaced
    ? { ok: true as const, plan: replaced.plan, shifts: replaced.shifts, validation }
    : { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
}

export async function validateAndReplaceFlashScheduleDraftForAdmin(input: {
  planId: string;
  expectedVersion: number;
  actor: string;
  shifts: FlashDraftShift[];
  now?: Date;
}) {
  const existing = await getFlashSchedulePlanById(input.planId);
  if (!existing) return { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
  if (existing.plan.status !== "draft") return { ok: false as const, code: "FLASH_SCHEDULE_PUBLISHED" as const };
  const schedulingInputs = await listFlashSchedulingInputs();
  const schedulingNpcs = schedulingInputs.npcs as SchedulingNpc[];
  const locationsByNpc = buildFlashSchedulingContext(schedulingInputs);
  const validation = validateFlashScheduleDraft({
    serviceDate: existing.plan.serviceDate,
    shifts: input.shifts,
    npcsById: new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc])),
    locationsByNpc,
  });
  if (!validation.valid || input.shifts.length === 0) {
    return {
      ok: false as const,
      code: "FLASH_SCHEDULE_INVALID" as const,
      validation: input.shifts.length === 0
        ? { valid: false, errors: [...validation.errors, "NO_SAFE_SHIFTS"] }
        : validation,
    };
  }
  const replaced = await replaceFlashScheduleShifts({
    planId: input.planId,
    expectedVersion: input.expectedVersion,
    updatedBy: input.actor,
    shifts: input.shifts,
    now: input.now ?? new Date(),
    source: "manual",
  });
  if (!replaced) return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  const refreshed = await getFlashSchedulePlanById(input.planId);
  return refreshed
    ? { ok: true as const, plan: refreshed.plan, shifts: refreshed.shifts, validation }
    : { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
}

export async function updateUpcomingFlashShiftForAdmin(input: {
  planId: string;
  shiftId: string;
  expectedVersion: number;
  actor: string;
  cancel?: boolean;
  shift?: FlashDraftShift;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const existing = await getFlashSchedulePlanById(input.planId);
  if (!existing) return { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
  if (!(["draft", "published"] as string[]).includes(existing.plan.status) || existing.plan.serviceDate !== shenzhenDateString(now)) {
    return { ok: false as const, code: "FLASH_SCHEDULE_NOT_TODAY" as const };
  }
  if (existing.plan.version !== input.expectedVersion) {
    return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  }
  const target = existing.shifts.find((shift: any) => shift.id === input.shiftId);
  if (!target || !canAdjustUpcomingFlashShift(existing.plan, target, now)) {
    return { ok: false as const, code: "FLASH_SHIFT_ALREADY_STARTED" as const };
  }
  if (!input.cancel && (!input.shift || input.shift.startsAt.getTime() <= now.getTime())) {
    return { ok: false as const, code: "FLASH_SHIFT_ALREADY_STARTED" as const };
  }

  if (!input.cancel && input.shift) {
    const schedulingInputs = await listFlashSchedulingInputs();
    const schedulingNpcs = schedulingInputs.npcs as SchedulingNpc[];
    const locationsByNpc = buildFlashSchedulingContext(schedulingInputs);
    const candidateShifts = existing.shifts
      .filter((shift: any) => shift.status === existing.plan.status)
      .map((shift: any) => shift.id === input.shiftId ? input.shift! : ({
        npcId: shift.npcId,
        locationId: shift.locationId,
        startsAt: new Date(shift.startsAt),
        endsAt: new Date(shift.endsAt),
        source: shift.source,
      }));
    const validation = validateFlashScheduleDraft({
      serviceDate: existing.plan.serviceDate,
      shifts: candidateShifts,
      npcsById: new Map<string, SchedulingNpc>(schedulingNpcs.map((npc) => [npc.id, npc])),
      locationsByNpc,
    });
    if (!validation.valid) {
      return { ok: false as const, code: "FLASH_SCHEDULE_INVALID" as const, validation };
    }
  }

  try {
    const updated = await updateUpcomingFlashShift({
      planId: input.planId,
      shiftId: input.shiftId,
      expectedVersion: input.expectedVersion,
      updatedBy: input.actor,
      now,
      cancel: input.cancel,
      shift: input.shift,
    });
    if (!updated) return { ok: false as const, code: "FLASH_SCHEDULE_CAS_CONFLICT" as const };
  } catch (error) {
    if (error instanceof Error && error.message === "FLASH_UPCOMING_SHIFT_CONFLICT") {
      return { ok: false as const, code: "FLASH_SHIFT_ALREADY_STARTED" as const };
    }
    throw error;
  }
  const refreshed = await getFlashSchedulePlanById(input.planId);
  return refreshed
    ? { ok: true as const, plan: refreshed.plan, shifts: refreshed.shifts }
    : { ok: false as const, code: "FLASH_SCHEDULE_NOT_FOUND" as const };
}

export async function runFlashMaintenanceJob(now = new Date()) {
  const [expiredAssignments, deletedPrivateReplies, deletedLocateBudgets] = await Promise.all([
    expireAllFlashAssignments(now),
    purgeExpiredFlashPrivateReplies(now),
    purgeExpiredFlashLocateBudgets(new Date(now.getTime() - 24 * 60 * 60 * 1000)),
  ]);
  return { expiredAssignments, deletedPrivateReplies, deletedLocateBudgets };
}

let workerTimer: NodeJS.Timeout | null = null;
let initialTimer: NodeJS.Timeout | null = null;

export function startFlashBackgroundJobs(intervalMs = JOB_INTERVAL_MS): void {
  if (workerTimer) return;
  const tick = async () => {
    if (!(await isFlashSchemaReady())) return;
    try {
      await runFlashMaintenanceJob();
      if (await getFeatureFlag("alangEnabled", false)) {
        await runFlashScheduleAutomation();
      }
    } catch (error) {
      logger.error("[FlashJobs] background tick failed", {
        code: "FLASH_JOB_FAILED",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  initialTimer = setTimeout(() => void tick(), 5_000);
  initialTimer.unref?.();
  workerTimer = setInterval(() => void tick(), intervalMs);
  workerTimer.unref?.();
}

export function stopFlashBackgroundJobsForTest(): void {
  if (initialTimer) clearTimeout(initialTimer);
  if (workerTimer) clearInterval(workerTimer);
  initialTimer = null;
  workerTimer = null;
}
