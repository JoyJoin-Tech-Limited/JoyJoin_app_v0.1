import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { venues, venueTimeSlots, venueTimeSlotBookings, eventPoolGroups, eventPools } from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { storage } from "../../storage";
import {
  checkVenueDataQuality,
  normalizeVenueQualityRecord,
} from "../../lib/venueDataQuality";
import { venueMatchingService } from "../../venueMatchingService";
import { requireAuth } from "../../middleware/auth";

function buildVenueAuditAfter(body: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!body) return {};
  const allowedKeys = [
    "name", "type", "city", "district", "clusterId", "districtId",
    "commissionRate", "tags", "cuisines", "priceRange", "budgetCategories", "maxConcurrentEvents", "seatingCapacity",
    "decorStyle", "tasteIntensity", "barThemes", "alcoholOptions", "vibeDescriptor", "isActive",
  ] as const;
  return Object.fromEntries(
    allowedKeys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]),
  );
}

const venueSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  address: z.string().min(1),
  city: z.string().min(1),
  district: z.string().min(1),
  clusterId: z.string().optional(),
  districtId: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  commissionRate: z.number().optional(),
  tags: z.array(z.string()).optional(),
  cuisines: z.array(z.string()).optional(),
  priceRange: z.string().optional(),
  budgetCategories: z.array(z.string()).optional(),
  maxConcurrentEvents: z.number().int().min(1).optional(),
  seatingCapacity: z.number().int().min(1).optional(),
  decorStyle: z.array(z.string()).optional(),
  tasteIntensity: z.array(z.string()).optional(),
  notes: z.string().optional(),
  barThemes: z.array(z.string()).optional(),
  alcoholOptions: z.array(z.string()).optional(),
  vibeDescriptor: z.string().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
  // Legacy backward-compat fields
  capacity: z.number().int().min(1).optional(),
  cuisineType: z.string().optional(),
  phone: z.string().optional(),
  description: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string()).optional(),
});

const venueDealSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  discountType: z.string().min(1),
  discountValue: z.number().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  usageLimit: z.number().int().optional(),
});

const venueTimeSlotSchema = z.object({
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  date: z.string().datetime(),
  isAvailable: z.boolean().default(true),
  price: z.number().optional(),
});

export function registerVenueRoutes(app: Express): void {
  // Venue Management - Get all venues
  app.get("/api/admin/venues", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const venues = (await storage.getAllVenues()).slice(0, limit);
      res.json(venues);
    } catch (error) {
      logger.error("Error fetching venues", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venues" });
    }
  });

  // Venue Data Quality — admin-facing summary of missing/invalid venue data.
  // Must be registered before /:id to avoid the segment matching "data-quality".
  app.get("/api/admin/venues/data-quality", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 500, 1000);
      const venues = (await storage.getAllVenues()).slice(0, limit);
      const report = checkVenueDataQuality(venues.map((venue) => normalizeVenueQualityRecord(venue)));
      res.json(report);
    } catch (error) {
      logger.error("Error running venue data quality check", { error: String(error) });
      res.status(500).json({ message: "Failed to run venue data quality check" });
    }
  });

  // Venue Management - Get venue details
  app.get("/api/admin/venues/:id", requireAdmin, async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.id);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      res.json(venue);
    } catch (error) {
      logger.error("Error fetching venue", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue" });
    }
  });

  // Venue Management - Create venue
  app.post("/api/admin/venues", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = venueSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid venue data", errors: parsed.error.issues });
      }
      const { 
        name, type, address, city, district, clusterId, districtId,
        contactName, contactPhone, commissionRate, tags, cuisines, 
        priceRange, budgetCategories, maxConcurrentEvents, seatingCapacity, notes, decorStyle, tasteIntensity,
        barThemes, alcoholOptions, vibeDescriptor,
        latitude, longitude
      } = req.body;
      
      if (!name || !type || !address || !city || !district) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const venue = await storage.createVenue({
        name,
        type,
        address,
        city,
        district,
        clusterId: clusterId || null,
        districtId: districtId || null,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        commissionRate: commissionRate || 20,
        tags: tags || [],
        cuisines: cuisines || [],
        priceRange: priceRange || null,
        budgetCategories: budgetCategories || [],
        seatingCapacity: seatingCapacity || 1,
        decorStyle: decorStyle || [],
        tasteIntensity: tasteIntensity || [],
        maxConcurrentEvents: maxConcurrentEvents || 1,
        isActive: true,
        notes: notes || null,
        barThemes: barThemes || [],
        alcoholOptions: alcoholOptions || [],
        vibeDescriptor: vibeDescriptor || null,
        latitude,
        longitude,
      });

      logAdminAudit({
        action: 'VENUE_CREATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: venue.id,
        context: { name: venue.name, city: venue.city, type: venue.type },
      });

      res.json(venue);
    } catch (error) {
      logger.error("Error creating venue", { error: String(error) });
      res.status(500).json({ message: "Failed to create venue" });
    }
  });

  // Venue Management - Update venue
  app.patch("/api/admin/venues/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = venueSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid venue data", errors: parsed.error.issues });
      }
      const venue = await storage.updateVenue(req.params.id, parsed.data);
      logAdminAudit({
        action: 'VENUE_UPDATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: req.params.id,
        after: buildVenueAuditAfter(parsed.data),
      });
      res.json(venue);
    } catch (error) {
      logger.error("Error updating venue", { venueId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update venue" });
    }
  });

  // Venue Management - Delete venue
  app.delete("/api/admin/venues/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenue(req.params.id);
      logAdminAudit({
        action: 'VENUE_DELETED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'venue',
        targetEntityId: req.params.id,
      });
      res.json({ message: "Venue deleted successfully" });
    } catch (error) {
      logger.error("Error deleting venue", { venueId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to delete venue" });
    }
  });

  // ============ VENUE DEALS API (场地优惠) ============
  
  // Get all deals for a venue (admin)
  app.get("/api/admin/venues/:venueId/deals", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const deals = (await storage.getVenueDeals(req.params.venueId)).slice(0, limit);
      res.json(deals);
    } catch (error) {
      logger.error("Error fetching venue deals", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Get active deals for a venue (public - for event detail page)
  app.get("/api/venues/:venueId/deals", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const deals = (await storage.getActiveVenueDeals(req.params.venueId)).slice(0, limit);
      res.json(deals);
    } catch (error) {
      logger.error("Error fetching active venue deals", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Create venue deal (admin)
  app.post("/api/admin/venues/:venueId/deals", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const deal = await storage.createVenueDeal({
        ...req.body,
        venueId: req.params.venueId,
      });
      res.json(deal);
    } catch (error) {
      logger.error("Error creating venue deal", { error: String(error) });
      res.status(500).json({ message: "Failed to create venue deal" });
    }
  });

  // Update venue deal (admin)
  app.patch("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const deal = await storage.updateVenueDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error) {
      logger.error("Error updating venue deal", { error: String(error) });
      res.status(500).json({ message: "Failed to update venue deal" });
    }
  });

  // Delete venue deal (admin)
  app.delete("/api/admin/venue-deals/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenueDeal(req.params.id);
      res.json({ message: "Venue deal deleted successfully" });
    } catch (error) {
      logger.error("Error deleting venue deal", { error: String(error) });
      res.status(500).json({ message: "Failed to delete venue deal" });
    }
  });

  // Record deal usage (for analytics)
  app.post("/api/venue-deals/:id/use", requireAuth, async (req, res) => {
    try {
      await storage.incrementVenueDealUsage(req.params.id);
      res.json({ message: "Deal usage recorded" });
    } catch (error) {
      logger.error("Error recording deal usage", { error: String(error) });
      res.status(500).json({ message: "Failed to record deal usage" });
    }
  });

  // Get venue with deals (public - for event detail page)
  app.get("/api/venues/:venueId/with-deals", async (req, res) => {
    try {
      const venue = await storage.getVenue(req.params.venueId);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      const deals = await storage.getActiveVenueDeals(req.params.venueId);
      res.json({ venue, deals });
    } catch (error) {
      logger.error("Error fetching venue with deals", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue info" });
    }
  });

  // Get venue by restaurant name with deals (for blind box event detail page)
  app.get("/api/venues/by-name", async (req, res) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Restaurant name required" });
      }
      
      const venue = await storage.getVenueByName(name);
      if (!venue) {
        return res.json({ venue: null, deals: [] });
      }
      
      // Only return partner venues with active deals
      if (venue.partner_status !== 'active') {
        return res.json({ venue: null, deals: [] });
      }
      
      const deals = await storage.getActiveVenueDeals(venue.id);
      res.json({ venue, deals });
    } catch (error) {
      logger.error("Error fetching venue by name", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue info" });
    }
  });

  // Get active venue districts (public - for event join form)
  app.get("/api/venues/active-districts", async (req, res) => {
    try {
      const { eventType } = req.query;
      const districts = await storage.getActiveVenueDistricts(eventType as string | undefined);
      res.json(districts);
    } catch (error) {
      logger.error("Error fetching active venue districts", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch active districts" });
    }
  });

  // Venue Booking - Check availability
  app.post("/api/venues/check-availability", requireAuth, async (req, res) => {
    try {
      const { venueId, bookingDate, bookingTime } = req.body;
      
      if (!venueId || !bookingDate || !bookingTime) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const isAvailable = await storage.checkVenueAvailability(
        venueId,
        new Date(bookingDate),
        bookingTime
      );

      res.json({ available: isAvailable });
    } catch (error) {
      logger.error("Error checking venue availability", { error: String(error) });
      res.status(500).json({ message: "Failed to check venue availability" });
    }
  });

  // Venue Booking - Create booking
  app.post("/api/venues/book", requireAuth, async (req, res) => {
    try {
      const { venueId, eventId, bookingDate, bookingTime, participantCount, estimatedRevenue } = req.body;
      
      if (!venueId || !eventId || !bookingDate || !bookingTime || !participantCount) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const booking = await storage.createVenueBooking({
        venueId,
        eventId,
        bookingDate: new Date(bookingDate),
        bookingTime,
        participantCount,
        estimatedRevenue,
      });

      res.json(booking);
    } catch (error: any) {
      logger.error("Error creating venue booking", { error: String(error) });
      if (error.message === 'Venue is not available at the requested time') {
        res.status(409).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Failed to create venue booking" });
      }
    }
  });

  // Venue Booking - Get bookings for a venue
  app.get("/api/admin/venues/:venueId/bookings", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const bookings = (await storage.getVenueBookings(req.params.venueId)).slice(0, limit);
      res.json(bookings);
    } catch (error) {
      logger.error("Error fetching venue bookings", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue bookings" });
    }
  });

  // Venue Booking - Get booking for an event
  app.get("/api/events/:eventId/venue-booking", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getEventVenueBooking(req.params.eventId);
      res.json(booking || null);
    } catch (error) {
      logger.error("Error fetching event venue booking", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch event venue booking" });
    }
  });

  // Venue Booking - Cancel booking
  app.post("/api/venues/bookings/:bookingId/cancel", requireAuth, async (req, res) => {
    try {
      const booking = await storage.cancelVenueBooking(req.params.bookingId);
      res.json(booking);
    } catch (error) {
      logger.error("Error cancelling venue booking", { error: String(error) });
      res.status(500).json({ message: "Failed to cancel venue booking" });
    }
  });

  // Venue Booking - Update revenue (Admin only)
  app.patch("/api/admin/venues/bookings/:bookingId/revenue", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { actualRevenue } = req.body;
      
      if (actualRevenue === undefined) {
        return res.status(400).json({ message: "Missing actualRevenue" });
      }

      const booking = await storage.updateVenueBookingRevenue(req.params.bookingId, actualRevenue);
      res.json(booking);
    } catch (error) {
      logger.error("Error updating venue booking revenue", { error: String(error) });
      res.status(500).json({ message: "Failed to update venue booking revenue" });
    }
  });

  // ============ Emergency Venue Migration ============
  
  // Get active bookings for a venue (for migration planning)
  app.get("/api/admin/venues/:venueId/active-bookings", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const bookings = (await storage.getActiveBookingsForVenue(req.params.venueId)).slice(0, limit);
      res.json(bookings);
    } catch (error) {
      logger.error("Error fetching active venue bookings", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch active venue bookings" });
    }
  });

  // Migrate a booking to a new venue
  app.post("/api/admin/venues/bookings/:bookingId/migrate", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { newVenueId, reason } = req.body;
      
      if (!newVenueId) {
        return res.status(400).json({ message: "newVenueId is required" });
      }

      const result = await storage.migrateVenueBooking(req.params.bookingId, newVenueId, reason);
      res.json({
        success: true,
        message: "Booking migrated successfully",
        ...result
      });
    } catch (error: any) {
      logger.error("Error migrating venue booking", { error: String(error) });
      res.status(400).json({ message: error.message || "Failed to migrate venue booking" });
    }
  });

  // Find alternative venues for a booking
  app.get("/api/admin/venues/bookings/:bookingId/alternatives", requireAdmin, async (req, res) => {
    try {
      const booking = await db.execute(sql`
        SELECT vb.*, v.city, v.district, e.event_type
        FROM venue_bookings vb
        LEFT JOIN venues v ON vb.venue_id = v.id
        LEFT JOIN blind_box_events e ON vb.event_id = e.id
        WHERE vb.id = ${req.params.bookingId}
      `);
      
      if (booking.rows.length === 0) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      const bookingData = booking.rows[0] as Record<string, any>;
      
      const alternatives = await venueMatchingService.findMatchingVenues({
        eventType: String(bookingData.event_type || "dining"),
        participantCount: Number(bookingData.participant_count) || 8,
        preferredCity: String(bookingData.city || ""),
        preferredDistrict: String(bookingData.district || ""),
        dateTime: new Date(bookingData.booking_date),
        durationHours: 3
      });
      
      const filteredAlternatives = alternatives.filter(a => a.venue.id !== bookingData.venue_id);
      
      res.json(filteredAlternatives);
    } catch (error) {
      logger.error("Error finding alternative venues", { error: String(error) });
      res.status(500).json({ message: "Failed to find alternative venues" });
    }
  });

  // ============ Venue Time Slots Management ============
  
  // Get all time slots across all venues (for calendar overview)
  app.get("/api/admin/time-slots/all", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const timeSlots = (await storage.getAllVenueTimeSlotsWithVenue()).slice(0, limit);
      res.json(timeSlots);
    } catch (error) {
      logger.error("Error fetching all venue time slots", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch all venue time slots" });
    }
  });
  
  // Get all time slots for a venue
  app.get("/api/admin/venues/:venueId/time-slots", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const timeSlots = (await storage.getVenueTimeSlots(req.params.venueId)).slice(0, limit);
      res.json(timeSlots);
    } catch (error) {
      logger.error("Error fetching venue time slots", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch venue time slots" });
    }
  });

  // Create a time slot for a venue
  app.post("/api/admin/venues/:venueId/time-slots", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { dayOfWeek, specificDate, startTime, endTime, maxConcurrentEvents, notes } = req.body;
      
      if (!startTime || !endTime) {
        return res.status(400).json({ message: "Start time and end time are required" });
      }
      
      if (dayOfWeek === undefined && !specificDate) {
        return res.status(400).json({ message: "Either dayOfWeek or specificDate is required" });
      }

      const timeSlot = await storage.createVenueTimeSlot({
        venueId: req.params.venueId,
        dayOfWeek: dayOfWeek !== undefined ? dayOfWeek : null,
        specificDate: specificDate || null,
        startTime,
        endTime,
        maxConcurrentEvents: maxConcurrentEvents || 1,
        notes: notes || null,
        isActive: true,
      });

      res.json(timeSlot);
    } catch (error) {
      logger.error("Error creating venue time slot", { error: String(error) });
      res.status(500).json({ message: "Failed to create venue time slot" });
    }
  });

  // Batch create time slots (for weekly recurring)
  app.post("/api/admin/venues/:venueId/time-slots/batch", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const { timeSlots } = req.body;
      
      if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
        return res.status(400).json({ message: "timeSlots array is required" });
      }

      const createdSlots = await storage.batchCreateVenueTimeSlots(
        req.params.venueId,
        timeSlots
      );

      res.json(createdSlots);
    } catch (error) {
      logger.error("Error batch creating venue time slots", { error: String(error) });
      res.status(500).json({ message: "Failed to batch create venue time slots" });
    }
  });

  // Update a time slot
  app.patch("/api/admin/time-slots/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const timeSlot = await storage.updateVenueTimeSlot(req.params.id, req.body);
      res.json(timeSlot);
    } catch (error) {
      logger.error("Error updating venue time slot", { error: String(error) });
      res.status(500).json({ message: "Failed to update venue time slot" });
    }
  });

  // Delete a time slot
  app.delete("/api/admin/time-slots/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteVenueTimeSlot(req.params.id);
      res.json({ message: "Time slot deleted successfully" });
    } catch (error) {
      logger.error("Error deleting venue time slot", { error: String(error) });
      res.status(500).json({ message: "Failed to delete venue time slot" });
    }
  });

  // Get available venues for a specific date/time (for event pool creation)
  app.get("/api/admin/available-venues", requireAdmin, async (req, res) => {
    try {
      const { city, district, date, startTime, endTime } = req.query;
      
      if (!city || !date) {
        return res.status(400).json({ message: "City and date are required" });
      }

      const availableVenues = await storage.getAvailableVenuesForDateTime(
        city as string,
        district as string | undefined,
        date as string,
        startTime as string | undefined,
        endTime as string | undefined
      );

      res.json(availableVenues);
    } catch (error) {
      logger.error("Error fetching available venues", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch available venues" });
    }
  });

  // Smart venue filter API - with budget and cuisine filtering
  app.get("/api/admin/smart-venues", requireAdmin, async (req, res) => {
    try {
      const { 
        city, 
        district, 
        eventType, 
        budgetRestrictions 
      } = req.query;
      
      if (!city || !eventType) {
        return res.status(400).json({ message: "缺少必要参数: city and eventType required" });
      }
      
      // Parse and validate budget restrictions
      let budgets: string[] = [];
      if (budgetRestrictions) {
        try {
          const parsed = JSON.parse(budgetRestrictions as string);
          if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string")) {
            return res.status(400).json({ message: "无效的 budgetRestrictions 参数，必须是字符串数组的 JSON" });
          }
          budgets = parsed;
        } catch {
          return res.status(400).json({ message: "无法解析 budgetRestrictions 参数，必须是有效的 JSON" });
        }
      }
      
      // Determine allowed venue types based on event type
      const allowedVenueTypes = eventType === "酒局"
        ? ["bar", "homebar"]
        : ["restaurant", "cafe"];
      
      // Build base query with venue type filter
      let whereConditions = and(
        eq(venues.city, city as string),
        eq(venues.isActive, true),
        inArray(venues.venueType, allowedVenueTypes)
      );
      
      // Apply district filter if provided
      if (district) {
        whereConditions = and(
          whereConditions,
          eq(venues.area, district as string)
        );
      }
      
      // Apply budget filter using SQL array overlap if restrictions provided
      if (budgets.length > 0) {
        whereConditions = and(
          whereConditions,
          sql`${venues.budgetCategories} && ${budgets}::text[]`
        );
      }
      
      const filteredVenues = await db
        .select()
        .from(venues)
        .where(whereConditions)
        .limit(1000);
      
      // Batch check which venues have time slots configured
      let venuesWithSlots;
      if (filteredVenues.length === 0) {
        venuesWithSlots = [];
      } else {
        // Single query to fetch all venueIds that have at least one active time slot
        const activeSlots = await db
          .select({ venueId: venueTimeSlots.venueId })
          .from(venueTimeSlots)
          .where(eq(venueTimeSlots.isActive, true))
          .limit(1000);

        const venuesWithActiveSlots = new Set(
          activeSlots.map((slot: { venueId: string | null }) => slot.venueId)
        );

        venuesWithSlots = filteredVenues.map((venue: typeof venues.$inferSelect) => ({
          ...venue,
          hasTimeSlots: venuesWithActiveSlots.has(venue.id),
        }));
      }
      
      res.json(venuesWithSlots);
    } catch (error) {
      logger.error("Smart venue filter error", { error: String(error) });
      res.status(500).json({ message: "查询失败" });
    }
  });

  // Venue Assignment Ops — list all unassigned groups across active pools
  app.get("/api/admin/venue-assignment/unassigned", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      
      const unassignedGroups = await db
        .select({
          groupId: eventPoolGroups.id,
          groupNumber: eventPoolGroups.groupNumber,
          poolId: eventPoolGroups.poolId,
          poolTitle: eventPools.title,
          poolDateTime: eventPools.dateTime,
          poolCity: eventPools.city,
          poolDistrict: eventPools.district,
          memberCount: eventPoolGroups.memberCount,
          venueAssignmentStatus: eventPoolGroups.venueAssignmentStatus,
          venueAssignmentReason: eventPoolGroups.venueAssignmentReason,
          createdAt: eventPoolGroups.createdAt,
        })
        .from(eventPoolGroups)
        .innerJoin(eventPools, eq(eventPoolGroups.poolId, eventPools.id))
        .where(eq(eventPoolGroups.venueAssignmentStatus, 'unassigned'))
        .orderBy(desc(eventPoolGroups.createdAt))
        .limit(limit);
      
      res.json(unassignedGroups);
    } catch (error) {
      logger.error("Error fetching unassigned groups", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch unassigned groups" });
    }
  });

  const venueMigrateSchema = z.object({
    newVenueId: z.string().min(1),
    reason: z.string().optional(),
  });

  // Venue Assignment Ops — migrate an auto-assigned group to a new venue
  app.post("/api/admin/venue-assignment/groups/:groupId/migrate", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = venueMigrateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid migrate data", errors: parsed.error.issues });
      }
      const { newVenueId, reason } = parsed.data;
      const groupId = req.params.groupId;
      
      if (!newVenueId) {
        return res.status(400).json({ message: "newVenueId is required" });
      }

      const group = await db.query.eventPoolGroups.findFirst({
        where: (groups: any, { eq }: any) => eq(groups.id, groupId),
      });
      
      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, group.poolId),
      });
      
      if (!pool) {
        return res.status(404).json({ message: "Pool not found" });
      }

      const newVenue = await storage.getVenue(newVenueId);
      if (!newVenue) {
        return res.status(404).json({ message: "New venue not found" });
      }

      // Find existing time slot booking for this group
      const existingBooking = await db
        .select()
        .from(venueTimeSlotBookings)
        .where(and(
          eq(venueTimeSlotBookings.eventGroupId, groupId),
          eq(venueTimeSlotBookings.status, 'confirmed')
        ));

      // Find matching time slot for new venue at event datetime
      const eventDateTime = pool.dateTime;
      const dayOfWeek = eventDateTime.getDay();
      const timeStr = eventDateTime.toTimeString().substring(0, 5);
      const year = eventDateTime.getFullYear();
      const month = String(eventDateTime.getMonth() + 1).padStart(2, '0');
      const day = String(eventDateTime.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const weeklySlots = await db
        .select()
        .from(venueTimeSlots)
        .where(and(
          eq(venueTimeSlots.venueId, newVenueId),
          eq(venueTimeSlots.dayOfWeek, dayOfWeek),
          eq(venueTimeSlots.isActive, true),
          sql`${venueTimeSlots.startTime} <= ${timeStr}`,
          sql`${venueTimeSlots.endTime} >= ${timeStr}`
        ));

      const specificSlots = await db
        .select()
        .from(venueTimeSlots)
        .where(and(
          eq(venueTimeSlots.venueId, newVenueId),
          sql`${venueTimeSlots.specificDate} = ${dateStr}::date`,
          eq(venueTimeSlots.isActive, true),
          sql`${venueTimeSlots.startTime} <= ${timeStr}`,
          sql`${venueTimeSlots.endTime} >= ${timeStr}`
        ));

      const matchingSlot = weeklySlots[0] || specificSlots[0];
      
      if (!matchingSlot) {
        return res.status(400).json({ message: "New venue has no available time slot at the event time" });
      }

      // Execute migration atomically
      const result = await db.transaction(async (tx) => {
        // Cancel existing booking
        if (existingBooking.length > 0) {
          await tx
            .update(venueTimeSlotBookings)
            .set({ status: 'cancelled', updatedAt: new Date() })
            .where(eq(venueTimeSlotBookings.id, existingBooking[0].id));
        }

        // Create new booking
        const [newBooking] = await tx
          .insert(venueTimeSlotBookings)
          .values({
            venueId: newVenueId,
            timeSlotId: matchingSlot.id,
            eventPoolId: group.poolId,
            eventGroupId: groupId,
            bookingDate: dateStr,
            status: 'confirmed',
          })
          .returning();

        // Update group with new venue
        await tx
          .update(eventPoolGroups)
          .set({
            venueId: newVenueId,
            venueName: newVenue.name,
            venueAddress: newVenue.address,
            venueAssignmentStatus: 'manual_override',
            venueAssignmentReason: reason || 'admin_migrated',
          })
          .where(eq(eventPoolGroups.id, groupId));

        return { newBooking, cancelledBookingId: existingBooking[0]?.id || null };
      });

      logAdminAudit({
        action: 'VENUE_MIGRATED',
        adminId: getActingAdminId(req),
        adminRole: (req as any).adminRole,
        targetEntityType: 'event_pool_group',
        targetEntityId: groupId,
        context: { oldVenueId: group.venueId, newVenueId, reason, cancelledBookingId: result.cancelledBookingId },
      });

      res.json({
        success: true,
        message: "Venue migrated successfully",
        newVenue: { id: newVenue.id, name: newVenue.name, address: newVenue.address },
        newBooking: result.newBooking,
        cancelledBookingId: result.cancelledBookingId,
      });
    } catch (error: any) {
      logger.error("Error migrating venue assignment", { groupId: req.params.groupId, error: String(error) });
      res.status(400).json({ message: error.message || "Failed to migrate venue assignment" });
    }
  });
}
