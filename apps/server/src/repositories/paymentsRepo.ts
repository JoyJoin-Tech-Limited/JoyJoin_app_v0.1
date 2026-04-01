import { db } from "../db";
import { sql } from "drizzle-orm";

export interface PaymentsRepository {
  getAllSubscriptions(): Promise<any[]>;
  getActiveSubscriptions(): Promise<any[]>;
  getUserSubscription(userId: string): Promise<any | undefined>;
  createSubscription(data: any): Promise<any>;
  updateSubscription(id: string, updates: any): Promise<any>;
  getAllCoupons(): Promise<any[]>;
  getCoupon(id: string): Promise<any | undefined>;
  getCouponByCode(code: string): Promise<any | undefined>;
  createCoupon(data: any): Promise<any>;
  updateCoupon(id: string, updates: any): Promise<any>;
  getCouponUsageStats(couponId: string): Promise<any>;
  recordCouponUsage(data: { couponId: string; userId: string; paymentId: string; discountApplied: number }): Promise<void>;
  getUserCoupons(userId: string): Promise<any[]>;
  createUserCoupon(data: { userId: string; couponId: string; source: string; sourceId?: string }): Promise<any>;
  deleteUserCoupon(userCouponId: string): Promise<void>;
  markUserCouponUsed(userCouponId: string): Promise<any>;
  getAllPayments(): Promise<any[]>;
  getPaymentById(id: string): Promise<any | undefined>;
  getPaymentByWechatOrderId(wechatOrderId: string): Promise<any | undefined>;
  getPaymentsByType(paymentType: string): Promise<any[]>;
  createPayment(data: any): Promise<any>;
  updatePayment(id: string, updates: any): Promise<any>;
}

export const paymentsRepo: PaymentsRepository = {
  async getAllSubscriptions(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT s.*, u.first_name, u.last_name, u.email, u.phone_number
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.created_at DESC
    `);
    return result.rows;
  },

  async getActiveSubscriptions(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT s.*, u.first_name, u.last_name, u.email, u.phone_number
      FROM subscriptions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.is_active = true AND s.end_date > NOW()
      ORDER BY s.created_at DESC
    `);
    return result.rows;
  },

  async getUserSubscription(userId: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM subscriptions
      WHERE user_id = ${userId} AND is_active = true AND end_date > NOW()
      ORDER BY created_at DESC
      LIMIT 1
    `);
    return result.rows[0];
  },

  async createSubscription(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO subscriptions (user_id, plan_type, start_date, end_date, is_active, auto_renew, payment_id)
      VALUES (${data.userId}, ${data.planType}, ${data.startDate}, ${data.endDate}, ${data.isActive || true}, ${data.autoRenew || false}, ${data.paymentId || null})
      RETURNING *
    `);
    return result.rows[0];
  },

  async updateSubscription(id: string, updates: any): Promise<any> {
    const setClauses = [];
    const values: any[] = [];

    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${values.length + 1}`);
      values.push(updates.isActive);
    }
    if (updates.autoRenew !== undefined) {
      setClauses.push(`auto_renew = $${values.length + 1}`);
      values.push(updates.autoRenew);
    }
    if (updates.endDate !== undefined) {
      setClauses.push(`end_date = $${values.length + 1}`);
      values.push(updates.endDate);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.paymentId !== undefined) {
      setClauses.push(`payment_id = $${values.length + 1}`);
      values.push(updates.paymentId);
    }

    if (setClauses.length === 0) {
      const result = await db.execute(sql`SELECT * FROM subscriptions WHERE id = ${id}`);
      return result.rows[0];
    }

    values.push(id);
    const query = sql.raw(`UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`);
    const result = await db.execute(query);
    return result.rows[0];
  },

  async getAllCoupons(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT c.*, 
        COUNT(cu.id) as usage_count
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    return result.rows;
  },

  async getCoupon(id: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT c.*, 
        COUNT(cu.id) as usage_count
      FROM coupons c
      LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
      WHERE c.id = ${id}
      GROUP BY c.id
    `);
    return result.rows[0];
  },

  async getCouponByCode(code: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM coupons WHERE code = ${code} AND is_active = true LIMIT 1
    `);
    return result.rows[0];
  },

  async createCoupon(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO coupons (code, discount_type, discount_value, valid_from, valid_until, usage_limit, is_active)
      VALUES (${data.code}, ${data.discountType}, ${data.discountValue}, ${data.validFrom}, ${data.validUntil}, ${data.maxUses || null}, true)
      RETURNING *
    `);
    return result.rows[0];
  },

  async updateCoupon(id: string, updates: any): Promise<any> {
    const setClauses = [];
    const values: any[] = [];

    if (updates.code !== undefined) {
      setClauses.push(`code = $${values.length + 1}`);
      values.push(updates.code);
    }
    if (updates.discountType !== undefined) {
      setClauses.push(`discount_type = $${values.length + 1}`);
      values.push(updates.discountType);
    }
    if (updates.discountValue !== undefined) {
      setClauses.push(`discount_value = $${values.length + 1}`);
      values.push(updates.discountValue);
    }
    if (updates.validFrom !== undefined) {
      setClauses.push(`valid_from = $${values.length + 1}`);
      values.push(updates.validFrom);
    }
    if (updates.validUntil !== undefined) {
      setClauses.push(`valid_until = $${values.length + 1}`);
      values.push(updates.validUntil);
    }
    if (updates.maxUses !== undefined) {
      setClauses.push(`usage_limit = $${values.length + 1}`);
      values.push(updates.maxUses);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${values.length + 1}`);
      values.push(updates.isActive);
    }

    if (setClauses.length === 0) {
      return paymentsRepo.getCoupon(id);
    }

    values.push(id);
    const query = sql.raw(`UPDATE coupons SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`);
    const result = await db.execute(query);
    return result.rows[0];
  },

  async getCouponUsageStats(couponId: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT 
        cu.*, 
        u.first_name, 
        u.last_name, 
        u.email
      FROM coupon_usage cu
      LEFT JOIN users u ON cu.user_id = u.id
      WHERE cu.coupon_id = ${couponId}
      ORDER BY cu.created_at DESC
    `);
    return result.rows;
  },

  async recordCouponUsage(data: { couponId: string; userId: string; paymentId: string; discountApplied: number }): Promise<void> {
    await db.execute(sql`
      INSERT INTO coupon_usage (coupon_id, user_id, payment_id, discount_applied)
      VALUES (${data.couponId}, ${data.userId}, ${data.paymentId}, ${data.discountApplied})
    `);

    await db.execute(sql`
      UPDATE coupons SET current_uses = current_uses + 1 WHERE id = ${data.couponId}
    `);
  },

  async getUserCoupons(userId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT uc.*, c.code, c.discount_type, c.discount_value, c.valid_from, c.valid_until
      FROM user_coupons uc
      LEFT JOIN coupons c ON uc.coupon_id = c.id
      WHERE uc.user_id = ${userId}
      ORDER BY uc.created_at DESC
    `);
    return result.rows;
  },

  async createUserCoupon(data: { userId: string; couponId: string; source: string; sourceId?: string }): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO user_coupons (user_id, coupon_id, source, source_id)
      VALUES (${data.userId}, ${data.couponId}, ${data.source}, ${data.sourceId || null})
      RETURNING *
    `);
    return result.rows[0];
  },

  async deleteUserCoupon(userCouponId: string): Promise<void> {
    await db.execute(sql`DELETE FROM user_coupons WHERE id = ${userCouponId}`);
  },

  async markUserCouponUsed(userCouponId: string): Promise<any> {
    const result = await db.execute(sql`
      UPDATE user_coupons 
      SET is_used = true, used_at = NOW() 
      WHERE id = ${userCouponId}
      RETURNING *
    `);
    return result.rows[0];
  },

  async createPayment(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO payments (user_id, payment_type, related_id, original_amount, discount_amount, final_amount, coupon_id, wechat_order_id, status)
      VALUES (${data.userId}, ${data.paymentType}, ${data.relatedId || null}, ${data.originalAmount}, ${data.discountAmount || 0}, ${data.finalAmount}, ${data.couponId || null}, ${data.wechatOrderId}, ${data.status || 'pending'})
      RETURNING *
    `);
    return result.rows[0];
  },

  async updatePayment(id: string, updates: any): Promise<any> {
    const setClauses = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      setClauses.push(`status = $${values.length + 1}`);
      values.push(updates.status);
    }
    if (updates.wechatTransactionId !== undefined) {
      setClauses.push(`wechat_transaction_id = $${values.length + 1}`);
      values.push(updates.wechatTransactionId);
    }
    if (updates.paidAt !== undefined) {
      setClauses.push(`paid_at = $${values.length + 1}`);
      values.push(updates.paidAt);
    }

    if (setClauses.length === 0) {
      const result = await db.execute(sql`SELECT * FROM payments WHERE id = ${id}`);
      return result.rows[0];
    }

    values.push(id);
    const query = sql.raw(`UPDATE payments SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`);
    const result = await db.execute(query);
    return result.rows[0];
  },

  async getAllPayments(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        p.*, 
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },

  async getPaymentById(id: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM payments
      WHERE id = ${id}
      LIMIT 1
    `);
    return result.rows[0];
  },

  async getPaymentByWechatOrderId(wechatOrderId: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT * FROM payments
      WHERE wechat_order_id = ${wechatOrderId}
      LIMIT 1
    `);
    return result.rows[0];
  },

  async getPaymentsByType(paymentType: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        p.*, 
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email
      FROM payments p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.payment_type = ${paymentType}
      ORDER BY p.created_at DESC
    `);
    return result.rows;
  },
};
