import type { Express } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { db } from "../../db";
import { storage } from "../../storage";
import { ARCHETYPE_NAMES } from "../../archetypeConfig";
import { eventAttendance, eventPoolRegistrations, eventPools, chatMessages, blindBoxEvents, events, users, venues, venueDeals } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../../lib/logger";

const seedPoolRegistrationsSchema = z.object({
  poolId: z.string().min(1),
  count: z.number().int().min(1).max(20).optional(),
  budgetTier: z.string().optional(),
});

// Demo seed endpoints perform a series of independent INSERTs per route.
// These are idempotent / best-effort seed operations, not transactional business flows.
export function registerDemoRoutes(app: Express): void {
  app.post('/api/demo/seed-events', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { db } = await import("../../db");
      const { blindBoxEvents } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if user already has demo events
      const existingEvents = await db.select().from(blindBoxEvents).where(eq(blindBoxEvents.userId, userId)).limit(100);
      const hasMatchedDemo = existingEvents.some((e: any) => e.status === 'matched' && e.restaurantName?.includes('Sushi'));
      const hasCompletedDemo = existingEvents.some((e: any) => e.status === 'completed' && e.restaurantName?.includes('Tap House'));
      
      if (hasMatchedDemo && hasCompletedDemo) {
        logger.info("✅ Demo events already exist for user", { data: { value: userId } });
        return res.json({ message: "Demo events already exist" });
      }
      
      // Create a matched event (tomorrow evening)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(19, 0, 0, 0);
      
      const matchedEvent = await db.insert(blindBoxEvents).values({
        userId,
        title: "周四 19:00 · 饭局",
        eventType: "饭局",
        city: "香港",
        district: "中环",
        dateTime: tomorrow,
        budgetTier: "150-250",
        selectedLanguages: ["粤语", "普通话"],
        selectedCuisines: ["日本料理", "粤菜"],
        acceptNearby: true,
        status: "matched",
        progress: 100,
        currentParticipants: 5,
        totalParticipants: 5,
        maleCount: 2,
        femaleCount: 3,
        restaurantName: "鮨一 Sushi Ichi",
        restaurantAddress: "中环云咸街28号",
        cuisineTags: ["日本料理", "寿司"],
        matchedAttendees: [
          { 
            userId: "demo-1", 
            displayName: "小美", 
            archetype: "hamster_praise", 
            topInterests: ["美食", "旅行", "艺术"], 
            age: 27, 
            birthdate: "1998-05-15", 
            industry: "科技", 
            gender: "Woman",
            educationLevel: "Master's",
            studyLocale: "Overseas",
            seniority: "Mid",
            relationshipStatus: "Single",
            fieldOfStudy: "计算机科学",
            hometownRegionCity: "上海",
            languagesComfort: ["普通话 (Mandarin)", "English", "粤语 (Cantonese)"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-2", 
            displayName: "阿强", 
            archetype: "fox", 
            topInterests: ["美食", "摄影", "旅行"], 
            age: 30, 
            birthdate: "1995-03-20", 
            industry: "设计",
            gender: "Man",
            educationLevel: "Bachelor's",
            studyLocale: "Domestic",
            seniority: "Senior",
            relationshipStatus: "Single",
            fieldOfStudy: "设计",
            hometownRegionCity: "广州",
            languagesComfort: ["粤语 (Cantonese)", "普通话 (Mandarin)"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-3", 
            displayName: "Lisa", 
            archetype: "spider", 
            topInterests: ["美食", "艺术", "音乐"], 
            age: 28, 
            birthdate: "1997-07-10", 
            industry: "金融",
            gender: "Woman",
            educationLevel: "Master's",
            studyLocale: "Both",
            seniority: "Mid",
            relationshipStatus: "Married/Partnered",
            fieldOfStudy: "金融学",
            hometownRegionCity: "香港",
            languagesComfort: ["English", "粤语 (Cantonese)", "普通话 (Mandarin)"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-4", 
            displayName: "David", 
            archetype: "octopus", 
            topInterests: ["美食", "音乐", "电影"], 
            age: 32, 
            birthdate: "1993-11-05", 
            industry: "媒体",
            gender: "Man",
            educationLevel: "Master's",
            studyLocale: "Overseas",
            seniority: "Senior",
            relationshipStatus: "Single",
            fieldOfStudy: "传媒",
            hometownRegionCity: "北京",
            languagesComfort: ["普通话 (Mandarin)", "English"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          }
        ],
        matchExplanation: "这桌是日料爱好者的聚会！大家都对精致料理和文化交流充满热情，年龄相近，话题契合度高。"
      }).returning();
      
      // Create a completed event (last week)
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      lastWeek.setHours(20, 0, 0, 0);
      
      const completedEvent = await db.insert(blindBoxEvents).values({
        userId,
        title: "周三 20:00 · 酒局",
        eventType: "酒局",
        city: "深圳",
        district: "南山区",
        dateTime: lastWeek,
        budgetTier: "200-300",
        selectedLanguages: ["普通话", "英语"],
        selectedCuisines: ["西餐", "酒吧"],
        acceptNearby: false,
        status: "completed",
        progress: 100,
        currentParticipants: 6,
        totalParticipants: 6,
        maleCount: 3,
        femaleCount: 3,
        restaurantName: "The Tap House 精酿酒吧",
        restaurantAddress: "南山区海德三道1186号",
        cuisineTags: ["酒吧", "西餐"],
        matchedAttendees: [
          { 
            userId: "demo-5", 
            displayName: "Sarah", 
            archetype: "rooster", 
            topInterests: ["音乐", "社交", "美食"], 
            age: 29, 
            birthdate: "1996-04-12", 
            industry: "创业",
            gender: "Woman",
            educationLevel: "Bachelor's",
            studyLocale: "Overseas",
            seniority: "Founder",
            relationshipStatus: "Single",
            fieldOfStudy: "市场营销",
            hometownRegionCity: "深圳",
            languagesComfort: ["普通话 (Mandarin)", "English"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-6", 
            displayName: "Alex", 
            archetype: "corgi", 
            topInterests: ["创业", "科技", "阅读"], 
            age: 31, 
            birthdate: "1994-09-08", 
            industry: "互联网",
            gender: "Man",
            educationLevel: "Master's",
            studyLocale: "Both",
            seniority: "Senior",
            relationshipStatus: "Single",
            fieldOfStudy: "软件工程",
            hometownRegionCity: "杭州",
            languagesComfort: ["普通话 (Mandarin)", "English"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-7", 
            displayName: "小红", 
            archetype: "koala", 
            topInterests: ["旅行", "摄影", "美食"], 
            age: 28, 
            birthdate: "1997-02-18", 
            industry: "市场",
            gender: "Woman",
            educationLevel: "Bachelor's",
            studyLocale: "Domestic",
            seniority: "Mid",
            relationshipStatus: "Single",
            fieldOfStudy: "市场营销",
            hometownRegionCity: "成都",
            languagesComfort: ["普通话 (Mandarin)"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-8", 
            displayName: "Tom", 
            archetype: "fox", 
            topInterests: ["音乐", "电影", "旅行"], 
            age: 30, 
            birthdate: "1995-07-22", 
            industry: "设计",
            gender: "Man",
            educationLevel: "Bachelor's",
            studyLocale: "Overseas",
            seniority: "Mid",
            relationshipStatus: "Married/Partnered",
            fieldOfStudy: "视觉设计",
            hometownRegionCity: "香港",
            languagesComfort: ["English", "粤语 (Cantonese)"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          },
          { 
            userId: "demo-9", 
            displayName: "Emma", 
            archetype: "spider", 
            topInterests: ["艺术", "文化", "咖啡"], 
            age: 27, 
            birthdate: "1998-01-30", 
            industry: "咨询",
            gender: "Woman",
            educationLevel: "Master's",
            studyLocale: "Both",
            seniority: "Junior",
            relationshipStatus: "Single",
            fieldOfStudy: "管理咨询",
            hometownRegionCity: "上海",
            languagesComfort: ["普通话 (Mandarin)", "English"],
            ageVisible: true,
            educationVisible: true,
            industryVisible: true
          }
        ],
        matchExplanation: "这是一场创意人的深夜聚会！精酿啤酒配上有趣的灵魂，大家都喜欢分享故事和创意想法。"
      }).returning();
      
      logger.info("✅ Demo events created", { data: { matched: matchedEvent[0].id, completed: completedEvent[0].id } });
      
      res.json({ 
        message: "Demo events created successfully",
        events: {
          matched: matchedEvent[0],
          completed: completedEvent[0]
        }
      });
    } catch (error) {
      logger.error("Error seeding demo events:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to seed demo events" });
    }
  });
  app.post('/api/demo/seed-pool-registrations', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        logger.error("[DemoSeedPoolRegistrations] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parseResult = seedPoolRegistrationsSchema.safeParse(req.body || {});
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parseResult.error.issues });
      }
      const { poolId, count, budgetTier } = parseResult.data;

      // 确认这个池子存在
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId));

      if (!pool) {
        logger.warn("Pool not found", { feature: 'DemoSeedPoolRegistrations', poolId });
        return res.status(404).json({ message: "Pool not found" });
      }

      const insertCount = typeof count === "number" && count > 0 ? count : 4;
      const finalBudget = budgetTier ?? "100以下";

      const demoUsersToInsert = Array.from({ length: insertCount }, (_, index) => {
        const suffix = randomUUID();
        const archetype = ARCHETYPE_NAMES[index % ARCHETYPE_NAMES.length];
        return {
          email: `demo.pool.${suffix}@joyjoin.local`,
          phoneNumber: `demo-pool-${suffix}`,
          displayName: `测试桌友${index + 1}`,
          gender: index % 2 === 0 ? "女性" : "男性",
          currentCity: pool.city,
          archetype,
          primaryArchetype: archetype,
          hasCompletedRegistration: true,
          hasCompletedPersonalityTest: true,
          hasCompletedInterestsCarousel: true,
        };
      });

      const demoUsers = await db
        .insert(users)
        .values(demoUsersToInsert)
        .returning({ id: users.id });

      const registrationsToInsert = demoUsers.map((demoUser: { id: string }) => ({
        poolId,
        userId: demoUser.id,
        budgetRange: [finalBudget],
        preferredLanguages: [],
        tasteIntensity: [],
        cuisinePreferences: [],
        eventIntent: [],
        dietaryRestrictions: [],
        matchStatus: "pending",
      }));

      const inserted = await db
        .insert(eventPoolRegistrations)
        .values(registrationsToInsert)
        .returning();

      // 更新池子的报名计数
      await db
        .update(eventPools)
        .set({
          totalRegistrations: sql`${eventPools.totalRegistrations} + ${inserted.length}`,
          updatedAt: new Date(),
        })
        .where(eq(eventPools.id, poolId));

      logger.info("[DemoSeedPoolRegistrations] inserted registrations:", {
        poolId,
        requestedByUserId: userId,
        count: inserted.length,
      });

      return res.json({
        ok: true,
        poolId,
        insertedCount: inserted.length,
      });
    } catch (error: any) {
      logger.error("[DemoSeedPoolRegistrations] Error seeding registrations:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({
        message: "Failed to seed pool registrations",
        error: error?.message || String(error),
      });
    }
  });
  app.post('/api/demo/create-christmas-pool', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        logger.error("[DemoChristmasPool] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { db } = await import("../../db");
      const { blindBoxEvents } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if user already has a Christmas pool demo
      const existingPools = await db
        .select()
        .from(blindBoxEvents)
        .where(eq(blindBoxEvents.userId, userId));
      
      const hasChristmasPool = existingPools.some((e: any) => 
        e.title && e.title.includes("圣诞") && e.status === "pending_match"
      );
      
      if (hasChristmasPool) {
        logger.info("✅ Christmas pool already exists for user", { data: { value: userId } });
        return res.json({ 
          message: "Christmas pool already exists",
          poolExists: true 
        });
      }
      
      // Create Christmas event on Dec 25, 2025 at 9 PM China time (UTC+8)
      const christmasDate = new Date("2025-12-25T21:00:00+08:00");
      
      const created = await db.insert(blindBoxEvents).values({
        userId,
        title: "圣诞神秘酒局 · 南山夜聊",
        eventType: "酒局",
        city: "深圳",
        district: "南山",
        dateTime: christmasDate,
        budgetTier: "150-250",
        selectedLanguages: ["粤语", "普通话"],
        selectedCuisines: ["鸡尾酒吧", "创意小食"],
        acceptNearby: true,
        status: "pending_match",
        progress: 0,
        currentParticipants: 1, // Just the creator
      }).returning();

      logger.info("✅ Demo Christmas pool created", { data: created[0].id });
      
      res.json({
        message: "Christmas pool created successfully",
        event: created[0],
        eventId: created[0].id,
        instructions: "你现在可以体验报名流程。系统将自动为你匹配其他参加者，生成完整的匹配桌。"
      });
    } catch (error) {
      logger.error("[DemoChristmasPool] Error creating pool:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        message: "Failed to create Christmas pool",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app.post('/api/demo/create-homebar-venue', requireAdmin, requireOperatorOrAbove, async (_req, res) => {
    try {
      const { db } = await import("../../db");
      const { venues, venueDeals } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if venue already exists
      const existingVenues = await db
        .select()
        .from(venues)
        .where(eq(venues.name, "弥所 Homebar"));
      
      if (existingVenues.length > 0) {
        const existingVenue = existingVenues[0];
        const existingDeals = await storage.getVenueDeals(existingVenue.id);
        return res.json({ 
          message: "Venue already exists",
          venue: existingVenue,
          deals: existingDeals
        });
      }
      
      // Create 弥所 Homebar venue
      const [venue] = await db.insert(venues).values({
        name: "弥所 Homebar",
        venueType: "homebar",
        address: "深圳市南山区科技园某商业街",
        city: "深圳",
        area: "南山区",
        contactPerson: "弥所老板",
        contactPhone: null,
        commissionRate: 15,
        tags: ["cozy", "lively", "小众", "适合破冰"],
        cuisines: ["鸡尾酒", "威士忌", "创意小食"],
        priceRange: "150以下",
        decorStyle: ["轻奢现代风", "温馨日式风"],
        capacity: 2,
        operatingHours: "18:00-02:00",
        priceNote: "一杯酒约100元起",
        coverImageUrl: null,
        galleryImages: [],
        partnerStatus: "active",
        partnerSince: "2025-01-01",
        isActive: true,
      }).returning();
      
      logger.info("Demo venue created", { feature: 'DemoSeed', venueId: venue.id, venueName: venue.name });
      
      // Create 20% off exclusive deal
      const [deal] = await db.insert(venueDeals).values({
        venueId: venue.id,
        title: "悦聚专属8折优惠",
        discountType: "percentage",
        discountValue: 20, // 20 means 20% off, so 8折
        description: "凡通过「悦聚」参加活动的朋友，全单消费可享8折优惠",
        redemptionMethod: "show_page",
        redemptionCode: null,
        minSpend: null,
        maxDiscount: null,
        perPersonLimit: false,
        validFrom: "2025-01-01",
        validUntil: "2025-12-31",
        terms: "每桌限使用一次，不可与其他优惠叠加使用",
        excludedDates: ["2025-02-14", "2025-12-24", "2025-12-25", "2025-12-31"],
        isActive: true,
      }).returning();
      
      logger.info("Demo deal created", { feature: 'DemoSeed', dealId: deal.id, dealTitle: deal.title });
      
      res.json({
        message: "Homebar venue and deal created successfully",
        venue,
        deals: [deal],
        instructions: "场地和优惠已创建成功，可在活动详情页查看"
      });
    } catch (error) {
      logger.error("[DemoHomebarVenue] Error creating venue:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        message: "Failed to create Homebar venue",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  app.post('/api/chats/seed-demo', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      logger.info(`[SEED-DEMO] Starting demo data creation for user: ${userId}`);

      // Create demo users with different archetypes and complete profiles
      const [demoUser1] = await db.insert(users).values({
        displayName: '小明',
        archetype: 'corgi',
        hasCompletedProfileSetup: true,
        hasCompletedPersonalityTest: true,
        hasCompletedInterestsTopics: true,
        gender: 'Man',
        age: 28,
        educationLevel: "Master's",
        industry: '科技',
        relationshipStatus: 'Single',
        interestsTop: ['科技', '创业', '咖啡', '产品'],
        interestsRankedTop3: ['科技', '创业', '咖啡'],
        topicsHappy: ['AI发展', '产品设计', '创业故事'],
        eventsAttended: 5,
        matchesMade: 8,
      }).returning();

      const [demoUser2] = await db.insert(users).values({
        displayName: '小红',
        archetype: 'spider',
        hasCompletedProfileSetup: true,
        hasCompletedPersonalityTest: true,
        hasCompletedInterestsTopics: true,
        gender: 'Woman',
        age: 26,
        educationLevel: "Bachelor's",
        industry: '设计',
        relationshipStatus: 'In a relationship',
        interestsTop: ['设计', '艺术', '旅行', '摄影'],
        interestsRankedTop3: ['设计', '艺术', '旅行'],
        topicsHappy: ['UI/UX设计', '摄影', '文化交流'],
        eventsAttended: 12,
        matchesMade: 15,
      }).returning();

      const [demoUser3] = await db.insert(users).values({
        displayName: '阿杰',
        archetype: 'fox',
        hasCompletedProfileSetup: true,
        hasCompletedPersonalityTest: true,
        hasCompletedInterestsTopics: true,
        gender: 'Man',
        age: 30,
        educationLevel: "Doctorate",
        industry: '金融',
        relationshipStatus: 'Single',
        interestsTop: ['投资', '徒步', '读书', '历史'],
        interestsRankedTop3: ['投资', '徒步', '读书'],
        topicsHappy: ['股市分析', '户外运动', '历史'],
        eventsAttended: 8,
        matchesMade: 10,
      }).returning();

      // Create demo events with different unlock states
      const now = new Date();
      
      // Event 1: Unlocked (event is in 12 hours - within 24h window)
      const in12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);
      
      const [event1] = await db.insert(events).values({
        title: '今晚聚餐 · 港式茶餐厅',
        description: '饭局 · ¥100-200',
        dateTime: in12Hours,
        location: '中环翠华餐厅',
        area: '中环',
        price: null,
        maxAttendees: 6,
        currentAttendees: 4,
        hostId: userId,
        status: 'upcoming',
      }).returning();

      // Add current user and demo users to event 1
      await db.insert(eventAttendance).values([
        {
          eventId: event1.id,
          userId,
          status: 'confirmed',
        },
        {
          eventId: event1.id,
          userId: demoUser1.id,
          status: 'confirmed',
        },
        {
          eventId: event1.id,
          userId: demoUser2.id,
          status: 'confirmed',
        },
        {
          eventId: event1.id,
          userId: demoUser3.id,
          status: 'confirmed',
        },
      ]);

      // Create demo messages for event 1 with different users
      const demoMessages = [
        { message: '大家好！很期待明天的聚会 👋', userId: demoUser1.id },
        { message: '我也是！有人知道这家店的招牌菜是什么吗？', userId: demoUser2.id },
        { message: '听说他们的菠萝包和奶茶超赞！', userId: demoUser3.id },
      ];

      for (const msg of demoMessages) {
        await db.insert(chatMessages).values({
          eventId: event1.id,
          userId: msg.userId,
          message: msg.message,
        });
      }

      // Event 2: Locked (event is in 3 days)
      const in3Days = new Date(now);
      in3Days.setDate(in3Days.getDate() + 3);
      in3Days.setHours(14, 0, 0, 0);
      
      const [event2] = await db.insert(events).values({
        title: '周日下午茶 · 咖啡厅',
        description: '咖啡 · ¥≤100',
        dateTime: in3Days,
        location: '尖沙咀 % Arabica',
        area: '尖沙咀',
        price: null,
        maxAttendees: 5,
        currentAttendees: 3,
        hostId: userId,
        status: 'upcoming',
      }).returning();

      await db.insert(eventAttendance).values({
        eventId: event2.id,
        userId,
        status: 'confirmed',
      });

      // Event 3: Past event (2 hours ago)
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      
      const [event3] = await db.insert(events).values({
        title: '刚结束的桌游局',
        description: '玩乐 · ¥200-300',
        dateTime: twoHoursAgo,
        location: '铜锣湾 Game On',
        area: '铜锣湾',
        price: null,
        maxAttendees: 6,
        currentAttendees: 5,
        hostId: userId,
        status: 'completed',
      }).returning();

      await db.insert(eventAttendance).values({
        eventId: event3.id,
        userId,
        status: 'confirmed',
      });

      // Create demo messages for past event with different users
      const pastMessages = [
        { message: '今天玩得太开心了！', userId: demoUser2.id },
        { message: '狼人杀太刺激了哈哈', userId: demoUser1.id },
        { message: '下次还要一起玩！', userId: demoUser3.id },
      ];

      for (const msg of pastMessages) {
        await db.insert(chatMessages).values({
          eventId: event3.id,
          userId: msg.userId,
          message: msg.message,
        });
      }

      // Also add demo users as event attendees
      await db.insert(eventAttendance).values([
        { eventId: event3.id, userId: demoUser1.id, status: 'confirmed' },
        { eventId: event3.id, userId: demoUser2.id, status: 'confirmed' },
        { eventId: event3.id, userId: demoUser3.id, status: 'confirmed' },
      ]);

      logger.info(`[SEED-DEMO] Demo data creation completed successfully for user: ${userId}`);
      res.json({ 
        success: true, 
        message: 'Demo chat data created',
        events: [
          { title: event1.title, status: 'unlocked', dateTime: event1.dateTime },
          { title: event2.title, status: 'locked', dateTime: event2.dateTime },
          { title: event3.title, status: 'past', dateTime: event3.dateTime },
        ],
      });
    } catch (error) {
      logger.error("[SEED-DEMO] Error creating demo chat data:", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: "Failed to create demo chat data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });
}
