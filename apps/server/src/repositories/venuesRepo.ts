import { type Venue, type VenueTimeSlot, type InsertVenueTimeSlot, type VenueTimeSlotBooking, type InsertVenueTimeSlotBooking, venues, venueDeals, venueTimeSlots, venueTimeSlotBookings, events, venueBookings } from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql, or, gte, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { logger } from "../lib/logger";

function mapVenueRowToCamelCase(row: any): any {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    brandName: row.brand_name,
    type: row.venue_type,
    address: row.address,
    city: row.city,
    district: row.area,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    commissionRate: row.commission_rate,
    tags: row.tags,
    cuisines: row.cuisines,
    priceRange: row.price_range,
    budgetCategories: row.budget_categories,
    decorStyle: row.decor_style,
    tasteIntensity: row.taste_intensity,
    barThemes: row.bar_themes,
    alcoholOptions: row.alcohol_options,
    barPriceRange: row.bar_price_range,
    vibeDescriptor: row.vibe_descriptor,
    maxConcurrentEvents: row.capacity,
    seatingCapacity: row.seating_capacity,
    operatingHours: row.operating_hours,
    latitude: row.latitude,
    longitude: row.longitude,
    districtId: row.district_id,
    clusterId: row.cluster_id,
    notes: row.notes,
    priceNote: row.price_note,
    coverImageUrl: row.cover_image_url,
    galleryImages: row.gallery_images,
    partnerStatus: row.partner_status,
    partnerSince: row.partner_since,
    onboardingStatus: row.onboarding_status,
    partnerCompanyName: row.partner_company_name,
    businessLicenseNo: row.business_license_no,
    partnerEmail: row.partner_email,
    bankAccountInfo: row.bank_account_info,
    contractStartDate: row.contract_start_date,
    contractEndDate: row.contract_end_date,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    bookingCount: row.booking_count !== undefined ? Number(row.booking_count) : undefined,
    totalCommission: row.total_commission !== undefined ? Number(row.total_commission) : undefined,
  };
}

export interface VenuesRepository {
  getAllVenues(): Promise<any[]>;
  getVenue(id: string): Promise<any>;
  getVenueByName(name: string): Promise<any>;
  getActiveVenueDistricts(venueType?: string): Promise<{ clusterId: string; districtId: string; count: number }[]>;
  createVenue(data: any): Promise<any>;
  updateVenue(id: string, updates: any): Promise<any>;
  deleteVenue(id: string): Promise<void>;
  getVenueDeals(venueId: string): Promise<any[]>;
  getActiveVenueDeals(venueId: string): Promise<any[]>;
  createVenueDeal(data: any): Promise<any>;
  updateVenueDeal(id: string, updates: any): Promise<any>;
  deleteVenueDeal(id: string): Promise<void>;
  incrementVenueDealUsage(id: string): Promise<void>;
  checkVenueAvailability(venueId: string, bookingDate: Date, bookingTime: string): Promise<boolean>;
  createVenueBooking(data: {
    venueId: string;
    eventId: string;
    bookingDate: Date;
    bookingTime: string;
    participantCount: number;
    estimatedRevenue?: number;
  }): Promise<any>;
  getVenueBookings(venueId: string): Promise<any[]>;
  getEventVenueBooking(eventId: string): Promise<any | undefined>;
  cancelVenueBooking(bookingId: string): Promise<any>;
  updateVenueBookingRevenue(bookingId: string, actualRevenue: number): Promise<any>;
  migrateVenueBooking(bookingId: string, newVenueId: string, reason?: string): Promise<any>;
  getActiveBookingsForVenue(venueId: string): Promise<any[]>;
  getAllVenueTimeSlotsWithVenue(): Promise<Array<VenueTimeSlot & { venueName: string; venueCity: string; venueDistrict: string }>>;
  getVenueTimeSlots(venueId: string): Promise<VenueTimeSlot[]>;
  createVenueTimeSlot(data: InsertVenueTimeSlot): Promise<VenueTimeSlot>;
  batchCreateVenueTimeSlots(venueId: string, slots: Array<Omit<InsertVenueTimeSlot, 'venueId'>>): Promise<VenueTimeSlot[]>;
  updateVenueTimeSlot(id: string, updates: Partial<VenueTimeSlot>): Promise<VenueTimeSlot>;
  deleteVenueTimeSlot(id: string): Promise<void>;
  getAvailableVenuesForDateTime(city: string, district: string | undefined, date: string, startTime?: string, endTime?: string): Promise<Array<{ venue: any; availableSlots: VenueTimeSlot[] }>>;
}

export const venuesRepo: VenuesRepository = {
  async getAllVenues(): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT v.*,
        COALESCE(COUNT(DISTINCT vb.id), 0)::text as booking_count,
        COALESCE(SUM(vb.commission_amount), 0)::text as total_commission
      FROM venues v
      LEFT JOIN venue_bookings vb ON v.id = vb.venue_id AND vb.status = 'completed'
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);
    return result.rows.map(mapVenueRowToCamelCase);
  },

  async getVenue(id: string): Promise<any> {
    const result = await db.execute(sql`SELECT * FROM venues WHERE id = ${id}`);
    return mapVenueRowToCamelCase(result.rows[0]);
  },

  async getVenueByName(name: string): Promise<any> {
    const result = await db.execute(sql`
      SELECT * FROM venues 
      WHERE name = ${name} AND is_active = true 
      LIMIT 1
    `);
    return mapVenueRowToCamelCase(result.rows[0]);
  },

  async getActiveVenueDistricts(venueType?: string): Promise<{ clusterId: string; districtId: string; count: number }[]> {
    // 获取有激活场地的商圈列表，按活动类型过滤（饭局->restaurant, 酒局->bar）
    const typeFilter = venueType === '饭局' ? 'restaurant' : venueType === '酒局' ? 'bar' : null;
    
    // 根据 area 推断 clusterId: 南山区->nanshan, 福田区->futian
    const result = await db.execute(sql`
      SELECT 
        CASE 
          WHEN area = '南山区' THEN 'nanshan'
          WHEN area = '福田区' THEN 'futian'
          ELSE 'nanshan'
        END as cluster_id,
        COALESCE(district_id, 'keji') as district_id,
        COUNT(*)::int as count
      FROM venues 
      WHERE is_active = true
        AND district_id IS NOT NULL
        ${typeFilter ? sql`AND venue_type = ${typeFilter}` : sql``}
      GROUP BY area, district_id
      ORDER BY count DESC
    `);
    
    return result.rows.map((row: any) => ({
      clusterId: row.cluster_id as string,
      districtId: row.district_id as string,
      count: Number(row.count)
    }));
  },

  async createVenue(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO venues (
        name, brand_name, venue_type, address, city, area,
        district_id, cluster_id,
        contact_person, contact_phone, commission_rate, tags, cuisines, 
        price_range, budget_categories, decor_style, taste_intensity, capacity, seating_capacity,
        is_active, notes, bar_themes, alcohol_options, vibe_descriptor,
        latitude, longitude, partner_status,
        onboarding_status, partner_company_name, business_license_no, partner_email,
        bank_account_info, contract_start_date, contract_end_date
      )
      VALUES (
        ${data.name}, ${data.brandName || null}, ${data.type}, ${data.address}, ${data.city}, ${data.district},
        ${data.districtId || null}, ${data.clusterId || null},
        ${data.contactName || null}, ${data.contactPhone || null}, ${data.commissionRate || 20},
        ${data.tags || []}, ${data.cuisines || []}, ${data.priceRange || null},
        ${data.budgetCategories || []}, ${data.decorStyle || []}, ${data.tasteIntensity || []}, ${data.maxConcurrentEvents || 1}, ${data.seatingCapacity || 1},
        ${data.isActive !== false}, ${data.notes || null},
        ${data.barThemes || []}, ${data.alcoholOptions || []}, ${data.vibeDescriptor || null},
        ${data.latitude || null}, ${data.longitude || null}, ${data.partnerStatus || 'active'},
        ${data.onboardingStatus || 'draft'}, ${data.partnerCompanyName || null}, ${data.businessLicenseNo || null},
        ${data.partnerEmail || null}, ${data.bankAccountInfo || null},
        ${data.contractStartDate || null}, ${data.contractEndDate || null}
      )
      RETURNING *
    `);
    return mapVenueRowToCamelCase(result.rows[0]);
  },

  async updateVenue(id: string, updates: any): Promise<any> {
    const setClauses = [];
    const values: any[] = [];
    
    if (updates.name !== undefined) {
      setClauses.push(`name = $${values.length + 1}`);
      values.push(updates.name);
    }
    if (updates.brandName !== undefined) {
      setClauses.push(`brand_name = $${values.length + 1}`);
      values.push(updates.brandName);
    }
    if (updates.type !== undefined) {
      setClauses.push(`venue_type = $${values.length + 1}`);
      values.push(updates.type);
    }
    if (updates.address !== undefined) {
      setClauses.push(`address = $${values.length + 1}`);
      values.push(updates.address);
    }
    if (updates.city !== undefined) {
      setClauses.push(`city = $${values.length + 1}`);
      values.push(updates.city);
    }
    if (updates.district !== undefined) {
      setClauses.push(`area = $${values.length + 1}`);
      values.push(updates.district);
    }
    if (updates.contactName !== undefined) {
      setClauses.push(`contact_person = $${values.length + 1}`);
      values.push(updates.contactName);
    }
    if (updates.contactPhone !== undefined) {
      setClauses.push(`contact_phone = $${values.length + 1}`);
      values.push(updates.contactPhone);
    }
    if (updates.commissionRate !== undefined) {
      setClauses.push(`commission_rate = $${values.length + 1}`);
      values.push(updates.commissionRate);
    }
    if (updates.tags !== undefined) {
      setClauses.push(`tags = $${values.length + 1}`);
      values.push(updates.tags);
    }
    if (updates.cuisines !== undefined) {
      setClauses.push(`cuisines = $${values.length + 1}`);
      values.push(updates.cuisines);
    }
    if (updates.priceRange !== undefined) {
      setClauses.push(`price_range = $${values.length + 1}`);
      values.push(updates.priceRange);
    }
    if (updates.budgetCategories !== undefined) {
      setClauses.push(`budget_categories = $${values.length + 1}`);
      values.push(updates.budgetCategories);
    }
    if (updates.maxConcurrentEvents !== undefined) {
      setClauses.push(`capacity = $${values.length + 1}`);
      values.push(updates.maxConcurrentEvents);
    }
    if (updates.seatingCapacity !== undefined) {
      setClauses.push(`seating_capacity = $${values.length + 1}`);
      values.push(updates.seatingCapacity);
    }
    if (updates.isActive !== undefined) {
      setClauses.push(`is_active = $${values.length + 1}`);
      values.push(updates.isActive);
    }
    if (updates.notes !== undefined) {
      setClauses.push(`notes = $${values.length + 1}`);
      values.push(updates.notes);
    }
    if (updates.clusterId !== undefined) {
      setClauses.push(`cluster_id = $${values.length + 1}`);
      values.push(updates.clusterId);
    }
    if (updates.districtId !== undefined) {
      setClauses.push(`district_id = $${values.length + 1}`);
      values.push(updates.districtId);
    }
    if (updates.decorStyle !== undefined) {
      setClauses.push(`decor_style = $${values.length + 1}`);
      values.push(updates.decorStyle);
    }
    if (updates.tasteIntensity !== undefined) {
      setClauses.push(`taste_intensity = $${values.length + 1}`);
      values.push(updates.tasteIntensity);
    }
    if (updates.barThemes !== undefined) {
      setClauses.push(`bar_themes = $${values.length + 1}`);
      values.push(updates.barThemes);
    }
    if (updates.alcoholOptions !== undefined) {
      setClauses.push(`alcohol_options = $${values.length + 1}`);
      values.push(updates.alcoholOptions);
    }
    if (updates.vibeDescriptor !== undefined) {
      setClauses.push(`vibe_descriptor = $${values.length + 1}`);
      values.push(updates.vibeDescriptor);
    }
    // 新增字段：合作场地优惠系统
    if (updates.avgPrice !== undefined) {
      setClauses.push(`avg_price = $${values.length + 1}`);
      values.push(updates.avgPrice);
    }
    if (updates.priceNote !== undefined) {
      setClauses.push(`price_note = $${values.length + 1}`);
      values.push(updates.priceNote);
    }
    if (updates.coverImageUrl !== undefined) {
      setClauses.push(`cover_image_url = $${values.length + 1}`);
      values.push(updates.coverImageUrl);
    }
    if (updates.galleryImages !== undefined) {
      setClauses.push(`gallery_images = $${values.length + 1}`);
      values.push(updates.galleryImages);
    }
    if (updates.partnerStatus !== undefined) {
      setClauses.push(`partner_status = $${values.length + 1}`);
      values.push(updates.partnerStatus);
    }
    if (updates.partnerSince !== undefined) {
      setClauses.push(`partner_since = $${values.length + 1}`);
      values.push(updates.partnerSince);
    }
    if (updates.onboardingStatus !== undefined) {
      setClauses.push(`onboarding_status = $${values.length + 1}`);
      values.push(updates.onboardingStatus);
    }
    if (updates.partnerCompanyName !== undefined) {
      setClauses.push(`partner_company_name = $${values.length + 1}`);
      values.push(updates.partnerCompanyName);
    }
    if (updates.businessLicenseNo !== undefined) {
      setClauses.push(`business_license_no = $${values.length + 1}`);
      values.push(updates.businessLicenseNo);
    }
    if (updates.partnerEmail !== undefined) {
      setClauses.push(`partner_email = $${values.length + 1}`);
      values.push(updates.partnerEmail);
    }
    if (updates.bankAccountInfo !== undefined) {
      setClauses.push(`bank_account_info = $${values.length + 1}`);
      values.push(updates.bankAccountInfo);
    }
    if (updates.contractStartDate !== undefined) {
      setClauses.push(`contract_start_date = $${values.length + 1}`);
      values.push(updates.contractStartDate);
    }
    if (updates.contractEndDate !== undefined) {
      setClauses.push(`contract_end_date = $${values.length + 1}`);
      values.push(updates.contractEndDate);
    }
    if (updates.latitude !== undefined) {
      setClauses.push(`latitude = $${values.length + 1}`);
      values.push(updates.latitude);
    }
    if (updates.longitude !== undefined) {
      setClauses.push(`longitude = $${values.length + 1}`);
      values.push(updates.longitude);
    }

    if (setClauses.length === 0) {
      return this.getVenue(id);
    }

    values.push(id);
    // SECURITY: setClauses contains only hardcoded column names. Never make them dynamic.
    const query = sql.raw(`UPDATE venues SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`);
    const result = await db.execute(query);
    return mapVenueRowToCamelCase(result.rows[0]);
  },

  async deleteVenue(id: string): Promise<void> {
    await db.execute(sql`DELETE FROM venues WHERE id = ${id}`);
  },

  async getVenueDeals(venueId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT * FROM venue_deals 
      WHERE venue_id = ${venueId}
      ORDER BY created_at DESC
    `);
    return result.rows;
  },

  async getActiveVenueDeals(venueId: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await db.execute(sql`
      SELECT * FROM venue_deals 
      WHERE venue_id = ${venueId}
        AND is_active = true
        AND (valid_from IS NULL OR valid_from <= ${today}::date)
        AND (valid_until IS NULL OR valid_until >= ${today}::date)
      ORDER BY created_at DESC
    `);
    return result.rows;
  },

  async createVenueDeal(data: any): Promise<any> {
    const result = await db.execute(sql`
      INSERT INTO venue_deals (
        venue_id, title, discount_type, discount_value, description,
        redemption_method, redemption_code, min_spend, max_discount,
        per_person_limit, valid_from, valid_until, terms, excluded_dates, is_active
      ) VALUES (
        ${data.venueId}, ${data.title}, ${data.discountType}, ${data.discountValue || null},
        ${data.description || null}, ${data.redemptionMethod || 'show_page'},
        ${data.redemptionCode || null}, ${data.minSpend || null}, ${data.maxDiscount || null},
        ${data.perPersonLimit || false}, ${data.validFrom || null}, ${data.validUntil || null},
        ${data.terms || null}, ${data.excludedDates || null}, ${data.isActive !== false}
      ) RETURNING *
    `);
    return result.rows[0];
  },

  async updateVenueDeal(id: string, updates: any): Promise<any> {
    const setData: any = {};
    if (updates.title !== undefined) setData.title = updates.title;
    if (updates.discountType !== undefined) setData.discountType = updates.discountType;
    if (updates.discountValue !== undefined) setData.discountValue = updates.discountValue;
    if (updates.description !== undefined) setData.description = updates.description;
    if (updates.redemptionMethod !== undefined) setData.redemptionMethod = updates.redemptionMethod;
    if (updates.redemptionCode !== undefined) setData.redemptionCode = updates.redemptionCode;
    if (updates.minSpend !== undefined) setData.minSpend = updates.minSpend;
    if (updates.maxDiscount !== undefined) setData.maxDiscount = updates.maxDiscount;
    if (updates.perPersonLimit !== undefined) setData.perPersonLimit = updates.perPersonLimit;
    if (updates.validFrom !== undefined) setData.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) setData.validUntil = updates.validUntil;
    if (updates.terms !== undefined) setData.terms = updates.terms;
    if (updates.excludedDates !== undefined) setData.excludedDates = updates.excludedDates;
    if (updates.isActive !== undefined) setData.isActive = updates.isActive;

    if (Object.keys(setData).length === 0) {
      const result = await db.execute(sql`SELECT * FROM venue_deals WHERE id = ${id}`);
      return result.rows[0];
    }

    setData.updatedAt = new Date();

    const [result] = await db.update(venueDeals)
      .set(setData)
      .where(eq(venueDeals.id, id))
      .returning();
    return result;
  },

  async deleteVenueDeal(id: string): Promise<void> {
    await db.execute(sql`DELETE FROM venue_deals WHERE id = ${id}`);
  },

  async incrementVenueDealUsage(id: string): Promise<void> {
    await db.execute(sql`
      UPDATE venue_deals SET usage_count = usage_count + 1, updated_at = NOW()
      WHERE id = ${id}
    `);
  },

  async checkVenueAvailability(venueId: string, bookingDate: Date, bookingTime: string): Promise<boolean> {
    const dateStr = bookingDate.toISOString().split('T')[0];
    
    const result = await db.execute(sql`
      SELECT v.max_concurrent_events,
        COALESCE(COUNT(vb.id), 0)::integer as current_bookings
      FROM venues v
      LEFT JOIN venue_bookings vb ON v.id = vb.venue_id
        AND DATE(vb.booking_date) = ${dateStr}::date
        AND vb.booking_time = ${bookingTime}
        AND vb.status IN ('confirmed', 'completed')
      WHERE v.id = ${venueId}
      GROUP BY v.id, v.max_concurrent_events
    `);

    if (result.rows.length === 0) {
      return false;
    }

    const venue = result.rows[0] as { max_concurrent_events: number; current_bookings: number };
    return venue.current_bookings < venue.max_concurrent_events;
  },

  async createVenueBooking(data: {
    venueId: string;
    eventId: string;
    bookingDate: Date;
    bookingTime: string;
    participantCount: number;
    estimatedRevenue?: number;
  }): Promise<any> {
    const dateStr = data.bookingDate.toISOString().split('T')[0];
    
    const result = await db.execute(sql`
      WITH venue_check AS (
        SELECT v.id, v.max_concurrent_events,
          COALESCE(COUNT(vb.id), 0)::integer as current_bookings
        FROM venues v
        LEFT JOIN venue_bookings vb ON v.id = vb.venue_id
          AND DATE(vb.booking_date) = ${dateStr}::date
          AND vb.booking_time = ${data.bookingTime}
          AND vb.status IN ('confirmed', 'completed')
        WHERE v.id = ${data.venueId}
        GROUP BY v.id, v.max_concurrent_events
        FOR UPDATE
      )
      INSERT INTO venue_bookings (
        venue_id, event_id, booking_date, booking_time,
        participant_count, estimated_revenue, status
      )
      SELECT 
        ${data.venueId}, ${data.eventId}, ${dateStr}::timestamp, ${data.bookingTime},
        ${data.participantCount}, ${data.estimatedRevenue || null}, 'confirmed'
      FROM venue_check
      WHERE current_bookings < max_concurrent_events
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new Error('Venue is not available at the requested time');
    }

    return result.rows[0];
  },

  async getVenueBookings(venueId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT vb.*, e.event_type, e.city, e.area
      FROM venue_bookings vb
      LEFT JOIN blind_box_events e ON vb.event_id = e.id
      WHERE vb.venue_id = ${venueId}
      ORDER BY vb.booking_date DESC, vb.booking_time DESC
    `);
    return result.rows;
  },

  async getEventVenueBooking(eventId: string): Promise<any | undefined> {
    const result = await db.execute(sql`
      SELECT vb.*, COALESCE(v.brand_name, v.name) as venue_name, v.address, v.city, v.district
      FROM venue_bookings vb
      LEFT JOIN venues v ON vb.venue_id = v.id
      WHERE vb.event_id = ${eventId}
      ORDER BY vb.created_at DESC
      LIMIT 1
    `);
    return result.rows[0];
  },

  async cancelVenueBooking(bookingId: string): Promise<any> {
    const result = await db.execute(sql`
      UPDATE venue_bookings
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${bookingId}
      RETURNING *
    `);
    return result.rows[0];
  },

  async updateVenueBookingRevenue(bookingId: string, actualRevenue: number): Promise<any> {
    const result = await db.execute(sql`
      UPDATE venue_bookings vb
      SET 
        actual_revenue = ${actualRevenue},
        commission_amount = (
          SELECT ROUND(${actualRevenue} * v.commission_rate / 100.0)
          FROM venues v
          WHERE v.id = vb.venue_id
        ),
        status = 'completed',
        updated_at = NOW()
      WHERE vb.id = ${bookingId}
      RETURNING *
    `);
    return result.rows[0];
  },

  async migrateVenueBooking(bookingId: string, newVenueId: string, reason?: string): Promise<any> {
    const existingBooking = await db.execute(sql`
      SELECT * FROM venue_bookings WHERE id = ${bookingId}
    `);
    
    if (existingBooking.rows.length === 0) {
      throw new Error('Booking not found');
    }
    
    const booking = existingBooking.rows[0];
    
    const newVenue = await this.getVenue(newVenueId);
    if (!newVenue) {
      throw new Error('New venue not found');
    }
    
    const isAvailable = await this.checkVenueAvailability(
      newVenueId, 
      new Date(booking.booking_date as string), 
      booking.booking_time as string
    );
    
    if (!isAvailable) {
      throw new Error('New venue is not available at the requested time');
    }
    
    const result = await db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
      await tx.update(venueBookings)
        .set({ status: 'migrated', updatedAt: new Date() })
        .where(eq(venueBookings.id, bookingId));

      const [newBookingRow] = await tx.insert(venueBookings)
        .values({
          venueId: newVenueId,
          eventId: booking.event_id as string,
          bookingDate: new Date(booking.booking_date as string),
          bookingTime: booking.booking_time as string,
          participantCount: Number(booking.participant_count),
          estimatedRevenue: booking.estimated_revenue ? Number(booking.estimated_revenue) : null,
          status: 'confirmed',
        })
        .returning();

      return {
        oldBooking: { ...booking, status: 'migrated' },
        newBooking: newBookingRow,
        newVenue
      };
    });

    logger.info(`[VenueMigration] Booking ${bookingId} migrated from venue to ${newVenueId}. Reason: ${reason || 'N/A'}`);

    return result;
  },

  async getActiveBookingsForVenue(venueId: string): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT vb.*, e.title as event_title, e.event_date, e.event_time
      FROM venue_bookings vb
      LEFT JOIN blind_box_events e ON vb.event_id = e.id
      WHERE vb.venue_id = ${venueId}
        AND vb.status IN ('confirmed', 'pending')
        AND vb.booking_date >= CURRENT_DATE
      ORDER BY vb.booking_date ASC, vb.booking_time ASC
    `);
    return result.rows;
  },

  async getAllVenueTimeSlotsWithVenue(): Promise<Array<VenueTimeSlot & { venueName: string; venueCity: string; venueDistrict: string }>> {
    const result = await db.execute(sql`
      SELECT 
        vts.*,
        COALESCE(v.brand_name, v.name) as venue_name,
        v.city as venue_city,
        v.district as venue_district
      FROM venue_time_slots vts
      JOIN venues v ON v.id = vts.venue_id
      WHERE vts.is_active = true AND v.is_active = true
      ORDER BY vts.day_of_week NULLS LAST, vts.start_time
    `);
    
    return (result.rows as any[]).map((row: any) => ({
      id: row.id,
      venueId: row.venue_id,
      dayOfWeek: row.day_of_week,
      specificDate: row.specific_date,
      startTime: row.start_time,
      endTime: row.end_time,
      maxConcurrentEvents: row.max_concurrent_events,
      isActive: row.is_active,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      venueName: row.venue_name,
      venueCity: row.venue_city,
      venueDistrict: row.venue_district,
    }));
  },

  async getVenueTimeSlots(venueId: string): Promise<VenueTimeSlot[]> {
    return await db
      .select()
      .from(venueTimeSlots)
      .where(eq(venueTimeSlots.venueId, venueId))
      .orderBy(venueTimeSlots.dayOfWeek, venueTimeSlots.startTime);
  },

  async createVenueTimeSlot(data: InsertVenueTimeSlot): Promise<VenueTimeSlot> {
    const [slot] = await db
      .insert(venueTimeSlots)
      .values(data)
      .returning();
    return slot;
  },

  async batchCreateVenueTimeSlots(venueId: string, slots: Array<Omit<InsertVenueTimeSlot, 'venueId'>>): Promise<VenueTimeSlot[]> {
    if (slots.length === 0) return [];
    
    const slotsWithVenueId = slots.map((slot: any) => ({
      ...slot,
      venueId,
    }));

    const createdSlots = await db
      .insert(venueTimeSlots)
      .values(slotsWithVenueId)
      .returning();
    
    return createdSlots;
  },

  async updateVenueTimeSlot(id: string, updates: Partial<VenueTimeSlot>): Promise<VenueTimeSlot> {
    const [slot] = await db
      .update(venueTimeSlots)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(venueTimeSlots.id, id))
      .returning();
    return slot;
  },

  async deleteVenueTimeSlot(id: string): Promise<void> {
    await db.delete(venueTimeSlots).where(eq(venueTimeSlots.id, id));
  },

  async getAvailableVenuesForDateTime(
    city: string,
    district: string | undefined,
    date: string,
    startTime?: string,
    endTime?: string
  ): Promise<Array<{ venue: any; availableSlots: VenueTimeSlot[] }>> {
    const dayOfWeek = new Date(date).getDay();

    let venueQuery = db.select().from(venues).where(
      and(
        eq(venues.city, city),
        eq(venues.isActive, true),
        district ? eq(venues.area, district) : undefined
      )
    );

    const allVenues: Venue[] = await venueQuery;
    if (allVenues.length === 0) return [];

    const venueIds = allVenues.map((v: Venue) => v.id);

    // Batch load all time slots for all venues in one query
    const allSlots = await db
      .select()
      .from(venueTimeSlots)
      .where(
        and(
          inArray(venueTimeSlots.venueId, venueIds),
          eq(venueTimeSlots.isActive, true),
          or(
            eq(venueTimeSlots.dayOfWeek, dayOfWeek),
            eq(venueTimeSlots.specificDate, date)
          )
        )
      );

    // Batch load all bookings for the date in one query
    const allBookings = await db
      .select()
      .from(venueTimeSlotBookings)
      .where(
        and(
          eq(venueTimeSlotBookings.bookingDate, date),
          eq(venueTimeSlotBookings.status, "confirmed"),
          inArray(venueTimeSlotBookings.venueId, venueIds)
        )
      );

    const result: Array<{ venue: any; availableSlots: VenueTimeSlot[] }> = [];

    for (const venue of allVenues) {
      let slots = allSlots.filter((s: any) => s.venueId === venue.id);

      if (startTime && endTime) {
        slots = slots.filter((slot: any) => 
          slot.startTime <= startTime && slot.endTime >= endTime
        );
      }

      const bookings = allBookings.filter((b: any) => b.venueId === venue.id);

      const availableSlots = slots.filter((slot: any) => {
        const slotBookings = bookings.filter((b: any) => b.timeSlotId === slot.id);
        return slotBookings.length < (slot.maxConcurrentEvents || 1);
      });

      if (availableSlots.length > 0) {
        result.push({ venue, availableSlots });
      }
    }

    return result;
  }
};
