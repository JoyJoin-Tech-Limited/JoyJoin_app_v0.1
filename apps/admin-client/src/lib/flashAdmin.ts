export type FlashAdminRole = "super_admin" | "operator" | "viewer";

export type FlashApprovalStatus = "draft" | "approved" | "rejected";
export type FlashScheduleStatus = "draft" | "published" | "superseded";
export type FlashShiftStatus = "draft" | "published" | "cancelled";

export interface FlashFeedbackPrompt {
  id: string;
  prompt: string;
  options: Array<{ id: string; label: string }>;
}

export interface FlashAvailabilityWindow {
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  startTime: string;
  endTime: string;
}

export interface FlashNpc {
  id: string;
  slug: string;
  name: string;
  species: string;
  personalitySummary: string;
  inviteLine: string;
  eligibleWeekdays: number[];
  oneShiftProbability: number;
  twoShiftProbability: number;
  minShiftMinutes: number;
  maxShiftMinutes: number;
  minGapMinutes: number;
  themeColor?: string | null;
  avatarUrl?: string | null;
  sortOrder?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashEncounterLocation {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  availabilityWindows: FlashAvailabilityWindow[];
  approvalStatus: FlashApprovalStatus;
  safetyNotes?: string | null;
  eligibleNpcIds?: string[];
  npcIds?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashTaskDestination {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  approvalStatus: FlashApprovalStatus;
  safetyNotes?: string | null;
  tags?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashTaskTemplate {
  id: string;
  contentVersion: number;
  code: string;
  category: string;
  title: string;
  brief: string;
  instructions: string;
  dialogueIntro: string;
  feedbackPrompts: FlashFeedbackPrompt[];
  tags: string[];
  durationDays: number;
  baseWeight?: number;
  safetyLevel: "L1" | "L2";
  safetyNotes: string;
  isHumanReviewed: boolean;
  isActive: boolean;
  npcIds?: string[];
  npcCopies?: Array<{
    npcId: string;
    requestCopy: string;
    deliveryCopy: string;
  }>;
  destinationIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashSchedulePlan {
  id: string;
  version: number;
  serviceDate: string;
  city: string;
  status: FlashScheduleStatus;
  source: "generated" | "fallback" | "manual";
  generatedAt?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
}

export interface FlashShift {
  id: string;
  planId: string;
  npcId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: FlashShiftStatus;
  source: "generated" | "fallback" | "manual";
  npc?: Pick<FlashNpc, "id" | "name" | "slug"> | null;
  location?: Pick<FlashEncounterLocation, "id" | "name" | "district"> | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashScheduleResponse {
  plan: FlashSchedulePlan | null;
  shifts: FlashShift[];
}

export interface FlashOverviewCounts {
  activeNpcs?: number;
  activeEncounterLocations?: number;
  approvedEncounterLocations?: number;
  approvedTaskDestinations?: number;
  activeTaskTemplates?: number;
  reviewedTasks?: number;
  publishedShiftsToday?: number;
}

export interface FlashOverview {
  counts?: FlashOverviewCounts;
  today?: FlashScheduleResponse | null;
  nextDraft?: FlashScheduleResponse | null;
}

type CollectionEnvelope<T> =
  | T[]
  | {
      items?: T[];
      data?: T[];
      npcs?: T[];
      locations?: T[];
      destinations?: T[];
      templates?: T[];
    }
  | null
  | undefined;

export function unpackFlashCollection<T>(payload: CollectionEnvelope<T>): T[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.items,
    payload.data,
    payload.npcs,
    payload.locations,
    payload.destinations,
    payload.templates,
  ];

  return candidates.find(Array.isArray) ?? [];
}

export function canWriteFlashAdmin(role?: string): boolean {
  return role === "super_admin" || role === "operator";
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: "周一",
  2: "周二",
  3: "周三",
  4: "周四",
  5: "周五",
  6: "周六",
  7: "周日",
};

export function formatEligibleWeekdays(days: number[]): string {
  return [...new Set(days)]
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    .sort((a, b) => a - b)
    .map((day) => WEEKDAY_LABELS[day])
    .join("、");
}

function formatShenzhenDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getShenzhenDatePair(now = new Date()): { today: string; tomorrow: string } {
  const today = formatShenzhenDate(now);
  const noonUtc = new Date(`${today}T04:00:00.000Z`);
  const tomorrowDate = new Date(noonUtc.getTime() + 24 * 60 * 60 * 1000);
  return { today, tomorrow: formatShenzhenDate(tomorrowDate) };
}

export function parseCommaList(value: string): string[] {
  return [...new Set(value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean))];
}

export function formatFeedbackPromptLines(prompts: FlashFeedbackPrompt[]): string {
  return prompts
    .map((item) => [item.prompt, ...item.options.map((option) => option.label)].join("｜"))
    .join("\n");
}

export function parseFeedbackPromptLines(
  value: string,
  existing: FlashFeedbackPrompt[] = [],
): { prompts: FlashFeedbackPrompt[]; error?: string } {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 1 || lines.length > 2) {
    return { prompts: [], error: "请填写 1–2 行反馈问题" };
  }

  const prompts: FlashFeedbackPrompt[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const segments = lines[index].split(/[｜|]/).map((part) => part.trim()).filter(Boolean);
    if (segments.length < 3) {
      return { prompts: [], error: `第 ${index + 1} 行至少需要一个问题和两个选项` };
    }
    if (segments.length > 6) {
      return { prompts: [], error: `第 ${index + 1} 行最多填写五个选项` };
    }

    const previous = existing[index];
    const promptId = previous?.id || `feedback_${index + 1}`;
    prompts.push({
      id: promptId,
      prompt: segments[0],
      options: segments.slice(1).map((label, optionIndex) => ({
        id: previous?.options[optionIndex]?.id || `${promptId}_option_${optionIndex + 1}`,
        label,
      })),
    });
  }

  return { prompts };
}

export function getNpcIds(location: FlashEncounterLocation): string[] {
  return location.eligibleNpcIds ?? location.npcIds ?? [];
}

export function formatFlashScheduleStatus(status?: string | null): string {
  if (status === "published") return "已发布";
  if (status === "draft") return "草案";
  if (status === "superseded") return "已替换";
  return "未生成";
}

export function formatFlashShiftStatus(status?: string | null): string {
  if (status === "published") return "在线计划";
  if (status === "draft") return "待发布";
  if (status === "cancelled") return "已取消";
  return "未知";
}

export function formatFlashTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function toShenzhenIso(serviceDate: string, time: string): string {
  return `${serviceDate}T${time}:00+08:00`;
}
