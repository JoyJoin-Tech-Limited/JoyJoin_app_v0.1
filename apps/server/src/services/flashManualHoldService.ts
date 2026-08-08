import {
  isFlashSchemaReady,
  listActiveFlashManualHolds,
  startFlashManualHold,
  stopFlashManualHold,
} from "../repositories/flashRepo";
import { isFlashManualHoldRuntimeAvailable } from "./flashService";

export class FlashManualHoldError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type FlashManualHoldDto = {
  appearanceId: string;
  startedAt: string;
  npc: { id: string; slug: string; name: string };
  location: { id: string; name: string; district: string; address: string };
};

type ManualHoldRow = Awaited<ReturnType<typeof listActiveFlashManualHolds>>[number];

function toDto(row: ManualHoldRow): FlashManualHoldDto {
  return {
    appearanceId: row.appearanceId,
    startedAt: row.startsAt.toISOString(),
    npc: { id: row.npcId, slug: row.npcSlug, name: row.npcName },
    location: {
      id: row.locationId,
      name: row.locationName,
      district: row.district,
      address: row.locationAddress,
    },
  };
}

function assertStaging(appMode?: string): void {
  if (!isFlashManualHoldRuntimeAvailable(appMode)) {
    throw new FlashManualHoldError(
      "FLASH_MANUAL_HOLD_PRODUCTION_FORBIDDEN",
      403,
      "手动保持在线只允许在 staging 测试环境使用",
    );
  }
}

async function assertSchemaReady(): Promise<void> {
  if (!await isFlashSchemaReady()) {
    throw new FlashManualHoldError(
      "FLASH_MANUAL_HOLD_SCHEMA_NOT_READY",
      503,
      "手动保持在线迁移尚未完成，请先核验 staging 数据库",
    );
  }
}

export async function getFlashManualHoldStatus(appMode = process.env.APP_MODE) {
  const available = isFlashManualHoldRuntimeAvailable(appMode);
  if (!available) {
    return { available: false, schemaReady: false, activeHolds: [] as FlashManualHoldDto[] };
  }
  const schemaReady = await isFlashSchemaReady();
  if (!schemaReady) return { available: true, schemaReady: false, activeHolds: [] as FlashManualHoldDto[] };
  return {
    available: true,
    schemaReady: true,
    activeHolds: (await listActiveFlashManualHolds()).map(toDto),
  };
}

export async function startFlashManualHoldForAdmin(input: {
  npcId: string;
  locationId: string;
  actorId: string;
  now?: Date;
  appMode?: string;
}) {
  assertStaging(input.appMode ?? process.env.APP_MODE);
  await assertSchemaReady();
  const result = await startFlashManualHold({
    npcId: input.npcId,
    locationId: input.locationId,
    actorId: input.actorId,
    now: input.now ?? new Date(),
  });
  if (result.ok) return { created: result.created, hold: toDto(result.hold) };

  if (result.code === "FLASH_MANUAL_HOLD_NOT_ELIGIBLE") {
    throw new FlashManualHoldError(result.code, 409, "NPC 与地点必须已启用、审核通过且完成绑定");
  }
  if (result.code === "FLASH_MANUAL_HOLD_SCHEDULED_CONFLICT") {
    throw new FlashManualHoldError(result.code, 409, "该 NPC 正在正式班次中，不能同时开启测试保持在线");
  }
  throw new FlashManualHoldError(result.code, 409, "该 NPC 已在另一个地点保持在线，请先显式下线");
}

export async function stopFlashManualHoldForAdmin(input: {
  appearanceId: string;
  actorId: string;
  now?: Date;
  appMode?: string;
}) {
  assertStaging(input.appMode ?? process.env.APP_MODE);
  await assertSchemaReady();
  const stopped = await stopFlashManualHold({
    appearanceId: input.appearanceId,
    actorId: input.actorId,
    now: input.now ?? new Date(),
  });
  return {
    stopped: Boolean(stopped),
    hold: stopped ? toDto(stopped as ManualHoldRow) : null,
  };
}
