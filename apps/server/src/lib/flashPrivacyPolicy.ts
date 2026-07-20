const DAY_MS = 24 * 60 * 60 * 1000;

export const FLASH_PRIVATE_REPLY_POST_DELIVERY_RETENTION_DAYS = 30;

// The extra seven-day grace preserves the promised 30 days after delivery when
// the next NPC encounter happens promptly, while still imposing an absolute
// cap when a ready-to-deliver task is never handed back.
export const FLASH_PRIVATE_REPLY_MAX_PENDING_RETENTION_DAYS = 37;

export function flashPrivateReplyPendingDeadline(
  submittedAt: Date,
  privateReply?: string,
): Date | null {
  if (!privateReply?.trim()) return null;
  return new Date(
    submittedAt.getTime() + FLASH_PRIVATE_REPLY_MAX_PENDING_RETENTION_DAYS * DAY_MS,
  );
}

export function flashPrivateReplyDeliveryDeadline(deliveredAt: Date): Date {
  return new Date(
    deliveredAt.getTime() + FLASH_PRIVATE_REPLY_POST_DELIVERY_RETENTION_DAYS * DAY_MS,
  );
}
