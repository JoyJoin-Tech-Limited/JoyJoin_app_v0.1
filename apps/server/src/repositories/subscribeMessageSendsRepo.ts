import { subscribeMessageSends } from "@shared/schema";
import { db } from "../db";

/**
 * Send-ledger for WeChat subscribe messages. The (userId, moment, poolId)
 * unique key is the idempotency claim: callers attempt the insert and only
 * send when the claim was newly created. A row whose send later fails on
 * transport stays recorded — for event-driven moments that is intentional
 * (the in-app notification is the fallback); scheduled moments gate on the
 * claim too, so a failed send is not retried within the same window.
 */
export const subscribeMessageSendsRepo = {
  /**
   * Claim the (user, moment, pool) send slot. Returns true when this call
   * created the claim (caller should send), false when a claim already
   * existed (caller must skip — a previous tick/run already handled it).
   */
  async tryClaimSend(params: {
    userId: string;
    poolId: string;
    moment: string;
    templateId: string;
  }): Promise<boolean> {
    const rows = await db
      .insert(subscribeMessageSends)
      .values({
        userId: params.userId,
        poolId: params.poolId,
        moment: params.moment,
        templateId: params.templateId,
      })
      .onConflictDoNothing({
        target: [
          subscribeMessageSends.userId,
          subscribeMessageSends.moment,
          subscribeMessageSends.poolId,
        ],
      })
      .returning({ id: subscribeMessageSends.id });
    return rows.length > 0;
  },
};
