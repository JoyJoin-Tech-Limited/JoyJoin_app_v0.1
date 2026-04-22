import { db } from "../db";
import { sql, eq, desc } from "drizzle-orm";
import { refundAttempts } from "@shared/schema";

export interface CreateRefundAttemptData {
  paymentId: string;
  status: "pending" | "success" | "failed";
  reason?: string;
  wechatRefundId?: string;
  amount: number;
  initiatedBy?: string;
}

export interface RefundAttemptRecord {
  id: string;
  paymentId: string;
  status: string;
  reason: string | null;
  wechatRefundId: string | null;
  amount: number;
  initiatedBy: string | null;
  initiatedAt: Date | null;
  resolvedAt: Date | null;
  failureReason: string | null;
}

export const refundAttemptsRepo = {
  async create(data: CreateRefundAttemptData): Promise<RefundAttemptRecord> {
    const [result] = await db
      .insert(refundAttempts)
      .values({
        paymentId: data.paymentId,
        status: data.status,
        reason: data.reason || null,
        wechatRefundId: data.wechatRefundId || null,
        amount: data.amount,
        initiatedBy: data.initiatedBy || null,
      })
      .returning();
    return result;
  },

  async updateStatus(
    id: string,
    updates: { status: "success" | "failed"; resolvedAt?: Date; failureReason?: string },
  ): Promise<RefundAttemptRecord | undefined> {
    const [result] = await db
      .update(refundAttempts)
      .set({
        status: updates.status,
        resolvedAt: updates.resolvedAt || new Date(),
        failureReason: updates.failureReason || null,
      })
      .where(eq(refundAttempts.id, id))
      .returning();
    return result;
  },

  async findByPaymentId(paymentId: string): Promise<RefundAttemptRecord[]> {
    const result = await db
      .select()
      .from(refundAttempts)
      .where(eq(refundAttempts.paymentId, paymentId))
      .orderBy(desc(refundAttempts.initiatedAt));
    return result;
  },

  async findPendingByPaymentId(paymentId: string): Promise<RefundAttemptRecord | undefined> {
    const result = await db
      .select()
      .from(refundAttempts)
      .where(sql`${refundAttempts.paymentId} = ${paymentId} AND ${refundAttempts.status} = 'pending'`)
      .orderBy(desc(refundAttempts.initiatedAt))
      .limit(1);
    return result[0];
  },

  async getAllWithPaymentDetails(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT
        ra.*,
        p.wechat_order_id as payment_wechat_order_id,
        p.payment_type,
        p.final_amount as payment_final_amount,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.phone_number as user_phone_number
      FROM refund_attempts ra
      LEFT JOIN payments p ON ra.payment_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY ra.initiated_at DESC
    `);
    return result.rows;
  },
};
