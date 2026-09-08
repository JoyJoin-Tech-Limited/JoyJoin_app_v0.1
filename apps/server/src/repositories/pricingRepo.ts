import { type PricingSetting, type PromotionBanner, pricingSettings, promotionBanners, users, events, eventPools } from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface PricingRepository {
  getAllPricingSettings(): Promise<PricingSetting[]>;
  getPricingSetting(id: string): Promise<PricingSetting | undefined>;
  updatePricingSetting(id: string, updates: Partial<PricingSetting>): Promise<PricingSetting>;
  getActivePricingSettings(): Promise<PricingSetting[]>;
  getActiveBanners(city?: string, placement?: string): Promise<PromotionBanner[]>;
  listAllBanners(): Promise<PromotionBanner[]>;
  createBanner(data: Partial<PromotionBanner> & { imageUrl: string }): Promise<PromotionBanner>;
  updateBanner(id: string, updates: Partial<PromotionBanner>): Promise<PromotionBanner | undefined>;
  deleteBanner(id: string): Promise<PromotionBanner | undefined>;
  getPublicStats(): Promise<{
    totalUsers: number;
    totalEvents: number;
    satisfactionRate: number;
    avgRating: number;
  }>;
}

export const pricingRepo: PricingRepository = {
  async getAllPricingSettings(): Promise<PricingSetting[]> {
    return await db
      .select()
      .from(pricingSettings)
      .orderBy(pricingSettings.sortOrder);
  },

  async getPricingSetting(id: string): Promise<PricingSetting | undefined> {
    const [setting] = await db
      .select()
      .from(pricingSettings)
      .where(eq(pricingSettings.id, id));
    return setting;
  },

  async updatePricingSetting(id: string, updates: Partial<PricingSetting>): Promise<PricingSetting> {
    const result = await db.execute(sql`
      UPDATE pricing_settings 
      SET 
        display_name = COALESCE(${updates.displayName ?? null}, display_name),
        display_name_en = COALESCE(${updates.displayNameEn ?? null}, display_name_en),
        description = COALESCE(${updates.description ?? null}, description),
        price_in_cents = COALESCE(${updates.priceInCents ?? null}, price_in_cents),
        original_price_in_cents = CASE 
          WHEN ${updates.originalPriceInCents === undefined}::boolean THEN original_price_in_cents 
          ELSE ${updates.originalPriceInCents ?? null}::integer 
        END,
        duration_days = CASE 
          WHEN ${updates.durationDays === undefined}::boolean THEN duration_days 
          ELSE ${updates.durationDays ?? null}::integer 
        END,
        sort_order = COALESCE(${updates.sortOrder ?? null}, sort_order),
        is_active = COALESCE(${updates.isActive ?? null}, is_active),
        is_featured = COALESCE(${updates.isFeatured ?? null}, is_featured),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);
    return result.rows[0] as PricingSetting;
  },

  async getActivePricingSettings(): Promise<PricingSetting[]> {
    return await db
      .select()
      .from(pricingSettings)
      .where(eq(pricingSettings.isActive, true))
      .orderBy(pricingSettings.sortOrder);
  },

  async getActiveBanners(city?: string, placement?: string): Promise<PromotionBanner[]> {
    const now = new Date();
    let query = db
      .select()
      .from(promotionBanners)
      .where(eq(promotionBanners.isActive, true))
      .orderBy(promotionBanners.sortOrder);

    const results = await query;
    
    return results.filter((banner: any) => {
      if (city && banner.city && banner.city !== city) return false;
      if (placement && banner.placement !== placement && banner.placement !== 'both') return false;
      if (banner.effectiveFrom && new Date(banner.effectiveFrom) > now) return false;
      if (banner.effectiveUntil && new Date(banner.effectiveUntil) < now) return false;
      return true;
    });
  },

  async listAllBanners(): Promise<PromotionBanner[]> {
    return await db
      .select()
      .from(promotionBanners)
      .orderBy(promotionBanners.sortOrder, desc(promotionBanners.createdAt));
  },

  async createBanner(data: Partial<PromotionBanner> & { imageUrl: string }): Promise<PromotionBanner> {
    const [banner] = await db
      .insert(promotionBanners)
      .values(data)
      .returning();
    return banner;
  },

  async updateBanner(id: string, updates: Partial<PromotionBanner>): Promise<PromotionBanner | undefined> {
    const [banner] = await db
      .update(promotionBanners)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(promotionBanners.id, id))
      .returning();
    return banner;
  },

  async deleteBanner(id: string): Promise<PromotionBanner | undefined> {
    const [banner] = await db
      .delete(promotionBanners)
      .where(eq(promotionBanners.id, id))
      .returning();
    return banner;
  },

  async getPublicStats(): Promise<{
    totalUsers: number;
    totalEvents: number;
    satisfactionRate: number;
    avgRating: number;
  }> {
    const [userCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    const [eventCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(events);

    const [poolCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(eventPools);

    const totalEvents = (eventCount?.count || 0) + (poolCount?.count || 0);

    return {
      totalUsers: userCount?.count || 0,
      totalEvents: totalEvents,
      satisfactionRate: 95,
      avgRating: 4.8,
    };
  }
};
