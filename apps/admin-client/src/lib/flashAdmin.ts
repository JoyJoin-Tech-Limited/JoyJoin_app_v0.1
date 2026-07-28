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

export interface FlashReadinessCounts {
  activeNpcs?: number;
  canonicalNpcs?: number;
  canonicalWeekdayNpcs?: number;
  schedulableNpcs?: number;
  taskReadyNpcs?: number;
  reviewedTasks?: number;
  approvedEncounterLocations?: number;
  approvedTaskDestinations?: number;
  linkedTasks?: number;
  readyTaskCategoryCounts?: Record<string, number>;
}

export interface FlashReadiness {
  schemaReady: boolean;
  ready: boolean;
  blockers: string[];
  counts: FlashReadinessCounts;
}

export interface FlashOverview {
  readiness?: FlashReadiness;
  counts?: FlashOverviewCounts;
  today?: FlashScheduleResponse | null;
  nextDraft?: FlashScheduleResponse | null;
}

export interface FlashReadinessItem {
  code: string;
  label: string;
  detail: string;
}

export function getFlashReadinessItems(readiness?: FlashReadiness): FlashReadinessItem[] {
  if (!readiness || readiness.ready) return [];
  const counts = readiness.counts ?? {};
  const formatCount = (value: number | undefined, target: number) => `${value ?? 0}/${target}`;
  const categoryCounts = Object.values(counts.readyTaskCategoryCounts ?? {});
  const completeCategories = categoryCounts.filter((count) => count >= 5).length;

  const messages: Record<string, Omit<FlashReadinessItem, "code">> = {
    schema_not_ready: {
      label: "正式数据表",
      detail: "街头盲盒正式数据表尚未部署；请先执行并核验 Flash 增量迁移。",
    },
    tencent_map_key_required: {
      label: "腾讯地图服务",
      detail: "服务端未配置腾讯地图密钥，地点无法完成深圳范围校验。",
    },
    exactly_five_canonical_active_npcs_required: {
      label: "固定 NPC",
      detail: `已启用 ${formatCount(counts.canonicalNpcs, 5)} 位固定 NPC；请保持五位正式角色全部启用。`,
    },
    canonical_npc_weekdays_required: {
      label: "NPC 上线日",
      detail: `已完成 ${formatCount(counts.canonicalWeekdayNpcs, 5)} 位；请恢复五位 NPC 的固定星期配置。`,
    },
    all_active_npcs_require_approved_locations: {
      label: "NPC 地点绑定",
      detail: `已完成 ${formatCount(counts.schedulableNpcs, counts.activeNpcs ?? 5)} 位；每位启用 NPC 都要绑定已审核且启用的街头盲盒地点。`,
    },
    all_active_npcs_require_ready_tasks: {
      label: "NPC 任务覆盖",
      detail: `已完成 ${formatCount(counts.taskReadyNpcs, counts.activeNpcs ?? 5)} 位；每位启用 NPC 都需要可用任务。`,
    },
    thirty_human_reviewed_tasks_required: {
      label: "人工审核任务",
      detail: `已完成 ${formatCount(counts.reviewedTasks, 30)} 条；请在「任务库」逐条确认内容并启用。`,
    },
    approved_encounter_location_required: {
      label: "街头盲盒地点",
      detail: "至少需要一个经过腾讯地图校验、人工审核并启用的地点。",
    },
    approved_task_destination_required: {
      label: "任务目的地",
      detail: "至少需要一个经过腾讯地图校验、人工审核并启用的任务目的地。",
    },
    all_tasks_require_active_npc_links: {
      label: "任务 NPC 绑定",
      detail: `已完成 ${formatCount(counts.linkedTasks, 30)} 条；每条任务都要绑定至少一个已启用的数字 NPC。`,
    },
    six_categories_with_five_ready_tasks_required: {
      label: "任务分类覆盖",
      detail: `已有 ${formatCount(completeCategories, 6)} 个分类达到 5 条可用任务；请补齐六类任务。`,
    },
  };

  return readiness.blockers.map((code) => ({
    code,
    ...(messages[code] ?? {
      label: "其他发布条件",
      detail: `服务端返回未识别的检查项：${code}。请联系开发人员确认。`,
    }),
  }));
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
