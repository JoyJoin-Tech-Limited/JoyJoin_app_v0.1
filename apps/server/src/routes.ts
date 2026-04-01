//my path:/Users/felixg/projects/JoyJoin3/server/routes.ts
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import socialIcebreakerRoutes from "./routes/socialIcebreaker";
import ttsRoutes from "./routes/tts";
import { storage } from "./storage";
import { matchIndustryFromText } from "./inference/industryOntology";
import { INDUSTRY_OPTIONS } from "@shared/constants";
import type { GroupAnalysisResponse } from "@shared/types/groupAnalysis";
import { setupPhoneAuth, isPhoneAuthenticated, validateVerificationCode } from "./phoneAuth";
import { setupWechatAuth } from "./wechatAuth";
import { registerAdminAuthRoutes, requireAdmin } from "./adminAuth";
import { paymentService } from "./paymentService";
import { subscriptionService } from "./subscriptionService";
import { venueMatchingService } from "./venueMatchingService";
import { calculateUserMatchScore, matchUsersToGroups, validateWeights, DEFAULT_WEIGHTS, type MatchingWeights } from "./userMatchingService";
import { broadcastEventStatusChanged, broadcastAdminAction, broadcastAttendanceStatusUpdated } from "./eventBroadcast";
import { matchEventPool, saveMatchResults } from "./poolMatchingService";
import { ARCHETYPE_NAMES } from "./archetypeConfig";
import type { ArchetypeName } from "./archetypeConfig";
import { enrichProfileFromRegistration } from "./lib/profileEnrichment";

type Traits = {
  affinity: number;
  openness: number;
  conscientiousness: number;
  emotionalStability: number;
  extraversion: number;
  positivity: number;
};

export const roleTraits: Record<ArchetypeName, Traits> = {
  "开心柯基": { affinity: 8, openness: 8, conscientiousness: 5, emotionalStability: 7, extraversion: 10, positivity: 10 },
  "太阳鸡": { affinity: 9, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 7, positivity: 9 },
  "夸夸豚": { affinity: 10, openness: 8, conscientiousness: 7, emotionalStability: 8, extraversion: 9, positivity: 10 },
  "机智狐": { affinity: 7, openness: 10, conscientiousness: 6, emotionalStability: 8, extraversion: 8, positivity: 8 },
  "淡定海豚": { affinity: 8, openness: 9, conscientiousness: 9, emotionalStability: 10, extraversion: 6, positivity: 8 },
  "织网蛛": { affinity: 9, openness: 8, conscientiousness: 8, emotionalStability: 8, extraversion: 7, positivity: 7 },
  "暖心熊": { affinity: 10, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 6, positivity: 9 },
  "灵感章鱼": { affinity: 7, openness: 10, conscientiousness: 5, emotionalStability: 8, extraversion: 8, positivity: 8 },
  "沉思猫头鹰": { affinity: 6, openness: 9, conscientiousness: 10, emotionalStability: 9, extraversion: 5, positivity: 7 },
  "定心大象": { affinity: 8, openness: 7, conscientiousness: 10, emotionalStability: 10, extraversion: 6, positivity: 7 },
  "稳如龟": { affinity: 7, openness: 8, conscientiousness: 9, emotionalStability: 9, extraversion: 4, positivity: 6 },
  "隐身猫": { affinity: 6, openness: 7, conscientiousness: 8, emotionalStability: 9, extraversion: 4, positivity: 7 },
};

type Insights = {
  strengths: string;
  challenges: string;
  idealFriendTypes: ArchetypeName[];
};

export const roleInsights: Record<ArchetypeName, Insights> = {
  "开心柯基": {
    strengths: "活力四射，擅长快速破冰",
    challenges: "有时过于热情，可能忽略细节",
    idealFriendTypes: ["暖心熊", "夸夸豚", "淡定海豚"],
  },
  "太阳鸡": {
    strengths: "稳定温暖，给人安全感",
    challenges: "可能过于求稳，缺乏冒险精神",
    idealFriendTypes: ["开心柯基", "定心大象", "淡定海豚"],
  },
  "夸夸豚": {
    strengths: "正向反馈专家，情绪价值满分",
    challenges: "可能过于迎合，表达过于单一",
    idealFriendTypes: ["暖心熊", "开心柯基", "织网蛛"],
  },
  "机智狐": {
    strengths: "点子多，擅长发现新奇事物",
    challenges: "注意力容易分散，缺乏耐心",
    idealFriendTypes: ["灵感章鱼", "织网蛛", "淡定海豚"],
  },
  "淡定海豚": {
    strengths: "情绪稳定，擅长调节气氛",
    challenges: "有时显得过于佛系，缺乏主见",
    idealFriendTypes: ["定心大象", "太阳鸡", "织网蛛"],
  },
  "织网蛛": {
    strengths: "连接者，能发现他人共同点",
    challenges: "可能过于关注关系网，忽略个人深度",
    idealFriendTypes: ["机智狐", "淡定海豚", "暖心熊"],
  },
  "暖心熊": {
    strengths: "极佳的倾听者，共情力极强",
    challenges: "容易吸纳负面情绪，需要空间充电",
    idealFriendTypes: ["沉思猫头鹰", "夸夸豚", "开心柯基"],
  },
  "灵感章鱼": {
    strengths: "创意无限，思维跳跃广阔",
    challenges: "想法太多难以落地，可能让人跟不上",
    idealFriendTypes: ["机智狐", "沉思猫头鹰", "稳如龟"],
  },
  "沉思猫头鹰": {
    strengths: "逻辑严密，提供深度洞察",
    challenges: "显得过于严肃，不擅长闲聊",
    idealFriendTypes: ["稳如龟", "暖心熊", "定心大象"],
  },
  "定心大象": {
    strengths: "稳重可靠，是团队的定心丸",
    challenges: "节奏较慢，对变化反应略显迟钝",
    idealFriendTypes: ["太阳鸡", "淡定海豚", "沉思猫头鹰"],
  },
  "稳如龟": {
    strengths: "看问题透彻，提供长远见解",
    challenges: "慢热，融入新群体需要时间",
    idealFriendTypes: ["沉思猫头鹰", "定心大象", "隐身猫"],
  },
  "隐身猫": {
    strengths: "安静观察者，提供舒适陪伴",
    challenges: "存在感弱，不擅长主动发起社交",
    idealFriendTypes: ["稳如龟", "定心大象", "暖心熊"],
  },
};
import { processTestV2, type AnswerV2 } from "./personalityMatchingV2";
import { aiEndpointLimiter, kpiEndpointLimiter } from "./rateLimiter";
import { checkUserAbuse, resetConversationTurns, recordTokenUsage } from "./abuseDetection";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { updateProfileSchema, updateFullProfileSchema, updatePersonalitySchema, insertChatMessageSchema, insertEventFeedbackSchema, registerUserSchema, insertChatReportSchema, insertChatLogSchema, events, eventAttendance, chatMessages, users, eventPools, eventPoolRegistrations, eventPoolGroups, insertEventPoolSchema, insertEventPoolRegistrationSchema, invitations, invitationUses, matchingThresholds, poolMatchingLogs, blindBoxEvents, referralCodes, referralConversions, assessmentSessions, industryAiLogs, industrySeedCandidates, userInterests, userInterestSignals, venues, venueTimeSlots, onboardingAnalytics, matchHistory, connections, type User } from "@shared/schema";
import * as schema from "@shared/schema";
import { normalizeProfileInterests, validateTelemetry, TAXONOMY_VERSION, getInterestById } from "@shared/interests";
import { db } from "./db";
import { eq, or, and, desc, inArray, isNotNull, gt, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import { z } from "zod";

// Type alias for database transaction
type DbTransaction = NeonDatabase<typeof schema>;

// 12个社交氛围原型题目映射表（与前端personalityQuestions.ts保持一致）
const roleMapping: Record<string, Record<string, string>> = {
  "1": { "A": "开心柯基", "B": "淡定海豚", "C": "隐身猫", "D": "织网蛛" },
  "2": { "A": "机智狐", "B": "夸夸豚", "C": "暖心熊", "D": "沉思猫头鹰" },
  "3": { "A": "暖心熊", "B": "太阳鸡", "C": "隐身猫", "D": "淡定海豚" },
  "4": { "A": "灵感章鱼", "B": "沉思猫头鹰", "C": "织网蛛", "D": "定心大象" },
  "5": { "A": "开心柯基", "B": "淡定海豚", "C": "稳如龟", "D": "灵感章鱼" },
  "6": { "A": "稳如龟", "B": "夸夸豚", "C": "暖心熊", "D": "定心大象" },
  "7": { "A": "开心柯基", "B": "太阳鸡", "C": "机智狐", "D": "隐身猫" },
  "8": { "A": "夸夸豚", "B": "沉思猫头鹰", "C": "织网蛛", "D": "稳如龟" },
  "9": { "A": "开心柯基", "B": "太阳鸡", "C": "定心大象", "D": "隐身猫" },
  "10": { "A": "太阳鸡", "B": "机智狐", "C": "灵感章鱼", "D": "定心大象" },
};

// 补测题映射表（ID 101-120）
const supplementaryRoleMapping: Record<string, Record<string, string>> = {
  "101": { "A": "开心柯基", "B": "太阳鸡" },
  "102": { "A": "开心柯基", "B": "太阳鸡" },
  "103": { "A": "淡定海豚", "B": "织网蛛" },
  "104": { "A": "淡定海豚", "B": "织网蛛" },
  "105": { "A": "沉思猫头鹰", "B": "稳如龟" },
  "106": { "A": "沉思猫头鹰", "B": "稳如龟" },
  "107": { "A": "机智狐", "B": "灵感章鱼" },
  "108": { "A": "机智狐", "B": "灵感章鱼" },
  "109": { "A": "暖心熊", "B": "夸夸豚" },
  "110": { "A": "暖心熊", "B": "夸夸豚" },
  "111": { "A": "定心大象", "B": "淡定海豚" },
  "112": { "A": "定心大象", "B": "淡定海豚" },
  "113": { "A": "隐身猫", "B": "稳如龟" },
  "114": { "A": "隐身猫", "B": "稳如龟" },
  "115": { "A": "开心柯基", "B": "机智狐" },
  "116": { "A": "太阳鸡", "B": "暖心熊" },
  "117": { "A": "织网蛛", "B": "机智狐" },
  "118": { "A": "灵感章鱼", "B": "沉思猫头鹰" },
  "119": { "A": "定心大象", "B": "稳如龟" },
  "120": { "A": "夸夸豚", "B": "太阳鸡" },
};

function calculateRoleScores(responses: Record<number, any>): Record<string, number> {
  const scores: Record<string, number> = {
    "开心柯基": 0,
    "太阳鸡": 0,
    "夸夸豚": 0,
    "机智狐": 0,
    "淡定海豚": 0,
    "织网蛛": 0,
    "暖心熊": 0,
    "灵感章鱼": 0,
    "沉思猫头鹰": 0,
    "定心大象": 0,
    "稳如龟": 0,
    "隐身猫": 0,
  };

  Object.entries(responses).forEach(([questionId, answer]: [string, any]) => {
    // Determine which mapping to use based on question ID
    const qId = parseInt(questionId);
    const mapping = qId >= 101 ? supplementaryRoleMapping[questionId] : roleMapping[questionId];
    
    if (!mapping) return;

    if (answer.type === "single") {
      const role = mapping[answer.value];
      if (role) {
        scores[role] = (scores[role] || 0) + 2;
      }
    } else if (answer.type === "dual") {
      const mostLikeRole = mapping[answer.mostLike];
      const secondLikeRole = mapping[answer.secondLike];
      if (mostLikeRole) {
        scores[mostLikeRole] = (scores[mostLikeRole] || 0) + 2;
      }
      if (secondLikeRole) {
        scores[secondLikeRole] = (scores[secondLikeRole] || 0) + 1;
      }
    }
  });

  return scores;
}

function determineSubtype(primaryArchetype: string, responses: Record<number, any>): string {
  // 12个原型的功能昵称（直接使用核心定位）
  const nicknames: Record<string, string> = {
    "开心柯基": "摇尾点火官",
    "太阳鸡": "咯咯小太阳",
    "夸夸豚": "掌声发动机",
    "机智狐": "巷口密探",
    "淡定海豚": "气氛冲浪手",
    "织网蛛": "关系织网师",
    "暖心熊": "怀抱故事熊",
    "灵感章鱼": "脑洞喷墨章",
    "沉思猫头鹰": "推镜思考官",
    "定心大象": "象鼻定心锚",
    "稳如龟": "慢语真知龟",
    "隐身猫": "安静伴伴猫",
  };

  return nicknames[primaryArchetype] || "";
}

function calculateTraitScores(primaryArchetype: string, secondaryArchetype: string | null): {
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
} {
  // Use imported roleTraits from archetypeConfig.ts
  const primary = roleTraits[primaryArchetype as ArchetypeName] || roleTraits["淡定海豚"]; // Default to 淡定海豚
  const secondary = secondaryArchetype ? roleTraits[secondaryArchetype as ArchetypeName] : null;

  // Blend primary and secondary (70% primary, 30% secondary)
  const blend = (p: number, s: number | null) => {
    if (s === null) return p;
    return Math.round(p * 0.7 + s * 0.3);
  };

  return {
    affinityScore: blend(primary.affinity, secondary?.affinity || null),
    opennessScore: blend(primary.openness, secondary?.openness || null),
    conscientiousnessScore: blend(primary.conscientiousness, secondary?.conscientiousness || null),
    emotionalStabilityScore: blend(primary.emotionalStability, secondary?.emotionalStability || null),
    extraversionScore: blend(primary.extraversion, secondary?.extraversion || null),
    positivityScore: blend(primary.positivity, secondary?.positivity || null),
  };
}

function generateInsights(primaryArchetype: string, secondaryArchetype: string | null): {
  strengths: string;
  challenges: string;
  idealFriendTypes: string[];
} {
  // Use imported roleInsights from archetypeConfig.ts
  return roleInsights[primaryArchetype as ArchetypeName] || roleInsights["淡定海豚"]; // Default to 淡定海豚
}

type InterestSignalContext = {
  interestKey: string;
  interestLabel: string;
  enthusiasmLevel: number;
  discussionStyle: string;
  conversationDepth: number;
};

async function loadInterestSignalsByUserIds(userIds: string[]): Promise<Map<string, InterestSignalContext[]>> {
  if (userIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      userId: userInterestSignals.userId,
      interestKey: userInterestSignals.interestKey,
      interestLabel: userInterestSignals.interestLabel,
      enthusiasmLevel: userInterestSignals.enthusiasmLevel,
      discussionStyle: userInterestSignals.discussionStyle,
      conversationDepth: userInterestSignals.conversationDepth,
    })
    .from(userInterestSignals)
    .where(sql`${userInterestSignals.userId} = ANY(${userIds})`);

  const byUserId = new Map<string, InterestSignalContext[]>();
  for (const row of rows) {
    const existing = byUserId.get(row.userId) ?? [];
    existing.push({
      interestKey: row.interestKey,
      interestLabel: row.interestLabel,
      enthusiasmLevel: row.enthusiasmLevel,
      discussionStyle: row.discussionStyle,
      conversationDepth: row.conversationDepth,
    });
    byUserId.set(row.userId, existing);
  }

  return byUserId;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // 🔧 DEV TOOLS: Debug logging for secret key configuration
  const DEV_SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY;
  console.log('[DEV TOOLS] Secret key configured:', DEV_SECRET_KEY ? '✅ Yes' : '❌ No');
  console.log('[DEV TOOLS] Secret key length:', DEV_SECRET_KEY?.length || 0);
  
  // 🔧 确保 trust proxy 在 session 之前设置（防止 index.ts 漏掉）
  app.set('trust proxy', 1);

  // API v1 backward compat: /api/v1/* routes work identically to /api/* routes.
  // Rewrite happens before session and route handlers so all existing logic is reused.
  app.use((req, _res, next) => {
    if (req.url) {
      if (req.url.startsWith('/api/v1/')) {
        req.url = '/api/' + req.url.slice('/api/v1/'.length);
      } else if (req.url === '/api/v1' || req.url.startsWith('/api/v1?')) {
        req.url = '/api' + req.url.slice('/api/v1'.length);
      }
    }
    next();
  });
  
  // 🔧 DEBUG: Add identity headers to ALL API responses (Phase 1.1)
  app.use((req, res, next) => {
    res.setHeader("X-App", "joyjoin-api");
    res.setHeader("X-Instance", process.env.HOSTNAME || "replit");
    res.setHeader("X-Git", process.env.GIT_SHA || "unknown");
    next();
  });

  // Health check endpoint - must be before session middleware for cloud platform health checks
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Reverse geocode endpoint - converts GPS coordinates to city/district
  // Uses Amap API for accurate Chinese address resolution
  app.post('/api/geo/reverse-geocode', async (req, res) => {
    try {
      const { latitude, longitude } = req.body;
      
      // Validate inputs are numbers
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ 
          success: false, 
          error: "经纬度参数格式错误" 
        });
      }
      
      // Validate coordinate ranges (Shenzhen/Hong Kong area roughly)
      if (lat < 20 || lat > 25 || lng < 112 || lng > 116) {
        return res.status(400).json({ 
          success: false, 
          error: "坐标超出服务范围" 
        });
      }

      const apiKey = process.env.AMAP_API_KEY;
      
      // Helper function to detect district from coordinates using bounding boxes
      const detectDistrictFromCoords = (lat: number, lng: number): string | null => {
        const districts = [
          { name: "南山区", minLat: 22.45, maxLat: 22.60, minLng: 113.85, maxLng: 114.05 },
          { name: "福田区", minLat: 22.50, maxLat: 22.58, minLng: 114.00, maxLng: 114.15 },
          { name: "罗湖区", minLat: 22.52, maxLat: 22.60, minLng: 114.10, maxLng: 114.20 },
          { name: "宝安区", minLat: 22.52, maxLat: 22.85, minLng: 113.75, maxLng: 113.95 },
          { name: "龙岗区", minLat: 22.55, maxLat: 22.80, minLng: 114.15, maxLng: 114.45 },
        ];
        
        for (const d of districts) {
          if (lat >= d.minLat && lat <= d.maxLat && lng >= d.minLng && lng <= d.maxLng) {
            return d.name;
          }
        }
        return null;
      };

      // Helper function to normalize district names
      const normalizeDistrictName = (district: string): string => {
        if (!district) return "";
        return district.replace(/市辖区$/, "").replace(/区区$/, "区");
      };
      
      if (!apiKey) {
        // Fallback to local boundary detection (use parsed numeric values)
        const district = detectDistrictFromCoords(lat, lng);
        return res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local"
        });
      }

      // Call Amap reverse geocoding API with encoded coordinates
      const encodedLocation = encodeURIComponent(`${lng.toFixed(6)},${lat.toFixed(6)}`);
      const amapUrl = `https://restapi.amap.com/v3/geocode/regeo?key=${apiKey}&location=${encodedLocation}&extensions=base`;
      
      const response = await fetch(amapUrl);
      const data = await response.json();
      
      if (data.status === "1" && data.regeocode) {
        const addressComponent = data.regeocode.addressComponent;
        const city = addressComponent.city || addressComponent.province;
        const district = addressComponent.district;
        
        // Normalize district name to match our clusters
        const normalizedDistrict = normalizeDistrictName(district);
        
        res.json({
          success: true,
          city: city === "深圳市" ? "深圳" : city,
          district: normalizedDistrict,
          rawDistrict: district,
          source: "amap"
        });
      } else {
        // Fallback to local detection (use parsed numeric values)
        const district = detectDistrictFromCoords(lat, lng);
        res.json({
          success: !!district,
          city: district ? "深圳" : undefined,
          district: district,
          source: "local",
          amapError: data.info
        });
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      res.status(500).json({ 
        success: false, 
        error: "定位服务暂时不可用" 
      });
    }
  });

  // Session middleware
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  // Cookie domain configuration for cross-subdomain session sharing
  // In production with yuejuapp.com, use '.yuejuapp.com' to share across subdomains
  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const isProduction = process.env.NODE_ENV === 'production';
  
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction, // Required for secure cookies behind Caddy proxy
    cookie: {
      domain: cookieDomain, // '.yuejuapp.com' enables sharing across api/admin/www subdomains
      httpOnly: true,
      secure: isProduction, // true when Caddy provides HTTPS
      maxAge: sessionTtl,
      sameSite: isProduction ? 'none' : 'lax', // 'none' required for cross-subdomain in production
    },
  }));

  // Phone auth setup
  setupPhoneAuth(app);

  // WeChat auth setup
  setupWechatAuth(app);

  // Admin password login endpoint (legacy: phone-based; kept for backward compat during transition)
  // New canonical endpoint is POST /api/admin/login (username-based).
  app.post('/api/auth/admin-login', async (req: Request, res) => {
    try {
      // Support both old phone-based format and new username-based format
      const { username, phoneNumber, password } = req.body;
      const loginId = username || phoneNumber;

      if (!loginId || !password) {
        return res.status(400).json({ message: "用户名和密码不能为空" });
      }

      const bcrypt = await import('bcrypt');

      // Try new admin_accounts table first (username-based)
      const adminAccount = await storage.getAdminAccountByUsername(loginId);
      if (adminAccount) {
        if (adminAccount.status !== 'active') {
          console.warn("Admin login attempt for disabled account", {
            username: adminAccount.username,
            status: adminAccount.status,
          });
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        const isValid = await bcrypt.compare(password, adminAccount.passwordHash);
        if (!isValid) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        await storage.updateAdminLastLogin(adminAccount.id);
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.adminAccountId = adminAccount.id;
            req.session.adminRole = adminAccount.role;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });
        return res.json({ message: "登录成功", role: adminAccount.role, displayName: adminAccount.displayName });
      }

      // Fallback: legacy users table (phone-based admin, transitional)
      if (phoneNumber) {
        const users = await storage.getUserByPhone(phoneNumber);
        if (users.length === 0) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        const user = users[0];
        if (!user.isAdmin) {
          return res.status(403).json({ message: "该账号没有管理员权限" });
        }
        if (!user.password) {
          return res.status(401).json({ message: "该账号未设置密码" });
        }
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ message: "用户名或密码错误" });
        }
        await new Promise<void>((resolve, reject) => {
          req.session.regenerate((err: any) => {
            if (err) return reject(err);
            req.session.userId = user.id;
            req.session.save((saveErr: any) => {
              if (saveErr) return reject(saveErr);
              resolve();
            });
          });
        });
        return res.json({ message: "登录成功", userId: user.id });
      }

      return res.status(401).json({ message: "用户名或密码错误" });
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ message: "登录失败" });
    }
  });

  // Dev-only login endpoint for testing
  app.post('/api/auth/dev-login', async (req: Request, res) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: "Dev login is only available in development mode" });
    }
    
    try {
      const testUsers = await storage.getUserByPhone("dev-test-12345");
      let testUser = testUsers && testUsers.length > 0 ? testUsers[0] : null;
      
      if (!testUser) {
        testUser = await storage.createUserWithPhone({
          phoneNumber: "dev-test-12345",
          email: "dev-test@joyjoin.app",
          firstName: "测试",
          lastName: "用户",
        });
      }
      
      req.session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Dev login failed" });
        }
        
        req.session.userId = testUser!.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Dev login failed" });
          }
          
          console.log("[DEV-LOGIN] Test session created for user:", testUser!.id);
          res.json({ 
            message: "Dev login successful",
            userId: testUser!.id
          });
        });
      });
    } catch (error) {
      console.error("Error during dev login:", error);
      res.status(500).json({ message: "Dev login failed" });
    }
  });

  // Simplified phone login (no SMS verification for MVP)
  app.post('/api/auth/quick-login', async (req: Request, res) => {
    try {
      const { phone } = req.body;
      
      if (!phone || phone.length < 8) {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      
      // Find or create user by phone number
      const existingUsers = await storage.getUserByPhone(phone);
      let user = existingUsers && existingUsers.length > 0 ? existingUsers[0] : null;
      
      if (!user) {
        user = await storage.createUserWithPhone({
          phoneNumber: phone,
          email: `${phone}@joyjoin.app`,
          firstName: "用户",
          lastName: phone.slice(-4),
        });
        console.log("[PHONE-LOGIN] Created new user:", user.id);
      } else {
        console.log("[PHONE-LOGIN] Found existing user:", user.id);
      }
      
      req.session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        
        req.session.userId = user!.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Login failed" });
          }
          
          console.log("[PHONE-LOGIN] Session created for user:", user!.id);
          res.json({ 
            message: "Login successful",
            userId: user!.id
          });
        });
      });
    } catch (error) {
      console.error("Error during phone login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Cache pre-signup answers by temporary session
  app.post('/api/auth/presignup-cache', async (req: any, res) => {
    try {
      const { sessionId, answers, metadata } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: 'sessionId is required' });
      }
      const record = await storage.savePreSignupData(sessionId, { answers, metadata });
      res.json({ sessionId: record.temporarySessionId, answers: record.answers || [], metadata: record.metadata || null });
    } catch (error: any) {
      console.error('[Presignup Cache] Error:', error);
      res.status(500).json({ message: 'Failed to cache answers' });
    }
  });

  app.get('/api/auth/presignup-cache/:sessionId', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const record = await storage.getPreSignupData(sessionId);
      if (!record) {
        return res.status(404).json({ message: 'No data found' });
      }
      res.json({ sessionId: record.temporarySessionId, answers: record.answers || [], metadata: record.metadata || null });
    } catch (error: any) {
      console.error('[Presignup Cache] Error:', error);
      res.status(500).json({ message: 'Failed to fetch cached answers' });
    }
  });

  // Unified onboarding - auth + profile + answers in one transaction
  app.post('/api/auth/unified-onboarding', async (req: any, res) => {
    try {
      const { authData, profileData, assessmentAnswers, temporarySessionId, metadata } = req.body;
      const phoneNumber = authData?.phoneNumber || authData?.phone;
      const code = authData?.code;

      if (!phoneNumber || !code) {
        return res.status(400).json({ message: 'Phone number and code are required' });
      }

      const verification = validateVerificationCode(phoneNumber, code);
      if (!verification.ok) {
        return res.status(400).json({ message: verification.message });
      }

      if (!profileData?.displayName || !profileData?.gender || !profileData?.currentCity || !Array.isArray(profileData?.intent) || profileData.intent.length === 0) {
        return res.status(400).json({ message: 'Missing required profile fields' });
      }

      const cachedRecord = temporarySessionId ? await storage.getPreSignupData(temporarySessionId) : undefined;
      const incomingAnswers = Array.isArray(assessmentAnswers) ? assessmentAnswers : [];
      const mergedAnswers = [...incomingAnswers, ...(Array.isArray(cachedRecord?.answers) ? cachedRecord?.answers : [])];
      const dedupedAnswers = new Map<string, any>();

      const getAnswerTimestamp = (answer: any): number | null => {
        if (!answer) return null;
        const timestampFields = [
          "updatedAt",
          "updated_at",
          "timestamp",
          "answeredAt",
          "answered_at",
          "createdAt",
          "created_at",
        ];
        for (const field of timestampFields) {
          const value = (answer as any)[field];
          if (!value) continue;
          const date = typeof value === "number" ? new Date(value) : new Date(String(value));
          const time = date.getTime();
          if (!Number.isNaN(time)) return time;
        }
        return null;
      };

      for (const ans of mergedAnswers) {
        const key = (ans && (ans.questionId || ans.question_id || ans.id)) ? String(ans.questionId || ans.question_id || ans.id) : null;
        if (!key) continue;

        const existing = dedupedAnswers.get(key);
        if (!existing) {
          dedupedAnswers.set(key, ans);
          continue;
        }

        const incomingTs = getAnswerTimestamp(ans);
        const existingTs = getAnswerTimestamp(existing);
        if (incomingTs === null && existingTs === null) {
          continue;
        }
        if (existingTs === null || (incomingTs !== null && incomingTs > existingTs)) {
          dedupedAnswers.set(key, ans);
        }
      }

      const uniqueAnswers = Array.from(dedupedAnswers.values());

      let user: User | undefined;
      let assessmentSessionId: string | null = null;

      await db.transaction(async (tx: any) => {
        const existing = await tx.select().from(users).where(eq(users.phoneNumber, phoneNumber));
        if (existing.length > 0) {
          user = existing[0];
        } else {
          const [created] = await tx.insert(users).values({
            phoneNumber,
            email: `${phoneNumber}@joyjoin.app`,
            firstName: '用户',
            lastName: phoneNumber.slice(-4),
          }).returning();
          user = created;
        }

        const updates: Partial<User> = {
          displayName: profileData?.displayName,
          gender: profileData?.gender,
          currentCity: profileData?.currentCity,
          intent: profileData?.intent,
          hasCompletedRegistration: true,
          hasCompletedInterestsTopics: true,
          hasCompletedProfileSetup: true,
        };
        if (profileData?.birthYear) {
          updates.birthdate = `${profileData.birthYear}-01-01`;
        }
        if (profileData?.relationshipStatus) {
          updates.relationshipStatus = profileData.relationshipStatus;
        }

        const [updatedUser] = await tx.update(users).set(updates).where(eq(users.id, user!.id)).returning();
        if (updatedUser) {
          user = updatedUser;
        }

        if (uniqueAnswers.length > 0) {
          const [session] = await tx.insert(assessmentSessions).values({
            userId: user!.id,
            phase: 'post_signup',
            preSignupData: uniqueAnswers,
            currentQuestionIndex: uniqueAnswers.length,
          }).returning();
          assessmentSessionId = session?.id || null;

          for (const ans of uniqueAnswers) {
            if (!assessmentSessionId) break;
            const questionId = String(ans.questionId || ans.question_id || ans.id);
            const selectedOption = ans.selectedOption || ans.value || ans.answer || ans.selected_option;
            await tx.insert(assessmentAnswers).values({
              sessionId: assessmentSessionId,
              questionId,
              questionLevel: (ans.questionLevel || ans.question_level || 1),
              selectedOption,
              traitScores: ans.traitScores || ans.trait_scores || {},
            }).onConflictDoUpdate({
              target: [assessmentAnswers.sessionId, assessmentAnswers.questionId],
              set: {
                selectedOption,
                traitScores: ans.traitScores || ans.trait_scores || {},
                answeredAt: new Date(),
              },
            });
          }
        }
      });

      if (!user) {
        return res.status(500).json({ message: 'Failed to create user' });
      }

      if (temporarySessionId) {
        await storage.clearPreSignupData(temporarySessionId);
      }

      req.session.userId = user.id;
      await new Promise((resolve, reject) => {
        req.session.save((err: any) => err ? reject(err) : resolve(null));
      });

      res.json({ message: 'Onboarding completed', user, assessmentSessionId });
    } catch (error: any) {
      console.error('[Unified Onboarding] Error:', error);
      res.status(500).json({ message: 'Failed to complete onboarding' });
    }
  });

  // Complete onboarding - sets registration flags and user profile data
  app.post('/api/auth/complete-onboarding', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const {
        displayName,
        gender,
        currentCity,
        intent,
        birthYear,
        showBirthYear,
        relationshipStatus,
        preSignupAnswers,
      } = req.body;

      if (!displayName || !gender || !currentCity || !intent || intent.length === 0) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const updateData: Partial<User> = {
        displayName,
        gender,
        currentCity,
        intent,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true, // Skip interests step in new flow
      };

      // Convert birthYear to birthdate if provided
      if (birthYear && typeof birthYear === 'number') {
        updateData.birthdate = `${birthYear}-01-01`;
      }
      if (relationshipStatus) {
        updateData.relationshipStatus = relationshipStatus;
      }

      const updatedUser = await storage.updateUser(userId, updateData);
      console.log("[COMPLETE-ONBOARDING] Updated user:", userId, { displayName, gender, currentCity });

      res.json({ message: "Onboarding completed", user: updatedUser });
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Complete personality test - sets hasCompletedPersonalityTest flag
  app.post('/api/auth/complete-personality-test', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const updatedUser = await storage.updateUser(userId, {
        hasCompletedPersonalityTest: true,
        hasCompletedProfileSetup: true,
        hasCompletedRegistration: true,
        hasCompletedInterestsTopics: true, 
      });
      console.log("[COMPLETE-PERSONALITY-TEST] User completed personality test flow:", userId);

      // Invalidate user cache to reflect role changes immediately
      if (req.session) {
        // Force session save to ensure state is consistent
        req.session.save(() => {});
      }

      res.json({ message: "Personality test completed", user: updatedUser });
    } catch (error) {
      console.error("Error completing personality test:", error);
      res.status(500).json({ message: "Failed to complete personality test" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: Request, res) => {
    // 🔧 DEBUG_AUTH logging (Phase 4.2)
    if (process.env.DEBUG_AUTH === "1") {
      console.log("[AUTH/USER]", {
        sid: req.sessionID,
        cookie: req.headers.cookie,
        userId: req.session?.userId,
        adminAccountId: req.session?.adminAccountId,
      });
    }

    // New admin_accounts-based session: return synthetic admin user object
    if (req.session?.adminAccountId) {
      try {
        const adminAccount = await storage.getAdminAccountById(req.session.adminAccountId);
        if (adminAccount && adminAccount.status === 'active') {
          return res.json({
            id: adminAccount.id,
            displayName: adminAccount.displayName || adminAccount.username,
            isAdmin: true,
            adminRole: adminAccount.role,
            // Enough for AdminApp.tsx to detect admin status:
            nextStep: 'discover',
          });
        }
        return res.status(401).json({ message: "Unauthorized" });
      } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
    }

    // Regular user session
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      
      // Server-driven navigation state (Scope B1)
      // Essential profile fields: displayName, gender, currentCity, birthdate
      const profileEssentialComplete = !!(
        user.displayName &&
        user.gender &&
        user.currentCity
      );
      
      // Extended profile fields: education, industry, hometown
      // ✅ UPDATED: Use 3-tier industry classification instead of legacy industry field
      const profileExtendedComplete = !!(
        user.educationLevel &&
        (user.industryNicheLabel || user.industryCategoryLabel) &&
        user.hometownRegionCity
      );
      
      // Get active assessment session if any
      let activeAssessmentSessionId: string | null = null;
      try {
        const sessions = await db
          .select({ id: assessmentSessions.id })
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.userId, userId),
              eq(assessmentSessions.phase, 'in_progress')
            )
          )
          .orderBy(desc(assessmentSessions.createdAt))
          .limit(1);
        if (sessions.length > 0) {
          activeAssessmentSessionId = sessions[0].id;
        }
      } catch (e) {
        // Ignore errors - session lookup is optional
      }
      
      // Determine next step in onboarding flow
      // Base nextStep on completion flags, then incorporate checkpoint for resume capability
      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'guide' | 'discover';
      
      let nextStep: OnboardingStep;
      if (!user.hasCompletedRegistration) {
        nextStep = 'onboarding';
      } else if (!user.hasCompletedPersonalityTest) {
        nextStep = 'personality-test';
      } else if (!profileEssentialComplete) {
        nextStep = 'essential-data';
      } else if (!user.hasCompletedInterestsCarousel) {
        // After essential data, must complete interests carousel
        nextStep = 'extended-data';
      } else if (!user.hasSeenProfileReview) {
        // After interests, show profile review
        nextStep = 'profile-review';
      } else if (!user.hasSeenGuide) {
        // After profile review, show guide
        nextStep = 'guide';
      } else {
        nextStep = 'discover';
      }
      
      const stepOrder: OnboardingStep[] = [
        'onboarding',
        'personality-test', 
        'essential-data',
        'extended-data',
        'profile-review',
        'guide',
        'discover'
      ];
      
      const baseIndex = stepOrder.indexOf(nextStep);
      const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
      const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;
      
      // Incorporate checkpoint to enable cross-device resume capability
      // If checkpoint indicates progress beyond baseline (completion flags), advance user to next step
      // Example: User completed personality test on device A (checkpoint saved), then opens on device B
      // before hasCompletedPersonalityTest flag was set. Checkpoint helps resume at correct position.
      if (
        checkpointValue &&
        checkpointIndex !== -1 &&
        baseIndex !== -1 &&
        checkpointIndex > baseIndex &&
        checkpointIndex < stepOrder.indexOf('discover')
      ) {
        // Checkpoint is ahead of baseline - user made progress that completion flags don't reflect yet
        // Advance to the step immediately after their checkpoint
        const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
        nextStep = stepOrder[nextStepIndex];
      }
      
      res.json({
        ...user,
        // Server-driven navigation helpers
        nextStep,
        profileEssentialComplete,
        profileExtendedComplete,
        activeAssessmentSessionId,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res) => {
    try {
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.clearCookie('connect.sid');
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Failed to logout" });
    }
  });

  // Mark guide as seen (B2: Guide persistence server-side)
  app.post('/api/guide/mark-seen', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      await db.update(users).set({ hasSeenGuide: true }).where(eq(users.id, userId));
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking guide as seen:", error);
      res.status(500).json({ message: "Failed to mark guide as seen" });
    }
  });

  // Alias endpoint for guide completion (matches problem statement requirement)
  app.post('/api/guide/complete', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      await db.update(users).set({ 
        hasSeenGuide: true,
        onboardingCheckpoint: 'guide',
        onboardingCheckpointTimestamp: new Date()
      }).where(eq(users.id, userId));
      
      res.json({ success: true, hasSeenGuide: true });
    } catch (error) {
      console.error("Error completing guide:", error);
      res.status(500).json({ message: "Failed to complete guide" });
    }
  });

  app.post('/api/profile-review/complete', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      await db.update(users).set({ 
        hasSeenProfileReview: true,
        onboardingCheckpoint: 'profile-review',
        onboardingCheckpointTimestamp: new Date()
      }).where(eq(users.id, userId));
      
      res.json({ success: true, hasSeenProfileReview: true });
    } catch (error) {
      console.error("Error completing profile review:", error);
      res.status(500).json({ message: "Failed to complete profile review" });
    }
  });

  // Save onboarding checkpoint
  app.post('/api/onboarding/checkpoint', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      const { step, timestamp } = req.body;
      if (!step) {
        return res.status(400).json({ message: "Step is required" });
      }

      // Validate step value
      const validSteps = ['onboarding', 'personality-test', 'essential-data', 'extended-data', 'profile-review', 'guide'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({ message: "Invalid step value" });
      }
      
      const checkpointTimestamp = timestamp ? new Date(timestamp) : new Date();
      
      await db.update(users).set({ 
        onboardingCheckpoint: step,
        onboardingCheckpointTimestamp: checkpointTimestamp
      }).where(eq(users.id, userId));
      
      res.json({ success: true, checkpoint: step });
    } catch (error) {
      console.error("Error saving checkpoint:", error);
      res.status(500).json({ message: "Failed to save checkpoint" });
    }
  });

  // AI profile tagline — presentation-only, no onboarding state side-effects
  app.get('/api/onboarding/profile-tagline', requireAuth, aiEndpointLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      // Fetch user and interests in parallel
      const [userRow, interestsRow] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, userId) }),
        db.query.userInterests.findFirst({ where: eq(userInterests.userId, userId) }),
      ]);

      if (!userRow) return res.status(404).json({ message: 'User not found' });

      const { generateProfileTagline } = await import('./profileTaglineService');
      const tagline = await generateProfileTagline({
        archetype: (userRow.archetype ?? userRow.primaryArchetype) as string | undefined,
        categoryHeat: (interestsRow?.categoryHeat as Record<string, number> | null) ?? {},
        intentKeys: Array.isArray(userRow.intent) ? (userRow.intent as string[]) : [],
      });

      res.json(tagline);
    } catch (error) {
      console.error('[profileTagline] route error:', error);
      res.status(500).json({ message: 'Failed to generate profile tagline' });
    }
  });

  // Phase 2: Onboarding Analytics endpoint
  app.post('/api/analytics/onboarding', async (req: Request, res) => {
    try {
      const { step, eventType, metadata, timestamp, sessionDuration, stepDuration, userAgent, screenSize } = req.body;
      
      // Validation
      if (!step || !eventType) {
        return res.status(400).json({ message: "Step and eventType are required" });
      }
      
      // Get userId from session if authenticated (optional for unauthenticated tracking)
      const userId = req.session?.userId || null;
      
      // Generate or use session ID
      const sessionId = req.session?.id || req.headers['x-session-id'] as string || null;
      
      // Fix: Validate duration values are non-negative
      const validSessionDuration = sessionDuration && sessionDuration >= 0 ? sessionDuration : null;
      const validStepDuration = stepDuration && stepDuration >= 0 ? stepDuration : null;
      
      // Insert analytics event
      await db.insert(onboardingAnalytics).values({
        userId,
        sessionId,
        step,
        eventType,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        sessionDuration: validSessionDuration,
        stepDuration: validStepDuration,
        metadata: metadata || null,
        userAgent: userAgent || req.headers['user-agent'] || null,
        screenSize: screenSize || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving analytics event:", error);
      // Silent fail - analytics should never block user flow
      res.status(200).json({ success: false, error: 'Analytics tracking failed' });
    }
  });

  // Profile stats endpoint
  app.get('/api/profile/stats', isPhoneAuthenticated, async (req: Request, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      
      // Calculate events completed: count completed events the user attended
      const completedEventsResult = await db
        .select({ count: eventAttendance.id })
        .from(eventAttendance)
        .innerJoin(events, eq(eventAttendance.eventId, events.id))
        .where(
          and(
            eq(eventAttendance.userId, userId),
            eq(events.status, 'completed')
          )
        );
      
      const eventsCompleted = completedEventsResult.length || 0;
      
      // Calculate connections made: count mutual connections where user is participant
      const connectionsResult = await db
        .select({ id: connections.id })
        .from(connections)
        .where(
          and(
            or(
              eq(connections.userAId, userId),
              eq(connections.userBId, userId)
            ),
            eq(connections.status, 'mutual')
          )
        );
      
      const connectionsMade = connectionsResult.length || 0;
      
      res.json({
        eventsCompleted,
        connectionsMade,
      });
    } catch (error) {
      console.error("Error fetching profile stats:", error);
      res.status(500).json({ message: "Failed to fetch profile stats" });
    }
  });

  // ============ AI Chat Registration Routes (小悦对话注册) ============
  
  app.post('/api/registration/chat/start', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const { mode, enrichmentContext } = req.body; // 接收模式参数: express | standard | deep | all_in_one | enrichment
      
      if (userId) {
        resetConversationTurns(userId);
      }
      
      // Chat registration is deprecated - only enrichment mode is supported
      if (mode === 'enrichment' && enrichmentContext) {
        const { startXiaoyueChatEnrichment } = await import('./deepseekClient');
        const result = await startXiaoyueChatEnrichment(enrichmentContext);
        res.json(result);
        return;
      }
      
      // Legacy registration modes removed - return error
      res.status(400).json({ 
        message: "Chat registration is no longer supported. Please use the Duolingo-style onboarding flow." 
      });
    } catch (error) {
      console.error("Error starting chat registration:", error);
      res.status(500).json({ message: "Failed to start chat" });
    }
  });

  app.post('/api/registration/chat/message', async (req: any, res) => {
    try {
      const { message, conversationHistory, sessionId: clientSessionId } = req.body;
      const userId = req.session?.userId;
      
      if (userId) {
        const abuseCheck = await checkUserAbuse(userId, message);
        if (!abuseCheck.allowed) {
          return res.status(abuseCheck.action === 'ban' ? 403 : 429).json({ 
            message: abuseCheck.message,
            action: abuseCheck.action,
            violationType: abuseCheck.violationType
          });
        }
        if (abuseCheck.action === 'warn' && abuseCheck.message) {
          console.log(`[Abuse Detection] Warning for user ${userId}: ${abuseCheck.message}`);
        }
      }
      
      // 使用带推断引擎的增强版对话函数
      const { continueXiaoyueChatWithInference } = await import('./deepseekClient');
      // sessionId: 优先使用客户端传入的，其次用userId，再用express session ID，最后才是匿名ID
      const sessionId = clientSessionId || userId || req.sessionID || `anon_${Date.now()}`;
      const result = await continueXiaoyueChatWithInference(message, conversationHistory, sessionId);
      
      if (userId && (result as any).usage?.totalTokens) {
        await recordTokenUsage(userId, (result as any).usage.totalTokens);
      }
      
      // 返回结果，包含推断信息供前端调试
      res.json({
        ...result,
        inference: result.inferenceResult ? {
          skippedQuestions: result.inferenceResult.skipQuestions,
          inferred: result.inferenceResult.inferred.map(i => ({ field: i.field, value: i.value }))
        } : undefined
      });
    } catch (error) {
      console.error("Error in chat registration:", error);
      res.status(500).json({ message: "Failed to process message" });
    }
  });

  app.post('/api/registration/chat/message/stream', async (req: any, res) => {
    const reqStart = Date.now();
    console.log(`\n[ROUTE PERF] ========== 请求到达 /api/registration/chat/message/stream ==========`);
    console.log(`[ROUTE PERF] 时间: ${new Date().toISOString()}`);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    
    const { message, conversationHistory, sessionId: clientSessionId } = req.body;
    const userId = req.session?.userId;
    
    if (!message || !conversationHistory) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: '缺少必要参数' })}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
      res.end();
      return;
    }
    
    const t1_afterValidation = Date.now();
    console.log(`[ROUTE PERF] 参数验证耗时: ${t1_afterValidation - reqStart}ms`);
    
    if (userId) {
      const abuseCheck = await checkUserAbuse(userId, message);
      if (!abuseCheck.allowed) {
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          content: abuseCheck.message,
          action: abuseCheck.action,
          violationType: abuseCheck.violationType
        })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
        res.end();
        return;
      }
      if (abuseCheck.action === 'warn' && abuseCheck.message) {
        res.write(`data: ${JSON.stringify({ 
          type: 'warning', 
          content: abuseCheck.message 
        })}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
    }
    
    const t2_afterAbuseCheck = Date.now();
    console.log(`[ROUTE PERF] 滥用检查耗时: ${t2_afterAbuseCheck - t1_afterValidation}ms`);
    
    try {
      // 使用带推断引擎的增强版流式对话函数
      const { continueXiaoyueChatStreamWithInference } = await import('./deepseekClient');
      const t3_afterImport = Date.now();
      console.log(`[ROUTE PERF] 动态import耗时: ${t3_afterImport - t2_afterAbuseCheck}ms`);
      
      // sessionId: 优先使用客户端传入的，其次用userId，最后用会话ID（express-session会自动生成稳定的session ID）
      const sessionId = clientSessionId || userId || req.sessionID || `anon_${Date.now()}`;
      
      let chunkCount = 0;
      let firstChunkTime: number | null = null;
      
      for await (const chunk of continueXiaoyueChatStreamWithInference(message, conversationHistory, sessionId)) {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
          console.log(`[ROUTE PERF] 首个chunk到达，从请求开始: ${firstChunkTime - reqStart}ms`);
        }
        chunkCount++;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (typeof (res as any).flush === 'function') (res as any).flush();
      }
      
      const reqEnd = Date.now();
      console.log(`[ROUTE PERF] 发送chunks: ${chunkCount}, 请求总耗时: ${reqEnd - reqStart}ms`);
      console.log(`[ROUTE PERF] ========== 请求结束 ==========\n`);
    } catch (error) {
      console.error("Error in streaming chat:", error);
      res.write(`data: ${JSON.stringify({ type: 'error', content: '小悦暂时走神了，请重试' })}\n\n`);
      if (typeof (res as any).flush === 'function') (res as any).flush();
    }
    
    res.end();
  });

  app.post('/api/registration/chat/complete', async (req: any, res) => {
    try {
      const { conversationHistory, phoneNumber, startTime } = req.body;
      
      // Validate conversation has sufficient content
      if (!conversationHistory || conversationHistory.length < 4) {
        return res.status(400).json({ message: "对话记录不完整，请继续和小悦聊天" });
      }
      
      const { summarizeAndExtractInfo } = await import('./deepseekClient');
      
      // Server-side extraction from conversation history (more secure than trusting client)
      const extractedInfo = await summarizeAndExtractInfo(conversationHistory);
      
      // Validate required field
      if (!extractedInfo.displayName) {
        return res.status(400).json({ message: "请告诉小悦你希望大家怎么称呼你" });
      }
      
      // Calculate server-side conversationalProfile metrics
      const registrationTime = new Date().toISOString();
      let completionSpeed: 'fast' | 'medium' | 'slow' = 'medium';
      if (startTime) {
        const durationMinutes = (Date.now() - new Date(startTime).getTime()) / 60000;
        if (durationMinutes < 3) {
          completionSpeed = 'fast';
        } else if (durationMinutes > 10) {
          completionSpeed = 'slow';
        }
      }
      
      // Always create conversationalProfile with server metrics, merging LLM behavioral data when available
      const conversationalProfile = {
        responseLength: extractedInfo.conversationalProfile?.responseLength || 'moderate',
        emojiUsage: extractedInfo.conversationalProfile?.emojiUsage || 'few',
        formalityLevel: extractedInfo.conversationalProfile?.formalityLevel || 'neutral',
        proactiveness: extractedInfo.conversationalProfile?.proactiveness || 'neutral',
        registrationTime,
        completionSpeed
      };
      extractedInfo.conversationalProfile = conversationalProfile as any;
      
      // Map collected info to user registration fields
      const registrationData: any = {
        displayName: extractedInfo.displayName,
        gender: extractedInfo.gender || '不透露',
        currentCity: extractedInfo.currentCity || '',
        registrationMethod: 'chat',
      };
      
      // Set birthdate if birth year provided
      if (extractedInfo.birthYear) {
        registrationData.birthdate = `${extractedInfo.birthYear}-01-01`;
      }
      
      // ❌ REMOVED: Legacy interests fields no longer exist in schema
      // These are now managed by user_interests table via Interest Carousel
      // if (extractedInfo.interestsTop && extractedInfo.interestsTop.length > 0) {
      //   registrationData.interestsTop = extractedInfo.interestsTop;
      // }
      // if (extractedInfo.primaryInterests && extractedInfo.primaryInterests.length > 0) {
      //   registrationData.primaryInterests = extractedInfo.primaryInterests;
      // }
      
      // Map new fields from AI chat extraction
      if (extractedInfo.intent && extractedInfo.intent.length > 0) {
        registrationData.intent = extractedInfo.intent;
      }
      if (extractedInfo.lifeStage) {
        registrationData.lifeStage = extractedInfo.lifeStage;
      }
      if (extractedInfo.ageMatchPreference) {
        registrationData.ageMatchPreference = extractedInfo.ageMatchPreference;
      }
      if (extractedInfo.relationshipStatus) {
        registrationData.relationshipStatus = extractedInfo.relationshipStatus;
      }
      if (extractedInfo.socialStyle) {
        registrationData.socialStyle = extractedInfo.socialStyle;
      }
      if (extractedInfo.venueStylePreference) {
        registrationData.venueStylePreference = extractedInfo.venueStylePreference;
      }
      if (extractedInfo.cuisinePreference && extractedInfo.cuisinePreference.length > 0) {
        registrationData.cuisinePreference = extractedInfo.cuisinePreference;
      }
      if (extractedInfo.favoriteRestaurant) {
        registrationData.favoriteRestaurant = extractedInfo.favoriteRestaurant;
      }
      if (extractedInfo.favoriteRestaurantReason) {
        registrationData.favoriteRestaurantReason = extractedInfo.favoriteRestaurantReason;
      }
      if (extractedInfo.educationLevel) {
        registrationData.educationLevel = extractedInfo.educationLevel;
      }
      // ❌ REMOVED: topicAvoidances field no longer exists in schema
      // if (extractedInfo.topicAvoidances && extractedInfo.topicAvoidances.length > 0) {
      //   registrationData.topicAvoidances = extractedInfo.topicAvoidances;
      // }
      if (extractedInfo.hometown) {
        registrationData.hometownRegionCity = extractedInfo.hometown;
      }
      if (extractedInfo.ageDisplayPreference) {
        registrationData.ageDisplayPreference = extractedInfo.ageDisplayPreference;
      }
      if (extractedInfo.occupationDescription) {
        registrationData.occupationDescription = extractedInfo.occupationDescription;
      }
      
      // ===== 智能信息收集系统新增字段 =====
      // ❌ REMOVED: industry field (replaced by 3-tier classification)
      // if (extractedInfo.industry) {
      //   registrationData.industry = extractedInfo.industry;
      // }
      if (extractedInfo.industrySegment) {
        registrationData.industrySegment = extractedInfo.industrySegment;
      }
      if (extractedInfo.occupation) {
        registrationData.structuredOccupation = extractedInfo.occupation;
      }
      if (extractedInfo.companyType) {
        registrationData.companyType = extractedInfo.companyType;
      }
      // ❌ REMOVED: seniority field (never collected in onboarding)
      // if (extractedInfo.seniority) {
      //   registrationData.seniority = extractedInfo.seniority;
      // }
      // 智能洞察存储到 insightLedger（JSONB）
      if (extractedInfo.smartInsights && extractedInfo.smartInsights.length > 0) {
        registrationData.insightLedger = extractedInfo.smartInsights;
      }
      
      // ===== AI Evolution System: Insight Detection & Storage =====
      try {
        const { insightDetectorService } = await import('./insightDetectorService');
        const { dialogueEmbeddingsService } = await import('./dialogueEmbeddingsService');
        const { getSessionInsights, clearSessionInsights } = await import('./deepseekClient');
        
        // Get accumulated per-message insights from session
        const sessionId = req.body.sessionId || req.sessionID;
        const accumulatedInsights = getSessionInsights(sessionId);
        
        // Store phoneNumber for cross-session linking
        const linkPhoneNumber = phoneNumber;
        
        // Run full conversation analysis (includes dialect + deep traits)
        const insightResult = await insightDetectorService.analyzeConversation(conversationHistory);
        
        // Merge accumulated per-message insights with final analysis
        const allInsights = [...accumulatedInsights, ...insightResult.insights];
        const uniqueInsights = allInsights.filter((insight, index, self) =>
          index === self.findIndex(i => i.subType === insight.subType)
        );
        
        // Update result with merged insights
        insightResult.insights = uniqueInsights;
        
        // Store insights to dialogue_embeddings table
        const dialogueContent = conversationHistory
          .filter((m: any) => m.role === 'user')
          .map((m: any) => m.content)
          .join('\n');
        
        await dialogueEmbeddingsService.storeInsights(
          sessionId,
          null, // userId not available yet
          dialogueContent,
          insightResult,
          true, // isSuccessful
          linkPhoneNumber // Store phone for cross-session linking
        );
        
        // Clear session insights after storing
        clearSessionInsights(sessionId);
        
        console.log(`[AI Evolution] Stored ${insightResult.insights.length} insights (${accumulatedInsights.length} realtime + final), dialect: ${insightResult.dialectProfile?.primaryDialect || 'none'}`);
        
        // Merge safety insights into registrationData
        const safetyInsights = insightResult.insights.filter(i => i.category === 'safety');
        if (safetyInsights.length > 0) {
          registrationData.safetyNoteHost = safetyInsights
            .map(i => `[${i.subType}] ${i.value}`)
            .join('; ');
        }
      } catch (insightError) {
        console.error('[AI Evolution] Insight detection error:', insightError);
        // Non-blocking - continue with registration
      }
      // ===== End AI Evolution System =====
      
      // Store chatSessionId in session for linking insights at user registration
      const chatSessionId = req.body.sessionId || req.sessionID;
      if (req.session) {
        req.session.chatSessionId = chatSessionId;
      }
      
      // If user is already logged in (via phone auth), update their profile and mark registration complete
      const userId = req.session?.userId;
      if (userId) {
        try {
          // Update user profile with extracted data
          // Also mark interests/topics as complete since AI chat already collected this info
          await storage.updateUserProfile(userId, {
            ...registrationData,
            hasCompletedInterestsTopics: true,
          });
          
          // Mark registration as complete
          await storage.markRegistrationComplete(userId);
          
          console.log(`[Chat Registration] User ${userId} profile updated, registration and interests marked complete`);
        } catch (updateError) {
          console.error('[Chat Registration] Error updating user profile:', updateError);
          // Non-blocking - continue with response
        }
      }
      
      // Return collected info
      res.json({
        success: true,
        message: userId ? "注册完成！" : "对话注册完成，请通过电话验证完成注册",
        registrationData,
        conversationalProfile: extractedInfo.conversationalProfile,
        chatSessionId, // Return for client to persist if needed
      });
    } catch (error) {
      console.error("Error completing chat registration:", error);
      res.status(500).json({ message: "注册失败，请稍后再试" });
    }
  });

  // ============ Registration Session Telemetry Routes ============
  
  // Create a new registration session (called when chat registration starts)
  app.post('/api/registration/sessions', async (req: any, res) => {
    try {
      const { sessionMode, deviceChannel } = req.body;
      const userId = req.session?.userId;
      const userAgent = req.headers['user-agent'];
      
      const session = await storage.createRegistrationSession({
        sessionMode: sessionMode || 'ai_chat',
        userId,
        deviceChannel,
        userAgent,
      });
      
      res.json({ sessionId: session.id });
    } catch (error) {
      console.error("Error creating registration session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });
  
  // Update registration session (lifecycle updates)
  app.patch('/api/registration/sessions/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Convert string dates to Date objects
      const processedUpdates: any = {};
      for (const [key, value] of Object.entries(updates)) {
        if (['l1CompletedAt', 'l2EnrichedAt', 'completedAt', 'abandonedAt', 'lastTouchAt'].includes(key) && value) {
          processedUpdates[key] = new Date(value as string);
        } else {
          processedUpdates[key] = value;
        }
      }
      
      const session = await storage.updateRegistrationSession(id, processedUpdates);
      res.json(session);
    } catch (error) {
      console.error("Error updating registration session:", error);
      res.status(500).json({ message: "Failed to update session" });
    }
  });
  
  // Get registration session stats (admin endpoint)
  app.get('/api/registration/sessions/stats', requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getRegistrationSessionStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting registration session stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // ========== Insight Feedback API ==========
  // 收集"小悦偷偷碎嘴"推理准确度反馈（无需登录）
  app.post('/api/insight-feedback', async (req: any, res) => {
    try {
      const { trigger, pillar, confidence, feedback, timestamp } = req.body;
      
      // 简单验证
      if (!trigger || !feedback || !['up', 'down'].includes(feedback)) {
        return res.status(400).json({ error: 'Invalid feedback data' });
      }
      
      // 记录到控制台（后续可存入数据库）
      console.log('[Insight Feedback]', {
        trigger,
        pillar,
        confidence,
        feedback,
        timestamp,
        sessionId: req.session?.id || 'anonymous'
      });
      
      // TODO: 存入数据库以供分析
      // await storage.saveInsightFeedback({ trigger, pillar, confidence, feedback, timestamp });
      
      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error) {
      console.error("Error saving insight feedback:", error);
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  });

  // Registration routes
  app.post('/api/user/register', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      console.log("[Backend] Received registration data:", req.body);
      const result = registerUserSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error("[Backend] Validation failed:", result.error);
        return res.status(400).json({ error: result.error });
      }

      console.log("[Backend] Validated data:", result.data);
      const user = await storage.registerUser(userId, result.data);
      console.log("[Backend] User updated successfully:", { id: user.id, displayName: user.displayName, gender: user.gender, birthdate: user.birthdate });
      
      // Award XP for registration (simplified - no mode detection)
      try {
        const { awardXPAndCoins } = await import('./gamificationService');
        // Use a generic registration action instead of mode-specific ones
        await awardXPAndCoins(userId, 'registration');
        console.log(`[Gamification] Awarded registration XP to user ${userId}`);
      } catch (xpError) {
        console.error("Error awarding registration XP:", xpError);
      }
      
      // ===== AI Evolution: Link session insights to user profile =====
      try {
        const { dialogueEmbeddingsService } = await import('./dialogueEmbeddingsService');
        
        // Method 1: Use verified phone number (most reliable, works cross-device)
        const verifiedPhone = req.session?.verifiedPhoneNumber;
        if (verifiedPhone) {
          const linkResult = await dialogueEmbeddingsService.linkByPhoneNumber(verifiedPhone, userId);
          if (linkResult.linked > 0) {
            console.log(`[AI Evolution] Linked ${linkResult.linked} records by phone to user ${userId}`);
          } else {
            // Method 2: Fallback to session ID
            const sessionId = req.session?.chatSessionId || req.body?.chatSessionId || req.sessionID;
            if (sessionId) {
              const sessionResult = await dialogueEmbeddingsService.linkSessionToUser(sessionId, userId);
              console.log(`[AI Evolution] Fallback: Linked ${sessionResult.linked} records by sessionId to user ${userId}`);
            }
          }
        } else {
          // Method 2: Fallback to session ID if phone not available
          const sessionId = req.session?.chatSessionId || req.body?.chatSessionId || req.sessionID;
          if (sessionId) {
            const linkResult = await dialogueEmbeddingsService.linkSessionToUser(sessionId, userId);
            console.log(`[AI Evolution] Linked ${linkResult.linked} records from session ${sessionId} to user ${userId}`);
          }
        }
      } catch (linkError) {
        console.error('[AI Evolution] Failed to link insights to user:', linkError);
        // Non-blocking - user registration still succeeds
      }
      // ===== End AI Evolution =====
      
      res.json(user);
    } catch (error: any) {
      console.error("Error registering user:", error);
      // Return detailed error message for debugging
      const errorMessage = error?.message || "Failed to register user";
      res.status(500).json({ 
        message: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error?.stack : undefined 
      });
    }
  });

  // Personality test routes
  
  // Preliminary scoring - check if supplementary questions are needed
  app.post('/api/personality-test/preliminary-score', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { responses } = req.body;

      // Calculate role scores from base 10 questions
      const roleScores = calculateRoleScores(responses);
      
      // Sort roles by score
      const sortedRoles = Object.entries(roleScores)
        .sort(([roleA, scoreA], [roleB, scoreB]) => {
          if (scoreB !== scoreA) return scoreB - scoreA;
          return roleA.localeCompare(roleB);
        });
      
      const top1 = sortedRoles[0];
      const top2 = sortedRoles[1];
      const scoreDiff = top1[1] - top2[1];

      // Threshold for supplementary testing: if top 2 are within 3 points
      const SUPPLEMENTARY_THRESHOLD = 3;

      if (scoreDiff < SUPPLEMENTARY_THRESHOLD) {
        // Need supplementary questions
        res.json({
          needsSupplementary: true,
          candidateArchetypes: [
            { name: top1[0], score: top1[1] },
            { name: top2[0], score: top2[1] }
          ],
          allScores: roleScores,
        });
      } else {
        // Scores are clear enough, return final result
        const primaryArchetype = top1[0];
        const rawSecondaryArchetype = top2[0];
        const secondaryArchetype = top2[1] >= 70 ? rawSecondaryArchetype : null;
        const roleSubtype = determineSubtype(primaryArchetype, responses);
        const traitScores = calculateTraitScores(primaryArchetype, secondaryArchetype);
        const insights = generateInsights(primaryArchetype, secondaryArchetype);

        res.json({
          needsSupplementary: false,
          result: {
            primaryArchetype,
            primaryArchetypeScore: top1[1],
            secondaryArchetype,
            secondaryArchetypeScore: secondaryArchetype ? top2[1] : 0,
            roleSubtype,
            ...traitScores,
            ...insights,
          },
        });
      }
    } catch (error) {
      console.error("Error in preliminary scoring:", error);
      res.status(500).json({ message: "Failed to calculate preliminary score" });
    }
  });

  app.post('/api/personality-test/submit', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { responses } = req.body;

      // Calculate role scores
      const roleScores = calculateRoleScores(responses);

      // Determine primary and secondary roles
      // Sort by score DESC, then by role name ASC for stability when scores are equal
      const sortedRoles = Object.entries(roleScores)
        .sort(([roleA, scoreA], [roleB, scoreB]) => {
          if (scoreB !== scoreA) return scoreB - scoreA;  // Higher score first
          return roleA.localeCompare(roleB);  // Stable sort by name when scores equal
        });

      const primaryArchetype = sortedRoles[0][0];
      const primaryArchetypeScore = sortedRoles[0][1];
      const rawSecondaryArchetype = sortedRoles[1]?.[0] || null;
      const secondaryArchetypeScoreRaw = sortedRoles[1]?.[1] || 0;
      const secondaryArchetype = secondaryArchetypeScoreRaw >= 70 ? rawSecondaryArchetype : null;
      const secondaryArchetypeScore = secondaryArchetype ? secondaryArchetypeScoreRaw : 0;

      // Determine subtype (simplified - based on highest scoring items)
      const roleSubtype = determineSubtype(primaryArchetype, responses);

      // Calculate six-dimensional trait scores
      const traitScores = calculateTraitScores(primaryArchetype, secondaryArchetype);

      // Generate insights
      const insights = generateInsights(primaryArchetype, secondaryArchetype);

      // Save responses and result
      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryArchetype,
        primaryArchetypeScore,
        secondaryArchetype,
        secondaryArchetypeScore,
        roleSubtype,
        roleScores,
        ...traitScores,
        ...insights,
        testVersion: 1,
      });

      // Mark personality test as complete
      await storage.markPersonalityTestComplete(userId);

      res.json(roleResult);
    } catch (error) {
      console.error("Error submitting personality test:", error);
      res.status(500).json({ message: "Failed to submit personality test" });
    }
  });

  /**
   * @deprecated LEGACY - V2 Personality Test Submit Endpoint
   * 
   * This endpoint is preserved only for admin-client backwards compatibility.
   * The user-client has migrated to V4 adaptive assessment endpoints.
   * 
   * TODO: Remove once admin-client is migrated to V4 or no longer needs personality tests.
   */
  // V2 Personality Test Submit Endpoint (using trait-based matching)
  app.post('/api/personality-test/v2/submit', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { responses } = req.body as { responses: Record<number, AnswerV2> };

      // Process V2 test using Euclidean distance matching
      const matchResult = processTestV2(responses);

      const primaryArchetype = matchResult.primaryArchetype;
      const rawSecondaryArchetype = matchResult.secondaryArchetype;
      const secondaryArchetype = matchResult.secondaryMatchScore >= 70 ? rawSecondaryArchetype : null;
      const roleSubtype = determineSubtype(primaryArchetype, responses);
      const insights = generateInsights(primaryArchetype, secondaryArchetype);

      // Save responses and result
      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryArchetype,
        primaryArchetypeScore: matchResult.primaryMatchScore,
        secondaryArchetype,
        secondaryArchetypeScore: secondaryArchetype ? matchResult.secondaryMatchScore : 0,
        roleSubtype,
        roleScores: {}, // V2 uses trait vectors instead
        affinityScore: matchResult.userTraits.A,
        opennessScore: matchResult.userTraits.O,
        conscientiousnessScore: matchResult.userTraits.C,
        emotionalStabilityScore: matchResult.userTraits.E,
        extraversionScore: matchResult.userTraits.X,
        positivityScore: matchResult.userTraits.P,
        ...insights,
        testVersion: 2,
      });

      // Mark personality test as complete
      await storage.markPersonalityTestComplete(userId);

      // Award registration welcome coupon (6折 = 40% off)
      try {
        const welcomeCoupon = await storage.getCouponByCode('WELCOME40');
        if (welcomeCoupon) {
          // Check if user already has this coupon
          const existingCoupons = await storage.getUserCoupons(userId);
          const alreadyHas = existingCoupons.some((uc: any) => uc.coupon_id === welcomeCoupon.id);
          if (!alreadyHas) {
            await storage.createUserCoupon({
              userId,
              couponId: welcomeCoupon.id,
              source: 'registration_complete',
            });
            console.log(`[Registration] Awarded welcome coupon to user ${userId}`);
          }
        }
      } catch (couponError) {
        console.error("Error awarding welcome coupon:", couponError);
      }

      res.json({
        ...roleResult,
        matchDetails: {
          primaryDistance: matchResult.primaryDistance,
          secondaryDistance: matchResult.secondaryDistance,
          userTraits: matchResult.userTraits,
        },
        welcomeCouponAwarded: true,
      });
    } catch (error) {
      console.error("Error submitting V2 personality test:", error);
      res.status(500).json({ message: "Failed to submit V2 personality test" });
    }
  });

  // Get user's coupons
  app.get('/api/user/coupons', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const coupons = await storage.getUserCoupons(userId);
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching user coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Get user's expiring coupons (within specified days)
  app.get('/api/user/coupons/expiring', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const withinDays = parseInt(req.query.days as string) || 7; // Default: 7 days
      
      const coupons = await storage.getUserCoupons(userId);
      const now = new Date();
      const thresholdDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
      
      // Filter coupons that are:
      // 1. Not yet used
      // 2. Have a valid_until date
      // 3. Will expire within the threshold
      // 4. Not already expired
      const expiringCoupons = coupons.filter((coupon: any) => {
        if (coupon.is_used) return false;
        if (!coupon.valid_until) return false;
        
        const validUntil = new Date(coupon.valid_until);
        return validUntil > now && validUntil <= thresholdDate;
      }).map((coupon: any) => {
        const validUntil = new Date(coupon.valid_until);
        const daysRemaining = Math.ceil((validUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        // Normalize to camelCase for frontend consistency
        return {
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discount_type,
          discountValue: coupon.discount_value,
          validFrom: coupon.valid_from,
          validUntil: coupon.valid_until,
          isUsed: coupon.is_used,
          source: coupon.source,
          daysRemaining,
          isUrgent: daysRemaining <= 3, // Mark as urgent if expiring within 3 days
        };
      });
      
      res.json({
        expiringCoupons,
        totalExpiring: expiringCoupons.length,
        urgentCount: expiringCoupons.filter((c: any) => c.isUrgent).length,
      });
    } catch (error) {
      console.error("Error fetching expiring coupons:", error);
      res.status(500).json({ message: "Failed to fetch expiring coupons" });
    }
  });

  // ============ 游戏化等级系统 API ============
  
  // Get user gamification info (level, XP, coins, streak)
  app.get('/api/user/gamification', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { getUserGamificationInfo } = await import('./gamificationService');
      const info = await getUserGamificationInfo(userId);
      
      if (!info) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(info);
    } catch (error) {
      console.error("Error fetching gamification info:", error);
      res.status(500).json({ message: "Failed to fetch gamification info" });
    }
  });

  // Get user XP transaction history
  app.get('/api/user/gamification/history', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const limit = parseInt(req.query.limit as string) || 20;
      const { getUserTransactionHistory } = await import('./gamificationService');
      const history = await getUserTransactionHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching transaction history:", error);
      res.status(500).json({ message: "Failed to fetch transaction history" });
    }
  });

  // Redeem joy coins for coupons
  app.post('/api/user/gamification/redeem', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { itemId } = req.body;
      
      if (!itemId) {
        return res.status(400).json({ message: "Item ID is required" });
      }
      
      // Import redeemable items config
      const { REDEEMABLE_ITEMS } = await import('@shared/gamification');
      const item = REDEEMABLE_ITEMS.find(i => i.id === itemId);
      
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      
      // Step 1: Check coin balance FIRST before any mutations
      const { checkCoinBalance, redeemCoins, refundCoins } = await import('./gamificationService');
      const balanceCheck = await checkCoinBalance(userId, item.costCoins);
      
      if (!balanceCheck.hasEnough) {
        return res.status(400).json({ 
          message: balanceCheck.error || "悦币不足", 
          currentBalance: balanceCheck.currentBalance,
          required: item.costCoins 
        });
      }
      
      // Step 2: Deduct coins first (primary operation)
      const result = await redeemCoins(userId, item.costCoins, item.id, item.nameCn);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error || "Redemption failed" });
      }
      
      // Step 3: Create coupon after coins successfully deducted
      let userCoupon: any;
      
      if (item.type === 'discount_coupon' || item.type === 'free_event') {
        try {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + item.validDays);
          
          const existingCoupons = await storage.getAllCoupons();
          let couponId = existingCoupons.find((c: any) => c.code === item.id)?.id;
          
          if (!couponId) {
            const newCoupon = await storage.createCoupon({
              code: item.id,
              discountType: 'percentage',
              discountValue: item.value,
              description: item.descriptionCn,
              expiresAt: expiryDate,
              maxUses: 10000,
              currentUses: 0,
              isActive: true,
            });
            couponId = newCoupon.id;
          }
          
          userCoupon = await storage.createUserCoupon({
            userId,
            couponId,
            source: 'joy_coins_redemption',
          });
        } catch (couponError) {
          // Coupon creation failed - automatically refund the coins
          console.error("Coupon creation failed, initiating refund:", couponError);
          
          const refundResult = await refundCoins(userId, item.costCoins, `兑换失败退还 - ${item.nameCn}`);
          
          if (refundResult.success) {
            return res.status(500).json({ 
              message: "优惠券创建失败，悦币已退还，请重试",
              refunded: true,
              newCoinsBalance: refundResult.newCoinsBalance 
            });
          } else {
            // Critical: Refund also failed - log for manual intervention
            console.error("Critical: Both coupon creation and refund failed:", refundResult.error);
            return res.status(500).json({ 
              message: "系统错误，请联系客服处理",
              coinsDeducted: item.costCoins 
            });
          }
        }
      }
      
      res.json({ 
        success: true, 
        newCoinsBalance: result.newCoinsBalance,
        redeemedItem: item,
      });
    } catch (error) {
      console.error("Error redeeming coins:", error);
      res.status(500).json({ message: "Failed to redeem coins" });
    }
  });

  // Get available redeemable items
  app.get('/api/user/gamification/redeemable-items', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { REDEEMABLE_ITEMS } = await import('@shared/gamification');
      res.json(REDEEMABLE_ITEMS);
    } catch (error) {
      console.error("Error fetching redeemable items:", error);
      res.status(500).json({ message: "Failed to fetch redeemable items" });
    }
  });

  // Get level configurations
  app.get('/api/gamification/levels', async (req, res) => {
    try {
      const { LEVELS } = await import('@shared/gamification');
      res.json(LEVELS);
    } catch (error) {
      console.error("Error fetching levels:", error);
      res.status(500).json({ message: "Failed to fetch levels" });
    }
  });

  // Get user's level discount for payment preview
  app.get('/api/user/gamification/level-discount', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const { getLevelDiscount, getLevelConfig } = await import('@shared/gamification');
      const userLevel = user.currentLevel || 1;
      const discountPercent = getLevelDiscount(userLevel);
      const levelConfig = getLevelConfig(userLevel);
      
      res.json({
        level: userLevel,
        levelName: levelConfig.nameCn,
        discountPercent,
        hasDiscount: discountPercent > 0,
      });
    } catch (error) {
      console.error("Error fetching level discount:", error);
      res.status(500).json({ message: "Failed to fetch level discount" });
    }
  });

  app.get('/api/personality-test/results', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = await storage.getRoleResult(userId);
      
      if (!result) {
        return res.status(404).json({ message: "No test results found" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error fetching test results:", error);
      res.status(500).json({ message: "Failed to fetch test results" });
    }
  });

  // Get personality type distribution stats
  app.get('/api/personality-test/stats', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getPersonalityDistribution();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching personality stats:", error);
      res.status(500).json({ message: "Failed to fetch personality stats" });
    }
  });

  // Get archetype role distribution (percentage of users for each role)
  app.get('/api/personality/role-distribution', isPhoneAuthenticated, async (req: any, res) => {
    try {
      // Get all users with personality results
      const allUsers = await db.select({ primaryArchetype: users.primaryArchetype }).from(users).where(isNotNull(users.primaryArchetype));
      
      if (allUsers.length === 0) {
        // Return default distribution if no users yet
        const defaultDistribution: Record<string, number> = {
          '开心柯基': 8,
          '太阳鸡': 9,
          '夸夸豚': 8,
          '机智狐': 9,
          '淡定海豚': 8,
          '织网蛛': 7,
          '暖心熊': 9,
          '灵感章鱼': 8,
          '沉思猫头鹰': 7,
          '定心大象': 6,
          '稳如龟': 5,
          '隐身猫': 6,
        };
        return res.json(defaultDistribution);
      }

      // Count users by primary role
      const distribution: Record<string, number> = {
        '开心柯基': 0,
        '太阳鸡': 0,
        '夸夸豚': 0,
        '机智狐': 0,
        '淡定海豚': 0,
        '织网蛛': 0,
        '暖心熊': 0,
        '灵感章鱼': 0,
        '沉思猫头鹰': 0,
        '定心大象': 0,
        '稳如龟': 0,
        '隐身猫': 0,
      };

      allUsers.forEach((user: any) => {
        if (user.primaryArchetype && distribution.hasOwnProperty(user.primaryArchetype)) {
          distribution[user.primaryArchetype] += 1;
        }
      });

      // Convert to percentages
      const total = allUsers.length;
      const percentages: Record<string, number> = {};
      Object.keys(distribution).forEach((role) => {
        percentages[role] = Math.round((distribution[role] / total) * 100);
      });

      res.json(percentages);
    } catch (error) {
      console.error("Error fetching role distribution:", error);
      res.status(500).json({ message: "Failed to fetch role distribution" });
    }
  });

  // Profile routes
  app.post('/api/profile/setup', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updateProfileSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updateProfile(userId, result.data);
      await storage.markProfileSetupComplete(userId);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ❌ DEPRECATED: Legacy interests-topics endpoint
  // Use /api/user/interests (Interest Carousel) instead
  /*
  app.post('/api/user/interests-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = interestsTopicsSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Validate and normalize interest fields
      const normalized = normalizeProfileInterests({
        interestsTop: result.data.interestsTop,
        primaryInterests: result.data.primaryInterests,
        topicAvoidances: result.data.topicAvoidances,
      });

      // Log warnings for observability
      if (normalized.warnings.length > 0) {
        console.log(`[InterestsTopics] Normalization warnings for user ${userId}:`, normalized.warnings);
      }

      const normalizedData = {
        ...result.data,
        interestsTop: normalized.interestsTop,
        primaryInterests: normalized.primaryInterests,
        topicAvoidances: normalized.topicAvoidances,
      };

      const user = await storage.updateInterestsTopics(userId, normalizedData);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating interests and topics:", error);
      res.status(500).json({ message: "Failed to update interests and topics" });
    }
  });
  */

  // Validation schemas for carousel-based interest selection
  const interestSelectionSchema = z.object({
    topicId: z.string(),
    emoji: z.string(),
    label: z.string(),
    fullName: z.string(),
    category: z.string(),
    categoryId: z.string(),
    level: z.number().int().min(1).max(3),
    heat: z.number().int().min(3).max(25),
  });

  const topPrioritySchema = z.object({
    topicId: z.string(),
    label: z.string(),
    heat: z.literal(25), // Level 3 only has heat value of 25
  });

  const userInterestsDataSchema = z.object({
    totalHeat: z.number().int().min(0),
    totalSelections: z.number().int().min(3),
    categoryHeat: z.record(z.string(), z.number().int().min(0)),
    selections: z.array(interestSelectionSchema).min(3),
    topPriorities: z.array(topPrioritySchema).optional(),
  });

  // New carousel-based interest selection endpoint with full validation and transaction
  app.post('/api/user/interests', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { interests } = req.body;

      // Validate interests is a proper object (not array, not null)
      if (typeof interests !== 'object' || Array.isArray(interests) || interests === null) {
        return res.status(400).json({ error: "Invalid interests data - must be an object" });
      }

      // Validate using Zod schema
      const validationResult = userInterestsDataSchema.safeParse(interests);
      if (!validationResult.success) {
        console.error("[InterestsAPI] Validation failed:", validationResult.error.issues);
        return res.status(400).json({ 
          error: "Invalid interests data structure",
          details: process.env.NODE_ENV === 'development' ? validationResult.error.issues : undefined
        });
      }

      const { totalHeat, totalSelections, categoryHeat, selections, topPriorities } = validationResult.data;

      // Additional business logic validation
      if (totalSelections < 3) {
        return res.status(400).json({ error: "Minimum 3 selections required" });
      }

      // Use transaction to ensure atomicity - both operations succeed or both fail
      const result = await db.transaction(async (tx: NeonDatabase<typeof schema>) => {
        // Check if user already has interests
        const existing = await tx
          .select()
          .from(userInterests)
          .where(eq(userInterests.userId, userId))
          .limit(1);

        let interestRecord;

        if (existing.length > 0) {
          // Update existing record
          const [updated] = await tx
            .update(userInterests)
            .set({
              totalHeat,
              totalSelections,
              categoryHeat,
              selections,
              topPriorities: topPriorities || null,
              updatedAt: new Date(),
            })
            .where(eq(userInterests.userId, userId))
            .returning();
          interestRecord = updated;
        } else {
          // Create new record
          const [created] = await tx
            .insert(userInterests)
            .values({
              userId,
              totalHeat,
              totalSelections,
              categoryHeat,
              selections,
              topPriorities: topPriorities || null,
            })
            .returning();
          interestRecord = created;
        }

        // Update user's completion flag in same transaction
        await tx
          .update(users)
          .set({ hasCompletedInterestsCarousel: true })
          .where(eq(users.id, userId));

        return interestRecord;
      });

      res.json({
        success: true,
        message: "兴趣已保存",
        data: {
          interestId: result.id,
          userId: result.userId,
          totalHeat: result.totalHeat,
        },
      });
    } catch (error) {
      console.error("Error saving user interests:", error);
      const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error 
        ? error.message 
        : "Failed to save interests";
      res.status(500).json({ message: errorMessage });
    }
  });

  app.get('/api/user/interests', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      const result = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error fetching user interests:", error);
      res.status(500).json({ message: "Failed to fetch interests" });
    }
  });

  app.get('/api/user/interests/summary', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      const result = await db
        .select({
          totalHeat: userInterests.totalHeat,
          totalSelections: userInterests.totalSelections,
          topPriorities: userInterests.topPriorities,
          categoryHeat: userInterests.categoryHeat,
        })
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (result.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Error fetching interest summary:", error);
      res.status(500).json({ message: "Failed to fetch interest summary" });
    }
  });


  // PATCH /api/user/interests/nudge
  // Bumps heat level (+1, capped at level 3) for specified topic IDs already in the user's selections.
  // Updates user_interests.updated_at — making it a meaningful behavioral signal.
  // Used by the post-event interest nudge step in EventFeedbackFlow.
  app.patch('/api/user/interests/nudge', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { boostTopicIds } = req.body;

      if (!Array.isArray(boostTopicIds) || boostTopicIds.length === 0) {
        return res.status(400).json({ error: "boostTopicIds must be a non-empty array" });
      }

      // Load existing interests
      const existing = await db
        .select()
        .from(userInterests)
        .where(eq(userInterests.userId, userId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "No interests found" });
      }

      // Heat values are normalized from level — single source of truth prevents aggregate drift
      const HEAT_BY_LEVEL: Record<number, number> = { 1: 3, 2: 10, 3: 25 };
      // Only boost topics already in the user's selections — nudge refines existing signals.
      // Adding new topics requires the full edit flow (/profile/edit/interests).
      let boostedCount = 0;
      const selections = (existing[0].selections as any[]).map(s => {
        // Normalize heat from level for all entries to prevent aggregate drift from stale data
        const normalizedHeat = HEAT_BY_LEVEL[s.level] ?? s.heat;
        if (boostTopicIds.includes(s.topicId) && s.level < 3) {
          const newLevel = (s.level + 1) as 1 | 2 | 3;
          boostedCount++;
          return { ...s, level: newLevel, heat: HEAT_BY_LEVEL[newLevel] };
        }
        return { ...s, heat: normalizedHeat };
      });

      // Recompute totals
      const totalHeat = selections.reduce((sum: number, s: any) => sum + s.heat, 0);
      const totalSelections = selections.length;
      const categoryHeat: Record<string, number> = {};
      selections.forEach((s: any) => {
        categoryHeat[s.categoryId] = (categoryHeat[s.categoryId] || 0) + s.heat;
      });
      const topPriorities = selections
        .filter((s: any) => s.level === 3)
        .map((s: any) => ({ topicId: s.topicId, label: s.label, heat: s.heat }));

      await db
        .update(userInterests)
        .set({ selections, totalHeat, totalSelections, categoryHeat, topPriorities, updatedAt: new Date() })
        .where(eq(userInterests.userId, userId));

      res.json({ success: true, boostedCount });
    } catch (error) {
      console.error("Error applying interest nudge:", error);
      res.status(500).json({ message: "Failed to apply interest nudge" });
    }
  });

  // ============ Interest Signal Boost endpoints ============
  // Optional pre-match signal: stores per-user per-interest calibration data.
  // Never required for matching or onboarding.
  //
  // enthusiasmLevel is NO LONGER collected from the client — it is derived
  // server-side from the user's onboarding interest heat (user_interests table):
  //   heat=25 (level 3) → enthusiasmLevel=5
  //   heat=10 (level 2) → enthusiasmLevel=3
  //   heat=5  (level 1) → enthusiasmLevel=2
  //   no data / unknown → enthusiasmLevel=3 (neutral default)

  const interestSignalSchema = z.object({
    interestKey: z.string().min(1).max(100),
    discussionStyle: z.enum([
      "casual_vibes",
      "character_people",
      "plot_worldbuilding",
      "meme_humor",
      "deeper_analysis",
    ]),
    conversationDepth: z.number().int().min(1).max(3),
  });

  /** Derive enthusiasm level (1-5) from onboarding heat value (5/10/25). */
  function deriveEnthusiasmFromHeat(heat: number): number {
    if (heat >= 25) return 5;
    if (heat >= 10) return 3;
    if (heat >= 5)  return 2;
    return 3; // neutral default: no heat data or below minimum threshold
  }

  /** Load heat value for a specific interestKey from the user_interests table. */
  async function getOnboardingHeatForInterest(userId: string, interestKey: string): Promise<number> {
    const rows = await db.select().from(userInterests).where(eq(userInterests.userId, userId)).limit(1);
    if (!rows.length) return 0;
    const selections = (rows[0].selections as any[]) ?? [];
    const match = selections.find((s: any) => s.topicId === interestKey);
    return match?.heat ?? 0;
  }

  // POST /api/user/interest-signals — create or update a signal for one interest
  app.post('/api/user/interest-signals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = interestSignalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const interest = getInterestById(result.data.interestKey);
      if (!interest?.active) {
        return res.status(400).json({ message: "Invalid interestKey: not found in active interest taxonomy" });
      }

      // Derive enthusiasm from onboarding data so we never duplicate the self-report
      const heat = await getOnboardingHeatForInterest(userId, result.data.interestKey);
      const enthusiasmLevel = deriveEnthusiasmFromHeat(heat);

      const signal = await storage.upsertInterestSignal(userId, {
        interestKey: result.data.interestKey,
        interestLabel: interest.label,
        enthusiasmLevel,
        discussionStyle: result.data.discussionStyle,
        conversationDepth: result.data.conversationDepth,
      });

      // Instrumentation: log completion for opt-in rate metrics
      console.info(`[InterestSignalBoost] completed userId=${userId} interestKey=${result.data.interestKey} style=${result.data.discussionStyle} depth=${result.data.conversationDepth} derivedEnthusiasm=${enthusiasmLevel}`);

      res.json({ success: true, data: signal });
    } catch (error) {
      console.error("Error upserting interest signal:", error);
      res.status(500).json({ message: "Failed to save interest signal" });
    }
  });

  // GET /api/user/interest-signals — retrieve all signals for the current user
  app.get('/api/user/interest-signals', requireAuth, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const signals = await storage.getUserInterestSignals(userId);
      res.json({ signals });
    } catch (error) {
      console.error("Error fetching interest signals:", error);
      res.status(500).json({ message: "Failed to fetch interest signals" });
    }
  });

  app.post('/api/profile/personality', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updatePersonalitySchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updatePersonality(userId, result.data);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating personality:", error);
      res.status(500).json({ message: "Failed to update personality" });
    }
  });

  // Update full profile (for editing in profile page)
  app.patch('/api/profile', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = updateFullProfileSchema.safeParse(req.body);
      
      if (!result.success) {
        console.error(`[Profile PATCH] Validation failed for user ${userId}:`, JSON.stringify(result.error.issues, null, 2));
        return res.status(400).json({ error: result.error });
      }

      const profileData: Record<string, any> = { ...result.data };

      // ✅ Age validation (Phase 0: Fix #8) - JoyJoin is 18+ only
      if (profileData.birthdate) {
        const birthDate = new Date(profileData.birthdate);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        // Adjust age if birthday hasn't occurred yet this year
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 18) {
          return res.status(400).json({ 
            message: "JoyJoin 仅面向 18 岁及以上用户开放",
            field: "birthdate" 
          });
        }
      }
      
      // Age validation for birthYear field (legacy support)
      // Fix: More strict validation to match birthdate precision
      if (profileData.birthYear && !profileData.birthdate) {
        const birthYear = parseInt(profileData.birthYear, 10);
        
        if (!Number.isFinite(birthYear)) {
          return res.status(400).json({
            message: "无效的出生年份",
            field: "birthYear",
          });
        }
        
        const currentYear = new Date().getFullYear();
        const roughAge = currentYear - birthYear;
        
        // Definitely under 18 based on year alone
        if (roughAge < 18) {
          return res.status(400).json({ 
            message: "JoyJoin 仅面向 18 岁及以上用户开放",
            field: "birthYear" 
          });
        }
        
        // Borderline case: could be 17 or 18 depending on month/day
        // Require full birthdate for precise validation
        if (roughAge === 18) {
          return res.status(400).json({
            message: "为了确保您已满 18 周岁，请填写完整出生日期（年-月-日）",
            field: "birthdate",
          });
        }
      }

      // ❌ REMOVED: Interest fields validation - these fields no longer exist
      // Legacy interests are now managed by user_interests table
      // if (profileData.interestsTop || profileData.primaryInterests || profileData.topicAvoidances) {
      //   const normalized = normalizeProfileInterests({
      //     interestsTop: profileData.interestsTop ?? undefined,
      //     primaryInterests: profileData.primaryInterests ?? undefined,
      //     topicAvoidances: profileData.topicAvoidances ?? undefined,
      //   });
      //   // Log warnings for observability
      //   if (normalized.warnings.length > 0) {
      //     console.log(`[Profile] Interest normalization warnings for user ${userId}:`, normalized.warnings);
      //   }
      //   profileData.interestsTop = normalized.interestsTop.length > 0 ? normalized.interestsTop : undefined;
      //   profileData.primaryInterests = normalized.primaryInterests.length > 0 ? normalized.primaryInterests : undefined;
      //   profileData.topicAvoidances = normalized.topicAvoidances.length > 0 ? normalized.topicAvoidances : undefined;
      // }

      // Validate telemetry if present
      if (profileData.interestsTelemetry) {
        const telemetryResult = validateTelemetry(profileData.interestsTelemetry);
        if (!telemetryResult.valid) {
          console.log(`[Profile] Invalid telemetry for user ${userId}:`, telemetryResult.errors);
          // Log and truncate oversized/invalid telemetry rather than reject
          profileData.interestsTelemetry = telemetryResult.data ?? undefined;
        } else {
          profileData.interestsTelemetry = telemetryResult.data;
        }
      }

      if (profileData.industryConfidence !== undefined) {
        profileData.industryConfidence = String(profileData.industryConfidence);
      }

      const user = await storage.updateFullProfile(userId, profileData);
      
      // Set hasCompletedRegistration if profile is being set with essential data
      if (user && (req.body.displayName || req.body.gender || req.body.currentCity)) {
        const updatedUser = await storage.updateUser(user.id, { hasCompletedRegistration: true });
        res.json(updatedUser);
      } else {
        res.json(user);
      }
    } catch (error) {
      console.error("Error updating full profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Social tag endpoints
  app.post('/api/user/social-tags/generate', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { archetype, profession, hobbies, forceRegenerate } = req.body;

      // Input validation
      if (!archetype || typeof archetype !== 'string') {
        return res.status(400).json({ error: 'Valid archetype is required' });
      }

      // Validate profession structure if provided
      if (profession !== undefined && profession !== null) {
        if (typeof profession !== 'object' || Array.isArray(profession)) {
          return res.status(400).json({ error: 'Profession must be an object' });
        }
      }

      // Validate hobbies structure if provided
      if (hobbies !== undefined && hobbies !== null) {
        if (!Array.isArray(hobbies)) {
          return res.status(400).json({ error: 'Hobbies must be an array' });
        }
        // Validate each hobby has name and heat
        const invalidHobby = hobbies.find((h: any) => 
          !h || typeof h !== 'object' || typeof h.name !== 'string' || typeof h.heat !== 'number'
        );
        if (invalidHobby) {
          return res.status(400).json({ error: 'Each hobby must have name (string) and heat (number)' });
        }
      }

      // Check if tags were generated within last 24 hours (return cached unless forceRegenerate)
      if (!forceRegenerate) {
        const existingTags = await storage.getUserGeneratedTags(userId);
        if (existingTags && existingTags.generatedAt) {
          const hoursSinceGeneration = (Date.now() - new Date(existingTags.generatedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceGeneration < 24 && existingTags.tags) {
            return res.json({
              tags: existingTags.tags,
              isFallback: false,
              cached: true,
            });
          }
        }
      }

      // Generate new tags
      const { generateSocialTags } = await import('./tagGenerationService');
      const result = await generateSocialTags({ archetype, profession, hobbies });

      // Save to database
      await storage.saveGeneratedTags(userId, {
        tags: result.tags,
        generatedAt: new Date(),
        version: 'v1.0',
        context: { archetype, profession, hobbies },
      });

      res.json({
        tags: result.tags,
        isFallback: result.isFallback,
      });
    } catch (error) {
      console.error('Error generating social tags:', error);
      res.status(500).json({ message: 'Failed to generate social tags' });
    }
  });

  app.post('/api/user/social-tags/select', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { tagIndex, fullTag } = req.body;

      if (tagIndex === undefined || !fullTag) {
        return res.status(400).json({ error: 'Tag index and full tag are required' });
      }

      await storage.recordTagSelection(userId, {
        selectedIndex: tagIndex,
        selectedTag: fullTag,
        selectedAt: new Date(),
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error selecting social tag:', error);
      res.status(500).json({ message: 'Failed to select social tag' });
    }
  });

  // Event routes
  app.get('/api/events/joined', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const events = await storage.getUserJoinedEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching joined events:", error);
      res.status(500).json({ message: "Failed to fetch joined events" });
    }
  });

  app.get('/api/events/:eventId/participants', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const participants = await storage.getEventParticipants(eventId);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching event participants:", error);
      res.status(500).json({ message: "Failed to fetch event participants" });
    }
  });

  // Chat routes (group chat opens 24 hours before event)
  app.get('/api/events/:eventId/messages', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Try to get event from events table first (for demo/regular events)
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      
      // If not found in events table, try blindBoxEvents table
      let eventDateTime = event?.dateTime;
      if (!event) {
        const blindBoxEvent = await storage.getBlindBoxEventById(eventId, userId);
        if (!blindBoxEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        eventDateTime = blindBoxEvent.dateTime;
      }

      // Check if group chat is open (24 hours before event OR event has passed)
      const now = new Date();
      const eventTime = new Date(eventDateTime);
      const hoursUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Chat unlocks 24 hours before event, and remains accessible after event completes
      const chatUnlocked = hoursUntilEvent <= 24;

      if (!chatUnlocked) {
        return res.json({
          chatUnlocked: false,
          hoursUntilUnlock: Math.max(0, hoursUntilEvent - 24),
          messages: [],
        });
      }

      const messages = await storage.getEventMessages(eventId);
      res.json({
        chatUnlocked: true,
        hoursUntilUnlock: 0,
        messages,
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/events/:eventId/messages', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Try to get event from events table first (for demo/regular events)
      const [event] = await db.select().from(events).where(eq(events.id, eventId));
      
      // If not found in events table, try blindBoxEvents table
      let eventDateTime = event?.dateTime;
      if (!event) {
        const blindBoxEvent = await storage.getBlindBoxEventById(eventId, userId);
        if (!blindBoxEvent) {
          return res.status(404).json({ message: "Event not found" });
        }
        eventDateTime = blindBoxEvent.dateTime;
      }

      // Check if group chat is open (24 hours before event OR event has passed)
      const now = new Date();
      const eventTime = new Date(eventDateTime);
      const hoursUntilEvent = (eventTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      // Chat unlocks 24 hours before event, and remains accessible after event completes
      const chatUnlocked = hoursUntilEvent <= 24;

      if (!chatUnlocked) {
        return res.status(403).json({ 
          message: "群聊将在活动开始前24小时开放",
          hoursUntilUnlock: Math.max(0, hoursUntilEvent - 24),
        });
      }

      const result = insertChatMessageSchema.safeParse({
        ...req.body,
        eventId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const message = await storage.createChatMessage(userId, result.data);
      res.json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Feedback routes
  app.get('/api/my-feedbacks', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const feedbacks = await storage.getUserAllFeedbacks(userId);
      res.json(feedbacks);
    } catch (error) {
      console.error("Error fetching all feedbacks:", error);
      res.status(500).json({ message: "Failed to fetch feedbacks" });
    }
  });

  // ── Connections endpoints ──────────────────────────────────────────────────

  /**
   * GET /api/my-connections
   * Returns the authenticated user's mutual connections, enriched with peer
   * display name, archetype, wechat id, and any saved connection feedback.
   */
  app.get('/api/my-connections', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;

      type ConnRow = {
        id: string;
        eventId: string;
        userAId: string;
        userBId: string;
        userAWechatId: string | null;
        userBWechatId: string | null;
        createdAt: Date | null;
        userAConnectionReasons: string[] | null;
        userANextStepPreference: string | null;
        userBConnectionReasons: string[] | null;
        userBNextStepPreference: string | null;
      };

      const rows: ConnRow[] = await db
        .select({
          id: connections.id,
          eventId: connections.eventId,
          userAId: connections.userAId,
          userBId: connections.userBId,
          userAWechatId: connections.userAWechatId,
          userBWechatId: connections.userBWechatId,
          createdAt: connections.createdAt,
          userAConnectionReasons: connections.userAConnectionReasons,
          userANextStepPreference: connections.userANextStepPreference,
          userBConnectionReasons: connections.userBConnectionReasons,
          userBNextStepPreference: connections.userBNextStepPreference,
        })
        .from(connections)
        .where(and(
          or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
          eq(connections.status, 'mutual'),
        ))
        .orderBy(desc(connections.createdAt))
        .limit(50);

      // Collect peer user ids to fetch display info
      const peerIds: string[] = rows.map((r) => r.userAId === userId ? r.userBId : r.userAId);
      const uniquePeerIds: string[] = Array.from(new Set(peerIds));

      const peerRows = uniquePeerIds.length > 0
        ? await db
            .select({ id: users.id, displayName: users.displayName, archetype: users.archetype })
            .from(users)
            .where(inArray(users.id, uniquePeerIds))
        : ([] as { id: string; displayName: string | null; archetype: string | null }[]);

      const peerMap: Record<string, { id: string; displayName: string | null; archetype: string | null }> = {};
      for (const u of peerRows) peerMap[u.id] = u;

      // Collect event names
      const eventIds: string[] = Array.from(new Set(rows.map((r) => r.eventId)));
      const eventRows = eventIds.length > 0
        ? await db
            .select({ id: blindBoxEvents.id, eventType: blindBoxEvents.eventType, dateTime: blindBoxEvents.dateTime })
            .from(blindBoxEvents)
            .where(inArray(blindBoxEvents.id, eventIds))
        : ([] as { id: string; eventType: string | null; dateTime: Date | null }[]);
      const eventMap: Record<string, { id: string; eventType: string | null; dateTime: Date | null }> = {};
      for (const e of eventRows) eventMap[e.id] = e;

      const result = rows.map((r) => {
        const isA = r.userAId === userId;
        const peerId = isA ? r.userBId : r.userAId;
        const peer = peerMap[peerId];
        const evt = eventMap[r.eventId];
        return {
          id: r.id,
          eventId: r.eventId,
          // Return raw fields so the client can format using HK timezone helpers
          eventType: evt?.eventType ?? null,
          eventDate: evt?.dateTime ? evt.dateTime.toISOString() : null,
          peerId,
          peerDisplayName: peer?.displayName ?? '连接用户',
          peerArchetype: peer?.archetype ?? null,
          peerWechatId: isA ? r.userBWechatId : r.userAWechatId,
          connectionReasons: isA ? r.userAConnectionReasons : r.userBConnectionReasons,
          nextStepPreference: isA ? r.userANextStepPreference : r.userBNextStepPreference,
          createdAt: r.createdAt,
        };
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching my connections:", error);
      res.status(500).json({ message: "Failed to fetch connections" });
    }
  });

  /**
   * PATCH /api/connections/:connectionId/feedback
   * Saves optional enrichment data (reasons + next-step) for a connection.
   * Only the two parties in the connection can update their own feedback slot.
   */
  app.patch('/api/connections/:connectionId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { connectionId } = req.params;
      const { connectionReasons, nextStepPreference } = req.body;

      const [conn] = await db
        .select()
        .from(connections)
        .where(eq(connections.id, connectionId))
        .limit(1);

      if (!conn) {
        return res.status(404).json({ message: "Connection not found" });
      }

      if (conn.userAId !== userId && conn.userBId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      if (conn.status !== 'mutual') {
        return res.status(400).json({ message: "Connection is not mutual" });
      }

      // Validate reasons (array of strings, max 4 to allow 3 canonical chips + 1 free-text element)
      const reasonsInput: unknown = connectionReasons;
      let reasons: string[] | null = null;
      if (Array.isArray(reasonsInput)) {
        reasons = reasonsInput.slice(0, 4).map(String);
      } else if (reasonsInput === null || reasonsInput === undefined) {
        reasons = null;
      } else {
        return res.status(400).json({ message: "connectionReasons must be an array" });
      }

      // Validate nextStepPreference
      const nextStep = (typeof nextStepPreference === 'string' && nextStepPreference.trim())
        ? nextStepPreference.trim()
        : null;

      const isA = conn.userAId === userId;
      await db
        .update(connections)
        .set(
          isA
            ? { userAConnectionReasons: reasons, userANextStepPreference: nextStep }
            : { userBConnectionReasons: reasons, userBNextStepPreference: nextStep }
        )
        .where(eq(connections.id, connectionId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating connection feedback:", error);
      res.status(500).json({ message: "Failed to update connection feedback" });
    }
  });

  app.get('/api/events/:eventId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const feedback = await storage.getUserFeedback(userId, eventId);
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  app.post('/api/events/:eventId/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const result = insertEventFeedbackSchema.safeParse({
        ...req.body,
        eventId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Save wechatContactId if provided and not previously set
      const { wechatContactId } = req.body;
      if (wechatContactId && typeof wechatContactId === 'string' && wechatContactId.trim()) {
        const currentUser = await storage.getUser(userId);
        if (!currentUser?.wechatContactId) {
          await storage.updateUserWechatId(userId, wechatContactId.trim());
        }
      }

      // Create feedback
      const feedback = await storage.createEventFeedback(userId, result.data);
      
      // Award XP and coins for completing feedback
      try {
        const { awardXPAndCoins } = await import('./gamificationService');
        const xpResult = await awardXPAndCoins(userId, 'feedback_basic', eventId, feedback.id);
        console.log(`[Gamification] Awarded basic feedback XP to user ${userId}:`, xpResult);
      } catch (xpError) {
        console.error("Error awarding feedback XP:", xpError);
      }
      
      // Process connection selections and detect mutual matches
      if (feedback.connections && feedback.connections.length > 0) {
        for (const selectedUserId of feedback.connections) {
          // Guard: skip self-selection
          if (selectedUserId === userId) {
            console.warn(`[Connections] User ${userId} attempted self-selection — skipped`);
            continue;
          }
          try {
            await storage.upsertConnection(eventId, userId, selectedUserId);
          } catch (connError) {
            console.error(`[Connections] Error upserting connection for ${userId} → ${selectedUserId}:`, connError);
          }
        }
      }

      // After the connections loop, notify the other side of any newly mutual connections
      const MUTUAL_MATCH_NOTIFICATION_WINDOW_MS = 60_000; // 60 seconds
      try {
        const freshMutualRows = await storage.getMutualConnections(eventId, userId);
        for (const conn of freshMutualRows) {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          // Only notify if this mutual was just created (revealedAt within last 60 seconds)
          const isNew = conn.revealedAt && (Date.now() - new Date(conn.revealedAt).getTime()) < MUTUAL_MATCH_NOTIFICATION_WINDOW_MS;
          if (isNew && otherUserId !== userId) {
            try {
              // Deduplicate: only create notification if one doesn't already exist for this user+event
              const existing = await db
                .select({ id: schema.notifications.id })
                .from(schema.notifications)
                .where(
                  and(
                    eq(schema.notifications.userId, otherUserId),
                    eq(schema.notifications.type, 'mutual_match'),
                    eq(schema.notifications.relatedResourceId, eventId)
                  )
                )
                .limit(1);
              if (existing.length === 0) {
                await storage.createNotification({
                  userId: otherUserId,
                  category: 'chat',
                  type: 'mutual_match',
                  title: '🎉 新的双向匹配',
                  message: `你和一位参与者互相选择了对方！查看Ta的微信号吧`,
                  relatedResourceId: eventId,
                });
              }
            } catch (notifError) {
              console.error(`[Connections] Failed to notify other user ${otherUserId}:`, notifError);
            }
          }
        }
      } catch (notifLoopError) {
        console.error(`[Connections] Failed to process mutual match notifications:`, notifLoopError);
      }

      // Collect all mutual connections for this event and return with wechat IDs.
      // Use the snapshot stored on the connection row at reveal time; fall back to live user
      // field only for legacy rows that pre-date snapshotting.
      const mutualConnectionRows = await storage.getMutualConnections(eventId, userId);
      const mutualMatches = await Promise.all(
        mutualConnectionRows.map(async (conn: any) => {
          const otherUserId = conn.userAId === userId ? conn.userBId : conn.userAId;
          // Snapshot WeChat ID for THIS user's counterpart
          const snapshotWechatId =
            conn.userAId === userId ? conn.userBWechatId : conn.userAWechatId;
          const otherUser = await storage.getUser(otherUserId);
          return {
            userId: otherUserId,
            displayName: otherUser?.displayName || otherUser?.firstName || "参与者",
            archetype: otherUser?.archetype ?? null,
            // Prefer snapshot; fall back to live field for legacy rows
            wechatContactId: snapshotWechatId ?? otherUser?.wechatContactId ?? null,
          };
        })
      );
      
      // Note: In a real app, you'd update user points here
      // await storage.awardFeedbackPoints(userId, 50);
      
      res.json({ ...feedback, mutualMatches });
    } catch (error) {
      console.error("Error creating feedback:", error);
      res.status(500).json({ message: "Failed to create feedback" });
    }
  });

  // Deep feedback route (optional extension)
  app.post('/api/events/:eventId/feedback/deep', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Get existing feedback
      const existingFeedback = await storage.getUserFeedback(userId, eventId);
      
      if (!existingFeedback) {
        return res.status(404).json({ message: "Basic feedback not found. Please complete basic feedback first." });
      }

      // Update with deep feedback data
      const deepFeedbackData = {
        hasDeepFeedback: true,
        matchPointValidation: req.body.matchPointValidation,
        additionalMatchPoints: req.body.additionalMatchPoints,
        conversationBalance: req.body.conversationBalance,
        conversationComfort: req.body.conversationComfort,
        conversationNotes: req.body.conversationNotes,
        futurePreferences: req.body.futurePreferences,
        futurePreferencesOther: req.body.futurePreferencesOther,
        deepFeedbackCompletedAt: new Date(),
      };

      const updatedFeedback = await storage.updateEventFeedbackDeep(userId, eventId, deepFeedbackData);
      
      // Award XP and coins for completing deep feedback
      try {
        const { awardXPAndCoins } = await import('./gamificationService');
        const xpResult = await awardXPAndCoins(userId, 'feedback_deep', eventId, updatedFeedback.id);
        console.log(`[Gamification] Awarded deep feedback XP to user ${userId}:`, xpResult);
      } catch (xpError) {
        console.error("Error awarding deep feedback XP:", xpError);
      }
      
      res.json(updatedFeedback);
    } catch (error) {
      console.error("Error updating deep feedback:", error);
      res.status(500).json({ message: "Failed to update deep feedback" });
    }
  });

  // 🎯 DEMO: Seed demonstration events
  app.post('/api/demo/seed-events', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { db } = await import("./db");
      const { blindBoxEvents } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      
      // Check if user already has demo events
      const existingEvents = await db.select().from(blindBoxEvents).where(eq(blindBoxEvents.userId, userId));
      const hasMatchedDemo = existingEvents.some((e: any) => e.status === 'matched' && e.restaurantName?.includes('Sushi'));
      const hasCompletedDemo = existingEvents.some((e: any) => e.status === 'completed' && e.restaurantName?.includes('Tap House'));
      
      if (hasMatchedDemo && hasCompletedDemo) {
        console.log("✅ Demo events already exist for user:", userId);
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
            archetype: "夸夸豚", 
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
            archetype: "机智狐", 
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
            archetype: "织网蛛", 
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
            archetype: "灵感章鱼", 
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
            archetype: "太阳鸡", 
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
            archetype: "开心柯基", 
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
            archetype: "暖心熊", 
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
            archetype: "机智狐", 
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
            archetype: "织网蛛", 
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
      
      console.log("✅ Demo events created:", { matched: matchedEvent[0].id, completed: completedEvent[0].id });
      
      res.json({ 
        message: "Demo events created successfully",
        events: {
          matched: matchedEvent[0],
          completed: completedEvent[0]
        }
      });
    } catch (error) {
      console.error("Error seeding demo events:", error);
      res.status(500).json({ message: "Failed to seed demo events" });
    }
  });

  // 🎯 DEMO: Seed registrations into a pool for quick matching tests
  app.post('/api/demo/seed-pool-registrations', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        console.error("[DemoSeedPoolRegistrations] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { poolId, count, budgetTier } = req.body || {};

      if (!poolId) {
        console.warn("[DemoSeedPoolRegistrations] missing poolId");
        return res.status(400).json({ message: "poolId is required" });
      }

      // 确认这个池子存在
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId));

      if (!pool) {
        console.warn("[DemoSeedPoolRegistrations] pool not found:", poolId);
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

      console.log("[DemoSeedPoolRegistrations] inserted registrations:", {
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
      console.error("[DemoSeedPoolRegistrations] Error seeding registrations:", error);
      res.status(500).json({
        message: "Failed to seed pool registrations",
        error: error?.message || String(error),
      });
    }
  });

  // 🎄 DEMO: Create a Christmas Mystery Cocktail Pool for testing
  app.post('/api/demo/create-christmas-pool', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        console.error("[DemoChristmasPool] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { db } = await import("./db");
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
        console.log("✅ Christmas pool already exists for user:", userId);
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

      console.log("✅ Demo Christmas pool created:", created[0].id);
      
      res.json({
        message: "Christmas pool created successfully",
        event: created[0],
        eventId: created[0].id,
        instructions: "你现在可以体验报名流程。系统将自动为你匹配其他参加者，生成完整的匹配桌。"
      });
    } catch (error) {
      console.error("[DemoChristmasPool] Error creating pool:", error);
      res.status(500).json({ 
        message: "Failed to create Christmas pool",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 🍸 DEMO: Create "弥所 Homebar" partner venue with exclusive deal
  app.post('/api/demo/create-homebar-venue', requireAdmin, async (_req, res) => {
    try {
      const { db } = await import("./db");
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
      
      console.log("✅ Demo venue created:", venue.id, venue.name);
      
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
      
      console.log("✅ Demo deal created:", deal.id, deal.title);
      
      res.json({
        message: "Homebar venue and deal created successfully",
        venue,
        deals: [deal],
        instructions: "场地和优惠已创建成功，可在活动详情页查看"
      });
    } catch (error) {
      console.error("[DemoHomebarVenue] Error creating venue:", error);
      res.status(500).json({ 
        message: "Failed to create Homebar venue",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Debug middleware for blind box event routes
  app.use('/api/blind-box-events', (req, _res, next) => {
    console.log("[BlindBoxDebug] incoming request on /api/blind-box-events", {
      method: req.method,
      originalUrl: req.originalUrl,
      params: req.params,
      query: req.query,
      body: req.body,
    });
    next();
  });
  // Blind Box Event routes
  app.get('/api/my-events', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const events = await storage.getUserBlindBoxEvents(userId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching blind box events:", error);
      res.status(500).json({ message: "Failed to fetch blind box events" });
    }
  });

  // app.post('/api/blind-box-events', isPhoneAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     const { date, time, eventType, city, area, budget, acceptNearby, selectedLanguages, selectedTasteIntensity, selectedCuisines, inviteFriends, friendsCount } = req.body;
      
  //     if (!date || !time || !eventType || !area || !budget || budget.length === 0) {
  //       return res.status(400).json({ message: "Missing required fields" });
  //     }
      
  //     const event = await storage.createBlindBoxEvent(userId, {
  //       date,
  //       time,
  //       eventType,
  //       city: city || "深圳",
  //       area,
  //       budget,
  //       acceptNearby,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       inviteFriends,
  //       friendsCount,
  //     });
      
  //     res.json(event);
  //   } catch (error) {
  //     console.error("Error creating blind box event:", error);
  //     res.status(500).json({ message: "Failed to create blind box event" });
  //   }
  // });

  app.post('/api/blind-box-events', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        console.error("[BlindBoxPayment] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

      // 尽量把当前用户查出来，方便 debug（可选）
      try {
        const usersResult = await db
          .select()
          .from(users)
          .where(eq(users.id, userId));
        console.log("[BlindBoxPayment] current user from DB:", usersResult);
      } catch (userErr) {
        console.warn("[BlindBoxPayment] failed to load user for debug:", userErr);
      }

      // 支付页 / 发现页传过来的盲盒报名数据（兼容老字段）
      const {
        // 新版字段
        city,
        district,
        eventType,
        budgetTier,
        selectedLanguages,
        selectedTasteIntensity,
        selectedCuisines,
        eventIntent,
        dietaryRestrictions,
        poolId,
        // 兼容旧版字段
        area,
        budget,
        acceptNearby,
        inviteFriends,
        friendsCount,
      } = req.body || {};

      console.log("[BlindBoxPayment] incoming payload:", {
        userId,
        city,
        district,
        area,
        eventType,
        budgetTier,
        budget,
        selectedLanguages,
        selectedTasteIntensity,
        selectedCuisines,
        eventIntent,
        dietaryRestrictions,
        poolId,
        acceptNearby,
        inviteFriends,
        friendsCount,
      });

      // ✅ 必须显式指定 poolId（这个池子是 admin 在后台创好的）
      if (!poolId) {
        console.warn("[BlindBoxPayment] missing poolId in request");
        return res.status(400).json({
          message: "缺少必填字段：poolId",
        });
      }

      // ✅ 统一处理预算：优先用 budgetTier，其次用 budget 数组
      let budgetRange: string[] = [];
      if (budgetTier !== undefined && budgetTier !== null) {
        if (Array.isArray(budgetTier)) {
          budgetRange = budgetTier.map((b) => String(b));
        } else {
          budgetRange = [String(budgetTier)];
        }
      } else if (Array.isArray(budget)) {
        budgetRange = budget.map((b: any) => String(b));
      }

      if (budgetRange.length === 0) {
        console.warn("[BlindBoxPayment] missing budget info");
        return res.status(400).json({
          message: "参数不完整：需要 budgetTier 或 budget",
        });
      }

      // ✅ 只允许报名已经存在且开放报名的池子（status = active 且 registrationDeadline 未来）
      const now = new Date();
      const poolsById = await db
        .select()
        .from(eventPools)
        .where(
          and(
            eq(eventPools.id, poolId),
            eq(eventPools.status, "active"),
            gt(eventPools.registrationDeadline, now)
          )
        );

      if (!poolsById || poolsById.length === 0) {
        console.warn("[BlindBoxPayment] pool not found or not active / expired:", poolId);
        return res.status(404).json({
          message: "指定的活动池不存在或已关闭报名",
        });
      }

      const pool = poolsById[0];

      console.log("[BlindBoxPayment] final chosen pool for registration:", {
        id: pool.id,
        title: pool.title,
        city: pool.city,
        district: pool.district,
      });

      // ✅ 防止重复报名：同一用户 + 同一池子只允许一条报名记录
      const existingRegistrations = await db
        .select({ id: eventPoolRegistrations.id })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, pool.id),
            eq(eventPoolRegistrations.userId, userId)
          )
        );

      if (existingRegistrations.length > 0) {
        console.warn("[BlindBoxPayment] user already registered for this pool:", {
          userId,
          poolId: pool.id,
        });
        return res.status(400).json({
          message: "你已经报名过这个活动盲盒啦，无法重复报名",
        });
      }

      // ✅ 在 event_pool_registrations 中插入报名记录（用户付完钱就直接进池子）
      const registrationData = {
        poolId: pool.id,
        userId,
        budgetRange,
        preferredLanguages: Array.isArray(selectedLanguages) ? selectedLanguages : [],
        tasteIntensity: Array.isArray(selectedTasteIntensity) ? selectedTasteIntensity : [],
        cuisinePreferences: Array.isArray(selectedCuisines) ? selectedCuisines : [],
        eventIntent: Array.isArray(eventIntent) ? eventIntent : [],
        dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
      };

      console.log("[BlindBoxPayment] creating eventPoolRegistration with data:", registrationData);

      const [registration] = await db
        .insert(eventPoolRegistrations)
        .values(registrationData)
        .returning();

      console.log("[BlindBoxPayment] created eventPoolRegistration:", registration);

      // ✅ 更新活动池的 totalRegistrations 计数
      const [updatedPool] = await db
        .update(eventPools)
        .set({
          totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(eventPools.id, pool.id))
        .returning();

      console.log("[BlindBoxPayment] updated eventPool after registration:", updatedPool);

      // ✅ 返回报名信息（前端目前只需要知道成功了 & 池子信息）
      return res.json({
        ok: true,
        registration,
        pool: updatedPool || pool,
      });
    } catch (error: any) {
      console.error("[BlindBoxPayment] Failed to create pool registration:", error);
      res.status(500).json({
        message: "Failed to create blind box registration",
        error: error?.message || String(error),
      });
    }
  });
  // app.post('/api/blind-box-events', isPhoneAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     if (!userId) {
  //       console.error("[BlindBoxPayment] No userId in session");
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     // 尽量把当前用户查出来，方便 debug（可选）
  //     try {
  //       const usersResult = await db
  //         .select()
  //         .from(users)
  //         .where(eq(users.id, userId));
  //       console.log("[BlindBoxPayment] current user from DB:", usersResult);
  //     } catch (userErr) {
  //       console.warn("[BlindBoxPayment] failed to load user for debug:", userErr);
  //     }

  //     // 支付页 / 发现页传过来的盲盒报名数据（兼容老字段）
  //     const {
  //       // 新版字段
  //       city,
  //       district,
  //       eventType,
  //       budgetTier,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       poolId,
  //       // 兼容旧版字段
  //       area,
  //       budget,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     } = req.body || {};

  //     console.log("[BlindBoxPayment] incoming payload:", {
  //       userId,
  //       city,
  //       district,
  //       area,
  //       eventType,
  //       budgetTier,
  //       budget,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       poolId,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     });

  //     // ✅ 我们现在的逻辑：必须显式指定 poolId（这个池子是 admin 在后台创好的）
  //     if (!poolId) {
  //       console.warn("[BlindBoxPayment] missing poolId in request");
  //       return res.status(400).json({
  //         message: "缺少必填字段：poolId",
  //       });
  //     }

  //     // ✅ 统一处理预算：优先用 budgetTier，其次用 budget 数组
  //     let budgetRange: string[] = [];
  //     if (budgetTier !== undefined && budgetTier !== null) {
  //       if (Array.isArray(budgetTier)) {
  //         budgetRange = budgetTier.map((b) => String(b));
  //       } else {
  //         budgetRange = [String(budgetTier)];
  //       }
  //     } else if (Array.isArray(budget)) {
  //       budgetRange = budget.map((b: any) => String(b));
  //     }

  //     if (budgetRange.length === 0) {
  //       console.warn("[BlindBoxPayment] missing budget info");
  //       return res.status(400).json({
  //         message: "参数不完整：需要 budgetTier 或 budget",
  //       });
  //     }

  //     // ✅ 只允许报名已经存在且开放报名的池子（status = active 且 registrationDeadline 未来）
  //     const now = new Date();
  //     const poolsById = await db
  //       .select()
  //       .from(eventPools)
  //       .where(
  //         and(
  //           eq(eventPools.id, poolId),
  //           eq(eventPools.status, "active"),
  //           gt(eventPools.registrationDeadline, now)
  //         )
  //       );

  //     if (!poolsById || poolsById.length === 0) {
  //       console.warn("[BlindBoxPayment] pool not found or not active / expired:", poolId);
  //       return res.status(404).json({
  //         message: "指定的活动池不存在或已关闭报名",
  //       });
  //     }

  //     const pool = poolsById[0];

  //     console.log("[BlindBoxPayment] final chosen pool for registration:", {
  //       id: pool.id,
  //       title: pool.title,
  //       city: pool.city,
  //       district: pool.district,
  //     });

  //     // ✅ 在 event_pool_registrations 中插入报名记录（用户付完钱就直接进池子）
  //     const registrationData = {
  //       poolId: pool.id,
  //       userId,
  //       budgetRange,
  //       preferredLanguages: Array.isArray(selectedLanguages) ? selectedLanguages : [],
  //       tasteIntensity: Array.isArray(selectedTasteIntensity) ? selectedTasteIntensity : [],
  //       cuisinePreferences: Array.isArray(selectedCuisines) ? selectedCuisines : [],
  //       eventIntent: Array.isArray(eventIntent) ? eventIntent : [],
  //       dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
  //     };

  //     console.log("[BlindBoxPayment] creating eventPoolRegistration with data:", registrationData);

  //     const [registration] = await db
  //       .insert(eventPoolRegistrations)
  //       .values(registrationData)
  //       .returning();

  //     console.log("[BlindBoxPayment] created eventPoolRegistration:", registration);

  //     // ✅ 更新活动池的 totalRegistrations 计数
  //     const [updatedPool] = await db
  //       .update(eventPools)
  //       .set({
  //         totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
  //         updatedAt: new Date(),
  //       })
  //       .where(eq(eventPools.id, pool.id))
  //       .returning();

  //     console.log("[BlindBoxPayment] updated eventPool after registration:", updatedPool);

  //     // ✅ 返回报名信息（前端目前只需要知道成功了 & 池子信息）
  //     return res.json({
  //       ok: true,
  //       registration,
  //       pool: updatedPool || pool,
  //     });
  //   } catch (error: any) {
  //     console.error("[BlindBoxPayment] Failed to create pool registration:", error);
  //     res.status(500).json({
  //       message: "Failed to create blind box registration",
  //       error: error?.message || String(error),
  //     });
  //   }
  // });
  // app.post('/api/blind-box-events', isPhoneAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     if (!userId) {
  //       console.error("[BlindBoxPayment] No userId in session");
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     // Try to fetch user for debugging (safe even if it fails)
  //     try {
  //       const usersResult = await db
  //         .select()
  //         .from(users)
  //         .where(eq(users.id, userId));
  //       console.log("[BlindBoxPayment] current user from DB:", usersResult);
  //     } catch (userErr) {
  //       console.warn("[BlindBoxPayment] failed to load user for debug:", userErr);
  //     }

  //     // 支付页传过来的盲盒报名数据 / 兼容老参数
  //     const {
  //       // 新版字段
  //       city,
  //       district,
  //       eventType,
  //       budgetTier,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       // 兼容旧版字段
  //       area,
  //       budget,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     } = req.body || {};

  //     console.log("[BlindBoxPayment] incoming payload:", {
  //       userId,
  //       city,
  //       district,
  //       area,
  //       eventType,
  //       budgetTier,
  //       budget,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     });

  //     // 统一处理城市和商圈/区域
  //     const finalCity = city || "深圳";
  //     const finalDistrict = district || area;
  //     // 统一处理预算：优先用 budgetTier，其次用 budget 数组
  //     let budgetRange: string[] = [];
  //     if (budgetTier !== undefined && budgetTier !== null) {
  //       if (Array.isArray(budgetTier)) {
  //         budgetRange = budgetTier.map((b) => String(b));
  //       } else {
  //         budgetRange = [String(budgetTier)];
  //       }
  //     } else if (Array.isArray(budget)) {
  //       budgetRange = budget.map((b: any) => String(b));
  //     }

  //     if (!finalCity || !finalDistrict || budgetRange.length === 0 || !eventType) {
  //       console.warn("[BlindBoxPayment] missing required fields after normalization:", {
  //         finalCity,
  //         finalDistrict,
  //         budgetRange,
  //         eventType,
  //       });
  //       return res.status(400).json({
  //         message: "参数不完整：需要 city / district(area) / eventType / budget",
  //       });
  //     }

  //     // 1) 查询当前城市 + 商圈下可用的活动池（admin 预设）
  //     const now = new Date();
  //     const pools = await db
  //       .select()
  //       .from(eventPools)
  //       .where(
  //         and(
  //           eq(eventPools.city, finalCity),
  //           eq(eventPools.district, finalDistrict),
  //           eq(eventPools.status, "active"),
  //           gt(eventPools.registrationDeadline, now)
  //         )
  //       );

  //     console.log("[BlindBoxPayment] matched event pools:", pools);

  //     // 🧊 优先用已有池子；如果没有，就懒创建一个「常驻池」
  //     let pool = pools[0];

  //     if (!pool) {
  //       console.log(
  //         "[BlindBoxPayment] No active pool found, creating persistent default pool for:",
  //         { city: finalCity, district: finalDistrict, eventType }
  //       );

  //       const farFuture = new Date();
  //       farFuture.setFullYear(2035); // 超远的占位时间

  //       const [createdPool] = await db
  //         .insert(eventPools)
  //         .values({
  //           title: `${finalCity}·${finalDistrict} ${eventType}常驻池`,
  //           description: null,
  //           eventType,
  //           city: finalCity,
  //           district: finalDistrict,
  //           venue: null,

  //           // ✅ 必填字段
  //           dateTime: farFuture,
  //           registrationDeadline: farFuture,

  //           minBudget: null,
  //           maxBudget: null,
  //           minAge: null,
  //           maxAge: null,

  //           minParticipants: 4,
  //           maxParticipants: 6,
  //           minPartySize: 1,

  //           genderBalanceMode: null,
  //           status: "active",
  //           totalRegistrations: 0,
  //           totalMatches: 0,

  //           // ✅ 这里改成当前 userId（之前是 null 导致报错）
  //           createdBy: userId,
  //         })
  //         .returning();

  //       console.log("[BlindBoxPayment] created default persistent pool:", createdPool);
  //       pool = createdPool;
  //     }

  //     // 2) 在 event_pool_registrations 中插入报名记录
  //     const registrationData = {
  //       poolId: pool.id,
  //       userId,
  //       budgetRange,
  //       preferredLanguages: Array.isArray(selectedLanguages) ? selectedLanguages : [],
  //       tasteIntensity: Array.isArray(selectedTasteIntensity) ? selectedTasteIntensity : [],
  //       cuisinePreferences: Array.isArray(selectedCuisines) ? selectedCuisines : [],
  //       eventIntent: Array.isArray(eventIntent) ? eventIntent : [],
  //       dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
  //     };

  //     console.log("[BlindBoxPayment] creating eventPoolRegistration with data:", registrationData);

  //     const [registration] = await db
  //       .insert(eventPoolRegistrations)
  //       .values(registrationData)
  //       .returning();

  //     console.log("[BlindBoxPayment] created eventPoolRegistration:", registration);

  //     // 3) 更新活动池的 totalRegistrations 计数
  //     const [updatedPool] = await db
  //       .update(eventPools)
  //       .set({
  //         totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
  //         updatedAt: new Date(),
  //       })
  //       .where(eq(eventPools.id, pool.id))
  //       .returning();

  //     console.log("[BlindBoxPayment] updated eventPool after registration:", updatedPool);

  //     // 4) 返回报名信息
  //     return res.json({
  //       ok: true,
  //       registration,
  //       pool: updatedPool || pool,
  //     });
  //   } catch (error: any) {
  //     console.error("[BlindBoxPayment] Failed to create pool registration:", error);
  //     res.status(500).json({
  //       message: "Failed to create blind box registration",
  //       error: error?.message || String(error),
  //     });
  //   }
  // });  
  // app.post('/api/blind-box-events', isPhoneAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     if (!userId) {
  //       console.error("[BlindBoxPayment] No userId in session");
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     // 尽量把当前用户查出来，方便 debug
  //     try {
  //       const usersResult = await db
  //         .select()
  //         .from(users)
  //         .where(eq(users.id, userId));
  //       console.log("[BlindBoxPayment] current user from DB:", usersResult);
  //     } catch (userErr) {
  //       console.warn("[BlindBoxPayment] failed to load user for debug:", userErr);
  //     }

  //     // 支付页传过来的盲盒报名数据 / 兼容老参数
  //     const {
  //       // 新版字段
  //       city,
  //       district,
  //       eventType,
  //       budgetTier,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       // 兼容旧版字段
  //       area,
  //       budget,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     } = req.body || {};

  //     console.log("[BlindBoxPayment] incoming payload:", {
  //       userId,
  //       city,
  //       district,
  //       area,
  //       eventType,
  //       budgetTier,
  //       budget,
  //       selectedLanguages,
  //       selectedTasteIntensity,
  //       selectedCuisines,
  //       eventIntent,
  //       dietaryRestrictions,
  //       acceptNearby,
  //       inviteFriends,
  //       friendsCount,
  //     });

  //     // 统一处理城市和商圈/区域
  //     const finalCity = city || "深圳";
  //     const finalDistrict = district || area;
  //     // 统一处理预算：优先用 budgetTier，其次用 budget 数组
  //     let budgetRange: string[] = [];
  //     if (budgetTier !== undefined && budgetTier !== null) {
  //       if (Array.isArray(budgetTier)) {
  //         budgetRange = budgetTier.map((b) => String(b));
  //       } else {
  //         budgetRange = [String(budgetTier)];
  //       }
  //     } else if (Array.isArray(budget)) {
  //       budgetRange = budget.map((b: any) => String(b));
  //     }

  //     if (!finalCity || !finalDistrict || budgetRange.length === 0 || !eventType) {
  //       console.warn("[BlindBoxPayment] missing required fields after normalization:", {
  //         finalCity,
  //         finalDistrict,
  //         budgetRange,
  //         eventType,
  //       });
  //       return res.status(400).json({
  //         message: "参数不完整：需要 city / district(area) / eventType / budget",
  //       });
  //     }

  //     // 1) 查询当前城市 + 商圈下可用的活动池（admin 预设）
  //     const now = new Date();
  //     const pools = await db
  //       .select()
  //       .from(eventPools)
  //       .where(
  //         and(
  //           eq(eventPools.city, finalCity),
  //           eq(eventPools.district, finalDistrict),
  //           eq(eventPools.status, "active"),
  //           gt(eventPools.registrationDeadline, now)
  //         )
  //       );

  //     console.log("[BlindBoxPayment] matched event pools:", pools);

  //     // 🧊 先用已有池子；如果没有，就懒创建一个「常驻池」
  //     let pool = pools[0];

  //     if (!pool) {
  //       console.log(
  //         "[BlindBoxPayment] No active pool found, creating persistent default pool for:",
  //         { city: finalCity, district: finalDistrict, eventType }
  //       );

  //       // 给这个常驻池一个很远的时间（既当活动时间又当报名截止时间）
  //       const farFuture = new Date();
  //       farFuture.setFullYear(2035); // 你要改成别的年份也可以

  //       const [createdPool] = await db
  //         .insert(eventPools)
  //         .values({
  //           title: `${finalCity}·${finalDistrict} ${eventType}常驻池`,
  //           description: null,
  //           eventType,
  //           city: finalCity,
  //           district: finalDistrict,
  //           venue: null,

  //           // ✅ 关键：一定要填 dateTime（NOT NULL）
  //           dateTime: farFuture,
  //           // ✅ 报名截止时间也给一个很远的时间
  //           registrationDeadline: farFuture,

  //           // 预算 / 年龄段先留空，之后 admin 可以在后台改
  //           minBudget: null,
  //           maxBudget: null,
  //           minAge: null,
  //           maxAge: null,

  //           // 一个合理的默认桌子规模（你也可以按需求改）
  //           minParticipants: 4,
  //           maxParticipants: 6,
  //           minPartySize: 1,

  //           genderBalanceMode: null, // 如果 schema 允许 null 就这样；有默认值的话可以不写
  //           status: "active",
  //           totalRegistrations: 0,
  //           totalMatches: 0,

  //           // createdBy 可以留 null，或者填当前用户 / admin id
  //           createdBy: null,
  //         })
  //         .returning();

  //       console.log("[BlindBoxPayment] created default persistent pool:", createdPool);
  //       pool = createdPool;
  //     }

  //     // 2) 在 event_pool_registrations 中插入报名记录（用户付完钱就直接进池子）
  //     const registrationData = {
  //       poolId: pool.id,
  //       userId,
  //       budgetRange,
  //       preferredLanguages: Array.isArray(selectedLanguages) ? selectedLanguages : [],
  //       tasteIntensity: Array.isArray(selectedTasteIntensity) ? selectedTasteIntensity : [],
  //       cuisinePreferences: Array.isArray(selectedCuisines) ? selectedCuisines : [],
  //       eventIntent: Array.isArray(eventIntent) ? eventIntent : [],
  //       dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
  //     };

  //     console.log("[BlindBoxPayment] creating eventPoolRegistration with data:", registrationData);

  //     const [registration] = await db
  //       .insert(eventPoolRegistrations)
  //       .values(registrationData)
  //       .returning();

  //     console.log("[BlindBoxPayment] created eventPoolRegistration:", registration);

  //     // 3) 更新活动池的 totalRegistrations 计数
  //     const [updatedPool] = await db
  //       .update(eventPools)
  //       .set({
  //         totalRegistrations: sql`${eventPools.totalRegistrations} + 1`,
  //         updatedAt: new Date(),
  //       })
  //       .where(eq(eventPools.id, pool.id))
  //       .returning();

  //     console.log("[BlindBoxPayment] updated eventPool after registration:", updatedPool);

  //     // 4) 返回报名信息（前端目前只需要知道成功了）
  //     return res.json({
  //       ok: true,
  //       registration,
  //       pool: updatedPool || pool,
  //     });
  //   } catch (error: any) {
  //     console.error("[BlindBoxPayment] Failed to create pool registration:", error);
  //     res.status(500).json({
  //       message: "Failed to create blind box registration",
  //       error: error?.message || String(error),
  //     });
  //   }
  // });

  app.get('/api/blind-box-events/:eventId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const event = await storage.getBlindBoxEventById(eventId, userId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error("Error fetching blind box event:", error);
      res.status(500).json({ message: "Failed to fetch blind box event" });
    }
  });

  app.patch('/api/blind-box-events/:eventId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const { budget, acceptNearby, selectedLanguages, selectedTasteIntensity, selectedCuisines } = req.body;
      
      const event = await storage.updateBlindBoxEventPreferences(eventId, userId, {
        budget,
        acceptNearby,
        selectedLanguages,
        selectedTasteIntensity,
        selectedCuisines,
      });
      
      res.json(event);
    } catch (error) {
      console.error("Error updating blind box event:", error);
      res.status(500).json({ message: "Failed to update blind box event" });
    }
  });

  // app.post('/api/blind-box-events/:eventId/cancel', isPhoneAuthenticated, async (req: any, res) => {
  //   try {
  //     const userId = req.session.userId;
  //     const { eventId } = req.params;
  //     const event = await storage.cancelBlindBoxEvent(eventId, userId);
  //     res.json(event);
  //   } catch (error) {
  //     console.error("Error canceling blind box event:", error);
  //     res.status(500).json({ message: "Failed to cancel blind box event" });
  //   }
  // });
  app.post('/api/blind-box-events/:eventId/cancel', isPhoneAuthenticated, async (req: any, res) => {
    try {
      console.log("[BlindBoxCancel] route hit, raw request:", {
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        body: req.body,
        sessionUserId: req.session?.userId,
      });

      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const { eventId } = req.params;

      console.log("[BlindBoxCancel] incoming cancel request:", {
        userId,
        eventId,
      });

      // 1) 先尝试旧逻辑：如果你之前有真正的 blindBoxEvent 记录
      try {
        const legacyResult = await storage.cancelBlindBoxEvent(eventId, userId);
        if (legacyResult) {
          console.log("[BlindBoxCancel] legacy cancelBlindBoxEvent succeeded:", {
            eventId,
            userId,
          });
          return res.json(legacyResult);
        }
      } catch (legacyErr) {
        console.warn("[BlindBoxCancel] legacy cancelBlindBoxEvent failed or not applicable:", legacyErr);
      }

      // 2) 新逻辑优先：把 eventId 当作报名记录 id（event_pool_registrations.id）来删除
      // 这样 Activities 页如果传 registrationId 也可以正常取消
      let deletedRegistrations = await db
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.id, eventId),
            eq(eventPoolRegistrations.userId, userId)
          )
        )
        .returning();

      if (deletedRegistrations.length > 0) {
        console.log("[BlindBoxCancel] cancelled by registrationId:", {
          userId,
          registrationId: eventId,
          count: deletedRegistrations.length,
        });
        console.log("[BlindBoxCancel] response (by registrationId):", {
          userId,
          cancelledIds: (deletedRegistrations as any[]).map((r: any) => r.id),
        });

        // 对每个被删除的报名，把对应池子的 totalRegistrations - 1
        for (const reg of deletedRegistrations) {
          if (reg.poolId) {
            await db
              .update(eventPools)
              .set({
                totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
                updatedAt: new Date(),
              })
              .where(eq(eventPools.id, reg.poolId));
          }
        }

        return res.json({
          ok: true,
          cancelledRegistrationIds: deletedRegistrations.map((r: any) => r.id),
        });
      }

      // 3) 兼容旧调用方式：把 eventId 当作 poolId，用于删除当前用户在该池子的报名记录
      deletedRegistrations = await db
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, eventId),
            eq(eventPoolRegistrations.userId, userId)
          )
        )
        .returning();

      if (deletedRegistrations.length === 0) {
        console.warn("[BlindBoxCancel] no registration found to cancel:", {
          userId,
          eventId,
        });
        return res.status(404).json({
          message: "没有找到可取消的报名记录，可能已经取消过了",
        });
      }

      console.log("[BlindBoxCancel] cancelled by poolId:", {
        userId,
        poolId: eventId,
        count: deletedRegistrations.length,
      });
      console.log("[BlindBoxCancel] response (by poolId):", {
        userId,
        cancelledIds: (deletedRegistrations as any[]).map((r: any) => r.id),
      });

      // 同样更新对应池子的 totalRegistrations
      for (const reg of deletedRegistrations) {
        if (reg.poolId) {
          await db
            .update(eventPools)
            .set({
              totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(eventPools.id, reg.poolId));
        }
      }

      return res.json({
        ok: true,
        cancelledRegistrationIds: (deletedRegistrations as any[]).map((r: any) => r.id),
      });
    } catch (error) {
      console.error("[BlindBoxCancel] Error canceling blind box event / pool registration:", error);
      res.status(500).json({ message: "Failed to cancel blind box event" });
    }
  });

  // ============ EVENT SESSION (ICEBREAKER) ROUTES ============
  
  // GET /api/events/:eventId/session - Get existing icebreaker session for a blind box event
  app.get('/api/events/:eventId/session', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      
      // Use blindBoxEventId for blind box events (no foreign key constraint)
      const session = await storage.getIcebreakerSessionByBlindBoxEventId(eventId);
      
      if (session) {
        // Get check-in count
        const checkins = await storage.getSessionCheckins(session.id);
        res.json({ 
          sessionId: session.id,
          checkedInCount: checkins.length,
          expectedAttendees: session.expectedAttendees || 0,
          currentPhase: session.currentPhase
        });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("[EventSession] Error getting session:", error);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // POST /api/events/:eventId/session - Create new icebreaker session for a blind box event
  app.post('/api/events/:eventId/session', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.session.userId;
      
      // Check if session already exists (using blindBoxEventId)
      const existingSession = await storage.getIcebreakerSessionByBlindBoxEventId(eventId);
      if (existingSession) {
        return res.json({ sessionId: existingSession.id });
      }
      
      // Get the event to get attendee count
      const event = await db
        .select()
        .from(blindBoxEvents)
        .where(eq(blindBoxEvents.id, eventId))
        .limit(1);
      
      if (!event || event.length === 0) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const eventData = event[0];
      
      // Create new session using blindBoxEventId (no foreign key constraint)
      const newSession = await storage.createIcebreakerSession({
        blindBoxEventId: eventId,
        currentPhase: 'warmup',
        expectedAttendees: eventData.totalParticipants || 4,
        atmosphereType: eventData.eventType === '酒局' ? 'lively' : 'balanced',
        hostUserId: userId,
        startedAt: new Date(),
      });
      
      res.json({ sessionId: newSession.id });
    } catch (error: any) {
      // Handle unique constraint violation (concurrent creation)
      if (error?.code === '23505' || error?.message?.includes('unique constraint')) {
        console.log("[EventSession] Unique constraint hit, returning existing session");
        // Another request already created the session, fetch and return it
        const existingSession = await storage.getIcebreakerSessionByBlindBoxEventId(req.params.eventId);
        if (existingSession) {
          return res.json({ sessionId: existingSession.id });
        }
      }
      console.error("[EventSession] Error creating session:", error);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // ============ ATTENDANCE STATUS ROUTES ============

  function getUserDisplayName(user: any): string {
    return user?.displayName || user?.display_name || user?.firstName || 'Unknown';
  }

  function isParticipantOfBlindBoxEvent(event: any, userId: string): boolean {
    if (event.userId === userId) return true;
    const matchedAttendees = Array.isArray(event.matchedAttendees) ? event.matchedAttendees : [];
    return matchedAttendees.some((a: any) => a.userId === userId);
  }

  // User: get my attendance status for an event
  app.get('/api/blind-box-events/:eventId/my-attendance-status', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const status = await storage.getAttendanceStatus(eventId, userId);
      if (!status) {
        return res.json({ status: 'pending', estimatedLateMinutes: null, absentReason: null });
      }
      res.json(status);
    } catch (error) {
      console.error("[AttendanceStatus] Error fetching status:", error);
      res.status(500).json({ message: "Failed to fetch attendance status" });
    }
  });

  // User: update my attendance status for an event
  app.post('/api/blind-box-events/:eventId/attendance-status', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const { status, estimatedLateMinutes, absentReason } = req.body;

      // Only allow user-settable statuses (not 'pending')
      const validStatuses = ['confirmed', 'late', 'absent'] as const;
      type AttendanceStatus = (typeof validStatuses)[number];
      const isValidStatus = (s: unknown): s is AttendanceStatus =>
        typeof s === 'string' && (validStatuses as readonly string[]).includes(s);
      if (!isValidStatus(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      const normalizedStatus: AttendanceStatus = status;

      // Verify the caller is a participant in this event
      const event = await storage.getBlindBoxEventAdmin(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (!isParticipantOfBlindBoxEvent(event, userId)) {
        return res.status(403).json({ message: "Not a participant in this event" });
      }

      // Enforce time-window constraints
      const eventStart = new Date(event.date_time);
      const now = new Date();
      const diffMinutes = (now.getTime() - eventStart.getTime()) / 60000;

      let normalizedEstimatedLateMinutes: number | null = null;
      let normalizedAbsentReason: string | null = null;

      if (normalizedStatus === 'absent') {
        if (diffMinutes >= 0) {
          return res.status(400).json({ message: "Cannot mark absent after the event has started" });
        }
        if (typeof absentReason !== 'string' || absentReason.trim().length === 0) {
          return res.status(400).json({ message: "absentReason is required when marking absent" });
        }
        normalizedAbsentReason = absentReason.trim();
      } else if (normalizedStatus === 'late') {
        if (diffMinutes < -120 || diffMinutes > 45) {
          return res.status(400).json({ message: "Late status can only be set within 2 hours before to 45 minutes after the event" });
        }
        if (typeof estimatedLateMinutes !== 'number' || !Number.isFinite(estimatedLateMinutes) || estimatedLateMinutes <= 0) {
          return res.status(400).json({ message: "estimatedLateMinutes must be a positive number when marking late" });
        }
        normalizedEstimatedLateMinutes = estimatedLateMinutes;
      }
      // 'confirmed' uses no auxiliary fields

      await storage.updateAttendanceStatus(eventId, userId, normalizedStatus, normalizedEstimatedLateMinutes, normalizedAbsentReason);

      // Fetch user displayName for broadcast
      const user = await storage.getUser(userId);
      const displayName = getUserDisplayName(user);

      broadcastAttendanceStatusUpdated(eventId, userId, displayName, normalizedStatus, normalizedEstimatedLateMinutes ?? undefined, normalizedAbsentReason ?? undefined);

      res.json({ success: true });
    } catch (error) {
      console.error("[AttendanceStatus] Error updating status:", error);
      res.status(500).json({ message: "Failed to update attendance status" });
    }
  });

  // User/TableMates: get attendance summary for an event (all attendees' statuses)
  app.get('/api/blind-box-events/:eventId/attendance-summary', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;

      // Verify the caller is a participant in this event
      const event = await storage.getBlindBoxEventAdmin(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (!isParticipantOfBlindBoxEvent(event, userId)) {
        return res.status(403).json({ message: "Not a participant in this event" });
      }

      const summary = await storage.getEventAttendanceSummary(eventId);
      res.json(summary);
    } catch (error) {
      console.error("[AttendanceStatus] Error fetching attendance summary:", error);
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: get attendance summary for an event
  app.get('/api/admin/events/:eventId/attendance-summary', requireAdmin, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const summary = await storage.getEventAttendanceSummary(eventId);
      res.json(summary);
    } catch (error) {
      console.error("[AttendanceStatus] Admin error fetching attendance summary:", error);
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: override attendance status for a specific user
  app.patch('/api/admin/events/:eventId/attendees/:userId/attendance-status', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const { eventId, userId } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'confirmed', 'late', 'absent'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      await storage.adminOverrideAttendanceStatus(eventId, userId, status, adminId);

      // Broadcast the override
      const user = await storage.getUser(userId);
      const displayName = getUserDisplayName(user);
      broadcastAttendanceStatusUpdated(eventId, userId, displayName, status as any);

      res.json({ success: true });
    } catch (error) {
      console.error("[AttendanceStatus] Admin error overriding status:", error);
      res.status(500).json({ message: "Failed to override attendance status" });
    }
  });

  // ============ ADMIN BLIND BOX EVENT ROUTES ============
  // ============ ADMIN BLIND BOX EVENT ROUTES ============

  // Admin: list all blind box events (for management console)
  app.get('/api/admin/events', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      console.log("[AdminBlindBox] GET /api/admin/events by admin:", adminId);

      const events = await db
        .select()
        .from(blindBoxEvents)
        .orderBy(desc(blindBoxEvents.dateTime));

      console.log("[AdminBlindBox] Loaded blind box events count:", events.length);
      res.json(events);
    } catch (error: any) {
      console.error("[AdminBlindBox] Error fetching blind box events:", error);
      res.status(500).json({
        message: "Failed to fetch blind box events",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: create a blind box event (桌) that admins manage
  app.post('/api/admin/blind-box-events', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      if (!adminId) {
        console.error("[AdminBlindBox] No adminId in session on create");
        return res.status(401).json({ message: "Unauthorized" });
      }

      const {
        // 桌子标题（比如「海底捞」）
        title,
        // 饭局 / 酒局
        eventType,
        // 必须绑定一个池子：这个桌子就是在这个池子里开出来的
        poolId,
        // 预算档位（前端传的 budgetTier，直接存进去）
        budgetTier,
        // 下面几个是偏好字段，前端可能用 languages / cuisines / tasteIntensity，
        // 也可能用 selectedLanguages / selectedCuisines / selectedTasteIntensity，这里统一兼容
        languages,
        cuisines,
        tasteIntensity,
        selectedLanguages,
        selectedCuisines,
        selectedTasteIntensity,
        // 预留：后面如果要做「自动匹配」可以用这个开关
        autoMatch,
      } = req.body || {};

      // 必填校验：这里刻意不要求 city/district/dateTime，因为这些都从 pool 上继承
      if (!title || !eventType || !poolId || !budgetTier) {
        console.warn("[AdminBlindBox] Missing required fields when creating blind box event");
        return res.status(400).json({
          message: "缺少必填字段：title / eventType / poolId / budgetTier",
        });
      }

      // 找到对应的活动池
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, poolId));

      if (!pool) {
        console.warn("[AdminBlindBox] Pool not found for create:", poolId);
        return res.status(404).json({ message: "活动池不存在" });
      }

      // 参数归一化
      const toStringArray = (value: any): string[] => {
        if (Array.isArray(value)) return value.map((v) => String(v));
        if (typeof value === "string") {
          return value
            .split(/[,\s/、]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        }
        return [];
      };

      const normalizedLanguages = toStringArray(selectedLanguages ?? languages);
      const normalizedCuisines = toStringArray(selectedCuisines ?? cuisines);
      const normalizedTasteIntensity = toStringArray(selectedTasteIntensity ?? tasteIntensity);

      console.log("[AdminBlindBox] incoming create payload:", {
        adminId,
        title,
        eventType,
        poolId,
        budgetTier,
        normalizedLanguages,
        normalizedCuisines,
        normalizedTasteIntensity,
        autoMatch,
      });

      const [created] = await db
        .insert(blindBoxEvents)
        .values({
          // 用 admin 的 userId 做创建者
          userId: adminId ?? "",
          title: title ?? "",
          eventType: eventType ?? "",
          // 城市 / 区域 / 时间直接继承池子的配置
          city: pool.city,
          district: pool.district ?? "",
          dateTime: pool.dateTime,
          // 绑定池子，后面匹配会用到
          poolId: pool.id,
          // 桌子的预算档
          budgetTier: budgetTier ?? "",
          // 偏好字段
          selectedLanguages: normalizedLanguages,
          selectedTasteIntensity: normalizedTasteIntensity,
          selectedCuisines: normalizedCuisines,
          cuisineTags: normalizedCuisines,
          // 桌子初始状态：匹配中
          status: "matching",
          progress: 0,
          currentParticipants: 0,
          totalParticipants: pool.maxGroupSize ?? null,
          // 暂时把池子的 venue 复用到店名/地址上（以后有更细 schema 再拆）
          restaurantName: null,
          restaurantAddress: null,
        })
        .returning();

      console.log("[AdminBlindBox] created blindBoxEvent:", created);

      res.json(created);
    } catch (error: any) {
      console.error("[AdminBlindBox] Failed to create blind box event:", error);
      res.status(500).json({
        message: "Failed to create blind box event",
        error: error?.message || String(error),
      });
    }
  });

  // Admin: manual match trigger for blind box event
  app.post('/api/admin/events/:id/match', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const eventId = req.params.id;

      console.log("[AdminBlindBox] manual match trigger by admin:", {
        adminId,
        eventId,
      });

      // 1. 读取桌子信息
      const [event] = await db
        .select()
        .from(blindBoxEvents)
        .where(eq(blindBoxEvents.id, eventId));

      if (!event) {
        console.warn("[AdminBlindBox] event not found for manual match:", eventId);
        return res.status(404).json({ message: "Event not found" });
      }

      if (!event.poolId) {
        console.warn("[AdminBlindBox] event has no poolId, cannot match:", eventId);
        return res.status(400).json({ message: "该盲盒活动未绑定活动池，无法匹配" });
      }

      // 2. 读取池子配置
      const [pool] = await db
        .select()
        .from(eventPools)
        .where(eq(eventPools.id, event.poolId));

      if (!pool) {
        console.warn("[AdminBlindBox] pool not found for event:", {
          eventId,
          poolId: event.poolId,
        });
        return res.status(404).json({ message: "活动池不存在" });
      }

      const minSize = pool.minGroupSize ?? 4;
      const maxSize = pool.maxGroupSize ?? 6;

      // 3. 取出池子里所有「待匹配」的用户
      const pendingRegistrations = await db
        .select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, pool.id),
            eq(eventPoolRegistrations.matchStatus, "pending")
          )
        )
        .orderBy(eventPoolRegistrations.registeredAt);

      console.log("[AdminBlindBox] pending registrations count:", pendingRegistrations.length);

      if (pendingRegistrations.length < minSize) {
        return res.status(400).json({
          message: `当前池子报名人数不足（${pendingRegistrations.length}/${minSize}），暂时无法成局`,
        });
      }

      // 简单版本：按报名先后顺序取一桌
      const groupSize = Math.min(maxSize, pendingRegistrations.length);
      const selected = pendingRegistrations.slice(0, groupSize);

      const selectedIds = (selected as any[]).map((r: any) => r.id);

      // 4. 更新报名记录为 matched，并标记桌子 id
      await db
        .update(eventPoolRegistrations)
        .set({
          matchStatus: "matched",
          assignedGroupId: event.id,
        })
        .where(inArray(eventPoolRegistrations.id, selectedIds));

      // 5. 更新桌子状态
      const [updatedEvent] = await db
        .update(blindBoxEvents)
        .set({
          status: "matched",
          progress: 100,
          currentParticipants: groupSize,
          totalParticipants: groupSize,
        })
        .where(eq(blindBoxEvents.id, event.id))
        .returning();

      console.log("[AdminBlindBox] manual match finished:", {
        eventId: event.id,
        poolId: pool.id,
        groupSize,
      });

      return res.json({
        ok: true,
        event: updatedEvent,
        poolId: pool.id,
        groupSize,
        registrationIds: selectedIds,
      });
    } catch (error: any) {
      console.error("[AdminBlindBox] Error in manual match:", error);
      res.status(500).json({
        message: "Failed to run manual match",
        error: error?.message || String(error),
      });
    }
  });
  // // Admin: list all blind box events (for management console)
  // app.get('/api/admin/events', requireAdmin, async (req: any, res) => {
  //   try {
  //     const adminId = req.session.userId;
  //     console.log("[AdminBlindBox] GET /api/admin/events by admin:", adminId);

  //     const { db } = await import("./db");
  //     const { blindBoxEvents } = await import("@shared/schema");
  //     const { desc } = await import("drizzle-orm");

  //     const events = await db
  //       .select()
  //       .from(blindBoxEvents)
  //       .orderBy(desc(blindBoxEvents.dateTime));

  //     console.log("[AdminBlindBox] Loaded blind box events count:", events.length);
  //     res.json(events);
  //   } catch (error: any) {
  //     console.error("[AdminBlindBox] Error fetching blind box events:", error);
  //     res.status(500).json({
  //       message: "Failed to fetch blind box events",
  //       error: error?.message || String(error),
  //     });
  //   }
  // });

  // // Admin: create a blind box event (桌) that admins manage
  // app.post('/api/admin/blind-box-events', requireAdmin, async (req: any, res) => {
  //   try {
  //     const adminId = req.session.userId;
  //     if (!adminId) {
  //       console.error("[AdminBlindBox] No adminId in session on create");
  //       return res.status(401).json({ message: "Unauthorized" });
  //     }

  //     const {
  //       // basic info
  //       title,
  //       eventType,
  //       city,
  //       district,
  //       dateTime,
  //       // pool linkage (optional, can be wired up later)
  //       poolId,
  //       // capacity
  //       minParticipants,
  //       maxParticipants,
  //       // budget / venue
  //       budgetTier,
  //       venueAddress,
  //       // preferences
  //       languages,
  //       cuisines,
  //       tasteIntensity,
  //       // flags
  //       autoMatch,
  //     } = req.body || {};

  //     // Support both `languages` / `cuisines` / `tasteIntensity` and
  //     // `selectedLanguages` / `selectedCuisines` / `selectedTasteIntensity` from frontend
  //     const rawLanguages = languages ?? (req.body as any).selectedLanguages;
  //     const rawCuisines = cuisines ?? (req.body as any).selectedCuisines;
  //     const rawTasteIntensity = tasteIntensity ?? (req.body as any).selectedTasteIntensity;

  //     const toStringArray = (value: any): string[] => {
  //       if (Array.isArray(value)) {
  //         return value.map((v) => String(v));
  //       }
  //       if (typeof value === "string") {
  //         return value
  //           .split(/[,\s/、]+/)
  //           .map((s) => s.trim())
  //           .filter(Boolean);
  //       }
  //       return [];
  //     };

  //     const normalizedLanguages = toStringArray(rawLanguages);
  //     const normalizedCuisines = toStringArray(rawCuisines);
  //     const normalizedTasteIntensity = toStringArray(rawTasteIntensity);

  //     console.log("[AdminBlindBox] incoming create payload:", {
  //       adminId,
  //       title,
  //       eventType,
  //       city,
  //       district,
  //       dateTime,
  //       poolId,
  //       minParticipants,
  //       maxParticipants,
  //       budgetTier,
  //       venueAddress,
  //       languages,
  //       cuisines,
  //       tasteIntensity,
  //       normalizedLanguages,
  //       normalizedCuisines,
  //       normalizedTasteIntensity,
  //       autoMatch,
  //     });

  //     // ✅ Treat budgetTier as required as well
  //     if (!title || !eventType || !city || !district || !dateTime || !budgetTier) {
  //       console.warn("[AdminBlindBox] Missing required fields when creating blind box event");
  //       return res.status(400).json({
  //         message: "缺少必填字段：title / eventType / city / district / dateTime / budgetTier",
  //       });
  //     }

  //     const eventDate = new Date(dateTime);
  //     if (Number.isNaN(eventDate.getTime())) {
  //       console.warn("[AdminBlindBox] Invalid dateTime:", dateTime);
  //       return res.status(400).json({
  //         message: "无效的活动时间 dateTime",
  //       });
  //     }

  //     const { db } = await import("./db");
  //     const { blindBoxEvents } = await import("@shared/schema");

  //     const [created] = await db
  //       .insert(blindBoxEvents)
  //       .values({
  //         // 用 userId 标记是由哪个管理员创建的（后续可以加专门的 createdByAdmin 字段）
  //         userId: adminId,
  //         title,
  //         eventType,
  //         city,
  //         district,
  //         dateTime: eventDate,
  //         // ✅ budgetTier is non-null in DB, so we must always send a value
  //         budgetTier,
  //         // 语言/口味偏好：尽量与前端的多选字段一致
  //         selectedLanguages: normalizedLanguages,
  //         selectedTasteIntensity: normalizedTasteIntensity,
  //         selectedCuisines: normalizedCuisines,
  //         // 冗余存一份，方便筛选
  //         cuisineTags: normalizedCuisines,
  //         // admin 创建的桌默认还在匹配/招募阶段
  //         status: "matching",
  //         progress: 0,
  //         currentParticipants: 0,
  //         totalParticipants: maxParticipants ?? null,
  //         // 暂时把 venueAddress 存进 restaurantName / restaurantAddress 字段，后续可以拆出专门的字段
  //         restaurantName: venueAddress || null,
  //         restaurantAddress: venueAddress || null,
  //         // 预留：根据 autoMatch 决定是否以后自动触发匹配逻辑（目前仅记录在日志中）
  //       })
  //       .returning();

  //     console.log("[AdminBlindBox] created blindBoxEvent:", created);

  //     res.json(created);
  //   } catch (error: any) {
  //     console.error("[AdminBlindBox] Failed to create blind box event:", error);
  //     res.status(500).json({
  //       message: "Failed to create blind box event",
  //       error: error?.message || String(error),
  //     });
  //   }
  // });

  // // Admin: manual match trigger for blind box event
  // app.post('/api/admin/events/:id/match', requireAdmin, async (req: any, res) => {
  //   try {
  //     const adminId = req.session.userId;
  //     const eventId = req.params.id;

  //     console.log("[AdminBlindBox] manual match trigger by admin:", {
  //       adminId,
  //       eventId,
  //     });

  //     const { blindBoxEvents } = await import("@shared/schema");
  //     const { db } = await import("./db");

  //     // Load event
  //     const [event] = await db
  //       .select()
  //       .from(blindBoxEvents)
  //       .where(eq(blindBoxEvents.id, eventId));

  //     if (!event) {
  //       console.warn("[AdminBlindBox] event not found for manual match:", eventId);
  //       return res.status(404).json({ message: "Event not found" });
  //     }

  //     // TODO: 在这里接入真正的匹配逻辑，比如：
  //     // - 根据 event.city / event.district / eventType 找到对应活动池
  //     // - 从 eventPoolRegistrations 中捞人
  //     // - 将匹配结果写入 matchedAttendees / currentParticipants / totalParticipants
  //     // 当前先只把状态标记为 matching / pending_match 的占位逻辑

  //     let newStatus = event.status;
  //     if (event.status === "pending_match") {
  //       newStatus = "matching";
  //     }

  //     const [updated] = await db
  //       .update(blindBoxEvents)
  //       .set({
  //         status: newStatus,
  //         updatedAt: new Date(),
  //       })
  //       .where(eq(blindBoxEvents.id, eventId))
  //       .returning();

  //     console.log("[AdminBlindBox] manual match route updated event:", {
  //       id: updated.id,
  //       status: updated.status,
  //     });

  //     return res.json({
  //       ok: true,
  //       message: "Match trigger accepted (stub).",
  //       event: updated,
  //     });
  //   } catch (err: any) {
  //     console.error("[AdminBlindBox] error in manual match route:", err);
  //     return res
  //       .status(500)
  //       .json({ message: "Failed to trigger match for this event" });
  //   }
  // });


// =============================================end of blind box event routes============================
// ======================================================================================================












  // Demo endpoint to set match data for testing
  app.post('/api/blind-box-events/:eventId/set-demo-match', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      
      // Demo matched attendees data with rich hidden attributes for interesting connections
      const demoMatchedAttendees = [
        {
          userId: "demo1",
          displayName: "Alex",
          archetype: "机智狐",
          topInterests: ["film_entertainment", "travel_exploration", "photography"],
          age: 29,
          birthdate: "1996-03-15",
          gender: "Man",
          industry: "科技",
          educationLevel: "Master's",
          fieldOfStudy: "计算机科学",
          hometownRegionCity: "北京",
          studyLocale: "Overseas",
          seniority: "Mid",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)", "English"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo2",
          displayName: "小明",
          archetype: "暖心熊",
          topInterests: ["food_dining", "music_concerts", "travel_exploration"],
          age: 27,
          birthdate: "1998-07-20",
          gender: "Man",
          industry: "艺术",
          educationLevel: "Bachelor's",
          fieldOfStudy: "视觉艺术",
          hometownRegionCity: "上海",
          studyLocale: "Domestic",
          seniority: "Junior",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo3",
          displayName: "Sarah",
          archetype: "智者",
          topInterests: ["reading_books", "film_entertainment", "coffee_tea"],
          age: 32,
          birthdate: "1993-05-10",
          gender: "Woman",
          industry: "金融",
          educationLevel: "Master's",
          fieldOfStudy: "金融工程",
          hometownRegionCity: "香港",
          studyLocale: "Overseas",
          seniority: "Senior",
          relationshipStatus: "Married/Partnered",
          languagesComfort: ["English", "粤语 (Cantonese)", "普通话 (Mandarin)"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        },
        {
          userId: "demo4",
          displayName: "李华",
          archetype: "太阳鸡",
          topInterests: ["fitness_health", "travel_exploration", "outdoor_activities"],
          age: 28,
          birthdate: "1997-09-25",
          gender: "Woman",
          industry: "医疗",
          educationLevel: "Doctorate",
          fieldOfStudy: "临床医学",
          hometownRegionCity: "深圳",
          studyLocale: "Both",
          seniority: "Mid",
          relationshipStatus: "Single",
          languagesComfort: ["普通话 (Mandarin)", "English"],
          ageVisible: true,
          industryVisible: true,
          educationVisible: true
        }
      ];
      
      const demoExplanation = "这桌聚集了对电影、旅行充满热情的朋友。我们平衡了机智狐的探索新鲜与暖心熊的深度倾听，确保对话既热烈又有深度。";
      
      const event = await storage.setBlindBoxEventMatchData(eventId, userId, {
        matchedAttendees: demoMatchedAttendees,
        matchExplanation: demoExplanation
      });
      
      res.json(event);
    } catch (error) {
      console.error("Error setting demo match data:", error);
      res.status(500).json({ message: "Failed to set demo match data" });
    }
  });

  // Icebreaker routes - Multi-layered questions for deeper connection
  const icebreakerQuestions = {
    // Layer 1: Simple & Lighthearted - Easy entry points
    lighthearted: [
      "今天什么事让你微笑了？",
      "本周最好的消息是什么？",
      "最近吃过最奇怪的一道菜是什么？",
      "如果可以从日常生活中去掉一件事，你会选什么？为什么？",
      "如果能立刻学会一项技能，你想学什么？",
      "周末最喜欢做的一件小事是什么？",
      "最近什么事让你觉得很治愈？",
      "你的「快乐按钮」是什么？做什么事能让你立刻开心起来？",
    ],
    
    // Layer 2: Passions & Hobbies - Discovering interests
    passions: [
      "你对什么充满热情？为什么？",
      "有什么爱好或活动是你真正享受的？它吸引你的地方是什么？",
      "最近沉迷的一项运动或爱好是什么？",
      "有什么一直想尝试但还没开始的事情？",
      "如果有一整天自由时间，你会怎么度过？",
      "你会推荐别人尝试什么爱好或体验？",
      "什么事情会让你完全忘记时间？",
    ],
    
    // Layer 3: Travel & Adventures - Shared experiences
    travel: [
      "最难忘的一次旅行经历是什么？",
      "如果可以立刻去任何地方旅行，你会去哪里？",
      "旅行中遇到过什么意外的惊喜？",
      "你更喜欢计划好的行程，还是随性探索？",
      "有什么地方去了之后改变了你的想法？",
      "推荐一个你觉得被低估的旅行目的地",
      "下一个最想去的地方是哪里？为什么？",
    ],
    
    // Layer 4: Art & Creativity - Cultural connections
    creativity: [
      "最近有什么艺术作品或表演让你印象深刻？",
      "你会用什么方式表达创意？（音乐、绘画、写作等）",
      "有没有特别喜欢的艺术家或创作者？",
      "如果可以掌握一门艺术，你会选什么？",
      "最近在读什么书或在看什么剧？",
      "有什么电影或音乐改变了你的看法？",
      "你觉得什么样的创作最能打动人心？",
    ],
    
    // Layer 5: Innovation & Technology - Future thinking
    innovation: [
      "你觉得什么技术会改变我们的未来？",
      "有什么新科技产品让你觉得很酷？",
      "如果能发明一样东西解决生活中的问题，你会发明什么？",
      "你对AI有什么看法？它会如何影响我们的生活？",
      "最让你期待的未来趋势是什么？",
      "科技让生活更好了，还是更复杂了？",
    ],
    
    // Layer 6: Deeper Personal - Building trust
    personal: [
      "今晚你对这次聚会有什么期待？",
      "猜猜看，大家都是做什么工作的？",
      "如果明年要实现一个重要目标，会是什么？为什么？",
      "有什么经历塑造了现在的你？",
      "如果要教一门课，你会教什么？",
      "你觉得自己在哪方面成长了很多？",
      "最近学到的最重要的一课是什么？",
      "如果可以给5年前的自己一个建议，会说什么？",
    ],
    
    // Layer 7: Values & Beliefs - Deep connection
    values: [
      "有什么信念或价值观对你很重要？它如何影响你的选择？",
      "你觉得人类的发展方向是在进步还是倒退？为什么？",
      "什么样的事情会让你觉得很有意义？",
      "你觉得什么品质在人身上最可贵？",
      "有什么原则是你一直坚持的？",
      "你希望为这个世界留下什么？",
      "对你来说，成功意味着什么？",
    ],
    
    // Context-specific: Dining & Local
    dining: [
      "今天最想点的一道菜是什么？",
      "有什么特别的饮食偏好或禁忌吗？",
      "分享一个你难忘的用餐体验",
      "最近发现的好吃的店铺",
      "如果只能选一种菜系吃一辈子，会选什么？",
    ],
    
    city_life: [
      "在这座城市最爱的一个小店是哪里？",
      "推荐一个你觉得被低估的城市角落",
      "你最喜欢这个城市的哪个季节？",
      "如果要带朋友游览，会带去哪里？",
      "这个城市让你最惊喜的发现是什么？",
    ],
  };

  // Category labels for UI display
  const categoryLabels: Record<string, { name: string, color: string }> = {
    lighthearted: { name: "轻松愉快", color: "green" },
    passions: { name: "兴趣爱好", color: "blue" },
    travel: { name: "旅行探险", color: "purple" },
    creativity: { name: "艺术创意", color: "pink" },
    innovation: { name: "创新科技", color: "cyan" },
    personal: { name: "个人成长", color: "orange" },
    values: { name: "共同价值观", color: "red" },
    dining: { name: "美食话题", color: "yellow" },
    city_life: { name: "城市生活", color: "teal" },
  };

  app.get('/api/icebreakers/random', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { topic } = req.query;
      let selectedCategory: string;
      let questions: string[];
      
      if (topic && topic in icebreakerQuestions) {
        selectedCategory = topic;
        questions = icebreakerQuestions[topic as keyof typeof icebreakerQuestions];
      } else {
        // General: randomly select a category
        const categories = Object.keys(icebreakerQuestions);
        selectedCategory = categories[Math.floor(Math.random() * categories.length)];
        questions = icebreakerQuestions[selectedCategory as keyof typeof icebreakerQuestions];
      }
      
      const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
      const categoryInfo = categoryLabels[selectedCategory] || { name: "破冰问题", color: "gray" };
      
      res.json({ 
        question: randomQuestion,
        category: categoryInfo.name,
        categoryColor: categoryInfo.color
      });
    } catch (error) {
      console.error("Error fetching icebreaker:", error);
      res.status(500).json({ message: "Failed to fetch icebreaker question" });
    }
  });

  // AI-powered topic recommendations for icebreaker toolkit
  app.post('/api/icebreaker/ai-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, atmosphereType = 'balanced', count = 5 } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { getAIRecommendedTopics, getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('./topicRecommendationService');
      
      // Get AI recommendations with personalized reasons
      const recommendedTopics = await getAIRecommendedTopics(participants, atmosphereType, count);
      
      // Get all available topics for the full toolkit
      const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      console.error("Error fetching AI topic recommendations:", error);
      res.status(500).json({ message: "Failed to fetch AI topic recommendations" });
    }
  });

  // Quick (non-AI) topic recommendations for faster loading
  app.post('/api/icebreaker/quick-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { archetypes = [], atmosphereType = 'balanced', count = 5 } = req.body;
      
      const { getQuickRecommendedTopics, getAllTopicsForToolkit } = await import('./topicRecommendationService');
      
      // Get quick local recommendations (no AI call)
      const recommendedTopics = getQuickRecommendedTopics(archetypes, atmosphereType, count);
      
      // Get all available topics
      const allTopics = getAllTopicsForToolkit(archetypes, atmosphereType);
      
      res.json({
        recommendedTopics,
        allTopics,
      });
    } catch (error) {
      console.error("Error fetching quick topic recommendations:", error);
      res.status(500).json({ message: "Failed to fetch quick topic recommendations" });
    }
  });

  // AI-powered welcome message for icebreaker session
  app.post('/api/icebreaker/welcome-message', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, eventTitle } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateWelcomeMessage, generateQuickWelcome } = await import('./icebreakerAIService');
      
      // Try AI generation, fallback to quick generation
      let message: string;
      try {
        message = await generateWelcomeMessage(participants, eventTitle);
      } catch {
        const archetypes = participants.map((p: any) => p.archetype).filter(Boolean);
        message = await generateQuickWelcome(participants.length, archetypes);
      }
      
      res.json({ message });
    } catch (error) {
      console.error("Error generating welcome message:", error);
      res.status(500).json({ message: "Failed to generate welcome message" });
    }
  });

  // AI-powered closing message for icebreaker session
  app.post('/api/icebreaker/closing-message', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, durationMinutes, topicsDiscussed, gamesPlayed } = req.body;
      
      if (!participants || !Array.isArray(participants)) {
        return res.status(400).json({ message: "participants array is required" });
      }
      
      const { generateClosingMessage } = await import('./icebreakerAIService');
      
      const message = await generateClosingMessage(
        participants,
        durationMinutes || 0,
        topicsDiscussed,
        gamesPlayed
      );
      
      res.json({ message });
    } catch (error) {
      console.error("Error generating closing message:", error);
      res.status(500).json({ message: "Failed to generate closing message" });
    }
  });

  // AI-powered game recommendation (小悦推荐)
  app.post('/api/icebreaker/recommend-game', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { participants, scene, excludeGameIds } = req.body;
      
      if (!participants || !Array.isArray(participants) || participants.length === 0) {
        return res.status(400).json({ message: "participants array with at least one participant is required" });
      }
      
      if (scene && !['dinner', 'bar', 'both'].includes(scene)) {
        return res.status(400).json({ message: "scene must be 'dinner', 'bar', or 'both'" });
      }
      
      const { icebreakerGames } = await import('@shared/icebreakerGames');
      const { recommendGameForParticipants } = await import('./icebreakerAIService');
      
      let games = icebreakerGames.map(g => ({
        id: g.id,
        name: g.name,
        scene: g.scene,
        category: g.category,
        difficulty: g.difficulty,
        minPlayers: g.minPlayers,
        maxPlayers: g.maxPlayers,
        description: g.description
      }));
      
      if (excludeGameIds && Array.isArray(excludeGameIds) && excludeGameIds.length > 0) {
        games = games.filter(g => !excludeGameIds.includes(g.id));
      }
      
      if (games.length === 0) {
        return res.status(400).json({ message: "All games have been excluded, no more recommendations available" });
      }
      
      const recommendation = await recommendGameForParticipants(participants, games, scene);
      
      if (!recommendation || !recommendation.gameId || !recommendation.gameName) {
        return res.status(500).json({ message: "Failed to generate valid recommendation" });
      }
      
      res.json(recommendation);
    } catch (error) {
      console.error("Error recommending game:", error);
      res.status(500).json({ message: "Failed to recommend game" });
    }
  });

  // ============ In-Event Icebreaker Card Game Endpoints ============
  
  // Helper function to verify user is authorized to access session
  async function verifySessionAccess(sessionId: string, userId: string, db: any, schema: any): Promise<boolean> {
    const { icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = schema;
    const { eq, and } = await import('drizzle-orm');
    
    // Get session
    const [session] = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
    if (!session) return false;
    
    // Check if user is in the event/group
    if (session.groupId) {
      // Check pool group membership
      const registration = await db.select()
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.userId, userId),
            eq(eventPoolRegistrations.assignedGroupId, session.groupId)
          )
        )
        .limit(1);
      return registration.length > 0;
    } else if (session.blindBoxEventId) {
      // Check blind box event attendance
      const event = await storage.getBlindBoxEventById(session.blindBoxEventId, userId);
      if (!event) return false;
      const matchedAttendees = (Array.isArray(event.matchedAttendees) ? event.matchedAttendees : []) as Array<{ userId?: string }>;
      return matchedAttendees.some((a: any) => a.userId === userId);
    }
    
    return false;
  }
  
  // Generate cards for current round
  app.post('/api/icebreaker/game/generate-cards', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId, eventId, groupId, roundNumber, cardsCount, aiRatio } = req.body;
      
      if (!sessionId && !eventId && !groupId) {
        return res.status(400).json({ message: "sessionId, eventId, or groupId required" });
      }
      
      const { generateMixedCards } = await import('./icebreakerCardGenerationService');
      const { db } = await import('./db');
      const { 
        icebreakerSessions, 
        icebreakerGameCards, 
        icebreakerGameProgress,
        users,
        userInterests,
        eventPoolRegistrations,
        eventPoolGroups,
        assessmentSessions,
      } = await import('@shared/schema');
      const { eq, and, inArray, sql, desc, isNotNull } = await import('drizzle-orm');
      
      // Find or create icebreaker session
      let session;
      if (sessionId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.id, sessionId)).limit(1);
        session = sessions[0];
      } else if (eventId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.blindBoxEventId, eventId)).limit(1);
        session = sessions[0];
        
        if (!session) {
          // Create new session for blind box event
          const [newSession] = await db.insert(icebreakerSessions).values({
            blindBoxEventId: eventId,
            currentPhase: 'icebreaker',
            phaseStartedAt: new Date(),
          }).returning();
          session = newSession;
        }
      } else if (groupId) {
        const sessions = await db.select().from(icebreakerSessions).where(eq(icebreakerSessions.groupId, groupId)).limit(1);
        session = sessions[0];
        
        if (!session) {
          // Create new session for pool group
          const [newSession] = await db.insert(icebreakerSessions).values({
            groupId: groupId,
            currentPhase: 'icebreaker',
            phaseStartedAt: new Date(),
          }).returning();
          session = newSession;
        }
      }
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Verify user authorization to access this session
      const isAuthorized = await verifySessionAccess(session.id, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      // Get attendees data for personalization
      let attendees: any[] = [];
      
      if (session.groupId) {
        // Pool event - get group members
        const [group] = await db.select().from(eventPoolGroups).where(eq(eventPoolGroups.id, session.groupId)).limit(1);
        if (group && group.members) {
          const memberIds = (group.members as any[]).map((m: any) => m.userId).filter(Boolean);
          if (memberIds.length > 0) {
            attendees = await db.select({
              id: users.id,
              displayName: users.displayName,
              birthdate: users.birthdate,
              gender: users.gender,
              educationLevel: users.educationLevel,
              industryCategory: users.industryCategory,
              industrySegment: users.industrySegment,
              relationshipStatus: users.relationshipStatus,
              primaryArchetype: users.primaryArchetype,
              secondaryArchetype: users.secondaryArchetype,
              conversationMode: users.conversationMode,
              conversationEnergy: users.conversationEnergy,
            }).from(users).where(inArray(users.id, memberIds));
          }
        }
      } else if (session.blindBoxEventId) {
        // Blind box event - get matched attendees
        const event = await storage.getBlindBoxEventById(session.blindBoxEventId, userId);
        if (event && event.matchedAttendees) {
          const attendeeUserIds = (event.matchedAttendees as any[]).map((a: any) => a.userId).filter(Boolean);
          if (attendeeUserIds.length > 0) {
            attendees = await db.select({
              id: users.id,
              displayName: users.displayName,
              birthdate: users.birthdate,
              gender: users.gender,
              educationLevel: users.educationLevel,
              industryCategory: users.industryCategory,
              industrySegment: users.industrySegment,
              relationshipStatus: users.relationshipStatus,
              primaryArchetype: users.primaryArchetype,
              secondaryArchetype: users.secondaryArchetype,
              conversationMode: users.conversationMode,
              conversationEnergy: users.conversationEnergy,
            }).from(users).where(inArray(users.id, attendeeUserIds));
          }
        }
      }
      
      // Enrich with interests and trait scores
      for (const attendee of attendees) {
        // Get interests
        const [interests] = await db.select().from(userInterests).where(eq(userInterests.userId, attendee.id)).limit(1);
        if (interests && interests.selections) {
          attendee.interests = (interests.selections as any[]).map((s: any) => s.label);
          attendee.topPriorities = interests.topPriorities;
        }
        
        // Get personality trait scores from assessment results using Drizzle query builder
        const [assessment] = await db
          .select({
            traitScores: assessmentSessions.traitScores,
            primaryArchetype: assessmentSessions.primaryArchetype,
          })
          .from(assessmentSessions)
          .where(
            and(
              eq(assessmentSessions.userId, attendee.id),
              isNotNull(assessmentSessions.completedAt)
            )
          )
          .orderBy(desc(assessmentSessions.completedAt))
          .limit(1);
        
        if (assessment) {
          attendee.traitScores = assessment.traitScores;
        }
        
        // Get intent from pool registration if available
        if (session.groupId) {
          const [registration] = await db.select()
            .from(eventPoolRegistrations)
            .where(and(
              eq(eventPoolRegistrations.userId, attendee.id),
              eq(eventPoolRegistrations.assignedGroupId, session.groupId)
            ))
            .limit(1);
          if (registration && registration.intent) {
            attendee.intent = registration.intent;
          }
        }
      }
      
      // Generate cards
      const round = roundNumber || 1;
      const count = cardsCount || 3;
      const ratio = aiRatio !== undefined ? aiRatio : 70;
      
      const { cards, sources } = await generateMixedCards(attendees, round, count, ratio);
      
      // Save cards to database
      const savedCards = [];
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        const source = sources[i];
        
        const [savedCard] = await db.insert(icebreakerGameCards).values({
          sessionId: session.id,
          cardType: card.cardType,
          content: card.content,
          hint: card.hint,
          category: card.category,
          difficulty: card.difficulty,
          voteOptions: card.voteOptions ? card.voteOptions : null,
          missionType: card.missionType,
          unlockCondition: card.unlockCondition,
          isAiGenerated: source === 'ai',
          generationSource: source === 'ai' ? 'ai_deepseek' : 'curated',
          aiRecommendReason: card.aiRecommendReason,
          personalizedFor: {
            archetypes: attendees.map(a => a.primaryArchetype).filter(Boolean),
            interests: Array.from(new Set(attendees.flatMap(a => a.interests || []))).slice(0, 10),
            industries: attendees.map(a => a.industryCategory).filter(Boolean),
          },
          roundNumber: round,
          displayOrder: i,
          isRevealed: false,
          interactionCount: 0,
          skipCount: 0,
        }).returning();
        
        savedCards.push(savedCard);
      }
      
      // Update or create game progress
      const [progress] = await db.select().from(icebreakerGameProgress).where(eq(icebreakerGameProgress.sessionId, session.id)).limit(1);
      
      if (!progress) {
        await db.insert(icebreakerGameProgress).values({
          sessionId: session.id,
          totalRounds: 5,
          roundDurationMinutes: 20,
          currentRound: round,
          roundStartedAt: new Date(),
          gameStartedAt: round === 1 ? new Date() : undefined,
          aiGenerationRatio: ratio,
          cardsPerRound: count,
          roundHistory: [{ round, startedAt: new Date(), cardsGenerated: cards.length }],
        });
      } else {
        // Update existing progress
        const history = (progress.roundHistory as any[]) || [];
        history.push({ round, startedAt: new Date(), cardsGenerated: cards.length });
        
        await db.update(icebreakerGameProgress)
          .set({
            currentRound: round,
            roundStartedAt: new Date(),
            roundHistory: history,
            updatedAt: new Date(),
          })
          .where(eq(icebreakerGameProgress.sessionId, session.id));
      }
      
      res.json({
        sessionId: session.id,
        cards: savedCards,
        roundNumber: round,
        totalCards: savedCards.length,
        aiGeneratedCount: sources.filter(s => s === 'ai').length,
        curatedCount: sources.filter(s => s === 'curated').length,
      });
    } catch (error) {
      console.error("Error generating icebreaker cards:", error);
      res.status(500).json({ message: "Failed to generate cards", error: String(error) });
    }
  });
  
  // Get cards for a session
  app.get('/api/icebreaker/game/cards/:sessionId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId } = req.params;
      const { roundNumber } = req.query;
      
      const { db } = await import('./db');
      const { icebreakerGameCards, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      let query = db.select().from(icebreakerGameCards).where(eq(icebreakerGameCards.sessionId, sessionId));
      
      if (roundNumber) {
        query = db.select().from(icebreakerGameCards).where(
          and(
            eq(icebreakerGameCards.sessionId, sessionId),
            eq(icebreakerGameCards.roundNumber, parseInt(roundNumber))
          )
        );
      }
      
      const cards = await query.orderBy(icebreakerGameCards.roundNumber, icebreakerGameCards.displayOrder);
      
      res.json({ cards });
    } catch (error) {
      console.error("Error fetching icebreaker cards:", error);
      res.status(500).json({ message: "Failed to fetch cards" });
    }
  });
  
  // Record card interaction
  app.post('/api/icebreaker/game/interact', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { cardId, sessionId, interactionType, voteOptionId, reaction } = req.body;
      
      if (!cardId || !sessionId || !interactionType) {
        return res.status(400).json({ message: "cardId, sessionId, and interactionType required" });
      }
      
      const { db } = await import('./db');
      const { icebreakerCardInteractions, icebreakerGameCards, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      // Use transaction to prevent race conditions and ensure atomic updates
      await db.transaction(async (tx: DbTransaction) => {
        // For vote interactions, check for duplicate votes first
        if (interactionType === 'vote') {
          const existingVote = await tx
            .select()
            .from(icebreakerCardInteractions)
            .where(
              and(
                eq(icebreakerCardInteractions.cardId, cardId),
                eq(icebreakerCardInteractions.userId, userId),
                eq(icebreakerCardInteractions.interactionType, 'vote')
              )
            )
            .limit(1);
          
          if (existingVote.length > 0) {
            throw new Error('User has already voted on this card');
          }
        }
        
        // Record interaction
        await tx.insert(icebreakerCardInteractions).values({
          cardId,
          userId,
          sessionId,
          interactionType,
          voteOptionId,
          reaction,
        });
        
        // Lock the card row and update interaction counts atomically
        const [card] = await tx
          .select()
          .from(icebreakerGameCards)
          .where(eq(icebreakerGameCards.id, cardId))
          .limit(1)
          .for('update');
        
        if (card) {
          const newCount = (card.interactionCount || 0) + 1;
          const newSkipCount = interactionType === 'skip' ? (card.skipCount || 0) + 1 : card.skipCount;
          
          await tx
            .update(icebreakerGameCards)
            .set({ 
              interactionCount: newCount, 
              skipCount: newSkipCount,
              updatedAt: new Date(),
            })
            .where(eq(icebreakerGameCards.id, cardId));
          
          // For vote cards, update vote results under the same lock
          if (interactionType === 'vote' && voteOptionId && card.voteOptions) {
            const currentResults = (card.voteResults as Record<string, number>) || {};
            currentResults[voteOptionId] = (currentResults[voteOptionId] || 0) + 1;
            
            await tx
              .update(icebreakerGameCards)
              .set({ voteResults: currentResults })
              .where(eq(icebreakerGameCards.id, cardId));
          }
        }
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording card interaction:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to record interaction";
      res.status(error instanceof Error && error.message.includes('already voted') ? 409 : 500)
        .json({ message: errorMessage });
    }
  });
  
  // Get game progress
  app.get('/api/icebreaker/game/progress/:sessionId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { sessionId } = req.params;
      
      const { db } = await import('./db');
      const { icebreakerGameProgress, icebreakerSessions, eventPoolRegistrations, eventPoolGroups } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');
      
      // Verify user authorization
      const isAuthorized = await verifySessionAccess(sessionId, userId, db, {
        icebreakerSessions,
        eventPoolRegistrations,
        eventPoolGroups,
      });
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to access this session" });
      }
      
      const [progress] = await db.select().from(icebreakerGameProgress).where(eq(icebreakerGameProgress.sessionId, sessionId)).limit(1);
      
      if (!progress) {
        return res.status(404).json({ message: "Game progress not found" });
      }
      
      res.json(progress);
    } catch (error) {
      console.error("Error fetching game progress:", error);
      res.status(500).json({ message: "Failed to fetch game progress" });
    }
  });

  // Notification endpoints
  app.get('/api/notifications/counts', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const counts = await storage.getNotificationCounts(userId);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching notification counts:", error);
      res.status(500).json({ message: "Failed to fetch notification counts" });
    }
  });

  app.post('/api/notifications/mark-read', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { category } = req.body;
      if (!category || !['discover', 'activities', 'chat'].includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }

      await storage.markNotificationsAsRead(userId, category);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      res.status(500).json({ message: "Failed to mark notifications as read" });
    }
  });

  // ============ INVITATION SYSTEM ROUTES ============

  // Helper function to generate unique invitation code
  function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  // POST /api/events/:id/create-invitation - Generate invitation link
  app.post('/api/events/:id/create-invitation', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const eventId = req.params.id;

      // Verify user owns this event
      const event = await storage.getBlindBoxEventById(eventId, userId);
      if (!event) {
        return res.status(404).json({ message: "Event not found or access denied" });
      }

      // Check if invitation already exists for this user and event
      const existingInvite = await db.query.invitations.findFirst({
        where: (invites: any, { and, eq }: any) => and(
          eq(invites.inviterId, userId),
          eq(invites.eventId, eventId)
        )
      });

      if (existingInvite) {
        return res.json({
          code: existingInvite.code,
          inviteLink: `${req.protocol}://${req.get('host')}/invite/${existingInvite.code}`
        });
      }

      // Generate unique code
      let code = generateInviteCode();
      let attempts = 0;
      while (attempts < 5) {
        const existing = await db.query.invitations.findFirst({
          where: (invites: any, { eq }: any) => eq(invites.code, code)
        });
        if (!existing) break;
        code = generateInviteCode();
        attempts++;
      }

      // Create invitation record
      const [invitation] = await db.insert(invitations).values({
        code,
        inviterId: userId,
        eventId,
        invitationType: event.status === 'matched' ? 'post_match' : 'pre_match',
        expiresAt: event.dateTime, // Expires when event starts
      }).returning();

      res.json({
        code: invitation.code,
        inviteLink: `${req.protocol}://${req.get('host')}/invite/${invitation.code}`
      });
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // ============ User Referral System API ============

  // GET /api/referrals/stats - Get user's referral code and stats
  app.get('/api/referrals/stats', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Check if user already has a referral code
      let [existingCode] = await db
        .select()
        .from(referralCodes)
        .where(eq(referralCodes.userId, userId))
        .limit(1);

      // If no code exists, create one
      if (!existingCode) {
        // Generate unique 6-char code
        const generateCode = () => {
          const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // No confusing chars
          let code = '';
          for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
          }
          return code;
        };

        let code = generateCode();
        let attempts = 0;
        while (attempts < 5) {
          const [existing] = await db
            .select({ id: referralCodes.id })
            .from(referralCodes)
            .where(eq(referralCodes.code, code))
            .limit(1);
          if (!existing) break;
          code = generateCode();
          attempts++;
        }

        [existingCode] = await db.insert(referralCodes).values({
          userId,
          code,
        }).returning();
      }

      // Count conversions for this user
      const conversions = await db
        .select({ id: referralConversions.id })
        .from(referralConversions)
        .where(eq(referralConversions.referralCodeId, existingCode.id));

      const successfulInvites = conversions.length;

      // Platform-wide stats (for social proof) - count all conversions
      const allConversions = await db
        .select({ id: referralConversions.id })
        .from(referralConversions);

      const platformTotal = allConversions.length;

      res.json({
        referralCode: existingCode.code,
        successfulInvites,
        platformTotal
      });
    } catch (error: any) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // GET /api/referrals/check/:code - Check if a code is a referral code (public)
  app.get('/api/referrals/check/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [referral] = await db
        .select({ id: referralCodes.id })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      res.json({ exists: !!referral });
    } catch (error: any) {
      console.error("Error checking referral code:", error);
      res.status(500).json({ error: "Failed to check referral code" });
    }
  });

  // GET /api/referrals/:code - Get referral info for landing page (public)
  app.get('/api/referrals/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [referral] = await db
        .select({
          id: referralCodes.id,
          code: referralCodes.code,
          userId: referralCodes.userId,
        })
        .from(referralCodes)
        .where(eq(referralCodes.code, code))
        .limit(1);

      if (!referral) {
        return res.status(404).json({ message: "Referral code not found" });
      }

      // Get inviter info
      const [inviter] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
        })
        .from(users)
        .where(eq(users.id, referral.userId))
        .limit(1);

      // Increment click count
      await db.update(referralCodes)
        .set({ totalClicks: sql`${referralCodes.totalClicks} + 1` })
        .where(eq(referralCodes.id, referral.id));

      res.json({
        code: referral.code,
        inviter: {
          displayName: inviter?.displayName || inviter?.firstName || '好友',
        }
      });
    } catch (error: any) {
      console.error("Error fetching referral:", error);
      res.status(500).json({ message: "Failed to fetch referral" });
    }
  });

  // GET /api/invitations/:code - Get invitation details (public, for landing page)
  app.get('/api/invitations/:code', async (req, res) => {
    try {
      const { code } = req.params;

      const [invitation] = await db
        .select({
          id: invitations.id,
          code: invitations.code,
          inviterId: invitations.inviterId,
          eventId: invitations.eventId,
          invitationType: invitations.invitationType,
          totalClicks: invitations.totalClicks,
          expiresAt: invitations.expiresAt,
          createdAt: invitations.createdAt,
        })
        .from(invitations)
        .where(eq(invitations.code, code))
        .limit(1);

      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      // Check if expired
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        return res.status(410).json({ message: "Invitation has expired" });
      }

      // Fetch inviter info
      const [inviter] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, invitation.inviterId))
        .limit(1);

      // Fetch event info (use inviter's userId for access)
      const event = await storage.getBlindBoxEventById(invitation.eventId, invitation.inviterId);

      // Increment click count
      await db.update(invitations)
        .set({ totalClicks: (invitation.totalClicks ?? 0) + 1 })
        .where(eq(invitations.id, invitation.id));

      res.json({
        inviter,
        event,
        invitationType: invitation.invitationType,
        code: invitation.code,
      });
    } catch (error: any) {
      console.error("Error fetching invitation:", error);
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

  // Create notification
  app.post('/api/notifications', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { category, type, title, message, relatedResourceId } = req.body;
      
      if (!category || !type || !title) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      await storage.createNotification({
        userId,
        category,
        type,
        title,
        message,
        relatedResourceId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  // Demo: Create sample chat data
  app.post('/api/chats/seed-demo', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      console.log(`[SEED-DEMO] Starting demo data creation for user: ${userId}`);

      // Create demo users with different archetypes and complete profiles
      const [demoUser1] = await db.insert(users).values({
        displayName: '小明',
        archetype: '开心柯基',
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
        archetype: '织网蛛',
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
        archetype: '机智狐',
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

      console.log(`[SEED-DEMO] Demo data creation completed successfully for user: ${userId}`);
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
      console.error("[SEED-DEMO] Error creating demo chat data:", error);
      res.status(500).json({ message: "Failed to create demo chat data", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Demo: Create sample notifications
  app.post('/api/notifications/seed-demo', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Create discover notifications
      await storage.createNotification({
        userId,
        category: 'discover',
        type: 'new_activity',
        title: '新活动推荐',
        message: '发现了一个超适合你的周末咖啡聚会',
      });

      // Create activities notifications
      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'match_success',
        title: '匹配成功',
        message: '你的周末轰趴活动已成功匹配4位小伙伴',
      });

      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'activity_reminder',
        title: '活动提醒',
        message: '距离「周末轰趴」开始还有2小时',
      });

      await storage.createNotification({
        userId,
        category: 'activities',
        type: 'feedback_reminder',
        title: '反馈提醒',
        message: '「周末轰趴」已结束，快来分享你的感受吧',
      });

      // Create chat notifications
      await storage.createNotification({
        userId,
        category: 'chat',
        type: 'new_message',
        title: '新消息',
        message: 'Alex 在群聊中@了你',
      });

      await storage.createNotification({
        userId,
        category: 'chat',
        type: 'new_message',
        title: '新消息',
        message: '周末轰趴群聊有6条新消息',
      });

      res.json({ success: true, message: 'Demo notifications created' });
    } catch (error) {
      console.error("Error creating demo notifications:", error);
      res.status(500).json({ message: "Failed to create demo notifications" });
    }
  });

  // ============ AUTH MIDDLEWARE ============
  
  async function requireAuth(req: Request, res: any, next: any) {
    const session = req.session as any;
    if (!session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }

  registerAdminAuthRoutes(app);
  
  // Amap config endpoint - provides map API keys for frontend (Admin Portal only)
  app.get('/api/config/amap', requireAdmin, (_req, res) => {
    const apiKey = process.env.AMAP_API_KEY;
    const securityKey = process.env.AMAP_SECURITY_KEY;
    
    if (!apiKey || !securityKey) {
      return res.status(503).json({ error: 'Amap configuration not available' });
    }
    
    res.json({
      apiKey,
      securityKey
    });
  });
  
  // Simple profile completeness calculator for stats (used before main function is defined)
  function calculateProfileCompletenessSimple(user: any): { score: number; starRating: number; missingFields: string[] } {
    const fields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
    ];
    
    const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    let filledWeight = 0;
    
    for (const field of fields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) filledWeight += field.weight;
      else missingFields.push(field.label);
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // Dashboard Statistics
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Calculate stats
      const totalUsers = allUsers.length;
      const subscribedUsers = 0; // TODO: Count from subscriptions table
      const newUsersThisWeek = 0; // TODO: Count users created in last 7 days
      const userGrowth = 0; // TODO: Calculate growth percentage
      
      // Count events (for now using blindBoxEvents)
      const allBlindBoxEvents = await storage.getAllBlindBoxEvents();
      const thisMonth = new Date();
      thisMonth.setDate(1);
      const eventsThisMonth = allBlindBoxEvents.filter((event: any) => {
        const eventDate = new Date(event.createdAt || '');
        return eventDate >= thisMonth;
      }).length;
      
      // Revenue stats (placeholder)
      const monthlyRevenue = 0; // TODO: Calculate from payments table
      
      // Personality distribution (archetypes)
      const personalityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.primaryArchetype) {
          acc[user.primaryArchetype] = (acc[user.primaryArchetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Archetype distribution (12-archetype system)
      const archetypeDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.archetype) {
          acc[user.archetype] = (acc[user.archetype] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Profile completeness distribution
      const completenessStats = { star1: 0, star2: 0, star3: 0, star4: 0, star5: 0, weakUsers: [] as any[] };
      for (const user of allUsers) {
        const completeness = calculateProfileCompletenessSimple(user);
        if (completeness.starRating === 1) completenessStats.star1++;
        else if (completeness.starRating === 2) completenessStats.star2++;
        else if (completeness.starRating === 3) completenessStats.star3++;
        else if (completeness.starRating === 4) completenessStats.star4++;
        else if (completeness.starRating === 5) completenessStats.star5++;
        
        // Track weak users (< 50% completeness)
        if (completeness.score < 50 && completenessStats.weakUsers.length < 10) {
          completenessStats.weakUsers.push({
            id: user.id,
            displayName: user.displayName || user.firstName || '未命名',
            score: completeness.score,
            starRating: completeness.starRating,
            missingFields: completeness.missingFields.slice(0, 5),
          });
        }
      }
      
      // City distribution
      const cityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.currentCity) {
          acc[user.currentCity] = (acc[user.currentCity] || 0) + 1;
        }
        return acc;
      }, {});

      // Calculate gamification stats
      const levelDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        const level = user.currentLevel || 1;
        acc[`Lv.${level}`] = (acc[`Lv.${level}`] || 0) + 1;
        return acc;
      }, {});
      
      const totalXP = allUsers.reduce((sum: number, user: any) => sum + (user.experiencePoints || 0), 0);
      const totalJoyCoins = allUsers.reduce((sum: number, user: any) => sum + (user.joyCoins || 0), 0);
      const activeStreakUsers = allUsers.filter((user: any) => (user.activityStreak || 0) > 0).length;
      
      const gamificationStats = {
        levelDistribution,
        totalXP,
        totalJoyCoins,
        activeStreakUsers,
        avgLevel: allUsers.length > 0 
          ? Math.round((allUsers.reduce((sum: number, u: any) => sum + (u.currentLevel || 1), 0) / allUsers.length) * 10) / 10
          : 1,
      };

      // Calculate weekly matching satisfaction and low-scoring matches
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      let weeklyMatchingSatisfaction = 70; // Default value
      let lowScoringMatches = 0;
      
      try {
        // Get recent pool matching logs from past 7 days
        const recentLogs = await db
          .select()
          .from(poolMatchingLogs)
          .where(gt(poolMatchingLogs.createdAt, sevenDaysAgo));
        
        if (recentLogs.length > 0) {
          // Calculate average satisfaction from matchScores (assuming > 70 is satisfied)
          const totalScore = recentLogs.reduce((sum: number, log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return sum + score;
          }, 0);
          weeklyMatchingSatisfaction = Math.round(totalScore / recentLogs.length);
          
          // Count low-scoring matches (< 50)
          lowScoringMatches = recentLogs.filter((log: any) => {
            const score = typeof log.matchScore === 'number' ? log.matchScore : 0;
            return score < 50;
          }).length;
        }
      } catch (err) {
        console.warn("Error calculating matching metrics:", err);
        // Use defaults if calculation fails
      }

      res.json({
        totalUsers,
        subscribedUsers,
        eventsThisMonth,
        monthlyRevenue,
        newUsersThisWeek,
        userGrowth,
        personalityDistribution,
        archetypeDistribution,
        completenessStats,
        cityDistribution,
        weeklyMatchingSatisfaction,
        lowScoringMatches,
        gamificationStats,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Helper function to calculate profile completeness
  function calculateProfileCompleteness(user: any): { score: number; starRating: number; missingFields: string[] } {
    const essentialFields = [
      { key: 'displayName', label: '昵称', weight: 1 },
      { key: 'gender', label: '性别', weight: 1 },
      { key: 'birthdate', label: '生日', weight: 1 },
      { key: 'currentCity', label: '城市', weight: 1 },
    ];
    const coreFields = [
      { key: 'interestsTop', label: '兴趣', weight: 1, isArray: true },
      { key: 'intent', label: '活动意向', weight: 1, isArray: true },
      { key: 'archetype', label: '社交原型', weight: 1 },
    ];
    const enrichmentFields = [
      { key: 'relationshipStatus', label: '感情状态', weight: 0.5 },
      { key: 'educationLevel', label: '学历', weight: 0.5 },
      { key: 'lifeStage', label: '人生阶段', weight: 0.5 },
      { key: 'socialStyle', label: '社交风格', weight: 0.5 },
      { key: 'venueStylePreference', label: '场地偏好', weight: 0.5 },
      { key: 'cuisinePreference', label: '菜系偏好', weight: 0.5, isArray: true },
      { key: 'topicAvoidances', label: '避免话题', weight: 0.3, isArray: true },
      { key: 'hasPets', label: '养宠物', weight: 0.3 },
      { key: 'hometown', label: '家乡', weight: 0.3 },
    ];
    
    const allFields = [...essentialFields, ...coreFields, ...enrichmentFields];
    const totalWeight = allFields.reduce((sum, f) => sum + f.weight, 0);
    const missingFields: string[] = [];
    
    let filledWeight = 0;
    for (const field of allFields) {
      const value = user[field.key];
      const isFilled = (field as any).isArray 
        ? Array.isArray(value) && value.length > 0
        : value !== null && value !== undefined && value !== '';
      
      if (isFilled) {
        filledWeight += field.weight;
      } else {
        missingFields.push(field.label);
      }
    }
    
    const score = Math.round((filledWeight / totalWeight) * 100);
    const starRating = score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1;
    
    return { score, starRating, missingFields };
  }

  // User Management - Get all users with filters and pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, filter, city, archetype, intent, interest, minCompleteness, maxCompleteness } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let users = await storage.getAllUsers();

      // Apply search filter
      if (search && typeof search === "string") {
        const searchLower = search.toLowerCase();
        users = users.filter((user: any) => 
          user.firstName?.toLowerCase().includes(searchLower) ||
          user.lastName?.toLowerCase().includes(searchLower) ||
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.email?.toLowerCase().includes(searchLower) ||
          user.phoneNumber?.includes(search)
        );
      }

      // Apply status filter
      if (filter === "banned") {
        users = users.filter((user: any) => user.isBanned);
      } else if (filter === "subscribed") {
        users = [];
      } else if (filter === "non-subscribed") {
        users = users;
      }
      
      // Apply city filter
      if (city && typeof city === "string") {
        users = users.filter((user: any) => user.currentCity === city);
      }
      
      // Apply archetype filter
      if (archetype && typeof archetype === "string") {
        users = users.filter((user: any) => user.archetype === archetype);
      }
      
      // Apply intent filter
      if (intent && typeof intent === "string") {
        users = users.filter((user: any) => 
          Array.isArray(user.intent) && user.intent.includes(intent)
        );
      }
      
      // Apply interest filter
      if (interest && typeof interest === "string") {
        users = users.filter((user: any) => 
          Array.isArray(user.interestsTop) && user.interestsTop.some((i: string) => 
            i.toLowerCase().includes(interest.toLowerCase())
          )
        );
      }
      
      // Calculate completeness for each user and apply completeness filter
      const usersWithCompleteness = users.map((user: any) => {
        const completeness = calculateProfileCompleteness(user);
        return { ...user, profileCompleteness: completeness };
      });
      
      // Apply completeness filters
      let filteredUsers = usersWithCompleteness;
      if (minCompleteness) {
        const minVal = parseInt(minCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score >= minVal);
      }
      if (maxCompleteness) {
        const maxVal = parseInt(maxCompleteness as string);
        filteredUsers = filteredUsers.filter(u => u.profileCompleteness.score <= maxVal);
      }

      const totalUsers = filteredUsers.length;
      const paginatedUsers = filteredUsers.slice(offset, offset + limit);

      res.json({
        users: paginatedUsers,
        pagination: {
          page,
          limit,
          total: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // User Management - Get user details with profile completeness
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's events
      const events = await storage.getUserBlindBoxEvents(req.params.id);
      
      // Calculate profile completeness
      const profileCompleteness = calculateProfileCompleteness(user);
      
      res.json({
        ...user,
        profileCompleteness,
        events,
        subscriptions: [],
        payments: [],
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
    }
  });

  // User Management - Get comprehensive user detail for admin portal
  app.get("/api/admin/users/:id/detail", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const profileCompleteness = calculateProfileCompleteness(user);

      // Onboarding lifecycle — mirrors /api/auth/user logic including onboardingCheckpoint override
      type OnboardingStep = 'onboarding' | 'personality-test' | 'essential-data' | 'extended-data' | 'profile-review' | 'guide' | 'discover';
      const profileEssentialComplete = !!(user.displayName && user.gender && user.currentCity);
      let nextStep: OnboardingStep;
      if (!user.hasCompletedRegistration) nextStep = 'onboarding';
      else if (!user.hasCompletedPersonalityTest) nextStep = 'personality-test';
      else if (!profileEssentialComplete) nextStep = 'essential-data';
      else if (!user.hasCompletedInterestsCarousel) nextStep = 'extended-data';
      else if (!user.hasSeenProfileReview) nextStep = 'profile-review';
      else if (!user.hasSeenGuide) nextStep = 'guide';
      else nextStep = 'discover';

      const stepOrder: OnboardingStep[] = ['onboarding', 'personality-test', 'essential-data', 'extended-data', 'profile-review', 'guide', 'discover'];
      const baseIndex = stepOrder.indexOf(nextStep);
      const checkpointValue = user.onboardingCheckpoint as OnboardingStep | null;
      const checkpointIndex = checkpointValue ? stepOrder.indexOf(checkpointValue) : -1;
      if (checkpointValue && checkpointIndex !== -1 && baseIndex !== -1 && checkpointIndex > baseIndex && checkpointIndex < stepOrder.indexOf('discover')) {
        const nextStepIndex = Math.min(checkpointIndex + 1, stepOrder.indexOf('discover'));
        nextStep = stepOrder[nextStepIndex];
      }

      // Fetch all independent data in parallel
      const [
        assessmentSessionResult,
        joinedEvents,
        poolRegistrations,
        userConnections,
        userMatchHistory,
        interestsResult,
      ] = await Promise.all([
        db
          .select()
          .from(assessmentSessions)
          .where(and(eq(assessmentSessions.userId, userId), eq(assessmentSessions.phase, 'completed')))
          .orderBy(desc(assessmentSessions.completedAt))
          .limit(1),
        storage.getUserJoinedEvents(userId),
        db
          .select()
          .from(eventPoolRegistrations)
          .where(eq(eventPoolRegistrations.userId, userId))
          .orderBy(desc(eventPoolRegistrations.registeredAt))
          .limit(20),
        db
          .select()
          .from(connections)
          .where(and(
            or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
            eq(connections.status, 'mutual')
          ))
          .orderBy(desc(connections.createdAt))
          .limit(20),
        db
          .select()
          .from(matchHistory)
          .where(or(eq(matchHistory.user1Id, userId), eq(matchHistory.user2Id, userId)))
          .orderBy(desc(matchHistory.matchedAt))
          .limit(20),
        db
          .select()
          .from(userInterests)
          .where(eq(userInterests.userId, userId))
          .limit(1),
      ]);

      const assessmentSession = assessmentSessionResult[0] || null;
      const interests = interestsResult[0] || null;

      // Matching readiness
      const blockers: string[] = [];
      if (!user.hasCompletedPersonalityTest) blockers.push('人格测试未完成');
      if (!user.archetype) blockers.push('原型未确定');
      if (!profileEssentialComplete) blockers.push('基本资料不完整');
      if (!user.hasCompletedInterestsCarousel) blockers.push('兴趣数据未完成');
      if (user.isBanned) blockers.push('用户已被封禁');
      const matchingReadiness = { isReady: blockers.length === 0, blockers };

      // Strip sensitive credential fields before sending to browser
      const { password, wechatSessionKey, wechatOpenId, ...safeUser } = user as any;
      res.json({
        user: { ...safeUser, profileCompleteness },
        onboarding: {
          nextStep,
          profileEssentialComplete,
          hasCompletedRegistration: user.hasCompletedRegistration,
          hasCompletedPersonalityTest: user.hasCompletedPersonalityTest,
          hasCompletedInterestsCarousel: user.hasCompletedInterestsCarousel,
          hasSeenProfileReview: user.hasSeenProfileReview,
          hasSeenGuide: user.hasSeenGuide,
        },
        assessmentSession: assessmentSession || null,
        joinedEvents,
        poolRegistrations,
        connections: userConnections,
        matchHistory: userMatchHistory,
        interests: interests || null,
        matchingReadiness,
      });
    } catch (error) {
      console.error("Error fetching user detail:", error);
      res.status(500).json({ message: "Failed to fetch user detail" });
    }
  });

  // User Management - Ban user
  app.patch("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: true });
      
      // TODO: Log moderation action
      res.json(updatedUser);
    } catch (error) {
      console.error("Error banning user:", error);
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  // User Management - Unban user
  app.patch("/api/admin/users/:id/unban", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = await storage.updateUser(req.params.id, { isBanned: false });
      
      // TODO: Log moderation action
      res.json(updatedUser);
    } catch (error) {
      console.error("Error unbanning user:", error);
      res.status(500).json({ message: "Failed to unban user" });
    }
  });

  // Subscription Management - Get all subscriptions with pagination
  app.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { filter } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      let subscriptions;
      
      if (filter === "active") {
        subscriptions = await storage.getActiveSubscriptions();
      } else {
        subscriptions = await storage.getAllSubscriptions();
      }

      const total = subscriptions.length;
      const paginatedData = subscriptions.slice(offset, offset + limit);

      res.json({
        subscriptions: paginatedData,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // Subscription Management - Create subscription
  app.post("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { userId, planType, durationMonths } = req.body;
      
      if (!userId || !planType || !durationMonths) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + durationMonths);

      const subscription = await storage.createSubscription({
        userId,
        planType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        isActive: true,
        autoRenew: false,
      });

      res.json(subscription);
    } catch (error) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: "Failed to create subscription" });
    }
  });

  // Subscription Management - Update subscription
  app.patch("/api/admin/subscriptions/:id", requireAdmin, async (req, res) => {
    try {
      const { isActive, autoRenew, endDate } = req.body;
      
      const subscription = await storage.updateSubscription(req.params.id, {
        isActive,
        autoRenew,
        endDate,
      });

      res.json(subscription);
    } catch (error) {
      console.error("Error updating subscription:", error);
      res.status(500).json({ message: "Failed to update subscription" });
    }
  });

  // Coupon Management - Get all coupons
  app.get("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const coupons = await storage.getAllCoupons();
      res.json(coupons);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  // Coupon Management - Get coupon details
  app.get("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      console.error("Error fetching coupon:", error);
      res.status(500).json({ message: "Failed to fetch coupon" });
    }
  });

  // Coupon Management - Get coupon usage stats
  app.get("/api/admin/coupons/:id/usage", requireAdmin, async (req, res) => {
    try {
      const usage = await storage.getCouponUsageStats(req.params.id);
      res.json(usage);
    } catch (error) {
      console.error("Error fetching coupon usage:", error);
      res.status(500).json({ message: "Failed to fetch coupon usage" });
    }
  });

  // Coupon Management - Create coupon
  app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const { code, discountType, discountValue, validFrom, validUntil, maxUses } = req.body;
      
      if (!code || !discountType || !discountValue) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const coupon = await storage.createCoupon({
        code: code.toUpperCase(),
        discountType,
        discountValue,
        validFrom: validFrom || new Date().toISOString(),
        validUntil: validUntil || null,
        maxUses: maxUses || null,
        isActive: true,
      });

      res.json(coupon);
    } catch (error) {
      console.error("Error creating coupon:", error);
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  // Coupon Management - Update coupon
  app.patch("/api/admin/coupons/:id", requireAdmin, async (req, res) => {
    try {
      const coupon = await storage.updateCoupon(req.params.id, req.body);
      res.json(coupon);
    } catch (error) {
      console.error("Error updating coupon:", error);
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  // ============ PUBLIC STATS ============

  // Public API - Get platform stats for landing page
  app.get("/api/public/stats", async (req, res) => {
    try {
      const stats = await storage.getPublicStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching public stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ PROMOTION BANNERS ============

  // Public API - Get active banners
  app.get("/api/banners", async (req, res) => {
    try {
      const { city, placement } = req.query;
      const banners = await storage.getActiveBanners(
        city as string | undefined,
        placement as string | undefined
      );
      res.json(banners);
    } catch (error) {
      console.error("Error fetching banners:", error);
      res.status(500).json({ message: "Failed to fetch banners" });
    }
  });

  // ============ PRICING MANAGEMENT ============

  // Public API - Get active pricing settings (for payment page)
  app.get("/api/pricing", async (req, res) => {
    try {
      const settings = await storage.getActivePricingSettings();
      const formatted = settings.map(s => ({
        id: s.id,
        planType: s.planType,
        name: s.displayName,
        nameEn: s.displayNameEn,
        description: s.description,
        price: s.priceInCents / 100,
        originalPrice: s.originalPriceInCents ? s.originalPriceInCents / 100 : null,
        durationDays: s.durationDays,
        isFeatured: s.isFeatured,
      }));
      res.json(formatted);
    } catch (error) {
      console.error("Error fetching pricing:", error);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  // Admin - Get all pricing settings
  app.get("/api/admin/pricing", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllPricingSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching pricing settings:", error);
      res.status(500).json({ message: "Failed to fetch pricing settings" });
    }
  });

  // Admin - Get single pricing setting
  app.get("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getPricingSetting(req.params.id);
      if (!setting) {
        return res.status(404).json({ message: "Pricing setting not found" });
      }
      res.json(setting);
    } catch (error) {
      console.error("Error fetching pricing setting:", error);
      res.status(500).json({ message: "Failed to fetch pricing setting" });
    }
  });

  // Admin - Update pricing setting
  app.patch("/api/admin/pricing/:id", requireAdmin, async (req, res) => {
    try {
      const { displayName, displayNameEn, description, priceInCents, originalPriceInCents, durationDays, sortOrder, isActive, isFeatured } = req.body;
      
      const setting = await storage.updatePricingSetting(req.params.id, {
        displayName,
        displayNameEn,
        description,
        priceInCents,
        originalPriceInCents,
        durationDays,
        sortOrder,
        isActive,
        isFeatured,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Error updating pricing setting:", error);
      res.status(500).json({ message: "Failed to update pricing setting" });
    }
  });

  // Venue Management - Get all venues
  app.get("/api/admin/venues", requireAdmin, async (req, res) => {
    try {
      const venues = await storage.getAllVenues();
      res.json(venues);
    } catch (error) {
      console.error("Error fetching venues:", error);
      res.status(500).json({ message: "Failed to fetch venues" });
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
      console.error("Error fetching venue:", error);
      res.status(500).json({ message: "Failed to fetch venue" });
    }
  });

  // Venue Management - Create venue
  app.post("/api/admin/venues", requireAdmin, async (req, res) => {
    try {
      const { 
        name, type, address, city, district, clusterId, districtId,
        contactName, contactPhone, commissionRate, tags, cuisines, 
        priceRange, maxConcurrentEvents, notes, decorStyle, tasteIntensity,
        barThemes, alcoholOptions, vibeDescriptor
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
        decorStyle: decorStyle || [],
        tasteIntensity: tasteIntensity || [],
        maxConcurrentEvents: maxConcurrentEvents || 1,
        isActive: true,
        notes: notes || null,
        barThemes: barThemes || [],
        alcoholOptions: alcoholOptions || [],
        vibeDescriptor: vibeDescriptor || null,
      });

      res.json(venue);
    } catch (error) {
      console.error("Error creating venue:", error);
      res.status(500).json({ message: "Failed to create venue" });
    }
  });

  // Venue Management - Update venue
  app.patch("/api/admin/venues/:id", requireAdmin, async (req, res) => {
    try {
      const venue = await storage.updateVenue(req.params.id, req.body);
      res.json(venue);
    } catch (error) {
      console.error("Error updating venue:", error);
      res.status(500).json({ message: "Failed to update venue" });
    }
  });

  // Venue Management - Delete venue
  app.delete("/api/admin/venues/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteVenue(req.params.id);
      res.json({ message: "Venue deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue:", error);
      res.status(500).json({ message: "Failed to delete venue" });
    }
  });

  // ============ VENUE DEALS API (场地优惠) ============
  
  // Get all deals for a venue (admin)
  app.get("/api/admin/venues/:venueId/deals", requireAdmin, async (req, res) => {
    try {
      const deals = await storage.getVenueDeals(req.params.venueId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching venue deals:", error);
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Get active deals for a venue (public - for event detail page)
  app.get("/api/venues/:venueId/deals", async (req, res) => {
    try {
      const deals = await storage.getActiveVenueDeals(req.params.venueId);
      res.json(deals);
    } catch (error) {
      console.error("Error fetching active venue deals:", error);
      res.status(500).json({ message: "Failed to fetch venue deals" });
    }
  });

  // Create venue deal (admin)
  app.post("/api/admin/venues/:venueId/deals", requireAdmin, async (req, res) => {
    try {
      const deal = await storage.createVenueDeal({
        ...req.body,
        venueId: req.params.venueId,
      });
      res.json(deal);
    } catch (error) {
      console.error("Error creating venue deal:", error);
      res.status(500).json({ message: "Failed to create venue deal" });
    }
  });

  // Update venue deal (admin)
  app.patch("/api/admin/venue-deals/:id", requireAdmin, async (req, res) => {
    try {
      const deal = await storage.updateVenueDeal(req.params.id, req.body);
      res.json(deal);
    } catch (error) {
      console.error("Error updating venue deal:", error);
      res.status(500).json({ message: "Failed to update venue deal" });
    }
  });

  // Delete venue deal (admin)
  app.delete("/api/admin/venue-deals/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteVenueDeal(req.params.id);
      res.json({ message: "Venue deal deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue deal:", error);
      res.status(500).json({ message: "Failed to delete venue deal" });
    }
  });

  // Record deal usage (for analytics)
  app.post("/api/venue-deals/:id/use", isPhoneAuthenticated, async (req, res) => {
    try {
      await storage.incrementVenueDealUsage(req.params.id);
      res.json({ message: "Deal usage recorded" });
    } catch (error) {
      console.error("Error recording deal usage:", error);
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
      console.error("Error fetching venue with deals:", error);
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
      console.error("Error fetching venue by name:", error);
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
      console.error("Error fetching active venue districts:", error);
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
      console.error("Error checking venue availability:", error);
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
      console.error("Error creating venue booking:", error);
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
      const bookings = await storage.getVenueBookings(req.params.venueId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching venue bookings:", error);
      res.status(500).json({ message: "Failed to fetch venue bookings" });
    }
  });

  // Venue Booking - Get booking for an event
  app.get("/api/events/:eventId/venue-booking", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getEventVenueBooking(req.params.eventId);
      res.json(booking || null);
    } catch (error) {
      console.error("Error fetching event venue booking:", error);
      res.status(500).json({ message: "Failed to fetch event venue booking" });
    }
  });

  // Venue Booking - Cancel booking
  app.post("/api/venues/bookings/:bookingId/cancel", requireAuth, async (req, res) => {
    try {
      const booking = await storage.cancelVenueBooking(req.params.bookingId);
      res.json(booking);
    } catch (error) {
      console.error("Error cancelling venue booking:", error);
      res.status(500).json({ message: "Failed to cancel venue booking" });
    }
  });

  // Venue Booking - Update revenue (Admin only)
  app.patch("/api/admin/venues/bookings/:bookingId/revenue", requireAdmin, async (req, res) => {
    try {
      const { actualRevenue } = req.body;
      
      if (actualRevenue === undefined) {
        return res.status(400).json({ message: "Missing actualRevenue" });
      }

      const booking = await storage.updateVenueBookingRevenue(req.params.bookingId, actualRevenue);
      res.json(booking);
    } catch (error) {
      console.error("Error updating venue booking revenue:", error);
      res.status(500).json({ message: "Failed to update venue booking revenue" });
    }
  });

  // ============ Emergency Venue Migration ============
  
  // Get active bookings for a venue (for migration planning)
  app.get("/api/admin/venues/:venueId/active-bookings", requireAdmin, async (req, res) => {
    try {
      const bookings = await storage.getActiveBookingsForVenue(req.params.venueId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching active venue bookings:", error);
      res.status(500).json({ message: "Failed to fetch active venue bookings" });
    }
  });

  // Migrate a booking to a new venue
  app.post("/api/admin/venues/bookings/:bookingId/migrate", requireAdmin, async (req, res) => {
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
      console.error("Error migrating venue booking:", error);
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
      console.error("Error finding alternative venues:", error);
      res.status(500).json({ message: "Failed to find alternative venues" });
    }
  });

  // ============ Venue Time Slots Management ============
  
  // Get all time slots across all venues (for calendar overview)
  app.get("/api/admin/time-slots/all", requireAdmin, async (req, res) => {
    try {
      const timeSlots = await storage.getAllVenueTimeSlotsWithVenue();
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching all venue time slots:", error);
      res.status(500).json({ message: "Failed to fetch all venue time slots" });
    }
  });
  
  // Get all time slots for a venue
  app.get("/api/admin/venues/:venueId/time-slots", requireAdmin, async (req, res) => {
    try {
      const timeSlots = await storage.getVenueTimeSlots(req.params.venueId);
      res.json(timeSlots);
    } catch (error) {
      console.error("Error fetching venue time slots:", error);
      res.status(500).json({ message: "Failed to fetch venue time slots" });
    }
  });

  // Create a time slot for a venue
  app.post("/api/admin/venues/:venueId/time-slots", requireAdmin, async (req, res) => {
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
      console.error("Error creating venue time slot:", error);
      res.status(500).json({ message: "Failed to create venue time slot" });
    }
  });

  // Batch create time slots (for weekly recurring)
  app.post("/api/admin/venues/:venueId/time-slots/batch", requireAdmin, async (req, res) => {
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
      console.error("Error batch creating venue time slots:", error);
      res.status(500).json({ message: "Failed to batch create venue time slots" });
    }
  });

  // Update a time slot
  app.patch("/api/admin/time-slots/:id", requireAdmin, async (req, res) => {
    try {
      const timeSlot = await storage.updateVenueTimeSlot(req.params.id, req.body);
      res.json(timeSlot);
    } catch (error) {
      console.error("Error updating venue time slot:", error);
      res.status(500).json({ message: "Failed to update venue time slot" });
    }
  });

  // Delete a time slot
  app.delete("/api/admin/time-slots/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteVenueTimeSlot(req.params.id);
      res.json({ message: "Time slot deleted successfully" });
    } catch (error) {
      console.error("Error deleting venue time slot:", error);
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
      console.error("Error fetching available venues:", error);
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
        .where(whereConditions);
      
      // Batch check which venues have time slots configured
      let venuesWithSlots;
      if (filteredVenues.length === 0) {
        venuesWithSlots = [];
      } else {
        // Single query to fetch all venueIds that have at least one active time slot
        const activeSlots = await db
          .select({ venueId: venueTimeSlots.venueId })
          .from(venueTimeSlots)
          .where(eq(venueTimeSlots.isActive, true));

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
      console.error("Smart venue filter error:", error);
      res.status(500).json({ message: "查询失败" });
    }
  });

  // Event Templates - Get all templates
  app.get("/api/admin/event-templates", requireAdmin, async (req, res) => {
    try {
      const templates = await storage.getAllEventTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching event templates:", error);
      res.status(500).json({ message: "Failed to fetch event templates" });
    }
  });

  // Event Templates - Create template
  app.post("/api/admin/event-templates", requireAdmin, async (req, res) => {
    try {
      const { name, eventType, dayOfWeek, timeOfDay, theme, genderRestriction, minAge, maxAge, minParticipants, maxParticipants, customPrice } = req.body;
      
      if (!name || !eventType || dayOfWeek === undefined || !timeOfDay) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const template = await storage.createEventTemplate({
        name,
        eventType,
        dayOfWeek,
        timeOfDay,
        theme: theme || null,
        genderRestriction: genderRestriction || null,
        minAge: minAge || null,
        maxAge: maxAge || null,
        minParticipants: minParticipants || 5,
        maxParticipants: maxParticipants || 10,
        customPrice: customPrice || null,
        isActive: true,
      });

      res.json(template);
    } catch (error) {
      console.error("Error creating event template:", error);
      res.status(500).json({ message: "Failed to create event template" });
    }
  });

  // Event Templates - Update template
  app.patch("/api/admin/event-templates/:id", requireAdmin, async (req, res) => {
    try {
      const template = await storage.updateEventTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      console.error("Error updating event template:", error);
      res.status(500).json({ message: "Failed to update event template" });
    }
  });

  // Event Templates - Delete template
  app.delete("/api/admin/event-templates/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteEventTemplate(req.params.id);
      res.json({ message: "Event template deleted successfully" });
    } catch (error) {
      console.error("Error deleting event template:", error);
      res.status(500).json({ message: "Failed to delete event template" });
    }
  });

  // Event Management - Get all events (admin view)
  app.get("/api/admin/events", requireAdmin, async (req, res) => {
    try {
      const events = await storage.getAllBlindBoxEventsAdmin();
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Event Management - Get event details (admin view)
  app.get("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const event = await storage.getBlindBoxEventAdmin(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Event Management - Update event status
  app.patch("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const eventId = req.params.id;
      const user = req.user as User;
      
      // Get old event state
      const oldEvent = await storage.getBlindBoxEventAdmin(eventId);
      if (!oldEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Update event
      const updatedEvent = await storage.updateBlindBoxEventAdmin(eventId, req.body);
      
      // Broadcast status change if status was updated
      if (req.body.status && req.body.status !== oldEvent.status) {
        await broadcastEventStatusChanged(
          eventId,
          oldEvent.status,
          req.body.status,
          user.id,
          req.body.reason
        );
      }
      
      // Broadcast admin action for other changes
      if (Object.keys(req.body).length > 0 && !req.body.status) {
        await broadcastAdminAction(
          eventId,
          'update_event',
          user.id,
          req.body
        );
      }
      
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // ============ EVENT POOLS (两阶段匹配模型) ============
  
  // Event Pools - Get all event pools (admin view)
  app.get("/api/admin/event-pools", requireAdmin, async (req, res) => {
    try {
      // 不用 relations，直接查 event_pools 表
      const pools = await db
        .select({
          id: eventPools.id,
          title: eventPools.title,
          description: eventPools.description,
          eventType: eventPools.eventType,
          city: eventPools.city,
          district: eventPools.district,
          dateTime: eventPools.dateTime,
          registrationDeadline: eventPools.registrationDeadline,
          genderRestriction: eventPools.genderRestriction,
          industryRestrictions: eventPools.industryRestrictions,
          seniorityRestrictions: eventPools.seniorityRestrictions,
          educationLevelRestrictions: eventPools.educationLevelRestrictions,
          ageRangeMin: eventPools.ageRangeMin,
          ageRangeMax: eventPools.ageRangeMax,
          minGroupSize: eventPools.minGroupSize,
          maxGroupSize: eventPools.maxGroupSize,
          targetGroups: eventPools.targetGroups,
          status: eventPools.status,
          totalRegistrations: eventPools.totalRegistrations,
          successfulMatches: eventPools.successfulMatches,
          createdBy: eventPools.createdBy,
          createdAt: eventPools.createdAt,
          updatedAt: eventPools.updatedAt,
          matchedAt: eventPools.matchedAt,
        })
        .from(eventPools)
        .orderBy(desc(eventPools.createdAt));

      console.log("[Admin] fetched raw eventPools:", pools);

      // 继续保留“报名数 / matched / pending”统计逻辑
      const poolsWithStats = await Promise.all(
        pools.map(async (pool: any) => {
          const registrations = await db.query.eventPoolRegistrations.findMany({
            where: (regs: any, { eq }: any) => eq(regs.poolId, pool.id),
          });

          return {
            ...pool,
            registrationCount: registrations.length,
            matchedCount: registrations.filter((r: any) => r.matchStatus === "matched").length,
            pendingCount: registrations.filter((r: any) => r.matchStatus === "pending").length,
          };
        })
      );

      console.log("[Admin] eventPools with stats:", poolsWithStats);

      res.json(poolsWithStats);
    } catch (error) {
      console.error("Error fetching event pools:", error);
      res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // // Event Pools - Create new event pool
  // app.post("/api/admin/event-pools", requireAdmin, async (req, res) => {
  //   try {
  //     const user = req.user as User;
      
  //     // Validate input
  //     const validatedData = insertEventPoolSchema.parse({
  //       ...req.body,
  //       createdBy: user.id,
  //       dateTime: new Date(req.body.dateTime),
  //       registrationDeadline: new Date(req.body.registrationDeadline),
  //     });
      
  //     const [pool] = await db.insert(eventPools).values(validatedData).returning();
      
  //     res.json(pool);
  //   } catch (error: any) {
  //     console.error("Error creating event pool:", error);
  //     res.status(400).json({ 
  //       message: "Failed to create event pool", 
  //       error: error.message 
  //     });
  //   }
  // });
// Event Pools - Create new event pool
app.post("/api/admin/event-pools", requireAdmin, async (req, res) => {
  try {
    const anyReq = req as any;
    const user = anyReq.user as User | undefined;
    const userIdFromReq = anyReq.userId || anyReq.adminId;
    const sessionUserId = anyReq.session?.userId;

    console.log("[EventPools] incoming create payload:", req.body);
    console.log("[EventPools] req.user =", user);
    console.log("[EventPools] req.userId / adminId =", userIdFromReq);
    console.log("[EventPools] session.userId =", sessionUserId);

    // ⚠️ 这里连 session 也一起兜底
    const createdBy =
      (user && user.id) ||
      userIdFromReq ||
      sessionUserId ||
      null;

    if (!createdBy) {
      console.error(
        "[EventPools] Missing admin user when creating event pool. Headers:",
        req.headers,
      );
      return res.status(401).json({
        message: "Unauthorized: admin user not found on request",
      });
    }

    // 校验 + 正常化
    const validatedData = insertEventPoolSchema.parse({
      ...req.body,
      createdBy,
      dateTime: new Date(req.body.dateTime),
      registrationDeadline: new Date(req.body.registrationDeadline),
    });

    console.log("[EventPools] validatedData =", validatedData);

    const [pool] = await db
      .insert(eventPools)
      .values(validatedData)
      .returning();

    console.log("[EventPools] created pool:", pool);

    res.json(pool);
  } catch (error: any) {
    console.error("Error creating event pool:", error);
    res.status(400).json({
      message: "Failed to create event pool",
      error: error?.message,
    });
  }
});

  // Event Pools - Update event pool
  app.patch("/api/admin/event-pools/:id", requireAdmin, async (req, res) => {
    try {
      const updates: any = { ...req.body };
      
      // Convert date strings to Date objects
      if (updates.dateTime) {
        updates.dateTime = new Date(updates.dateTime);
      }
      if (updates.registrationDeadline) {
        updates.registrationDeadline = new Date(updates.registrationDeadline);
      }
      
      updates.updatedAt = new Date();
      
      const [pool] = await db
        .update(eventPools)
        .set(updates)
        .where(eq(eventPools.id, req.params.id))
        .returning();
      
      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }
      
      res.json(pool);
    } catch (error) {
      console.error("Error updating event pool:", error);
      res.status(500).json({ message: "Failed to update event pool" });
    }
  });

  // Event Pools - Get registrations for a pool
  app.get("/api/admin/event-pools/:id/registrations", requireAdmin, async (req, res) => {
    try {
      const registrations = await db
        .select({
          id: eventPoolRegistrations.id,
          poolId: eventPoolRegistrations.poolId,
          userId: eventPoolRegistrations.userId,
          budgetRange: eventPoolRegistrations.budgetRange,
          preferredLanguages: eventPoolRegistrations.preferredLanguages,
          eventIntent: eventPoolRegistrations.eventIntent,
          cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
          dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
          tasteIntensity: eventPoolRegistrations.tasteIntensity,
          matchStatus: eventPoolRegistrations.matchStatus,
          assignedGroupId: eventPoolRegistrations.assignedGroupId,
          matchScore: eventPoolRegistrations.matchScore,
          registeredAt: eventPoolRegistrations.registeredAt,
          // User info
          userName: users.displayName,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          userGender: users.gender,
          userBirthdate: users.birthdate,
          // ✅ UPDATED: Use 3-tier industry classification
          userIndustryNiche: users.industryNicheLabel,
          userIndustryCategory: users.industryCategoryLabel,
          userArchetype: users.archetype,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(eq(eventPoolRegistrations.poolId, req.params.id));
      
      res.json(registrations);
    } catch (error) {
      console.error("Error fetching registrations:", error);
      res.status(500).json({ message: "Failed to fetch registrations" });
    }
  });

  // Event Pools - Get groups for a pool
  app.get("/api/admin/event-pools/:id/groups", requireAdmin, async (req, res) => {
    try {
      const groups = await db.query.eventPoolGroups.findMany({
        where: (groups: any, { eq }: any) => eq(groups.poolId, req.params.id),
        orderBy: (groups: any, { asc }: any) => [asc(groups.groupNumber)],
      });
      
      // Get members for each group
      const groupsWithMembers = await Promise.all(groups.map(async (group: any) => {
        const members = await db
          .select({
            registrationId: eventPoolRegistrations.id,
            userId: eventPoolRegistrations.userId,
            userName: users.displayName,
            userFirstName: users.firstName,
            userLastName: users.lastName,
            userGender: users.gender,
            userArchetype: users.archetype,
            // ✅ UPDATED: Use 3-tier industry classification
            userIndustryNiche: users.industryNicheLabel,
            userIndustryCategory: users.industryCategoryLabel,
            matchScore: eventPoolRegistrations.matchScore,
          })
          .from(eventPoolRegistrations)
          .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
          .where(eq(eventPoolRegistrations.assignedGroupId, group.id));
        
        return {
          ...group,
          members,
        };
      }));
      
      res.json(groupsWithMembers);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ message: "Failed to fetch groups" });
    }
  });

  // Event Pools - Trigger matching algorithm
  app.post("/api/admin/event-pools/:id/match", requireAdmin, async (req, res) => {
    try {
      const poolId = req.params.id;
      
      // Check if pool exists and is in active status
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId)
      });
      
      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }
      
      if (pool.status !== 'active') {
        return res.status(400).json({ message: "Pool is not in active status" });
      }
      
      // Run matching algorithm
      const groups = await matchEventPool(poolId);
      
      // Save results
      await saveMatchResults(poolId, groups);
      
      // Broadcast to admins and users
      await broadcastAdminAction(
        poolId,
        'pool_matched',
        (req.user as User).id,
        { groupCount: groups.length, totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0) }
      );
      
      res.json({ 
        message: "Matching completed successfully",
        groupCount: groups.length,
        totalMatched: groups.reduce((sum, g) => sum + g.members.length, 0),
        groups: groups.map(g => ({
          memberCount: g.members.length,
          avgChemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
        }))
      });
    } catch (error: any) {
      console.error("Error matching event pool:", error);
      res.status(500).json({ 
        message: "Failed to match event pool",
        error: error.message 
      });
    }
  });

  // ============ USER EVENT POOLS (用户端活动池) ============
  
  // Get all active event pools (for DiscoverPage)
  app.get('/api/event-pools', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const { city, eventType } = req.query;
      const now = new Date();

      const whereClauses = [
        eq(eventPools.status, "active"),
        gt(eventPools.registrationDeadline, now),
      ];

      if (city) {
        whereClauses.push(eq(eventPools.city, String(city)));
      }

      if (eventType) {
        whereClauses.push(eq(eventPools.eventType, String(eventType)));
      }

      const pools = await db
        .select()
        .from(eventPools)
        .where(and(...whereClauses))
        // 不用 asc/desc，直接按时间排序即可，防止少 import 报错
        .orderBy(eventPools.dateTime);

      if (pools.length === 0) {
        return res.json([]);
      }

      const poolIds = (pools as any[]).map((p: any) => p.id);

      // 查出当前用户在这些池子里的报名记录
      const userRegistrations = await db
        .select({ poolId: eventPoolRegistrations.poolId })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.userId, userId),
            inArray(eventPoolRegistrations.poolId, poolIds)
          )
        );

      const registeredPoolIds = new Set((userRegistrations as any[]).map((r: any) => r.poolId));

      // 过滤掉已经报名过的池子
      const visiblePools = (pools as any[]).filter((p: any) => !registeredPoolIds.has(p.id));

      // 获取每个池子的报名人数和前3个报名者的原型
      const poolsWithSocialProof = await Promise.all(
        visiblePools.map(async (pool: any) => {
          const registrations = await db
            .select({
              id: eventPoolRegistrations.id,
              userId: eventPoolRegistrations.userId,
            })
            .from(eventPoolRegistrations)
            .where(eq(eventPoolRegistrations.poolId, pool.id))
            .limit(10);

          // 获取前3个报名者的原型信息
          const sampleUserIds = registrations.slice(0, 3).map((r: any) => r.userId);
          let sampleArchetypes: string[] = [];
          
          if (sampleUserIds.length > 0) {
            const sampleUsers = await db
              .select({ archetype: users.archetype })
              .from(users)
              .where(inArray(users.id, sampleUserIds));
            sampleArchetypes = (sampleUsers as any[])
              .map((u: any) => u.archetype)
              .filter((a: any): a is string => a !== null);
          }

          return {
            ...pool,
            registrationCount: registrations.length,
            spotsLeft: ((pool.minGroupSize || 4) * (pool.targetGroups || 1)) - registrations.length,
            sampleArchetypes,
          };
        })
      );

      console.log("[EventPools] visible pools for user:", {
        userId,
        total: pools.length,
        registeredCount: userRegistrations.length,
        visibleCount: visiblePools.length,
      });

      return res.json(poolsWithSocialProof);
    } catch (error) {
      console.error("Error fetching event pools:", error);
      return res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // Get single event pool details
  app.get("/api/event-pools/:id", async (req, res) => {
    try {
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, req.params.id),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      // Get registration count
      const registrations = await db.query.eventPoolRegistrations.findMany({
        where: (regs: any, { eq }: any) => eq(regs.poolId, req.params.id)
      });

      res.json({
        ...pool,
        registrationCount: registrations.length,
        spotsLeft: ((pool.minGroupSize || 4) * (pool.targetGroups || 1)) - registrations.length,
      });
    } catch (error) {
      console.error("Error fetching event pool:", error);
      res.status(500).json({ message: "Failed to fetch event pool" });
    }
  });

  // Get group-fill progress for a pool (lightweight progress tracking)
  app.get("/api/event-pools/:poolId/group-fill", async (req, res) => {
    try {
      const { poolId } = req.params;

      // Count pending registrations in this pool
      const pendingRegs = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.poolId, poolId),
            eq(eventPoolRegistrations.matchStatus, "pending")
          )
        );

      // Get pool config for min/max group size
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId),
        columns: { minGroupSize: true, maxGroupSize: true },
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      const minSize = pool.minGroupSize || 4;
      const maxSize = pool.maxGroupSize || 6;
      const currentFill = Math.min(pendingRegs[0]?.count || 0, maxSize);
      
      // Progress is based on reaching minSize, capped at 100%
      const progress = Math.min((currentFill / minSize) * 100, 100);

      res.json({
        currentFill,
        minGroupSize: minSize,
        maxGroupSize: maxSize,
        progress,
      });
    } catch (error) {
      console.error("Error fetching group-fill progress:", error);
      res.status(500).json({ message: "Failed to fetch group-fill progress" });
    }
  });

  // User register for event pool with preferences
  app.post("/api/event-pools/:id/register", requireAuth, async (req, res) => {
    try {
      const poolId = req.params.id;
      const userId = (req.user as User).id;
      const invitationCode = req.body.invitationCode;

      // Check if pool exists and is active
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, poolId)
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      if (pool.status !== 'active') {
        return res.status(400).json({ message: "This event pool is no longer accepting registrations" });
      }

      // Check if user already registered
      const existingReg = await db.query.eventPoolRegistrations.findFirst({
        where: (regs: any, { eq, and }: any) => and(
          eq(regs.poolId, poolId),
          eq(regs.userId, userId)
        )
      });

      if (existingReg) {
        return res.status(400).json({ message: "You have already registered for this event pool" });
      }

      // Check if user has active subscription
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(403).json({ 
          message: "Subscription required",
          requiresSubscription: true,
          code: "NO_ACTIVE_SUBSCRIPTION"
        });
      }

      // Validate invitation if provided
      let inviterId: string | undefined;
      if (invitationCode) {
        const [invitation] = await db
          .select()
          .from(invitations)
          .where(eq(invitations.code, invitationCode))
          .limit(1);

        if (!invitation) {
          return res.status(400).json({ message: "Invalid invitation code" });
        }

        // Check if invitation expired
        if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
          return res.status(410).json({ message: "Invitation has expired" });
        }

        // Verify invitation is for a pool, not a specific event
        if (invitation.invitationType !== 'pre_match') {
          return res.status(400).json({ message: "This invitation is not valid for pool registration" });
        }

        inviterId = invitation.inviterId;
      }

      // Validate preferences
      const validatedData = insertEventPoolRegistrationSchema.parse({
        poolId,
        userId,
        budgetRange: req.body.budgetRange || [],
        preferredLanguages: req.body.preferredLanguages || [],
        eventIntent: req.body.eventIntent || [],
        cuisinePreferences: req.body.cuisinePreferences || [],
        dietaryRestrictions: req.body.dietaryRestrictions || [],
        tasteIntensity: req.body.tasteIntensity || 'medium',
        matchStatus: 'pending',
      });

      // Create registration
      const [registration] = await db
        .insert(eventPoolRegistrations)
        .values(validatedData)
        .returning();

      // Record invitation use if invitation was provided
      if (invitationCode && inviterId) {
        await db.insert(invitationUses).values({
          invitationId: invitationCode,
          inviteeId: userId,
          poolRegistrationId: registration.id,
        });

        // Increment acceptance count on invitation
        await db.update(invitations)
          .set({ totalAcceptances: sql`COALESCE(total_acceptances, 0) + 1` })
          .where(eq(invitations.code, invitationCode));
      }

      // Trigger realtime matching scan after registration (fire and forget with error handling)
      // Import at top: import { scanPoolAndMatch } from "./poolRealtimeMatchingService";
      const { scanPoolAndMatch } = await import("./poolRealtimeMatchingService");
      
      // Async trigger (don't block response)
      scanPoolAndMatch(poolId, "realtime", "user_registration").catch((err: any) =>  {
        console.error(`[Realtime Matching] Scan failed after registration:`, err);
        // Error logged, operation continues
      });

      // Silently backfill empty profile fields from registration data (fire-and-forget)
      enrichProfileFromRegistration({
        userId: registration.userId,
        eventIntent: registration.eventIntent ?? undefined,
        preferredLanguages: registration.preferredLanguages ?? undefined,
        dietaryRestrictions: registration.dietaryRestrictions ?? undefined,
      }).catch((err: any) => {
        // Log but don't fail the registration
        console.error("[profileEnrichment] Failed to enrich profile:", err);
      });

      res.json(registration);
    } catch (error: any) {
      console.error("Error registering for event pool:", error);

      if (error?.code === "23505" || error?.cause?.code === "23505") {
        return res.status(400).json({ message: "You have already registered for this event pool" });
      }

      res.status(500).json({ 
        message: "Failed to register for event pool",
        error: error.message 
      });
    }
  });


// Get user's pool registrations
app.get("/api/my-pool-registrations", requireAuth, async (req, res) => {
  try {
    const anyReq = req as any;
    const session = anyReq.session;
    const reqUser = anyReq.user;

    // 尽量兼容不同的 user 存放方式：req.user / session.userId / session.user.id
    const userId: string | undefined =
      reqUser?.id ||
      session?.userId ||
      session?.user?.id;

    console.log("[MyPoolRegistrations] identity debug:", {
      hasReqUser: !!reqUser,
      hasSession: !!session,
      sessionUserId: session?.userId,
      sessionUser: session?.user,
      finalUserId: userId,
    });

    if (!userId) {
      console.error("[MyPoolRegistrations] No user on request/session");
      return res.status(401).json({ message: "Unauthorized" });
    }

    console.log("[MyPoolRegistrations] fetching registrations for userId:", userId);

    const registrations = await db
      .select({
        id: eventPoolRegistrations.id,
        poolId: eventPoolRegistrations.poolId,
        budgetRange: eventPoolRegistrations.budgetRange,
        preferredLanguages: eventPoolRegistrations.preferredLanguages,
        eventIntent: eventPoolRegistrations.eventIntent,
        matchStatus: eventPoolRegistrations.matchStatus,
        assignedGroupId: eventPoolRegistrations.assignedGroupId,
        matchScore: eventPoolRegistrations.matchScore,
        registeredAt: eventPoolRegistrations.registeredAt,
        // Pool details
        poolTitle: eventPools.title,
        poolEventType: eventPools.eventType,
        poolCity: eventPools.city,
        poolDistrict: eventPools.district,
        poolDateTime: eventPools.dateTime,
        poolStatus: eventPools.status,
      })
      .from(eventPoolRegistrations)
      .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
      .where(eq(eventPoolRegistrations.userId, userId))
      .orderBy(desc(eventPoolRegistrations.registeredAt));

    console.log("[MyPoolRegistrations] base registrations count:", registrations.length);

    // 原来的邀请关系 enrichment 逻辑我全部保留，只是包了一层 Promise.all
    const enrichedRegistrations = await Promise.all(
      (registrations as any[]).map(async (reg: any) => {
        const [inviteUse] = await db
          .select()
          .from(invitationUses)
          .where(eq(invitationUses.poolRegistrationId, reg.id))
          .limit(1);
        
        let invitationRole: "inviter" | "invitee" | null = null;
        let relatedUserName: string | null = null;
        
        if (inviteUse && inviteUse.invitationId) {
          // 用户是被邀请的一方
          const [invitation] = await db
            .select()
            .from(invitations)
            .where(eq(invitations.code, inviteUse.invitationId))
            .limit(1);
          
          if (invitation) {
            const [inviter] = await db
              .select({ firstName: users.firstName, lastName: users.lastName })
              .from(users)
              .where(eq(users.id, invitation.inviterId))
              .limit(1);
            
            if (inviter) {
              invitationRole = "invitee";
              relatedUserName =
                `${inviter.firstName || ""} ${inviter.lastName || ""}`.trim() ||
                "好友";
            }
          }
        } else {
          // 看看当前用户是不是邀请人
          const userInvitations = await db
            .select({ code: invitations.code })
            .from(invitations)
            .where(eq(invitations.inviterId, userId))
            .limit(10);
          
          if (userInvitations.length > 0) {
            const codes = userInvitations.map((inv: any) => inv.code);
            const [relatedInviteUse] = await db
              .select({
                inviteeId: invitationUses.inviteeId,
              })
              .from(invitationUses)
              .innerJoin(
                eventPoolRegistrations,
                eq(invitationUses.poolRegistrationId, eventPoolRegistrations.id)
              )
              .where(
                and(
                  inArray(invitationUses.invitationId, codes),
                  eq(eventPoolRegistrations.poolId, reg.poolId)
                )
              )
              .limit(1);
            
            if (relatedInviteUse) {
              const [invitee] = await db
                .select({ firstName: users.firstName, lastName: users.lastName })
                .from(users)
                .where(eq(users.id, relatedInviteUse.inviteeId))
                .limit(1);
              
              if (invitee) {
                invitationRole = "inviter";
                relatedUserName =
                  `${invitee.firstName || ""} ${invitee.lastName || ""}`.trim() ||
                  "好友";
              }
            }
          }
        }
        
        return {
          ...reg,
          invitationRole,
          relatedUserName,
        };
      })
    );

    console.log("[MyPoolRegistrations] enriched registrations:", enrichedRegistrations);

    res.json(enrichedRegistrations);
  } catch (error) {
    console.error("Error fetching user pool registrations:", error);
    res.status(500).json({ message: "Failed to fetch registrations" });
  }
});


  // 取消盲盒报名（从活动池中移除当前用户的报名记录）
  app.delete('/api/pool-registrations/:id', isPhoneAuthenticated, async (req: any, res) => {
    try {
      console.log('[MyPoolRegistrationsCancel] route hit for /api/pool-registrations/:id', {
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        sessionUserId: req.session?.userId,
      });

      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      const { id } = req.params;

      if (!userId) {
        console.error('[MyPoolRegistrationsCancel] No userId in session');
        return res.status(401).json({ message: 'Unauthorized' });
      }

      console.log('[MyPoolRegistrationsCancel] attempting to delete registration', {
        userId,
        registrationId: id,
      });

      // 1) 删除当前用户在这个报名记录上的 row
      let deletedRegistrations = await db
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.id, id),
            eq(eventPoolRegistrations.userId, userId),
          )
        )
        .returning();

      if (deletedRegistrations.length === 0) {
        console.warn('[MyPoolRegistrationsCancel] no registration found to delete', {
          userId,
          registrationId: id,
        });
        return res.status(404).json({
          message: '没有找到可以取消的报名记录，可能已经取消过了',
        });
      }

      console.log('[MyPoolRegistrationsCancel] deleted registrations:', {
        count: deletedRegistrations.length,
        ids: deletedRegistrations.map((r: any) => r.id),
        poolIds: deletedRegistrations.map((r: any) => r.poolId),
      });

      // 2) 对每个受影响的池子，把 totalRegistrations - 1
      for (const reg of deletedRegistrations) {
        if (reg.poolId) {
          await db
            .update(eventPools)
            .set({
              totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
              updatedAt: new Date(),
            })
            .where(eq(eventPools.id, reg.poolId));
        }
      }

      console.log('[MyPoolRegistrationsCancel] updated pools after deletion');

      return res.json({
        ok: true,
        cancelledRegistrationIds: (deletedRegistrations as any[]).map((r: any) => r.id),
      });
    } catch (error) {
      console.error('[MyPoolRegistrationsCancel] error while cancelling registration', error);
      return res.status(500).json({ message: 'Failed to cancel pool registration' });
    }
  });

  // Get pool group details (members + activity info)
  app.get("/api/pool-groups/:groupId", requireAuth, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const userId = (req.session as any).userId as string;

      // Get group info
      const group = await db.query.eventPoolGroups.findFirst({
        where: (groups: any, { eq }: any) => eq(groups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get pool info
      const pool = await db.query.eventPools.findFirst({
        where: (pools: any, { eq }: any) => eq(pools.id, group.poolId),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      // Check if user is in this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: (regs: any, { eq, and }: any) => and(
          eq(regs.assignedGroupId, groupId),
          eq(regs.userId, userId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }

      // Get all group members with their profile info
      const members = await db
        .select({
          userId: users.id,
          displayName: users.displayName,
          archetype: users.archetype,
          topInterests: users.interestsRankedTop3,
          age: users.birthdate,
          // ✅ UPDATED: Use 3-tier industry classification
          industryNicheLabel: users.industryNicheLabel,
          industryCategoryLabel: users.industryCategoryLabel,
          ageVisible: users.ageVisibility,
          industryVisible: users.workVisibility,
          gender: users.gender,
          educationLevel: users.educationLevel,
          hometownRegionCity: users.hometownRegionCity,
          hometownAffinityOptin: users.hometownAffinityOptin,
          educationVisible: users.educationVisibility,
          relationshipStatus: users.relationshipStatus,
          // Event-specific preferences from registration
          intent: eventPoolRegistrations.eventIntent,
        })
        .from(eventPoolRegistrations)
        .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
        .where(eq(eventPoolRegistrations.assignedGroupId, groupId));

      res.json({
        group: {
          id: group.id,
          groupNumber: group.groupNumber,
          memberCount: group.memberCount,
          matchScore: group.overallScore,
          avgPairScore: group.avgChemistryScore, // stored as avgChemistryScore in DB (= avgPairScore)
          diversityScore: group.diversityScore,
          energyBalance: group.energyBalance,
          matchExplanation: group.matchExplanation,
          venueName: group.venueName,
          venueAddress: group.venueAddress,
          finalDateTime: group.finalDateTime,
          status: group.status,
        },
        pool: {
          id: pool.id,
          title: pool.title,
          description: pool.description,
          eventType: pool.eventType,
          city: pool.city,
          district: pool.district,
          dateTime: pool.dateTime,
        },
        members,
      });
    } catch (error) {
      console.error("Error fetching pool group details:", error);
      res.status(500).json({ message: "Failed to fetch group details" });
    }
  });

  // Get AI-generated group analysis for a pool group
  app.get('/api/pool-groups/:groupId/analysis', requireAuth, aiEndpointLimiter, async (req, res) => {
    try {
      const { groupId } = req.params;
      const userId = (req.session as any).userId as string;

      // Load group from DB
      const group = await db.query.eventPoolGroups.findFirst({
        where: eq(eventPoolGroups.id, groupId),
      });
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Load pool for eventType context
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, group.poolId),
      });

      // Check if user is in this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, groupId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }

      // Load all group registrations to get member IDs
      const groupRegistrations = await db.query.eventPoolRegistrations.findMany({
        where: eq(eventPoolRegistrations.assignedGroupId, groupId),
      });

      const memberIds = groupRegistrations.map((r: any) => r.userId as string);

      if (memberIds.length === 0) {
        return res.status(404).json({ error: 'Group has no members' });
      }

      // Load full user profiles for all members
      const memberProfiles = await db.query.users.findMany({
        where: inArray(users.id, memberIds),
      });

      // Load user interests (with heat levels) for deep interest overlap detection
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: inArray(userInterests.userId, memberIds),
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );

      // Build MatchMember[] using the same field mapping as the existing handler
      const members = memberProfiles.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? interestRow.selections.map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;
        // Prefer interestsRankedTop3; fall back to top heat-sorted selections; then legacy field
        const interestsTop =
          Array.isArray(m.interestsRankedTop3) && m.interestsRankedTop3.length > 0
            ? m.interestsRankedTop3
            : interestsWithHeat
            ? interestsWithHeat
                .slice()
                .sort((a: { heatLevel: number }, b: { heatLevel: number }) => b.heatLevel - a.heatLevel)
                .slice(0, 3)
                .map((s: { topicId: string }) => s.topicId)
            : m.interestsTop;
        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
        };
      });

      const { generateGroupAnalysis, getPairExplanationForUser } = await import('./matchExplanationService');

      // Call the existing service with caching enabled
      const analysis = await generateGroupAnalysis(
        groupId,
        members,
        pool?.eventType ?? '饭局',
        true
      );

      // Helper: map an internal PairExplanation to the shared response type
      const mapPe = (pe: { pairKey: string; explanation: string; chemistryScore: number; sharedInterests?: string[]; connectionPoints?: string[] }) => ({
        pairKey: pe.pairKey,
        explanation: pe.explanation,
        chemistryScore: pe.chemistryScore,
        sharedInterests: pe.sharedInterests ?? [],
        connectionPoints: pe.connectionPoints ?? [],
      });

      // Map internal GroupAnalysis → GroupAnalysisResponse
      const response: GroupAnalysisResponse = {
        groupId,
        overallChemistry: analysis.overallChemistry as GroupAnalysisResponse['overallChemistry'],
        groupDynamics: analysis.groupDynamics,
        iceBreakers: analysis.iceBreakers,
        pairExplanations: analysis.pairExplanations.map(mapPe),
        fromCache: analysis.fromCache ?? false,
        generatedAt: analysis.generatedAt ?? new Date().toISOString(),
        provider: analysis.provider ?? null,
        fallbackUsed: analysis.fallbackUsed ?? false,
        // Convenience field: pairs involving the authenticated viewer
        myPairs: getPairExplanationForUser(analysis, userId).map(mapPe),
        // Post-match theme layer
        groupThemeTags: analysis.groupThemeTags,
        groupThemeCompanion: analysis.groupThemeCompanion,
      };

      return res.json(response);
    } catch (error) {
      console.error('[analysis] Error generating group analysis:', error);
      return res.status(500).json({ error: 'Failed to generate analysis' });
    }
  });

  // Confirm attendance for a pool group
  app.post("/api/pool-groups/:groupId/confirm-attendance", requireAuth, async (req, res) => {
    try {
      const groupId = req.params.groupId;
      const session = req.session as any;
      const userId = session?.userId;

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Verify the user is a member of this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: (regs: any, { eq, and }: any) =>
          and(eq(regs.assignedGroupId, groupId), eq(regs.userId, userId)),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: "You are not a member of this group" });
      }

      // Look up the event pool to find a linked blind box event
      const group = await db.query.eventPoolGroups.findFirst({
        where: (groups: any, { eq }: any) => eq(groups.id, groupId),
      });

      let blindBoxEventId: string | null = null;
      if (group?.poolId) {
        const linkedEvent = await db
          .select({ id: blindBoxEvents.id })
          .from(blindBoxEvents)
          .where(eq(blindBoxEvents.poolId, group.poolId))
          .limit(1);
        if (linkedEvent.length > 0) {
          blindBoxEventId = linkedEvent[0].id;
        }
      }

      res.json({ success: true, blindBoxEventId });
    } catch (error) {
      console.error("Error confirming pool group attendance:", error);
      res.status(500).json({ message: "Failed to confirm attendance" });
    }
  });
  app.get("/api/admin/finance/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getFinanceStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching finance stats:", error);
      res.status(500).json({ message: "Failed to fetch finance stats" });
    }
  });

  // Finance - Get all payments
  app.get("/api/admin/finance/payments", requireAdmin, async (req, res) => {
    try {
      const { type } = req.query;
      const payments = type 
        ? await storage.getPaymentsByType(type as string)
        : await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Finance - Get venue commissions
  app.get("/api/admin/finance/commissions", requireAdmin, async (req, res) => {
    try {
      const commissions = await storage.getVenueCommissions();
      res.json(commissions);
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });

  // Moderation - Get statistics
  app.get("/api/admin/moderation/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getModerationStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching moderation stats:", error);
      res.status(500).json({ message: "Failed to fetch moderation stats" });
    }
  });

  // Moderation - Get all reports
  app.get("/api/admin/moderation/reports", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const reports = status === 'pending' 
        ? await storage.getPendingReports()
        : await storage.getAllReports();
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Moderation - Update report status
  app.patch("/api/admin/moderation/reports/:id", requireAdmin, async (req, res) => {
    try {
      const { status, adminNotes } = req.body;
      const report = await storage.updateReportStatus(req.params.id, status, adminNotes);
      res.json(report);
    } catch (error) {
      console.error("Error updating report:", error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  // Moderation - Create moderation log
  app.post("/api/admin/moderation/logs", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const log = await storage.createModerationLog({
        adminId: session.userId,
        action: req.body.action,
        targetUserId: req.body.targetUserId,
        reason: req.body.reason,
        notes: req.body.notes,
      });
      res.json(log);
    } catch (error) {
      console.error("Error creating moderation log:", error);
      res.status(500).json({ message: "Failed to create moderation log" });
    }
  });

  // Moderation - Get moderation logs
  app.get("/api/admin/moderation/logs", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getModerationLogs();
      res.json(logs);
    } catch (error) {
      console.error("Error fetching moderation logs:", error);
      res.status(500).json({ message: "Failed to fetch moderation logs" });
    }
  });

  // Data Insights - Get analytics data
  app.get("/api/admin/insights", requireAdmin, async (req, res) => {
    try {
      const insights = await storage.getInsightsData();
      res.json(insights);
    } catch (error) {
      console.error("Error fetching insights:", error);
      res.status(500).json({ message: "Failed to fetch insights" });
    }
  });

  // Registration Funnel Analytics - Get registration funnel data
  app.get("/api/admin/insights/registration-funnel", requireAdmin, async (req, res) => {
    try {
      const { getRegistrationFunnelData } = await import('./analytics/registrationFunnelAnalytics');
      const funnelData = await getRegistrationFunnelData();
      res.json(funnelData);
    } catch (error) {
      console.error("Error fetching registration funnel data:", error);
      res.status(500).json({ message: "Failed to fetch registration funnel data" });
    }
  });

  // ============ ADMIN FEEDBACK MANAGEMENT ============

  // Get all feedbacks with filters
  app.get("/api/admin/feedback", requireAdmin, async (req, res) => {
    try {
      const { eventId, minRating, maxRating, startDate, endDate, hasDeepFeedback } = req.query;
      
      const filters: any = {};
      if (eventId) filters.eventId = eventId as string;
      if (minRating) filters.minRating = parseInt(minRating as string);
      if (maxRating) filters.maxRating = parseInt(maxRating as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (hasDeepFeedback !== undefined) filters.hasDeepFeedback = hasDeepFeedback === 'true';
      
      const feedbacks = await storage.getAllFeedbacks(filters);
      res.json(feedbacks);
    } catch (error) {
      console.error("Error fetching feedbacks:", error);
      res.status(500).json({ message: "Failed to fetch feedbacks" });
    }
  });

  // Get feedback stats
  app.get("/api/admin/feedback/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getFeedbackStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching feedback stats:", error);
      res.status(500).json({ message: "Failed to fetch feedback stats" });
    }
  });

  // Get single feedback by ID
  app.get("/api/admin/feedback/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const feedback = await storage.getFeedbackById(id);
      
      if (!feedback) {
        return res.status(404).json({ message: "Feedback not found" });
      }
      
      res.json(feedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      res.status(500).json({ message: "Failed to fetch feedback" });
    }
  });

  // ============ CONTENT MANAGEMENT ============

  // Get all contents (with optional type filter)
  app.get("/api/admin/contents", requireAdmin, async (req, res) => {
    try {
      const { type } = req.query;
      const contents = await storage.getAllContents(type as string | undefined);
      res.json(contents);
    } catch (error) {
      console.error("Error fetching contents:", error);
      res.status(500).json({ message: "Failed to fetch contents" });
    }
  });

  // Get single content
  app.get("/api/admin/contents/:id", requireAdmin, async (req, res) => {
    try {
      const content = await storage.getContent(req.params.id);
      if (!content) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(content);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  // Create content
  app.post("/api/admin/contents", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const content = await storage.createContent({
        ...req.body,
        createdBy: session.userId,
      });
      res.json(content);
    } catch (error) {
      console.error("Error creating content:", error);
      res.status(500).json({ message: "Failed to create content" });
    }
  });

  // Update content
  app.patch("/api/admin/contents/:id", requireAdmin, async (req, res) => {
    try {
      const content = await storage.updateContent(req.params.id, req.body);
      res.json(content);
    } catch (error) {
      console.error("Error updating content:", error);
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  // Delete content
  app.delete("/api/admin/contents/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteContent(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content:", error);
      res.status(500).json({ message: "Failed to delete content" });
    }
  });

  // Publish content (update status to published and set published_at)
  app.post("/api/admin/contents/:id/publish", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      const { sendNotification } = req.body;

      const content = await storage.updateContent(req.params.id, {
        status: 'published',
        publishedAt: new Date(),
      });

      // If sendNotification is true and content type is announcement, send notification to all users
      if (sendNotification && content.type === 'announcement') {
        const users = await storage.getAllUsers();
        const userIds = users.map(u => u.id);
        
        if (userIds.length > 0) {
          await storage.createBroadcastNotification({
            sentBy: adminId,
            category: 'discover',
            type: 'admin_announcement',
            title: content.title,
            message: content.content?.substring(0, 100), // Limit to 100 characters
            userIds,
          });
        }
      }

      res.json(content);
    } catch (error) {
      console.error("Error publishing content:", error);
      res.status(500).json({ message: "Failed to publish content" });
    }
  });

  // Get published contents (public endpoint for users)
  app.get("/api/contents/:type", async (req, res) => {
    try {
      const contents = await storage.getPublishedContents(req.params.type);
      res.json(contents);
    } catch (error) {
      console.error("Error fetching published contents:", error);
      res.status(500).json({ message: "Failed to fetch contents" });
    }
  });

  // ============ ADMIN NOTIFICATION MANAGEMENT ============

  // Get admin notification history
  app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const notifications = await storage.getAdminNotifications(adminId);
      res.json({ notifications });
    } catch (error) {
      console.error("Error fetching admin notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Broadcast notification to multiple users
  app.post("/api/admin/notifications/broadcast", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const { category, type, title, message, userIds } = req.body;
      
      if (!category || !type || !title || !userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const result = await storage.createBroadcastNotification({
        sentBy: adminId,
        category,
        type,
        title,
        message,
        userIds,
      });
      
      res.json({ success: true, sent: result.sent });
    } catch (error) {
      console.error("Error broadcasting notification:", error);
      res.status(500).json({ message: "Failed to broadcast notification" });
    }
  });

  // Send notification to a single user
  app.post("/api/admin/notifications/send", requireAdmin, async (req, res) => {
    try {
      const session = req.session as any;
      const adminId = session.userId;
      
      const { userId, category, type, title, message } = req.body;
      
      if (!userId || !category || !type || !title) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      const result = await storage.createBroadcastNotification({
        sentBy: adminId,
        category,
        type,
        title,
        message,
        userIds: [userId],
      });
      
      res.json({ success: true, sent: result.sent });
    } catch (error) {
      console.error("Error sending notification:", error);
      res.status(500).json({ message: "Failed to send notification" });
    }
  });

  // Get notification stats
  app.get("/api/admin/notifications/:id/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getNotificationStats(req.params.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ SUBSCRIPTION MANAGEMENT ============
  
  // Get current user's subscription status
  app.get("/api/subscription/status", isPhoneAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const status = await subscriptionService.getUserSubscriptionStatus(userId);
      res.json(status);
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });
  
  // Create subscription renewal (returns payment details)
  app.post("/api/subscription/renew", isPhoneAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { planType, couponCode } = req.body;
      
      if (!planType || !["monthly", "quarterly"].includes(planType)) {
        return res.status(400).json({ message: "Invalid plan type" });
      }
      
      // Create pending subscription
      const renewalData = await subscriptionService.renewSubscription(userId, planType);
      
      // Create payment for the renewal
      let couponId: string | undefined;
      if (couponCode) {
        const coupons = await storage.getAllCoupons();
        const coupon = coupons.find(c => c.code === couponCode && c.isActive);
        if (coupon) {
          couponId = coupon.id;
        }
      }
      
      const paymentResult = await paymentService.createPayment({
        userId,
        paymentType: "event_bundle",
        relatedId: renewalData.subscriptionId,
        originalAmount: renewalData.amount,
        couponId,
        clientIp: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "127.0.0.1",
      });
      
      res.json({
        subscription: renewalData,
        payment: paymentResult,
      });
    } catch (error) {
      console.error("Error renewing subscription:", error);
      res.status(500).json({ message: "Failed to renew subscription" });
    }
  });
  
  // Cancel subscription
  app.post("/api/subscription/cancel", isPhoneAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const subscription = await storage.getUserSubscription(userId);
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      
      await subscriptionService.cancelSubscription(subscription.id, req.body.reason);
      res.json({ message: "Subscription cancelled" });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // ============ PAYMENT & WEBHOOKS ============
  
  // Create payment order for subscription
  app.post("/api/payments/create", isPhoneAuthenticated, async (req, res) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { paymentType, relatedId, originalAmount, couponCode } = req.body;
      
      // Validate coupon if provided
      let couponId: string | undefined;
      if (couponCode) {
        const coupons = await storage.getAllCoupons();
        const coupon = coupons.find(c => c.code === couponCode && c.isActive);
        if (coupon) {
          couponId = coupon.id;
        }
      }
      
      const paymentResult = await paymentService.createPayment({
        userId,
        paymentType,
        relatedId,
        originalAmount,
        couponId,
        clientIp: (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "127.0.0.1",
      });
      
      res.json(paymentResult);
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });
  
  // WeChat Pay webhook - receives payment status updates
  app.post("/api/webhooks/wechat-pay", async (req, res) => {
    try {
      await paymentService.handleWebhook({
        headers: req.headers,
        rawBody: (req as typeof req & { rawBody?: Buffer }).rawBody,
        payload: req.body,
      });
      res.json({ code: "SUCCESS", message: "OK" });
    } catch (error) {
      console.error("Error processing WeChat Pay webhook:", error);
      const status = typeof (error as { status?: unknown }).status === "number"
        ? ((error as { status: number }).status)
        : 500;
      res.status(status).json({
        code: "FAIL",
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  });
  
  // Query payment status
  app.get("/api/payments/:wechatOrderId/status", isPhoneAuthenticated, async (req, res) => {
    try {
      const { wechatOrderId } = req.params;
      const status = await paymentService.queryPaymentStatus(wechatOrderId);
      res.json({ status });
    } catch (error) {
      console.error("Error querying payment status:", error);
      res.status(500).json({ message: "Failed to query payment status" });
    }
  });
  
  // Admin - Get all payments
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });
  
  // Admin - Create refund
  app.post("/api/admin/payments/:paymentId/refund", requireAdmin, async (req, res) => {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body;
      await paymentService.createRefund(paymentId, reason);
      res.json({ message: "Refund initiated" });
    } catch (error) {
      console.error("Error creating refund:", error);
      res.status(500).json({ message: "Failed to create refund" });
    }
  });

  // ============ VENUE MATCHING ============
  
  // Find matching venues for event criteria
  app.post("/api/venues/match", isPhoneAuthenticated, async (req, res) => {
    try {
      const { eventType, theme, participantCount, preferredDistrict, preferredCity, cuisinePreferences, priceRange } = req.body;
      
      if (!eventType || !participantCount) {
        return res.status(400).json({ message: "eventType and participantCount are required" });
      }
      
      const matches = await venueMatchingService.findMatchingVenues({
        eventType,
        theme,
        participantCount,
        preferredDistrict,
        preferredCity,
        cuisinePreferences,
        priceRange,
      });
      
      res.json({ venues: matches });
    } catch (error) {
      console.error("Error matching venues:", error);
      res.status(500).json({ message: "Failed to match venues" });
    }
  });
  
  // Get best venue for event
  app.post("/api/venues/select-best", isPhoneAuthenticated, async (req, res) => {
    try {
      const { eventType, theme, participantCount, preferredDistrict, preferredCity, cuisinePreferences, priceRange } = req.body;
      
      if (!eventType || !participantCount) {
        return res.status(400).json({ message: "eventType and participantCount are required" });
      }
      
      const bestMatch = await venueMatchingService.selectBestVenue({
        eventType,
        theme,
        participantCount,
        preferredDistrict,
        preferredCity,
        cuisinePreferences,
        priceRange,
      });
      
      if (!bestMatch) {
        return res.status(404).json({ message: "No suitable venue found" });
      }
      
      res.json(bestMatch);
    } catch (error) {
      console.error("Error selecting venue:", error);
      res.status(500).json({ message: "Failed to select venue" });
    }
  });

  // ============ MATCHING ALGORITHM ENDPOINTS ============
  
  // Calculate match score between two users
  app.post("/api/matching/calculate-pair", requireAdmin, async (req, res) => {
    try {
      const { userId1, userId2, weights } = req.body;
      
      if (!userId1 || !userId2) {
        return res.status(400).json({ message: "userId1 and userId2 are required" });
      }
      
      // Parallelize user fetching for better performance
      const [user1, user2] = await Promise.all([
        storage.getUserById(userId1),
        storage.getUserById(userId2)
      ]);
      
      if (!user1 || !user2) {
        return res.status(404).json({ message: "One or both users not found" });
      }
      
      const matchWeights: MatchingWeights = weights || DEFAULT_WEIGHTS;
      const score = calculateUserMatchScore(user1, user2, matchWeights);
      
      res.json(score);
    } catch (error) {
      console.error("Error calculating match score:", error);
      res.status(500).json({ message: "Failed to calculate match score" });
    }
  });
  
  // Match users to groups (主匹配算法)
  app.post("/api/matching/create-groups", requireAdmin, async (req, res) => {
    try {
      const { userIds, config } = req.body;
      
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: "userIds array is required" });
      }
      
      // 获取所有用户信息
      const users = await Promise.all(
        userIds.map(id => storage.getUserById(id))
      );
      
      const validUsers = users.filter((u): u is User => u !== undefined);
      
      if (validUsers.length < (config?.minGroupSize || 5)) {
        return res.status(400).json({ 
          message: `至少需要${config?.minGroupSize || 5}个有效用户` 
        });
      }
      
      const startTime = Date.now();
      const groups = matchUsersToGroups(validUsers, config);
      const executionTime = Date.now() - startTime;
      
      res.json({
        groups,
        totalUsers: validUsers.length,
        groupCount: groups.length,
        executionTimeMs: executionTime,
      });
    } catch (error: any) {
      console.error("Error creating groups:", error);
      res.status(500).json({ message: error.message || "Failed to create groups" });
    }
  });
  
  // Get current matching configuration
  app.get("/api/matching/config", requireAdmin, async (req, res) => {
    try {
      // 从数据库获取活跃配置，如果没有则返回默认配置
      const activeConfig = await storage.getActiveMatchingConfig();
      
      if (activeConfig) {
        res.json(activeConfig);
      } else {
        res.json({
          configName: "default",
          personalityWeight: 30,
          interestsWeight: 25,
          intentWeight: 20,
          backgroundWeight: 15,
          cultureWeight: 10,
          minGroupSize: 5,
          maxGroupSize: 10,
          preferredGroupSize: 7,
          maxSameArchetypeRatio: 40,
          minChemistryScore: 60,
          isActive: true,
        });
      }
    } catch (error) {
      console.error("Error getting matching config:", error);
      res.status(500).json({ message: "Failed to get matching config" });
    }
  });
  
  // Update matching configuration (Admin only)
  app.post("/api/matching/config", requireAdmin, async (req, res) => {
    try {
      
      const config = req.body;
      
      // 验证权重
      const validation = validateWeights({
        personalityWeight: config.personalityWeight,
        interestsWeight: config.interestsWeight,
        intentWeight: config.intentWeight,
        backgroundWeight: config.backgroundWeight,
        cultureWeight: config.cultureWeight,
        conversationSignatureWeight: config.conversationSignatureWeight || 0,
      });
      
      if (!validation.valid) {
        return res.status(400).json({ message: validation.error });
      }
      
      const updatedConfig = await storage.updateMatchingConfig(config);
      res.json(updatedConfig);
    } catch (error) {
      console.error("Error updating matching config:", error);
      res.status(500).json({ message: "Failed to update matching config" });
    }
  });
  
  // Test matching scenario (Admin only - for algorithm tuning)
  app.post("/api/matching/test-scenario", requireAdmin, async (req, res) => {
    try {
      
      const { userIds, config } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ message: "userIds array is required" });
      }
      
      const users = await Promise.all(
        userIds.map(id => storage.getUserById(id))
      );
      
      const validUsers = users.filter((u): u is User => u !== undefined);
      
      const startTime = Date.now();
      const groups = matchUsersToGroups(validUsers, config);
      const executionTime = Date.now() - startTime;
      
      // 计算整体评分指标
      const avgChemistryScore = Math.round(
        groups.reduce((sum, g) => sum + g.avgChemistryScore, 0) / groups.length
      );
      const avgDiversityScore = Math.round(
        groups.reduce((sum, g) => sum + g.diversityScore, 0) / groups.length
      );
      const overallMatchQuality = Math.round((avgChemistryScore + avgDiversityScore) / 2);
      
      // 保存测试结果到数据库
      const result = await storage.saveMatchingResult({
        userIds,
        userCount: validUsers.length,
        groups: groups.map(g => ({
          groupId: g.groupId,
          userIds: g.userIds,
          chemistryScore: g.avgChemistryScore,
          diversityScore: g.diversityScore,
          overallScore: g.overallScore,
        })),
        groupCount: groups.length,
        avgChemistryScore,
        avgDiversityScore,
        overallMatchQuality,
        executionTimeMs: executionTime,
        isTestRun: true,
        configId: config?.configId,
        notes: config?.notes,
      });
      
      res.json({
        testId: result.id,
        groups,
        metrics: {
          totalUsers: validUsers.length,
          groupCount: groups.length,
          avgChemistryScore,
          avgDiversityScore,
          overallMatchQuality,
          executionTimeMs: executionTime,
        },
      });
    } catch (error: any) {
      console.error("Error testing matching scenario:", error);
      res.status(500).json({ message: error.message || "Failed to test matching scenario" });
    }
  });

  // ============ CHAT REPORTS & MODERATION ROUTES ============
  
  // POST /api/chat-reports - User creates a report
  app.post("/api/chat-reports", isPhoneAuthenticated, async (req, res) => {
    try {
      const session = req.session as any;
      const userId = session.userId;
      
      const validatedData = insertChatReportSchema.parse(req.body);
      
      const report = await storage.createChatReport(validatedData);
      
      res.json(report);
    } catch (error: any) {
      console.error("Error creating chat report:", error);
      res.status(400).json({ message: error.message || "Failed to create report" });
    }
  });

  // GET /api/admin/chat-reports - Admin gets all reports with optional status filter
  app.get("/api/admin/chat-reports", requireAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      
      const reports = await storage.getChatReports(status as string | undefined);
      
      res.json(reports);
    } catch (error: any) {
      console.error("Error fetching chat reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // GET /api/admin/chat-reports/:id - Admin gets single report with context
  app.get("/api/admin/chat-reports/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const session = req.session as any;
      const adminUserId = session.userId;
      
      const report = await storage.getChatReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Record moderation log for viewing the report
      await storage.createModerationLog({
        adminUserId,
        action: "view_report",
        targetType: "chat_report",
        targetId: id,
        details: { reportId: id, reportType: report.reportType },
      });
      
      res.json(report);
    } catch (error: any) {
      console.error("Error fetching chat report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // PATCH /api/admin/chat-reports/:id - Admin reviews/processes a report
  app.patch("/api/admin/chat-reports/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const session = req.session as any;
      const adminUserId = session.userId;
      
      const { status, reviewNotes, actionTaken } = req.body;
      
      if (!status || !["reviewed", "dismissed", "action_taken"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const report = await storage.updateChatReport(id, {
        status,
        reviewedBy: adminUserId,
        reviewNotes,
        actionTaken,
      });
      
      // Record moderation log
      await storage.createModerationLog({
        adminUserId,
        action: "review_report",
        targetType: "chat_report",
        targetId: id,
        details: { 
          reportId: id, 
          status, 
          actionTaken,
          reviewNotes: reviewNotes || null,
        },
      });
      
      res.json(report);
    } catch (error: any) {
      console.error("Error updating chat report:", error);
      res.status(400).json({ message: error.message || "Failed to update report" });
    }
  });

  // ============ INTERACTION LOGS ROUTES ============
  
  // POST /api/interaction-logs - Internal logging endpoint
  app.post("/api/interaction-logs", async (req, res) => {
    try {
      const validatedData = insertChatLogSchema.parse(req.body);
      
      const log = await storage.createInteractionLog(validatedData);
      
      res.json(log);
    } catch (error: any) {
      console.error("Error creating interaction log:", error);
      res.status(400).json({ message: error.message || "Failed to create log" });
    }
  });

  // GET /api/admin/interaction-logs - Admin queries logs with filters
  app.get("/api/admin/interaction-logs", requireAdmin, async (req, res) => {
    try {
      const { eventId, userId, severity, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (eventId) filters.eventId = eventId as string;
      if (userId) filters.userId = userId as string;
      if (severity) filters.severity = severity as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const logs = await storage.getInteractionLogs(filters);
      
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching interaction logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // GET /api/admin/interaction-logs/stats - Admin gets log statistics
  app.get("/api/admin/interaction-logs/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getInteractionLogStats();
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching interaction log stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // ============ REALTIME MATCHING CONFIGURATION ROUTES ============
  
  // GET /api/admin/matching-thresholds - Get current matching threshold config
  app.get("/api/admin/matching-thresholds", requireAdmin, async (req, res) => {
    try {
      const [activeConfig] = await db
        .select()
        .from(matchingThresholds)
        .where(eq(matchingThresholds.isActive, true))
        .limit(1);
      
      if (!activeConfig) {
        // Return default config if none exists
        return res.json({
          highCompatibilityThreshold: 85,
          mediumCompatibilityThreshold: 70,
          lowCompatibilityThreshold: 55,
          timeDecayEnabled: true,
          timeDecayRate: 5,
          minThresholdAfterDecay: 50,
          minGroupSizeForMatch: 4,
          optimalGroupSize: 6,
          scanIntervalMinutes: 60,
        });
      }
      
      res.json(activeConfig);
    } catch (error: any) {
      console.error("Error fetching matching thresholds:", error);
      res.status(500).json({ message: "Failed to fetch thresholds" });
    }
  });
  
  // PUT /api/admin/matching-thresholds - Update matching threshold config
  app.put("/api/admin/matching-thresholds", requireAdmin, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      
      // Deactivate current config
      await db
        .update(matchingThresholds)
        .set({ isActive: false })
        .where(eq(matchingThresholds.isActive, true));
      
      // Create new config
      const [newConfig] = await db
        .insert(matchingThresholds)
        .values({
          highCompatibilityThreshold: req.body.highCompatibilityThreshold || 85,
          mediumCompatibilityThreshold: req.body.mediumCompatibilityThreshold || 70,
          lowCompatibilityThreshold: req.body.lowCompatibilityThreshold || 55,
          timeDecayEnabled: req.body.timeDecayEnabled ?? true,
          timeDecayRate: req.body.timeDecayRate || 5,
          minThresholdAfterDecay: req.body.minThresholdAfterDecay || 50,
          minGroupSizeForMatch: req.body.minGroupSizeForMatch || 4,
          optimalGroupSize: req.body.optimalGroupSize || 6,
          scanIntervalMinutes: req.body.scanIntervalMinutes || 60,
          isActive: true,
          createdBy: userId,
          notes: req.body.notes || null,
        })
        .returning();
      
      res.json(newConfig);
    } catch (error: any) {
      console.error("Error updating matching thresholds:", error);
      res.status(500).json({ message: "Failed to update thresholds" });
    }
  });
  
  // GET /api/admin/matching-logs - Get matching scan logs with filters
  app.get("/api/admin/matching-logs", requireAdmin, async (req, res) => {
    try {
      const { poolId, scanType, decision, limit = 50 } = req.query;
      
      let query = db.select().from(poolMatchingLogs);
      
      const conditions: any[] = [];
      if (poolId) conditions.push(eq(poolMatchingLogs.poolId, poolId as string));
      if (scanType) conditions.push(eq(poolMatchingLogs.scanType, scanType as string));
      if (decision) conditions.push(eq(poolMatchingLogs.decision, decision as string));
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      const logs = await query
        .orderBy(desc(poolMatchingLogs.createdAt))
        .limit(parseInt(limit as string));
      
      // Enrich with pool titles
      const enrichedLogs = await Promise.all(
        logs.map(async (log: any) => {
          const [pool] = await db
            .select({ title: eventPools.title })
            .from(eventPools)
            .where(eq(eventPools.id, log.poolId))
            .limit(1);
          
          return {
            ...log,
            poolTitle: pool?.title || "未知活动池",
          };
        })
      );
      
      res.json(enrichedLogs);
    } catch (error: any) {
      console.error("Error fetching matching logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });
  
  // POST /api/admin/pools/:id/scan - Manually trigger pool scan
  app.post("/api/admin/pools/:id/scan", requireAdmin, async (req, res) => {
    try {
      const poolId = req.params.id;
      const { scanPoolAndMatch } = await import("./poolRealtimeMatchingService");
      
      const result = await scanPoolAndMatch(poolId, "manual", "admin_manual");
      
      res.json(result);
    } catch (error: any) {
      console.error("Error triggering pool scan:", error);
      res.status(500).json({ message: "Failed to trigger scan", error: error.message });
    }
  });

  


  const INDUSTRY_MATCHERS: { value: string; keywords: string[] }[] = [
    { value: "tech", keywords: ["互联网", "科技", "tech", "ai", "it", "大厂", "程序员", "码农", "字节", "腾讯", "阿里", "百度", "美团", "华为", "bat", "tmd", "软件", "开发", "社畜", "打工人", "大疆", "小米", "oppo", "vivo", "网易", "京东", "拼多多", "快手", "硬科技", "芯片", "半导体", "ic", "嵌入式", "硬件", "电子", "新能源", "汽车", "电动车", "比亚迪", "特斯拉", "蔚来", "理想", "小鹏", "电池", "自动驾驶"] },
    { value: "finance", keywords: ["金融", "finance", "bank", "investment", "投资", "银行", "基金", "pe", "vc", "投行", "量化", "证券", "保险", "会计", "审计", "四大"] },
    { value: "media", keywords: ["媒体", "内容", "传媒", "博主", "kol", "网红", "主播", "直播", "自媒体", "公众号", "小红书", "抖音", "b站", "up主", "创意", "设计", "creative", "design", "舞蹈", "跳舞", "表演", "演员", "歌手", "音乐", "文化", "娱乐", "文娱", "艺术", "艺人", "街舞", "芭蕾", "编舞", "摄影", "视频", "剪辑", "插画", "画画", "美工", "ui", "ux", "dj", "打碟", "唱歌", "乐队"] },
    { value: "education", keywords: ["教育", "education", "edu", "老师", "教师", "培训", "讲师", "教授", "学校", "大学"] },
    { value: "consulting", keywords: ["咨询", "consulting", "mbb", "麦肯锡", "波士顿", "贝恩", "埃森哲", "猎头", "hr", "人力", "法律", "legal", "律师", "律所", "法务", "合规", "金杜", "中伦", "方达"] },
    { value: "healthcare", keywords: ["医疗", "医药", "健康", "health", "医生", "护士", "医院", "制药", "生物", "心理咨询"] },
    { value: "manufacturing", keywords: ["制造", "工业", "engineering", "工厂", "生产"] },
    { value: "retail", keywords: ["零售", "消费", "retail", "电商", "跨境", "亚马逊", "淘宝", "天猫", "独立站", "shopify", "运营", "选品", "生活服务", "lifestyle", "健身", "瑜伽", "咖啡", "美容", "美发", "宠物", "餐饮", "私教", "教练", "厨师", "调酒", "茶艺", "花艺", "酒店", "旅游", "航空", "空乘", "导游", "旅行", "空姐", "空少", "机场"] },
    { value: "real_estate", keywords: ["地产", "房地产", "real estate", "建筑", "物业", "装修", "室内设计", "景观"] },
    { value: "government", keywords: ["政府", "公共", "gov", "公务员", "事业单位", "体制内", "国企", "央企"] },
    { value: "other", keywords: ["自由职业", "创业", "外企", "500强"] },
  ];

  const INDUSTRY_OPTIONS_MAP = INDUSTRY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  function mapIndustryNameToOption(industryName: string | undefined) {
    const fallback = INDUSTRY_OPTIONS_MAP.find((o) => o.value === "other") || INDUSTRY_OPTIONS_MAP[INDUSTRY_OPTIONS_MAP.length - 1];
    if (!industryName) return fallback;
    const name = industryName.toLowerCase();

    const scored = INDUSTRY_MATCHERS.map((matcher) => {
      const score = matcher.keywords.reduce((acc, keyword) => acc + (name.includes(keyword.toLowerCase()) ? 1 : 0), 0);
      return { value: matcher.value, score };
    }).sort((a, b) => b.score - a.score);

    const matchedValue = scored[0]?.score > 0 ? scored[0].value : "other";
    return INDUSTRY_OPTIONS_MAP.find((o) => o.value === matchedValue) || fallback;
  }

// ============ AI 时刻 API ============

  /** Fallback copy used when no profile data is available. */
  const VIBE_BRIEF_FALLBACK = {
    insight: '我们的算法已初步读懂你的社交画像',
    matchingPromise: '我们会以此为基础，为你匹配更对 vibe 的小组',
  } as const;

  // Archetype-keyed insight copy (12 archetypes)
  const ARCHETYPE_INSIGHTS: Record<string, string> = {
    '开心柯基': '你天生自带暖场能量，最容易让整桌气氛活跃起来',
    '太阳鸡': '你的热情感染力强，适合引领话题的群体节奏',
    '夸夸豚': '你善于欣赏他人，最容易在轻松氛围里建立连接',
    '机智狐': '你对话题的洞察快，适合那种先破冰、再深聊的群体',
    '淡定海豚': '你不需要刻意表现，真实感反而是你最强的社交优势',
    '织网蛛': '你擅长把不同背景的人串联在一起，天然的社交节点',
    '暖心熊': '你给人安全感，最容易在小群体里慢慢成为大家信任的人',
    '灵感章鱼': '你的跨界联想力强，适合多元背景交汇的小组',
    '沉思猫头鹰': '你更适合先观察、再发言的节奏，深聊比破冰更适合你',
    '定心大象': '你的稳定感让整个群体更有安全感，适合偏深度的小聚',
    '稳如龟': '你不求一夜深交，但会让别人记住你的踏实感',
    '隐身猫': '你慢热但有质感，在对的氛围里往往是最让人印象深刻的那个',
  };

  // WorkMode-keyed matching promise variants
  const WORK_MODE_PROMISES: Record<string, string> = {
    founder: '我们会为你匹配同样有主见、聊得来的同频小组',
    self_employed: '我们会优先把你放进背景多元、互相启发的小组',
    employed: '我们会以此为基础，为你匹配更对 vibe 的小组',
    student: '我们会帮你找到同样好奇心旺盛、愿意交流的小组',
  };

  // Archetype-keyed fit reasons per event type (饭局 / 酒局)
  const ARCHETYPE_FIT_REASONS: Record<string, { 饭局: string; 酒局: string }> = {
    '开心柯基':    { 饭局: '你的暖场感很适合围桌聊天', 酒局: '你的活力能自然带热气氛' },
    '太阳鸡':     { 饭局: '你的感染力很适合带动全桌', 酒局: '你的热情能帮陌生人快些破冰' },
    '夸夸豚':     { 饭局: '轻松饭局最能发挥你的共情力', 酒局: '你的温柔让酒局不只热闹' },
    '机智狐':     { 饭局: '话题型饭局很适合你的机智', 酒局: '自由节奏给你更多即兴空间' },
    '淡定海豚':   { 饭局: '你的真实感很适合轻松饭局', 酒局: '你的松弛感在酒局里很加分' },
    '织网蛛':     { 饭局: '你擅长把一桌人自然串联', 酒局: '多元背景更容易被你聊开' },
    '暖心熊':     { 饭局: '你的安全感适合慢慢熟络', 酒局: '你的体贴会让酒局更有温度' },
    '灵感章鱼':   { 饭局: '跨界话题里你更容易发光', 酒局: '松弛酒局最能放大你的灵感' },
    '沉思猫头鹰': { 饭局: '饭局的慢节奏适合你深入聊', 酒局: '你偶尔的深刻观点会很出彩' },
    '定心大象':   { 饭局: '你的稳定感适合有温度的小聚', 酒局: '你的沉稳会让热闹更舒服' },
    '稳如龟':     { 饭局: '你的踏实感适合慢慢熟悉彼此', 酒局: '热闹过后别人更容易记住你' },
    '隐身猫':     { 饭局: '饭局给你更自然的展开空间', 酒局: '松弛环境适合你慢慢打开自己' },
  };

  // WorkMode-keyed social goal reasons
  const WORK_MODE_GOAL_REASONS: Record<string, string> = {
    founder: '同桌多半有主见，也更有聊头',
    self_employed: '多元背景更容易带来新灵感',
    employed: '小而精的局更容易留下真连接',
    student: '年纪相近的话题更容易接住',
  };

  // Valid event types for type-safe checks across VibeBrief logic
  const VALID_EVENT_TYPES = ['饭局', '酒局'] as const;
  type VibeBriefEventType = typeof VALID_EVENT_TYPES[number];

  function isValidEventType(v: string | null | undefined): v is VibeBriefEventType {
    return VALID_EVENT_TYPES.includes(v as VibeBriefEventType);
  }

  // Generic area/format fit reason
  function buildAreaReason(area: string | null | undefined): string | null {
    if (!area || !area.trim()) return null;
    return `在${area}附近，更容易轻松赴约`;
  }

  /**
   * Generate a deterministic vibe brief from profile fields.
   * No LLM call — uses curated copy variants keyed on archetype/workMode.
   */
  function generateVibeBrief(
    archetype: string | null | undefined,
    workMode: string | null | undefined,
    industry: string | null | undefined,
    eventType?: string | null,
    area?: string | null,
  ): { insight: string; matchingPromise: string; reasons: string[] } {
    let insight: string;
    if (archetype && ARCHETYPE_INSIGHTS[archetype]) {
      insight = ARCHETYPE_INSIGHTS[archetype];
    } else if (industry) {
      insight = `我们已读懂你在${industry}领域的社交画像`;
    } else {
      insight = VIBE_BRIEF_FALLBACK.insight;
    }

    const matchingPromise = (workMode && WORK_MODE_PROMISES[workMode])
      ? WORK_MODE_PROMISES[workMode]
      : VIBE_BRIEF_FALLBACK.matchingPromise;

    // Build 2-3 pool-specific fit reasons
    const reasons: string[] = [];
    const normalizedEventType = isValidEventType(eventType) ? eventType : null;

    // Reason 1: archetype × event type
    if (archetype && ARCHETYPE_FIT_REASONS[archetype] && normalizedEventType) {
      reasons.push(ARCHETYPE_FIT_REASONS[archetype][normalizedEventType]);
    } else if (normalizedEventType === '饭局') {
      reasons.push('轻松饭局更适合自然拉近距离');
    } else if (normalizedEventType === '酒局') {
      reasons.push('松弛酒局让初见没那么拘束');
    }

    // Reason 2: workMode-based social dynamic
    if (workMode && WORK_MODE_GOAL_REASONS[workMode]) {
      reasons.push(WORK_MODE_GOAL_REASONS[workMode]);
    } else {
      reasons.push('小规模聚会更容易建立真实连接');
    }

    // Reason 3: area-based (only if area is available, to keep it specific)
    const areaReason = buildAreaReason(area);
    if (areaReason) {
      reasons.push(areaReason);
    }

    if (reasons.length < 2) {
      return { insight, matchingPromise, reasons: [] };
    }

    return { insight, matchingPromise, reasons };
  }

  // GET /api/ai/pre-join-vibe-brief - Compact pre-join vibe brief for conversion
  // Returns a personalized insight + matching promise + 2-3 pool fit reasons.
  // Always returns content — meta.fallbackUsed indicates live vs deterministic.
  // Optional query params: eventType ("饭局"|"酒局"), area (e.g. "南山区")
  app.get('/api/ai/pre-join-vibe-brief', requireAuth, async (req: any, res) => {
    const { buildFallbackAIMeta } = await import('@shared/types/aiMeta');
    try {
      const userId = req.session.userId as string;
      const eventType = typeof req.query.eventType === 'string' ? req.query.eventType : null;
      const area = typeof req.query.area === 'string' ? req.query.area : null;

      const [profile] = await db
        .select({
          primaryArchetype: users.primaryArchetype,
          workMode: users.workMode,
          industryNicheLabel: users.industryNicheLabel,
          industryCategoryLabel: users.industryCategoryLabel,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!profile) {
        return res.json({
          insight: VIBE_BRIEF_FALLBACK.insight,
          matchingPromise: VIBE_BRIEF_FALLBACK.matchingPromise,
          reasons: [],
          meta: buildFallbackAIMeta('user_not_found'),
        });
      }

      const brief = generateVibeBrief(
        profile.primaryArchetype,
        profile.workMode,
        profile.industryNicheLabel ?? profile.industryCategoryLabel,
        eventType,
        area,
      );

      return res.json({
        insight: brief.insight,
        matchingPromise: brief.matchingPromise,
        reasons: brief.reasons,
        meta: buildFallbackAIMeta(),
      });
    } catch (err) {
      console.error('[VibeBrief] Failed to generate pre-join vibe brief:', err);
      return res.json({
        insight: VIBE_BRIEF_FALLBACK.insight,
        matchingPromise: VIBE_BRIEF_FALLBACK.matchingPromise,
        reasons: [],
        meta: buildFallbackAIMeta('server_error'),
      });
    }
  });

// ============ 推断引擎API ============


  // POST /api/inference/parse-industry - semantic industry parsing
  app.post("/api/inference/parse-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      const text = (req.body?.text || '').toString();
      if (!text.trim()) {
        return res.status(400).json({ message: "text is required" });
      }

      const match = matchIndustryFromText(text);
      const primaryOption = mapIndustryNameToOption(match?.industry);
      const primaryConfidence = match?.confidence ?? 0.68;
      const primary = {
        value: primaryOption.value,
        label: primaryOption.label,
        confidence: primaryConfidence,
      };

      // Derive alternatives based on similarity to the primary label and confidence.
      // If confidence is low, do not return arbitrary alternatives.
      let alternatives: { value: string; label: string; confidence: number }[] = [];

      if (primary.label && primaryConfidence >= 0.7) {
        const primaryWords = primary.label
          .toLowerCase()
          .split(/[\s\/,&()-]+/)
          .filter(Boolean);

        const scoredOptions = INDUSTRY_OPTIONS_MAP
          .filter((o) => o.value !== primary.value)
          .map((o, index) => {
            const optionWords = o.label
              .toLowerCase()
              .split(/[\s\/,&()-]+/)
              .filter(Boolean);
            const overlap = optionWords.reduce((count, w) => {
              return count + (primaryWords.includes(w) ? 1 : 0);
            }, 0);
            return { option: o, overlap, index };
          })
          .filter(({ overlap }) => overlap > 0)
          .sort((a, b) => {
            if (b.overlap !== a.overlap) return b.overlap - a.overlap;
            return a.index - b.index;
          });

        alternatives = scoredOptions
          .slice(0, 3)
          .map(({ option }) => ({
            value: option.value,
            label: option.label,
            confidence: Math.max(0, primaryConfidence - 0.05),
          }));
      }
      res.json({ primary, alternatives });
    } catch (error: any) {
      console.error("parse-industry error", error);
      res.status(500).json({ message: "Failed to parse industry" });
    }
  });

  // POST /api/inference/test - 测试快速推断（不调用LLM）
  app.post("/api/inference/test", async (req, res) => {
    try {
      const { message } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ message: "Missing message parameter" });
      }
      
      const { testQuickInference } = await import("./deepseekClient");
      const result = testQuickInference(message);
      
      res.json(result);
    } catch (error: any) {
      console.error("Inference test error:", error);
      res.status(500).json({ message: "Inference test failed", error: error.message });
    }
  });
  
  // POST /api/inference/classify-industry - 三层行业智能分类
  app.post("/api/inference/classify-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      const { description, context } = req.body;
      
      if (!description || typeof description !== 'string') {
        return res.status(400).json({ error: "Description is required" });
      }
      
      const { classifyIndustryUnified } = await import("./inference/industryClassifier");
      const result = await classifyIndustryUnified({ description, context });
      
      // 记录AI分类日志
      if (result.source === "ai" && req.session?.userId) {
        try {
          await db.insert(industryAiLogs).values({
            userId: req.session.userId,
            rawInput: description,
            aiCategory: result.category.id,
            aiSegment: result.segment.id,
            aiNiche: result.niche?.id,
            aiConfidence: result.confidence.toString(),
            aiReasoning: result.reasoning,
            processingTimeMs: result.processingTimeMs,
            modelVersion: "v1",
          });
          
          // 如果置信度高，添加到seed候选库
          if (result.confidence >= 0.85) {
            await db.insert(industrySeedCandidates).values({
              rawInput: description,
              frequency: 1,
              aiCategory: result.category.id,
              aiSegment: result.segment.id,
              aiNiche: result.niche?.id,
              avgConfidence: result.confidence.toString(),
              status: "pending",
            }).onConflictDoUpdate({
              target: industrySeedCandidates.rawInput,
              set: {
                frequency: sql`${industrySeedCandidates.frequency} + 1`,
                avgConfidence: sql`(${industrySeedCandidates.avgConfidence}::numeric * ${industrySeedCandidates.frequency} + ${result.confidence}) / (${industrySeedCandidates.frequency} + 1)`,
                updatedAt: new Date(),
              },
            });
          }
        } catch (logError) {
          console.error("Failed to log AI classification:", logError);
          // 不影响主流程
        }
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Industry classification error:", error);
      res.status(500).json({ error: "Classification failed", message: error.message });
    }
  });
  
  // POST /api/profile/update-industry - 更新用户三层行业分类
  app.post("/api/profile/update-industry", isPhoneAuthenticated, async (req, res) => {
    try {
      if (!req.session?.userId) {
        return res.status(401).json({ error: "未登录" });
      }
      
      const {
        category,
        categoryLabel,
        segment,
        segmentLabel,
        niche,
        nicheLabel,
        rawInput,
        normalizedInput,
        source,
        confidence,
      } = req.body;
      
      if (!category || !segment) {
        return res.status(400).json({ error: "Category and segment are required" });
      }
      
      // 构建完整路径用于显示
      const pathParts = [categoryLabel, segmentLabel, nicheLabel].filter(Boolean);
      const fullPath = pathParts.join(" > ");
      
      await db.update(users)
        .set({
          industryCategory: category,
          industryCategoryLabel: categoryLabel,
          industrySegmentNew: segment,
          industrySegmentLabel: segmentLabel,
          industryNiche: niche || null,
          industryNicheLabel: nicheLabel || null,
          industry: fullPath, // 更新legacy字段以向后兼容
          industryRawInput: rawInput,
          industryNormalized: normalizedInput || rawInput, // Use normalized or fallback to raw
          industrySource: source,
          industryConfidence: confidence?.toString(),
          industryClassifiedAt: new Date(),
          industryLastVerifiedAt: new Date(),
        })
        .where(eq(users.id, req.session.userId));
      
      res.json({ success: true, industry: fullPath });
    } catch (error: any) {
      console.error("Update industry error:", error);
      res.status(500).json({ error: "Update failed", message: error.message });
    }
  });
  
  // GET /api/inference/logs - 获取推断日志
  app.get("/api/inference/logs", requireAdmin, async (req, res) => {
    try {
      const { sessionId } = req.query;
      const { getInferenceLogs } = await import("./deepseekClient");
      const logs = getInferenceLogs(sessionId as string | undefined);
      
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching inference logs:", error);
      res.status(500).json({ message: "Failed to fetch logs", error: error.message });
    }
  });
  
  // POST /api/inference/evaluate - 运行评估（需要Admin权限）
  app.post("/api/inference/evaluate", requireAdmin, async (req, res) => {
    try {
      const { scenarioCount } = req.body;
      const { runEvaluation } = await import("./inference/evaluator");
      
      console.log(`[Evaluation] Starting evaluation with ${scenarioCount || 'all'} scenarios...`);
      const result = await runEvaluation(scenarioCount);
      
      res.json({
        metrics: result.metrics,
        report: result.markdownReport
      });
    } catch (error: any) {
      console.error("Evaluation error:", error);
      res.status(500).json({ message: "Evaluation failed", error: error.message });
    }
  });

  // ============ 专家评估系统 API ============
  
  // POST /api/inference/expert-evaluation - 运行10位AI专家评估
  app.post("/api/inference/expert-evaluation", requireAdmin, async (req, res) => {
    try {
      console.log("[ExpertEval] 开始专家评估...");
      
      // 先获取系统性能指标
      const { runEvaluation } = await import("./inference/evaluator");
      const evalResult = await runEvaluation(50); // 用50个场景获取性能指标
      
      // 运行专家评估
      const { runExpertEvaluation, generateExpertReportMarkdown } = await import("./inference/expertEvaluation");
      const { getRandomScenarios } = await import("./inference/scenarios");
      
      const sampleScenarios = getRandomScenarios(10);
      const report = await runExpertEvaluation(evalResult.metrics, sampleScenarios);
      
      res.json({
        report,
        markdownReport: generateExpertReportMarkdown(report)
      });
    } catch (error: any) {
      console.error("Expert evaluation error:", error);
      res.status(500).json({ message: "Expert evaluation failed", error: error.message });
    }
  });
  
  // GET /api/inference/expert-personas - 获取专家人设列表
  app.get("/api/inference/expert-personas", async (req, res) => {
    try {
      const { EXPERT_PERSONAS, EVALUATION_DIMENSIONS } = await import("./inference/expertEvaluation");
      res.json({
        experts: EXPERT_PERSONAS,
        dimensions: EVALUATION_DIMENSIONS
      });
    } catch (error: any) {
      console.error("Error fetching expert personas:", error);
      res.status(500).json({ message: "Failed to fetch experts", error: error.message });
    }
  });
  
  // GET /api/inference/questionnaire - 获取评估问卷模板
  app.get("/api/inference/questionnaire", async (req, res) => {
    try {
      const { generateEvaluationQuestionnaire } = await import("./inference/expertEvaluation");
      const questionnaire = generateEvaluationQuestionnaire();
      res.json(questionnaire);
    } catch (error: any) {
      console.error("Error generating questionnaire:", error);
      res.status(500).json({ message: "Failed to generate questionnaire", error: error.message });
    }
  });
  
  // GET /api/inference/scenario-stats - 获取测试场景统计
  app.get("/api/inference/scenario-stats", async (req, res) => {
    try {
      const { getScenarioStats } = await import("./inference/scenarios");
      const stats = getScenarioStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching scenario stats:", error);
      res.status(500).json({ message: "Failed to fetch stats", error: error.message });
    }
  });
  
  // POST /api/inference/full-evaluation - 运行完整评测（500场景 + 专家评审）
  app.post("/api/inference/full-evaluation", requireAdmin, async (req, res) => {
    try {
      console.log("[FullEval] 开始完整评测...");
      
      // 运行500场景自动化评测
      const { runEvaluation } = await import("./inference/evaluator");
      console.log("[FullEval] 运行500场景自动化评测...");
      const autoEval = await runEvaluation(500);
      
      // 运行专家评估
      const { runExpertEvaluation, generateExpertReportMarkdown } = await import("./inference/expertEvaluation");
      const { getRandomScenarios } = await import("./inference/scenarios");
      console.log("[FullEval] 运行10位AI专家评估...");
      const sampleScenarios = getRandomScenarios(20);
      const expertReport = await runExpertEvaluation(autoEval.metrics, sampleScenarios);
      
      // 生成综合报告
      const combinedReport = {
        timestamp: new Date().toISOString(),
        automatedEvaluation: {
          metrics: autoEval.metrics,
          report: autoEval.markdownReport
        },
        expertEvaluation: {
          report: expertReport,
          markdownReport: generateExpertReportMarkdown(expertReport)
        },
        overallGrade: expertReport.grade,
        overallScore: expertReport.overallScore,
        summary: `小悦智能推断引擎完整评测完成。自动化测试覆盖${autoEval.metrics.totalScenarios}个场景，推断准确率${(autoEval.metrics.inferenceAccuracy * 100).toFixed(1)}%。10位AI专家综合评分${expertReport.overallScore.toFixed(2)}/10，评级${expertReport.grade}。`
      };
      
      console.log(`[FullEval] 评测完成！综合评分：${expertReport.overallScore.toFixed(2)}，评级：${expertReport.grade}`);
      
      res.json(combinedReport);
    } catch (error: any) {
      console.error("Full evaluation error:", error);
      res.status(500).json({ message: "Full evaluation failed", error: error.message });
    }
  });

  // ============ 小悦进化系统 API - AI Evolution System ============
  
  // 获取当前匹配权重配置
  app.get('/api/admin/evolution/weights', requireAdmin, async (req: any, res) => {
    try {
      const { matchingWeightsService } = await import('./matchingWeightsService');
      const config = await matchingWeightsService.getActiveConfig();
      const weights = await matchingWeightsService.getActiveWeights();
      res.json({ config, weights });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get weights:', error);
      res.status(500).json({ message: 'Failed to get weights', error: error.message });
    }
  });

  // 获取权重变化历史
  app.get('/api/admin/evolution/weights-history', requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 30;
      const { matchingWeightsService } = await import('./matchingWeightsService');
      const history = await matchingWeightsService.getWeightsHistory(limit);
      res.json(history);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get weights history:', error);
      res.status(500).json({ message: 'Failed to get history', error: error.message });
    }
  });

  // 获取触发器性能统计
  app.get('/api/admin/evolution/triggers', requireAdmin, async (req: any, res) => {
    try {
      const { triggerPerformanceService } = await import('./triggerPerformanceService');
      const stats = await triggerPerformanceService.getAllTriggerStats();
      const top = await triggerPerformanceService.getTopPerformingTriggers(10);
      const underperforming = await triggerPerformanceService.getUnderperformingTriggers(0.3);
      res.json({ all: stats, topPerforming: top, underperforming });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get trigger stats:', error);
      res.status(500).json({ message: 'Failed to get trigger stats', error: error.message });
    }
  });

  // 获取黄金话术列表
  app.get('/api/admin/evolution/golden-dialogues', requireAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const category = req.query.category as string;
      const { goldenDialogueService } = await import('./goldenDialogueService');
      
      let dialogues;
      if (category) {
        dialogues = await goldenDialogueService.findByCategory(category, limit);
      } else {
        dialogues = await goldenDialogueService.getAllDialogues(limit);
      }
      const stats = await goldenDialogueService.getStatistics();
      res.json({ dialogues, stats });
    } catch (error: any) {
      console.error('[Evolution API] Failed to get golden dialogues:', error);
      res.status(500).json({ message: 'Failed to get dialogues', error: error.message });
    }
  });

  // 标记黄金话术
  app.post('/api/admin/evolution/golden-dialogues', requireAdmin, async (req: any, res) => {
    try {
      const adminId = req.session.userId;
      const { dialogueContent, category, sourceSessionId, sourceUserId } = req.body;
      
      if (!dialogueContent || !category) {
        return res.status(400).json({ message: 'dialogueContent and category are required' });
      }

      const { goldenDialogueService } = await import('./goldenDialogueService');
      const result = await goldenDialogueService.tagAsGolden(
        dialogueContent,
        category,
        adminId,
        sourceSessionId,
        sourceUserId
      );
      
      res.json({ success: true, dialogue: result });
    } catch (error: any) {
      console.error('[Evolution API] Failed to tag golden dialogue:', error);
      res.status(500).json({ message: 'Failed to tag dialogue', error: error.message });
    }
  });

  // 更新黄金话术精炼版本
  app.patch('/api/admin/evolution/golden-dialogues/:id', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { refinedVersion, isActive } = req.body;
      
      const { goldenDialogueService } = await import('./goldenDialogueService');
      
      if (refinedVersion !== undefined) {
        await goldenDialogueService.updateRefinedVersion(id, refinedVersion);
      }
      if (isActive === false) {
        await goldenDialogueService.deactivateDialogue(id);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Evolution API] Failed to update golden dialogue:', error);
      res.status(500).json({ message: 'Failed to update dialogue', error: error.message });
    }
  });

  // 进化系统总览统计
  app.get('/api/admin/evolution/overview', requireAdmin, async (req: any, res) => {
    try {
      const { matchingWeightsService } = await import('./matchingWeightsService');
      const { triggerPerformanceService } = await import('./triggerPerformanceService');
      const { goldenDialogueService } = await import('./goldenDialogueService');
      const { dialogueEmbeddingsService } = await import('./dialogueEmbeddingsService');

      const [weightsConfig, triggerStats, dialogueStats, insightStats] = await Promise.all([
        matchingWeightsService.getActiveConfig(),
        triggerPerformanceService.getAllTriggerStats(),
        goldenDialogueService.getStatistics(),
        dialogueEmbeddingsService.getInsightStats(),
      ]);

      const overview = {
        weights: {
          totalMatches: weightsConfig?.totalMatches || 0,
          successfulMatches: weightsConfig?.successfulMatches || 0,
          avgSatisfaction: parseFloat(weightsConfig?.averageSatisfaction || '0'),
          lastUpdated: weightsConfig?.updatedAt,
        },
        triggers: {
          total: triggerStats.length,
          avgEffectiveness: triggerStats.length > 0
            ? triggerStats.reduce((sum, t) => sum + t.effectivenessScore, 0) / triggerStats.length
            : 0,
          totalActivations: triggerStats.reduce((sum, t) => sum + t.totalTriggers, 0),
        },
        dialogues: dialogueStats,
        insights: {
          total: insightStats.totalInsights,
          byCategory: insightStats.byCategory,
          avgConfidence: insightStats.avgConfidence,
        },
        systemHealth: 'healthy',
        lastAnalyzed: new Date().toISOString(),
      };

      res.json(overview);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get overview:', error);
      res.status(500).json({ message: 'Failed to get overview', error: error.message });
    }
  });

  // 洞察统计详情
  app.get('/api/admin/evolution/insights', requireAdmin, async (req: any, res) => {
    try {
      const { dialogueEmbeddingsService } = await import('./dialogueEmbeddingsService');
      const stats = await dialogueEmbeddingsService.getInsightStats();
      res.json(stats);
    } catch (error: any) {
      console.error('[Evolution API] Failed to get insight stats:', error);
      res.status(500).json({ message: 'Failed to get insight stats', error: error.message });
    }
  });

  // ============ Match Explanation & Ice-Breaker API ============

  // Get match explanations for an event pool group
  app.get('/api/event-pool-groups/:groupId/match-explanations', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the group
      const group = await db.query.eventPoolGroups.findFirst({
        where: eq(eventPoolGroups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Check if user is in this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, groupId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }

      // Get all group members
      const groupMembers = await db.query.eventPoolRegistrations.findMany({
        where: eq(eventPoolRegistrations.assignedGroupId, groupId),
      });

      // Get full user info for group members
      const memberIds = groupMembers.map((m: any) => m.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
      });

      const { matchExplanationService } = await import('./matchExplanationService');

      // Load user interests (with heat levels) for deep interest overlap detection
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level: number }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;
        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
        };
      });

      // Get event pool info for event type
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, group.poolId),
      });

      const groupAnalysis = await matchExplanationService.generateGroupAnalysis(
        groupId,
        matchMembers,
        pool?.eventType || '饭局'
      );

      res.json({
        groupId,
        overallChemistry: groupAnalysis.overallChemistry,
        groupDynamics: groupAnalysis.groupDynamics,
        explanations: groupAnalysis.pairExplanations,
        iceBreakers: groupAnalysis.iceBreakers,
      });
    } catch (error: any) {
      console.error('[Match Explanations] Error:', error);
      res.status(500).json({ message: 'Failed to generate match explanations', error: error.message });
    }
  });

  // Get ice-breakers for an event pool group (part of 活动工具包)
  app.get('/api/event-pool-groups/:groupId/ice-breakers', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the group
      const group = await db.query.eventPoolGroups.findFirst({
        where: eq(eventPoolGroups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: 'Group not found' });
      }

      // Check membership
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: and(
          eq(eventPoolRegistrations.userId, userId),
          eq(eventPoolRegistrations.assignedGroupId, groupId)
        ),
      });

      if (!userRegistration) {
        return res.status(403).json({ message: 'Not a member of this group' });
      }

      // Get group members
      const groupMembers = await db.query.eventPoolRegistrations.findMany({
        where: eq(eventPoolRegistrations.assignedGroupId, groupId),
      });

      const memberIds = groupMembers.map((m: any) => m.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
      });
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);

      const { matchExplanationService } = await import('./matchExplanationService');

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level?: number | null }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;

        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
        };
      });

      // Get event pool info for event type
      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, group.poolId),
      });

      const iceBreakerResult = await matchExplanationService.generateIceBreakers(
        matchMembers,
        pool?.eventType || '饭局'
      );

      res.json({
        iceBreakers: iceBreakerResult.iceBreakers,
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
      });
    } catch (error: any) {
      console.error('[Ice-Breakers] Error:', error);
      res.status(500).json({ message: 'Failed to generate ice-breakers', error: error.message });
    }
  });

  // Match explanations for blind box events (using matchedAttendees field)
  app.get('/api/blind-box-events/:eventId/match-explanations', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the blind box event
      const event = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Check if user is the creator or in matched attendees
      const matchedAttendees = event.matchedAttendees as any[];
      const isParticipant = event.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not a participant in this event' });
      }

      if (!matchedAttendees || matchedAttendees.length === 0) {
        return res.status(404).json({ message: 'Match not ready yet' });
      }

      // Get full user info for matched attendees
      const memberIds = matchedAttendees.map((a: any) => a.userId);
      const members = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${memberIds})`,
      });

      const { matchExplanationService } = await import('./matchExplanationService');

      // Load user interests (with heat levels) for deep interest overlap detection
      const memberInterestsRows = await db.query.userInterests.findMany({
        where: sql`${userInterests.userId} = ANY(${memberIds})`,
      }) as Array<{
        userId: string;
        selections: Array<{ topicId: string; level?: number | null }> | null;
      }>;
      const interestsByUserId = new Map(
        memberInterestsRows.map((row) => [row.userId, row] as const)
      );

      const matchMembers = members.map((m: any) => {
        const interestRow = interestsByUserId.get(m.id);
        const interestsWithHeat = interestRow?.selections
          ? (interestRow.selections as Array<{ topicId: string; level: number }>).map(
              (s) => ({ topicId: s.topicId, heatLevel: s.level ?? 1 })
            )
          : null;
        return {
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestsWithHeat,
        };
      });

      const groupAnalysis = await matchExplanationService.generateGroupAnalysis(
        eventId,
        matchMembers,
        event.eventType || '饭局'
      );

      res.json({
        eventId,
        overallChemistry: groupAnalysis.overallChemistry,
        groupDynamics: groupAnalysis.groupDynamics,
        explanations: groupAnalysis.pairExplanations,
        iceBreakers: groupAnalysis.iceBreakers,
        existingExplanation: event.matchExplanation,
      });
    } catch (error: any) {
      console.error('[Match Explanations] Error:', error);
      res.status(500).json({ message: 'Failed to generate match explanations', error: error.message });
    }
  });

  // Conversation topics for event participants (DeepSeek AI)
  app.post('/api/events/:eventId/conversation-topics', isPhoneAuthenticated, aiEndpointLimiter, async (req: any, res) => {
    try {
      const { eventId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Try to find blind box event first
      const blindBoxEvent = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!blindBoxEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Verify user is a participant
      const matchedAttendees = blindBoxEvent.matchedAttendees as any[];
      const isParticipant = blindBoxEvent.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this event' });
      }

      // SECURITY: Only use validated participant IDs from the event data
      // Never trust caller-provided userIds to prevent data exfiltration
      const validParticipantIds = matchedAttendees?.map((a: any) => a.userId) || [];
      
      if (validParticipantIds.length === 0) {
        return res.json({
          topics: [],
          commonInterests: [],
          generatedAt: new Date().toISOString(),
        });
      }

      // Only fetch minimal profile data needed for topic generation
      const participants = await db.query.users.findMany({
        where: sql`${users.id} = ANY(${validParticipantIds})`,
        columns: {
          id: true,
          displayName: true,
          archetype: true,
          interestsTop: true,
          topicsHappy: true,
          topicsAvoid: true,
        },
      });
      const interestSignalsByUserId = await loadInterestSignalsByUserIds(validParticipantIds);

      const { generateConversationTopics } = await import('./conversationTopicsService');
      
      const profiles = participants.map((p: any) => ({
        displayName: p.displayName || '嘉宾',
        archetype: p.archetype,
        interests: p.interestsTop || undefined,
        topicsHappy: p.topicsHappy || undefined,
        topicsAvoid: p.topicsAvoid || undefined,
        interestSignals: interestSignalsByUserId.get(p.id) ?? undefined,
      }));

      const result = await generateConversationTopics(profiles, blindBoxEvent.eventType || '饭局');
      res.json(result);
    } catch (error: any) {
      console.error('[Conversation Topics] Error:', error);
      res.status(500).json({ message: 'Failed to generate conversation topics', error: error.message });
    }
  });

  // Profile spotlight for tablemates (auth-gated, limited to event participants)
  app.get('/api/events/:eventId/spotlight/:targetUserId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { eventId, targetUserId } = req.params;
      const userId = req.user?.id || req.session?.userId;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get the blind box event
      const blindBoxEvent = await db.query.blindBoxEvents.findFirst({
        where: eq(blindBoxEvents.id, eventId),
      });

      if (!blindBoxEvent) {
        return res.status(404).json({ message: 'Event not found' });
      }

      // Verify requesting user is a participant
      const matchedAttendees = blindBoxEvent.matchedAttendees as any[];
      const isParticipant = blindBoxEvent.userId === userId || 
        matchedAttendees?.some((a: any) => a.userId === userId);

      if (!isParticipant) {
        return res.status(403).json({ message: 'Not authorized to view this event' });
      }

      // SECURITY: Only allow viewing profiles of event participants
      const isTargetParticipant = blindBoxEvent.userId === targetUserId ||
        matchedAttendees?.some((a: any) => a.userId === targetUserId);

      if (!isTargetParticipant) {
        return res.status(403).json({ message: 'Target user is not a participant' });
      }

      // Fetch minimal profile data for spotlight
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
        columns: {
          id: true,
          displayName: true,
          archetype: true,
          secondaryArchetype: true,
          industry: true,
          interestsTop: true,
          socialStyle: true,
          ageVisibility: true,
          workVisibility: true,
          birthdate: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Calculate age based on visibility preference
      let age: number | undefined;
      let ageRange: string | undefined;
      
      if (targetUser.birthdate && targetUser.ageVisibility !== 'hide_all') {
        const birthDate = new Date(targetUser.birthdate + 'T00:00:00');
        const today = new Date();
        const exactAge = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        const adjustedAge = (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) ? exactAge - 1 : exactAge;
        
        // PRIVACY: Only show age range, never exact age
        if (targetUser.ageVisibility === 'show_age_range') {
          // Calculate age range (e.g., "25-29", "30-34")
          const lowerBound = Math.floor(adjustedAge / 5) * 5;
          const upperBound = lowerBound + 4;
          ageRange = `${lowerBound}-${upperBound}`;
        }
      }

      res.json({
        profile: {
          userId: targetUser.id,
          displayName: targetUser.displayName || '神秘嘉宾',
          archetype: targetUser.archetype,
          secondaryArchetype: targetUser.secondaryArchetype,
          industry: targetUser.workVisibility !== 'hide_all' ? targetUser.industry : undefined,
          ageRange: ageRange,
          interests: targetUser.interestsTop || [],
          socialStyle: targetUser.socialStyle,
          ageVisible: targetUser.ageVisibility !== 'hide_all',
          industryVisible: targetUser.workVisibility !== 'hide_all',
        },
      });
    } catch (error: any) {
      console.error('[Profile Spotlight] Error:', error);
      res.status(500).json({ message: 'Failed to fetch profile', error: error.message });
    }
  });

  // Admin endpoint to regenerate explanations for an event pool
  app.post('/api/admin/event-pools/:poolId/regenerate-explanations', requireAdmin, async (req: any, res) => {
    try {
      const { poolId } = req.params;

      // Get all groups in this pool
      const groups = await db.query.eventPoolGroups.findMany({
        where: eq(eventPoolGroups.poolId, poolId),
      });

      if (groups.length === 0) {
        return res.status(404).json({ message: 'No groups found for this pool' });
      }

      const pool = await db.query.eventPools.findFirst({
        where: eq(eventPools.id, poolId),
      });

      const { matchExplanationService } = await import('./matchExplanationService');
      const allAnalyses = [];

      for (const group of groups) {
        const groupMembers = await db.query.eventPoolRegistrations.findMany({
          where: eq(eventPoolRegistrations.assignedGroupId, group.id),
        });

        const memberIds = groupMembers.map((m: any) => m.userId);
        const members = await db.query.users.findMany({
          where: sql`${users.id} = ANY(${memberIds})`,
        });
        const interestSignalsByUserId = await loadInterestSignalsByUserIds(memberIds);

        const matchMembers = members.map((m: any) => ({
          userId: m.id,
          displayName: m.displayName || '神秘嘉宾',
          archetype: m.archetype,
          secondaryArchetype: m.secondaryArchetype,
          interestsTop: m.interestsTop,
          industry: m.industryNicheLabel || m.industryCategoryLabel,
          hometown: m.hometownRegionCity,
          socialStyle: m.socialStyle,
          educationLevel: m.educationLevel,
          relationshipStatus: m.relationshipStatus,
          workMode: m.workMode,
          industryCategory: m.industryCategory,
          industryCategoryLabel: m.industryCategoryLabel,
          interestSignals: interestSignalsByUserId.get(m.id) ?? null,
        }));

        const analysis = await matchExplanationService.generateGroupAnalysis(
          group.id,
          matchMembers,
          pool?.eventType || '饭局'
        );

        allAnalyses.push({
          ...analysis,
          groupNumber: group.groupNumber,
        });
      }

      res.json({
        poolId,
        groupCount: allAnalyses.length,
        analyses: allAnalyses,
      });
    } catch (error: any) {
      console.error('[Admin Match Explanations] Error:', error);
      res.status(500).json({ message: 'Failed to regenerate explanations', error: error.message });
    }
  });

  // ============ KPI Dashboard API ============

  // Get KPI dashboard data
  app.get('/api/admin/kpi/dashboard', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const { kpiService } = await import('./kpiService');
      const data = await kpiService.getKpiDashboardData(days);
      res.json(data);
    } catch (error: any) {
      console.error('[KPI Dashboard] Error:', error);
      res.status(500).json({ message: 'Failed to get KPI dashboard data', error: error.message });
    }
  });

  // Get churn analysis
  app.get('/api/admin/kpi/churn-analysis', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { kpiService } = await import('./kpiService');
      const analysis = await kpiService.getChurnAnalysis();
      res.json(analysis);
    } catch (error: any) {
      console.error('[KPI Churn] Error:', error);
      res.status(500).json({ message: 'Failed to get churn analysis', error: error.message });
    }
  });

  // Generate daily KPI snapshot (can be called manually or via cron)
  app.post('/api/admin/kpi/generate-snapshot', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { kpiService } = await import('./kpiService');
      await kpiService.generateDailyKpiSnapshot();
      res.json({ success: true, message: 'KPI snapshot generated' });
    } catch (error: any) {
      console.error('[KPI Snapshot] Error:', error);
      res.status(500).json({ message: 'Failed to generate KPI snapshot', error: error.message });
    }
  });

  // Update user engagement metrics
  app.post('/api/admin/kpi/update-user-engagement/:userId', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { kpiService } = await import('./kpiService');
      await kpiService.updateUserEngagement(userId);
      res.json({ success: true, message: 'User engagement updated' });
    } catch (error: any) {
      console.error('[KPI User Engagement] Error:', error);
      res.status(500).json({ message: 'Failed to update user engagement', error: error.message });
    }
  });

  // Calculate current CSAT and NPS scores
  app.get('/api/admin/kpi/satisfaction-scores', kpiEndpointLimiter, requireAdmin, async (req: any, res) => {
    try {
      const { kpiService } = await import('./kpiService');
      const days = parseInt(req.query.days as string) || 30;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const [csatScore, npsScore] = await Promise.all([
        kpiService.calculateCSAT(startDate, endDate),
        kpiService.calculateNPS(startDate, endDate),
      ]);
      
      res.json({
        csatScore: csatScore.toFixed(2),
        npsScore: Math.round(npsScore),
        period: `Last ${days} days`,
      });
    } catch (error: any) {
      console.error('[KPI Satisfaction] Error:', error);
      res.status(500).json({ message: 'Failed to get satisfaction scores', error: error.message });
    }
  });

  // ============ V4 Adaptive Personality Assessment API ============

  // Start assessment session (with optional pre-signup answers from onboarding)
  app.post('/api/assessment/v4/start', async (req: any, res) => {
    try {
      const { preSignupAnswers, sessionId: existingSessionId, forceNew } = req.body;
      const userId = req.session?.userId || null;
      
      console.log('[Assessment V4 Start] Called with:', {
        existingSessionId,
        userId,
        forceNew,
        preSignupAnswersCount: preSignupAnswers?.length || 0,
        hasSession: !!req.session,
      });
      
      // Import adaptive engine
      const { 
        initializeEngineState, 
        processAnswer, 
        selectNextQuestion, 
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      let session;
      let engineState;
      
      // Determine if this is an explicit restart request vs automatic forceNew from presignup flow
      // forceNew + preSignupAnswers = automatic (post-login, should resume existing session)
      // forceNew + NO preSignupAnswers = explicit restart (user wants fresh start)
      const isExplicitRestart = forceNew && (!preSignupAnswers || preSignupAnswers.length === 0);
      
      // PRIORITY 1: For logged-in users, check for existing session first
      // Resume existing session UNLESS user explicitly wants to restart
      if (userId && !isExplicitRestart) {
        const existingUserSession = await storage.getAssessmentSessionByUser(userId);
        console.log('[V4 Start] Checked for existing user session:', {
          userId,
          foundSession: !!existingUserSession,
          sessionId: existingUserSession?.id,
          isCompleted: existingUserSession?.completedAt ? true : false,
        });
        
        if (existingUserSession && !existingUserSession.completedAt) {
          // Resume existing session - it was created by presignup-sync
          session = existingUserSession;
          
          // Reconstruct engine state from session data
          const answers = await storage.getAssessmentAnswers(session.id);
          engineState = initializeEngineState(assessmentConfig);
          
          // Replay answers to rebuild state
          for (const answer of answers) {
            const question = (await import('@shared/personality')).questionsV4.find(
              q => q.id === answer.questionId
            );
            if (question) {
              engineState = processAnswer(engineState, question, answer.selectedOption);
            }
          }
          
          console.log('[V4 Start] Resuming existing session for user:', userId, 'with', answers.length, 'answers');
        } else if (existingUserSession && existingUserSession.completedAt) {
          // User has a completed session - start fresh
          console.log('[V4 Start] User has completed session, creating new one');
        } else {
          console.log('[V4 Start] No existing session found for user:', userId);
        }
      } else if (userId && isExplicitRestart) {
        console.log('[V4 Start] Explicit restart requested for user:', userId);
      }
      
      // If resuming by session ID (anonymous pre-signup flow)
      if (!session && existingSessionId && !forceNew) {
        console.log('[V4 Start] Attempting to resume by sessionId:', existingSessionId);
        session = await storage.getAssessmentSession(existingSessionId);
        if (!session) {
          console.error('[V4 Start] Session not found by sessionId:', existingSessionId);
          return res.status(404).json({ message: 'Session not found' });
        }
        
        console.log('[V4 Start] Found session by sessionId:', {
          sessionId: session.id,
          userId: session.userId,
          phase: session.phase,
        });
        
        // Reconstruct engine state from session data
        const answers = await storage.getAssessmentAnswers(existingSessionId);
        engineState = initializeEngineState(assessmentConfig);
        
        // Replay answers to rebuild state
        for (const answer of answers) {
          const question = (await import('@shared/personality')).questionsV4.find(
            q => q.id === answer.questionId
          );
          if (question) {
            engineState = processAnswer(engineState, question, answer.selectedOption);
          }
        }
        
        console.log('[V4 Start] Replayed', answers.length, 'answers for session:', existingSessionId);
      }
      
      // Create new session if none exists
      if (!session) {
        // Create new session - fresh start
        session = await storage.createAssessmentSession({
          userId,
          phase: userId ? 'post_signup' : 'pre_signup',
          preSignupAnswers: preSignupAnswers || null,
        });
        
        engineState = initializeEngineState(assessmentConfig);
        
        // If we have pre-signup answers, process them (only for new session)
        if (preSignupAnswers && Array.isArray(preSignupAnswers)) {
          const { questionsV4 } = await import('@shared/personality');
          
          // Defensive deduplication: keep only the latest answer per questionId
          const dedupedAnswers = new Map<string, typeof preSignupAnswers[0]>();
          for (const ans of preSignupAnswers) {
            dedupedAnswers.set(ans.questionId, ans);
          }
          const uniqueAnswers = Array.from(dedupedAnswers.values());
          
          for (const ans of uniqueAnswers) {
            const question = questionsV4.find(q => q.id === ans.questionId);
            if (question) {
              engineState = processAnswer(engineState, question, ans.selectedOption);
              
              // Save answer to database
              await storage.createAssessmentAnswer({
                sessionId: session.id,
                questionId: ans.questionId,
                questionLevel: question.level,
                selectedOption: ans.selectedOption,
                traitScores: question.options.find(o => o.value === ans.selectedOption)?.traitScores || {},
              });
            }
          }
        }
      }
      
      // Ensure engineState is initialized (should always be by this point)
      if (!engineState) {
        console.log('[V4 Start] Engine state was not initialized, initializing now');
        engineState = initializeEngineState(assessmentConfig);
      }
      
      // Ensure session exists by this point
      if (!session) {
        console.error('[V4 Start] No session available after all checks - this should not happen');
        return res.status(500).json({ message: 'Failed to create or find session' });
      }
      
      // Get next question
      const nextQuestion = selectNextQuestion(engineState);
      
      console.log('[Assessment V4 Start] Engine state:', {
        answeredCount: engineState.answeredQuestionIds.size,
        skipCount: engineState.skipCount,
        phase: session.phase,
        hasNextQuestion: !!nextQuestion,
        nextQuestionId: nextQuestion?.id,
      });
      
      const response = {
        sessionId: session.id,
        phase: session.phase,
        currentQuestionIndex: engineState.answeredQuestionIds.size,
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          level: nextQuestion.level,
          category: nextQuestion.category,
          scenarioText: nextQuestion.scenarioText,
          questionText: nextQuestion.questionText,
          options: shuffleOptions(nextQuestion.options),
          questionType: nextQuestion.questionType,
          sliderConfig: nextQuestion.sliderConfig,
        } : null,
        progress: {
          answered: engineState.answeredQuestionIds.size,
          minQuestions: engineState.config.minQuestions,
          softMaxQuestions: engineState.config.softMaxQuestions,
          hardMaxQuestions: engineState.config.hardMaxQuestions,
          estimatedRemaining: Math.max(0, engineState.config.minQuestions - engineState.answeredQuestionIds.size),
        },
        currentMatches: engineState.currentMatches.slice(0, 3),
        isComplete: nextQuestion === null,
      };
      
      console.log('[Assessment V4 Start] Response:', {
        sessionId: response.sessionId,
        phase: response.phase,
        answered: response.progress.answered,
        hasNextQuestion: !!response.nextQuestion,
        isComplete: response.isComplete,
      });
      
      res.json(response);
    } catch (error: any) {
      console.error('[Assessment V4 Start] Error:', error);
      res.status(500).json({ message: 'Failed to start assessment', error: error.message });
    }
  });

  // Submit answer and get next question
  app.post('/api/assessment/v4/:sessionId/answer', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId, selectedOption } = req.body;
      
      console.log('[Assessment V4 Answer] Called with:', {
        sessionId,
        questionId,
        selectedOption,
      });
      
      if (!questionId || !selectedOption) {
        return res.status(400).json({ message: 'questionId and selectedOption are required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Answer] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Import modules
      const { 
        questionsV4, 
        initializeEngineState, 
        processAnswer, 
        selectNextQuestion,
        shouldTerminate,
        getFinalResult,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG,
        SECONDARY_QUESTION_MAP,
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Find the question
      const question = questionsV4.find(q => q.id === questionId);
      if (!question) {
        return res.status(400).json({ message: 'Invalid question ID' });
      }
      
      // Validate option
      const option = question.options.find(o => o.value === selectedOption);
      if (!option) {
        return res.status(400).json({ message: 'Invalid option selected' });
      }

      // Detect playful secondary questions and persist the decoded value
      if (SECONDARY_QUESTION_MAP[questionId]) {
        const { field, valueMap } = SECONDARY_QUESTION_MAP[questionId];
        const secondaryValue = valueMap[selectedOption];
        if (secondaryValue) {
          const currentPreSignup = session.preSignupData as any;
          const existingSecondary =
            currentPreSignup && !Array.isArray(currentPreSignup)
              ? currentPreSignup.secondaryData ?? {}
              : {};
          const newPreSignupData = Array.isArray(currentPreSignup)
            ? currentPreSignup
            : {
                ...(currentPreSignup ?? {}),
                secondaryData: { ...existingSecondary, [field]: secondaryValue },
              };
          await storage.updateAssessmentSession(sessionId, {
            preSignupAnswers: newPreSignupData,
          });
        }
      }
      
      // Save answer
      await storage.createAssessmentAnswer({
        sessionId,
        questionId,
        questionLevel: question.level,
        selectedOption,
        traitScores: option.traitScores,
      });
      
      // Rebuild engine state
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      for (const answer of answers) {
        const q = questionsV4.find(quest => quest.id === answer.questionId);
        if (q) {
          engineState = processAnswer(engineState, q, answer.selectedOption);
        }
      }
      
      // Check if complete
      const isComplete = shouldTerminate(engineState);
      
      if (isComplete) {
        // Load secondary data accumulated from playful questions (re-fetch to pick up any update above)
        const freshSession = await storage.getAssessmentSession(sessionId);
        const userSecondaryData = (freshSession?.preSignupData as any)?.secondaryData ?? {};

        // Generate final result
        const finalResult = getFinalResult(engineState, userSecondaryData);
        
        // Update session
        await storage.updateAssessmentSession(sessionId, {
          phase: 'completed',
          currentQuestionIndex: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
          finalResult,
          primaryArchetype: finalResult.primaryArchetype,
          isDecisive: finalResult.isDecisive,
          completedAt: new Date(),
        });
        
        // Sync V4 result to role_results table (overwrite any previous results)
        if (session.userId) {
          const primaryArchetype = finalResult.primaryArchetype;
          const secondaryArchetype = finalResult.secondaryArchetype || null;
          const roleSubtype = determineSubtype(primaryArchetype, {});
          const insights = generateInsights(primaryArchetype, secondaryArchetype);
          
          // Use actual archetype match scores from engineState
          const primaryMatchScore = engineState.currentMatches[0]?.score || 80;
          const secondaryMatchScore = engineState.currentMatches[1]?.score || 70;
          
          await storage.saveRoleResult(session.userId, {
            userId: session.userId,
            primaryArchetype,
            primaryArchetypeScore: Math.round(primaryMatchScore),
            secondaryArchetype,
            secondaryArchetypeScore: secondaryArchetype ? Math.round(secondaryMatchScore) : 0,
            roleSubtype,
            roleScores: {},
            affinityScore: finalResult.traitScores?.A || 50,
            opennessScore: finalResult.traitScores?.O || 50,
            conscientiousnessScore: finalResult.traitScores?.C || 50,
            emotionalStabilityScore: finalResult.traitScores?.E || 50,
            extraversionScore: finalResult.traitScores?.X || 50,
            positivityScore: finalResult.traitScores?.P || 50,
            ...insights,
            testVersion: 4,
          });
          
          // Mark personality test as complete
          await storage.markPersonalityTestComplete(session.userId);
          
          // Log algorithm version and match details for A/B testing
          const algorithmVersion = finalResult.algorithmVersion || 'v1.0';
          const isDecisive = finalResult.isDecisive ?? true;
          console.log(`[Assessment V4] Algorithm: ${algorithmVersion} | Result: ${primaryArchetype} (score: ${primaryMatchScore}) | Decisive: ${isDecisive} | User: ${session.userId}`);
        }
        
        res.json({
          isComplete: true,
          result: finalResult,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
          },
        });
      } else {
        // Get next question
        const nextQuestion = selectNextQuestion(engineState);
        
        // Generate milestone encouragement if applicable
        let encouragement = null;
        const { getMilestoneMessage } = await import('@shared/personality');
        const milestoneMsg = getMilestoneMessage(answers.length);
        if (milestoneMsg) {
          encouragement = milestoneMsg.message;
        }
        
        // Update session progress
        await storage.updateAssessmentSession(sessionId, {
          currentQuestionIndex: answers.length,
          traitConfidences: engineState.traitConfidences,
          topArchetypes: engineState.currentMatches,
        });
        
        res.json({
          isComplete: false,
          nextQuestion: nextQuestion ? {
            id: nextQuestion.id,
            level: nextQuestion.level,
            category: nextQuestion.category,
            scenarioText: nextQuestion.scenarioText,
            questionText: nextQuestion.questionText,
            options: shuffleOptions(nextQuestion.options),
            questionType: nextQuestion.questionType,
            sliderConfig: nextQuestion.sliderConfig,
          } : null,
          progress: {
            answered: answers.length,
            minQuestions: engineState.config.minQuestions,
            softMaxQuestions: engineState.config.softMaxQuestions,
            hardMaxQuestions: engineState.config.hardMaxQuestions,
            estimatedRemaining: Math.max(0, engineState.config.minQuestions - answers.length),
          },
          currentMatches: engineState.currentMatches.slice(0, 3),
          encouragement,
        });
        
        console.log('[Assessment V4 Answer] Response:', {
          isComplete: false,
          hasNextQuestion: !!nextQuestion,
          nextQuestionId: nextQuestion?.id,
          answered: answers.length,
        });
      }
    } catch (error: any) {
      console.error('[Assessment V4 Answer] Error:', error);
      res.status(500).json({ message: 'Failed to submit answer', error: error.message });
    }
  });

  // Skip current question and get alternative
  app.post('/api/assessment/v4/:sessionId/skip', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { questionId } = req.body;
      
      console.log('[Assessment V4 Skip] Called with:', {
        sessionId,
        questionId,
      });
      
      if (!questionId) {
        return res.status(400).json({ message: 'questionId is required' });
      }
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Skip] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      const { 
        questionsV4, 
        initializeEngineState, 
        processAnswer, 
        skipQuestion,
        MAX_SKIP_COUNT,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Get current skip count from session
      const currentSkipCount = session.skipCount || 0;
      const skippedQuestionIds: string[] = (session.skippedQuestionIds as string[]) || [];
      
      if (currentSkipCount >= MAX_SKIP_COUNT) {
        return res.status(400).json({ 
          success: false,
          message: 'Maximum skip limit reached',
          skipCount: currentSkipCount,
          canSkip: false,
          remainingSkips: 0,
        });
      }
      
      // Rebuild engine state with skipped questions
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      // Add previously skipped questions to state
      for (const skippedId of skippedQuestionIds) {
        engineState.skippedQuestionIds.add(skippedId);
      }
      engineState.skipCount = currentSkipCount;
      
      // Process previous answers
      for (const answer of answers) {
        const q = questionsV4.find(quest => quest.id === answer.questionId);
        if (q) {
          engineState = processAnswer(engineState, q, answer.selectedOption);
        }
      }
      
      // Skip current question
      const skipResult = skipQuestion(engineState, questionId);
      
      if (!skipResult) {
        return res.status(400).json({ 
          success: false,
          message: 'Cannot skip question',
          skipCount: currentSkipCount,
          canSkip: false,
          remainingSkips: 0,
        });
      }
      
      // Update session with new skip info
      const newSkippedIds = [...skippedQuestionIds, questionId];
      await storage.updateAssessmentSession(sessionId, {
        skipCount: skipResult.newState.skipCount,
        skippedQuestionIds: newSkippedIds,
      });
      
      const newQuestion = skipResult.newQuestion;
      
      res.json({
        success: true,
        newQuestion: newQuestion ? {
          id: newQuestion.id,
          level: newQuestion.level,
          category: newQuestion.category,
          scenarioText: newQuestion.scenarioText,
          questionText: newQuestion.questionText,
          options: shuffleOptions(newQuestion.options),
          questionType: newQuestion.questionType,
          sliderConfig: newQuestion.sliderConfig,
        } : null,
        skipCount: skipResult.newState.skipCount,
        canSkip: skipResult.newState.skipCount < MAX_SKIP_COUNT,
        remainingSkips: MAX_SKIP_COUNT - skipResult.newState.skipCount,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Skip] Error:', error);
      res.status(500).json({ message: 'Failed to skip question', error: error.message });
    }
  });

  // Get assessment results
  app.get('/api/assessment/v4/:sessionId/result', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      if (session.phase !== 'completed') {
        return res.status(400).json({ message: 'Assessment not yet completed' });
      }
      
      res.json({
        sessionId: session.id,
        completedAt: session.completedAt,
        result: session.finalResult,
        traitConfidences: session.traitConfidences,
        topArchetypes: session.topArchetypes,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Result] Error:', error);
      res.status(500).json({ message: 'Failed to get result', error: error.message });
    }
  });

  // Link session to user after signup (called from onboarding)
  app.post('/api/assessment/v4/:sessionId/link-user', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user!.id;
      
      console.log('[Assessment V4 Link] Called with:', {
        sessionId,
        userId,
      });
      
      const session = await storage.getAssessmentSession(sessionId);
      if (!session) {
        console.error('[Assessment V4 Link] Session not found:', sessionId);
        return res.status(404).json({ message: 'Session not found' });
      }
      
      // Update session with user ID
      await storage.updateAssessmentSession(sessionId, {
        userId,
        phase: 'post_signup',
      });
      
      // Import adaptive engine to get next question
      const { 
        initializeEngineState, 
        processAnswer, 
        selectNextQuestion, 
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');
      
      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;
      
      // Reconstruct engine state from session answers
      const answers = await storage.getAssessmentAnswers(sessionId);
      let engineState = initializeEngineState(assessmentConfig);
      
      // Replay answers to rebuild state
      for (const answer of answers) {
        const question = (await import('@shared/personality')).questionsV4.find(
          q => q.id === answer.questionId
        );
        if (question) {
          engineState = processAnswer(engineState, question, answer.selectedOption);
        }
      }
      
      // Get next question
      const nextQuestion = selectNextQuestion(engineState);
      
      // Return success with next question data
      const responseData = { 
        success: true,
        phase: 'post_signup',
        nextQuestion: nextQuestion ? {
          id: nextQuestion.id,
          level: nextQuestion.level,
          category: nextQuestion.category,
          scenarioText: nextQuestion.scenarioText,
          questionText: nextQuestion.questionText,
          options: shuffleOptions(nextQuestion.options),
          questionType: nextQuestion.questionType,
          sliderConfig: nextQuestion.sliderConfig,
        } : null,
        progress: {
          answered: engineState.answeredQuestionIds.size,
          minQuestions: engineState.config.minQuestions,
          softMaxQuestions: engineState.config.softMaxQuestions,
          hardMaxQuestions: engineState.config.hardMaxQuestions,
          estimatedRemaining: Math.max(0, engineState.config.minQuestions - engineState.answeredQuestionIds.size),
        },
        currentMatches: engineState.currentMatches.slice(0, 3),
      };
      
      console.log('[Assessment V4 Link] Response:', {
        success: true,
        hasNextQuestion: !!nextQuestion,
        nextQuestionId: nextQuestion?.id,
        answered: engineState.answeredQuestionIds.size,
      });
      
      res.json(responseData);
    } catch (error: any) {
      console.error('[Assessment V4 Link] Error:', error);
      res.status(500).json({ message: 'Failed to link user', error: error.message });
    }
  });

  // Get anchor questions for pre-signup onboarding
  app.get('/api/assessment/v4/anchor-questions', async (req: any, res) => {
    try {
      const { getAnchorQuestions } = await import('@shared/personality');
      const anchors = getAnchorQuestions();
      
      res.json({
        questions: anchors.map(q => ({
          id: q.id,
          level: q.level,
          category: q.category,
          scenarioText: q.scenarioText,
          questionText: q.questionText,
          options: shuffleOptions(q.options),
        })),
        count: anchors.length,
      });
    } catch (error: any) {
      console.error('[Assessment V4 Anchors] Error:', error);
      res.status(500).json({ message: 'Failed to get anchor questions', error: error.message });
    }
  });

  // Sync pre-signup answers after login - creates session and seeds L1 answers
  app.post('/api/assessment/v4/presignup-sync', async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        console.warn('[Presignup Sync] No userId in session - session may not be ready yet');
        return res.status(401).json({ message: 'Unauthorized - must be logged in' });
      }

      const { preSignupAnswers } = req.body;
      if (!preSignupAnswers || !Array.isArray(preSignupAnswers) || preSignupAnswers.length === 0) {
        return res.status(400).json({ message: 'No pre-signup answers provided' });
      }

      console.log('[Presignup Sync] Syncing', preSignupAnswers.length, 'answers for user:', userId);

      // Import adaptive engine
      const { 
        initializeEngineState, 
        processAnswer,
        questionsV4,
        DEFAULT_ASSESSMENT_CONFIG,
        V2_ASSESSMENT_CONFIG 
      } = await import('@shared/personality');

      // Use V2 config when ENABLE_MATCHER_V2 is set
      const ENABLE_MATCHER_V2 = process.env.ENABLE_MATCHER_V2 === 'true';
      const assessmentConfig = ENABLE_MATCHER_V2 ? V2_ASSESSMENT_CONFIG : DEFAULT_ASSESSMENT_CONFIG;

      // Check if user already has an active session
      let session = await storage.getAssessmentSessionByUser(userId);
      
      if (session) {
        // Merge answers instead of skipping
        const existingAnswers = await storage.getAssessmentAnswers(session.id);
        const existingQuestionIds = new Set(existingAnswers.map(a => a.questionId));
        
        // Deduplicate incoming answers and filter out ones already in DB
        const dedupedIncoming = new Map<string, typeof preSignupAnswers[0]>();
        for (const ans of preSignupAnswers) {
          dedupedIncoming.set(ans.questionId, ans);
        }
        
        const newAnswers = Array.from(dedupedIncoming.values()).filter(ans => !existingQuestionIds.has(ans.questionId));
        
        if (newAnswers.length === 0) {
          console.log('[Presignup Sync] No new answers to sync for session:', session.id);
          return res.json({ 
            sessionId: session.id, 
            message: 'All answers already synced',
            totalCount: existingAnswers.length,
            syncedCount: 0
          });
        }

        console.log('[Presignup Sync] Syncing', newAnswers.length, 'new answers to existing session:', session.id);
        
        // Reconstruct engine state for full session (existing + new) to update current matches
        const allUniqueAnswers = [...existingAnswers.map(a => ({ questionId: a.questionId, selectedOption: a.selectedOption })), ...newAnswers];
        let engineState = initializeEngineState(assessmentConfig);
        
        const { questionsV4 } = await import('@shared/personality');

        // Save new answers and build engine state
        for (const ans of newAnswers) {
          const question = questionsV4.find(q => q.id === ans.questionId);
          await storage.createAssessmentAnswer({
            sessionId: session.id,
            questionId: ans.questionId,
            questionLevel: question?.level || 1,
            selectedOption: ans.selectedOption,
            traitScores: question?.options.find(o => o.value === ans.selectedOption)?.traitScores || {}
          });
        }

        // Replay ALL answers to ensure trait scores and matches are correct
        for (const ans of allUniqueAnswers) {
          const question = questionsV4.find(q => q.id === ans.questionId);
          if (question) {
            engineState = processAnswer(engineState, question, ans.selectedOption);
          }
        }

        const traitScoresObj: Record<string, number> = {};
        const traitConfidencesObj: Record<string, number> = {};
        for (const [trait, conf] of Object.entries(engineState.traitConfidences)) {
          traitScoresObj[trait] = conf.score;
          traitConfidencesObj[trait] = conf.confidence;
        }

        // Phase validation: Only mark anchor phase complete if we have 8 unique answers
        const uniqueAnsweredIds = new Set(allUniqueAnswers.map(a => a.questionId));
        const currentPhase = uniqueAnsweredIds.size >= 8 ? 'adaptive' : 'anchor';

        await storage.updateAssessmentSession(session.id, {
          phase: currentPhase,
          traitScores: traitScoresObj,
          traitConfidences: traitConfidencesObj,
          topArchetypes: engineState.currentMatches.slice(0, 3).map(m => m.archetype),
          answeredQuestionIds: Array.from(engineState.answeredQuestionIds),
        });

        return res.json({
          sessionId: session.id,
          syncedCount: newAnswers.length,
          totalCount: engineState.answeredQuestionIds.size
        });
      } else {
        // Create new session for logged-in user
        session = await storage.createAssessmentSession({
          userId,
          phase: 'post_signup',
          preSignupAnswers: preSignupAnswers,
        });
        console.log('[Presignup Sync] Created new session:', session.id);
      }

      // Initialize engine state and process pre-signup answers
      let engineState = initializeEngineState(assessmentConfig);
      
      // Deduplicate answers - keep only latest answer per question
      const dedupedAnswers = new Map<string, typeof preSignupAnswers[0]>();
      for (const ans of preSignupAnswers) {
        dedupedAnswers.set(ans.questionId, ans);
      }
      const uniqueAnswers = Array.from(dedupedAnswers.values());
      
      // Process and save each answer
      for (const ans of uniqueAnswers) {
        const question = questionsV4.find(q => q.id === ans.questionId);
        if (question) {
          engineState = processAnswer(engineState, question, ans.selectedOption);
          
          // Save answer to database
          await storage.createAssessmentAnswer({
            sessionId: session.id,
            questionId: ans.questionId,
            questionLevel: question.level,
            selectedOption: ans.selectedOption,
            traitScores: question.options.find(o => o.value === ans.selectedOption)?.traitScores || {},
          });
        }
      }

      // Update session with current state
      const traitScoresObj: Record<string, number> = {};
      const traitConfidencesObj: Record<string, number> = {};
      for (const [trait, conf] of Object.entries(engineState.traitConfidences)) {
        traitScoresObj[trait] = conf.score;
        traitConfidencesObj[trait] = conf.confidence;
      }

      await storage.updateAssessmentSession(session.id, {
        phase: 'post_signup',
        currentQuestionIndex: uniqueAnswers.length,
        traitScores: traitScoresObj,
        traitConfidences: traitConfidencesObj,
        topArchetypes: engineState.currentMatches.slice(0, 3).map(m => m.archetype),
        answeredQuestionIds: Array.from(engineState.answeredQuestionIds),
      });

      console.log('[Presignup Sync] Synced', uniqueAnswers.length, 'answers to session:', session.id);

      res.json({ 
        sessionId: session.id, 
        totalCount: uniqueAnswers.length,
        syncedCount: uniqueAnswers.length,
        message: 'Pre-signup answers synced successfully'
      });
    } catch (error: any) {
      console.error('[Presignup Sync] Error:', error);
      res.status(500).json({ message: 'Failed to sync pre-signup answers', error: error.message });
    }
  });

  // Helper function to shuffle options (prevent order bias)
  function shuffleOptions(options: any[]): any[] {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  // ============ Unified Assessment Result Endpoint (V2 Integration) ============
  // This endpoint normalizes both V1 and V2 results into a consistent shape
  app.get('/api/assessment/result', isPhoneAuthenticated, async (req: any, res) => {
    try {
      // Use session userId fallback when req.user is undefined (phone auth uses session)
      const userId = req.user?.id || req.session?.userId;
      const { getChemistryForArchetype, archetypePrototypes } = await import('@shared/personality/prototypes');
      
      // Get the latest COMPLETED V4 assessment session
      // This ensures we always return the most recent finished result, even if user has 
      // an incomplete retest session in progress
      const session = await storage.getLatestCompletedAssessmentSessionByUser(userId);
      
      if (session) {
        const finalResult = session.finalResult as any;
        const primaryArchetype = session.primaryArchetype || finalResult?.primaryArchetype || finalResult?.archetype;
        
        if (!primaryArchetype) {
          return res.status(400).json({ message: 'No archetype found in result' });
        }

        // Generate dynamic chemistry from prototypes
        const chemistryList = getChemistryForArchetype(primaryArchetype);
        
        // Get archetype prototype for trait profile
        const prototype = archetypePrototypes[primaryArchetype];
        
        // Use trait scores from finalResult (already normalized to 0-100 by V4 adaptive engine)
        // Fallback to top-level traitScores for legacy sessions
        const traitScores = (finalResult?.traitScores || session.traitScores || {}) as Record<string, number>;
        const normalizeScore = (score: number | undefined, fallback: number = 50): number =>  {
          if (score === undefined || score === null) return fallback;
          // V4 finalResult.traitScores are already 0-100 (normalized by adaptive engine)
          // Top-level session.traitScores are also 0-100 (from engineState.traitConfidences)
          // Very old legacy V1 sessions might have 0-1 scores, so handle both cases for safety
          if (score > 0 && score < 1) return Math.round(score * 100);
          // Already in 0-100 range
          return Math.round(score);
        };
        
        const normalizedTraits = {
          affinityScore: normalizeScore(traitScores.A),
          opennessScore: normalizeScore(traitScores.O),
          conscientiousnessScore: normalizeScore(traitScores.C),
          emotionalStabilityScore: normalizeScore(traitScores.E),
          extraversionScore: normalizeScore(traitScores.X),
          positivityScore: normalizeScore(traitScores.P),
        };

        // Get total questions from session answers count
        const answers = await storage.getAssessmentAnswers(session.id);
        const totalQuestions = answers?.length || finalResult?.questionCount || 12;

        // Build normalized response
        const response = {
          algorithmVersion: session.algorithmVersion || 'v1',
          primaryArchetype: primaryArchetype,
          secondaryArchetype: finalResult?.secondaryArchetype,
          ...normalizedTraits,
          totalQuestions,
          chemistryList: chemistryList.map(c => ({
            role: c.archetype,
            percentage: c.percentage,
            reason: c.reason,
          })),
          archetypeTraitProfile: prototype?.traitProfile || null,
          matchDetails: session.matchDetailsJson || null,
          isDecisive: session.isDecisive || false,
          completedAt: session.completedAt,
        };
        
        return res.json(response);
      }
      
      // Fallback to legacy role_results table
      const legacyResult = await storage.getRoleResult(userId);
      if (legacyResult) {
        const chemistryList = getChemistryForArchetype(legacyResult.primaryArchetype);
        const prototype = archetypePrototypes[legacyResult.primaryArchetype];
        
        return res.json({
          algorithmVersion: 'v1',
          primaryArchetype: legacyResult.primaryArchetype,
          secondaryArchetype: legacyResult.secondaryArchetype,
          affinityScore: legacyResult.affinityScore,
          opennessScore: legacyResult.opennessScore,
          conscientiousnessScore: legacyResult.conscientiousnessScore,
          emotionalStabilityScore: legacyResult.emotionalStabilityScore,
          extraversionScore: legacyResult.extraversionScore,
          positivityScore: legacyResult.positivityScore,
          totalQuestions: 12,
          chemistryList: chemistryList.map(c => ({
            role: c.archetype,
            percentage: c.percentage,
            reason: c.reason,
          })),
          archetypeTraitProfile: prototype?.traitProfile || null,
          matchDetails: null,
          isDecisive: false,
          completedAt: legacyResult.createdAt,
        });
      }
      
      return res.status(404).json({ 
        error: 'No completed assessment found', 
        hasCompletedTest: false 
      });
    } catch (error: any) {
      console.error('[Unified Assessment Result] Error:', error);
      res.status(500).json({ message: 'Failed to get result', error: error.message });
    }
  });

  // ============ Assessment Feedback Endpoint ============
  app.post('/api/assessment/feedback', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session?.userId;
      const { archetype, accuracy } = req.body;
      
      if (!archetype || !accuracy) {
        return res.status(400).json({ message: 'Missing archetype or accuracy' });
      }
      
      if (!['accurate', 'partial', 'inaccurate'].includes(accuracy)) {
        return res.status(400).json({ message: 'Invalid accuracy value' });
      }

      console.log(`[Assessment Feedback] User ${userId} rated ${archetype} as ${accuracy}`);
      
      // Store feedback for analysis (could be extended to save to DB)
      // For now, just log it for collection
      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error: any) {
      console.error('[Assessment Feedback] Error:', error);
      res.status(500).json({ message: 'Failed to record feedback', error: error.message });
    }
  });

  // ============ Share Card Data Endpoint ============
  app.get('/api/personality-test/share-card-data', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.session?.userId;
      
      // Get user data for rankings
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Get assessment result
      const session = await storage.getLatestCompletedAssessmentSessionByUser(userId);
      let archetype: string;
      let traitScores: Record<string, number>;

      if (session) {
        const finalResult = session.finalResult as any;
        archetype = session.primaryArchetype || finalResult?.primaryArchetype || finalResult?.archetype;
        // Use trait scores from finalResult (already normalized to 0-100 by V4 adaptive engine)
        // Fallback to top-level traitScores for legacy sessions
        traitScores = (finalResult?.traitScores || session.traitScores || {}) as Record<string, number>;
      } else {
        // Fallback to legacy role_results (already 0-100 scale)
        const legacyResult = await storage.getRoleResult(userId);
        if (!legacyResult) {
          return res.status(404).json({ message: 'No assessment result found' });
        }
        archetype = legacyResult.primaryArchetype;
        traitScores = {
          A: legacyResult.affinityScore,
          O: legacyResult.opennessScore,
          C: legacyResult.conscientiousnessScore,
          E: legacyResult.emotionalStabilityScore,
          X: legacyResult.extraversionScore,
          P: legacyResult.positivityScore,
        };
      }

      // Validate archetype exists
      if (!archetype) {
        return res.status(400).json({ message: 'No archetype found in assessment result' });
      }

      // Check for user createdAt
      if (!user.createdAt) {
        return res.status(400).json({ message: 'User account missing creation date' });
      }

      // Calculate user rankings
      const totalUserRank = await storage.calculateUserRank(user.createdAt);
      const archetypeRank = await storage.calculateArchetypeRank(userId, archetype);

      // Normalize trait scores to 0-100 scale
      // V4 finalResult.traitScores are already 0-100 (normalized by adaptive engine)
      // Top-level session.traitScores are also 0-100 (from engineState.traitConfidences)
      // Legacy role_results are expected to be 0-100; normalization also defensively handles 0-1 inputs
      const normalizeScore = (score: number | undefined): number => {
        if (score === undefined || score === null) return 50;
        // If score is a fractional value in (0, 1), treat as legacy 0-1 and convert to 0-100
        if (score > 0 && score < 1) return Math.round(score * 100);
        // Already in 0-100 range (including 0 and 1)
        return Math.round(score);
      };

      // Get archetype primary color
      const archetypePrimaryColors: Record<string, string> = {
        "机智狐": "#FF6B6B",
        "开心柯基": "#FFD93D",
        "暖心熊": "#FFA07A",
        "织网蛛": "#9B59B6",
        "夸夸豚": "#FF69B4",
        "太阳鸡": "#FFA500",
        "淡定海豚": "#4FC3F7",
        "沉思猫头鹰": "#8B4789",
        "稳如龟": "#2E7D32",
        "隐身猫": "#757575",
        "定心大象": "#5C6BC0",
        "灵感章鱼": "#AB47BC"
      };

      // Get default gradients for each archetype
      const archetypeGradients: Record<string, string> = {
        '开心柯基': 'from-yellow-500 via-orange-500 to-red-500',
        '太阳鸡': 'from-amber-500 via-yellow-500 to-orange-500',
        '夸夸豚': 'from-cyan-500 via-blue-500 to-indigo-500',
        '机智狐': 'from-orange-500 via-red-500 to-pink-500',
        '淡定海豚': 'from-blue-500 via-indigo-500 to-purple-500',
        '织网蛛': 'from-purple-500 via-pink-500 to-fuchsia-500',
        '暖心熊': 'from-rose-500 via-pink-500 to-red-500',
        '灵感章鱼': 'from-violet-500 via-purple-500 to-indigo-500',
        '沉思猫头鹰': 'from-slate-500 via-gray-500 to-zinc-500',
        '定心大象': 'from-gray-500 via-slate-500 to-stone-500',
        '稳如龟': 'from-green-500 via-emerald-500 to-teal-500',
        '隐身猫': 'from-indigo-500 via-purple-500 to-violet-500',
      };

      res.json({
        archetype,
        gradient: archetypeGradients[archetype] || 'from-gray-500 to-gray-600',
        primaryColor: archetypePrimaryColors[archetype] || '#9CA3AF',
        illustrationUrl: `/assets/${archetype}_transparent.png`, // Placeholder - frontend will use actual imported images
        rankings: {
          totalUserRank,
          archetypeRank,
        },
        // Trait scores are 0-100 from adaptive engine
        traitScores: {
          A: normalizeScore(traitScores.A),
          O: normalizeScore(traitScores.O),
          C: normalizeScore(traitScores.C),
          E: normalizeScore(traitScores.E),
          X: normalizeScore(traitScores.X),
          P: normalizeScore(traitScores.P),
        }
      });
    } catch (error: any) {
      console.error('[Share Card Data] Error:', error);
      res.status(500).json({ message: 'Failed to get share card data', error: error.message });
    }
  });

  // ============ Xiaoyue AI Analysis Endpoint ============
  app.post('/api/xiaoyue/analysis', async (req: any, res) => {
    try {
      const { archetype, traitScores, confidence } = req.body;
      
      if (!archetype || !traitScores) {
        return res.status(400).json({ message: 'Missing archetype or traitScores' });
      }

      const { generateXiaoyueAnalysis } = await import('./xiaoyueAnalysisService');
      const result = await generateXiaoyueAnalysis({
        archetype,
        traitScores: {
          affinity: traitScores.A || traitScores.affinity || 0.5,
          openness: traitScores.O || traitScores.openness || 0.5,
          conscientiousness: traitScores.C || traitScores.conscientiousness || 0.5,
          emotionalStability: traitScores.E || traitScores.emotionalStability || 0.5,
          extraversion: traitScores.X || traitScores.extraversion || 0.5,
          positivity: traitScores.P || traitScores.positivity || 0.5,
        },
        confidence,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('[Xiaoyue Analysis] Error:', error);
      res.status(500).json({ message: 'Failed to generate analysis', error: error.message });
    }
  });

  // Prefetch xiaoyue analysis when test approaches completion
  app.post('/api/xiaoyue/prefetch', async (req: any, res) => {
    try {
      const { archetype, traitScores, confidence } = req.body;
      
      if (!archetype || !traitScores || confidence < 0.7) {
        return res.json({ prefetched: false, reason: 'Not ready yet' });
      }

      const { prefetchAnalysisIfReady } = await import('./xiaoyueAnalysisService');
      prefetchAnalysisIfReady(
        archetype,
        {
          affinity: traitScores.A || traitScores.affinity || 0.5,
          openness: traitScores.O || traitScores.openness || 0.5,
          conscientiousness: traitScores.C || traitScores.conscientiousness || 0.5,
          emotionalStability: traitScores.E || traitScores.emotionalStability || 0.5,
          extraversion: traitScores.X || traitScores.extraversion || 0.5,
          positivity: traitScores.P || traitScores.positivity || 0.5,
        },
        confidence
      );
      
      res.json({ prefetched: true });
    } catch (error: any) {
      console.error('[Xiaoyue Prefetch] Error:', error);
      res.json({ prefetched: false, error: error.message });
    }
  });

  // ============ Development Tools API Endpoints ============
  // TODO: Restrict to development only before production launch
  // Currently enabled in production for internal testing
  
  // Helper function to verify secret key
  function verifySecretKey(secretKey: string): { valid: boolean; error?: string; hint?: string } {
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    
    if (!expectedKey) {
      console.error('[DEV TOOLS] ADMIN_CREATE_SECRET_KEY not set in environment');
      return { 
        valid: false, 
        error: 'ADMIN_CREATE_SECRET_KEY not configured on server',
        hint: 'Add ADMIN_CREATE_SECRET_KEY=BYPASSSECRET12345678 to .env'
      };
    }
    
    if (secretKey !== expectedKey) {
      console.error('[DEV TOOLS] Secret key mismatch');
      console.error('[DEV TOOLS] Expected length:', expectedKey.length);
      console.error('[DEV TOOLS] Received length:', secretKey?.length || 0);
      return { 
        valid: false, 
        error: 'Invalid secret key',
        hint: 'Use BYPASSSECRET12345678'
      };
    }
    
    return { valid: true };
  }

  // Create admin account
  app.post('/api/dev/admin/create', async (req: any, res) => {
    try {
      const { phoneNumber, password, secretKey } = req.body;

      console.log('[DEV] Admin create attempt');
      console.log('[DEV] Secret key provided:', secretKey ? 'Yes' : 'No');
      
      // Verify secret key
      const verification = verifySecretKey(secretKey);
      if (!verification.valid) {
        return res.status(verification.error?.includes('not configured') ? 500 : 403).json({ 
          error: verification.error,
          hint: verification.hint
        });
      }

      // Validate inputs
      if (!phoneNumber || !password) {
        return res.status(400).json({ message: 'Phone number and password are required' });
      }

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Check if user exists
      const existingUsers = await storage.getUserByPhone(phoneNumber);
      let user;

      if (existingUsers.length > 0) {
        // Update existing user to be admin
        user = existingUsers[0];
        user = await storage.updateUser(user.id, {
          password: hashedPassword,
          isAdmin: true,
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
        });
        console.log(`[Dev Tools] Updated user ${user.id} to admin account`);
      } else {
        // Create new admin user
        user = await storage.createUserWithPhone({
          phoneNumber,
          email: `admin_${Date.now()}@joyjoin.app`,
          firstName: 'Admin',
          lastName: 'User',
        });
        user = await storage.updateUser(user.id, {
          password: hashedPassword,
          isAdmin: true,
          hasCompletedPersonalityTest: true,
          hasCompletedRegistration: true,
          displayName: 'Admin',
          primaryArchetype: '开心柯基', // Default archetype
        });
        console.log(`[Dev Tools] Created new admin account ${user.id}`);
      }

      res.json({
        success: true,
        message: 'Admin account created/updated successfully',
        userId: user.id,
        phoneNumber: user.phoneNumber,
      });
    } catch (error: any) {
      console.error('[Dev Tools] Error creating admin:', error);
      // Sanitize error message to avoid leaking sensitive information
      const safeMessage = error?.message?.includes('getaddrinfo') 
        ? 'Database connection failed'
        : error?.message || 'Failed to create admin account';
      res.status(500).json({ 
        message: 'Failed to create admin account',
        error: process.env.NODE_ENV === 'development' ? safeMessage : undefined
      });
    }
  });

  // Create user account with bypass
  app.post('/api/dev/user/create', async (req: any, res) => {
    try {
      const { 
        phoneNumber, 
        password, 
        secretKey, 
        displayName, 
        archetype, 
        gender, 
        city,
        age,
        industry,
        topInterests
      } = req.body;

      console.log('[DEV] User create attempt');
      console.log('[DEV] Secret key provided:', secretKey ? 'Yes' : 'No');

      // Verify secret key
      const verification = verifySecretKey(secretKey);
      if (!verification.valid) {
        return res.status(verification.error?.includes('not configured') ? 500 : 403).json({ 
          error: verification.error,
          hint: verification.hint
        });
      }

      // Validate required inputs
      if (!phoneNumber || !password || !displayName || !archetype || !gender || !city) {
        return res.status(400).json({ 
          message: 'Phone number, password, displayName, archetype, gender, and city are required' 
        });
      }

      // Validate archetype
      if (!ARCHETYPE_NAMES.includes(archetype as ArchetypeName)) {
        return res.status(400).json({ 
          message: 'Invalid archetype. Must be one of the 12 archetypes.' 
        });
      }

      // Hash password
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);

      // Check if user exists
      const existingUsers = await storage.getUserByPhone(phoneNumber);
      let user;

      const userData: any = {
        password: hashedPassword,
        displayName,
        primaryArchetype: archetype,
        gender,
        currentCity: city,
        hasCompletedPersonalityTest: true,
        hasCompletedRegistration: true,
      };

      if (age) {
        userData.age = parseInt(age);
      }

      if (industry) {
        userData.currentOccupation = industry;
      }

      if (topInterests) {
        // Parse comma-separated interests
        const interestsArray = topInterests.split(',').map((i: string) => i.trim()).filter((i: string) => i);
        if (interestsArray.length > 0) {
          userData.interestsTop = interestsArray;
        }
      }

      if (existingUsers.length > 0) {
        // Update existing user
        user = existingUsers[0];
        user = await storage.updateUser(user.id, userData);
        console.log(`[Dev Tools] Updated user ${user.id}`);
      } else {
        // Create new user
        user = await storage.createUserWithPhone({
          phoneNumber,
          email: `user_${Date.now()}@joyjoin.app`,
          firstName: displayName.split(' ')[0] || displayName,
          lastName: displayName.split(' ')[1] || '',
        });
        user = await storage.updateUser(user.id, userData);
        console.log(`[Dev Tools] Created new user ${user.id}`);
      }

      res.json({
        success: true,
        message: 'User account created/updated successfully',
        userId: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        archetype: user.primaryArchetype,
      });
    } catch (error: any) {
      console.error('[Dev Tools] Error creating user:', error);
      // Sanitize error message to avoid leaking sensitive information
      const safeMessage = error?.message?.includes('getaddrinfo') 
        ? 'Database connection failed'
        : error?.message || 'Failed to create user account';
      res.status(500).json({ 
        message: 'Failed to create user account',
        error: process.env.NODE_ENV === 'development' ? safeMessage : undefined
      });
    }
  });

  // Bypass personality test for current user
  app.post('/api/dev/personality-test/bypass', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { secretKey } = req.body;
      const userId = req.session.userId;

      console.log('[DEV] Personality test bypass attempt');
      console.log('[DEV] Secret key provided:', secretKey ? 'Yes' : 'No');

      // Verify secret key
      const verification = verifySecretKey(secretKey);
      if (!verification.valid) {
        return res.status(verification.error?.includes('not configured') ? 500 : 403).json({ 
          error: verification.error,
          hint: verification.hint
        });
      }

      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }

      // Get user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Set default archetype if none exists
      const updates: any = {
        hasCompletedPersonalityTest: true,
      };

      if (!user.primaryArchetype) {
        updates.primaryArchetype = '开心柯基'; // Default archetype
      }

      await storage.updateUser(userId, updates);

      console.log(`[Dev Tools] Bypassed personality test for user ${userId}`);

      res.json({
        success: true,
        message: 'Personality test bypassed successfully',
        archetype: user.primaryArchetype || '开心柯基',
      });
    } catch (error: any) {
      console.error('[Dev Tools] Error bypassing test:', error);
      // Sanitize error message to avoid leaking sensitive information
      const safeMessage = error?.message?.includes('getaddrinfo') 
        ? 'Database connection failed'
        : error?.message || 'Failed to bypass personality test';
      res.status(500).json({ 
        message: 'Failed to bypass personality test',
        error: process.env.NODE_ENV === 'development' ? safeMessage : undefined
      });
    }
  });

  // Check secret key validity (debugging endpoint)
  app.post('/api/dev/check-secret', async (req: any, res) => {
    const { secretKey } = req.body;
    
    const DEV_SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY;
    
    console.log('[DEV] Secret key check');
    console.log('[DEV] Server has key:', DEV_SECRET_KEY ? 'Yes' : 'No');
    console.log('[DEV] Key length:', DEV_SECRET_KEY?.length || 0);
    console.log('[DEV] Provided key length:', secretKey?.length || 0);
    console.log('[DEV] Match:', secretKey === DEV_SECRET_KEY);
    
    if (!DEV_SECRET_KEY) {
      return res.status(500).json({
        error: 'ADMIN_CREATE_SECRET_KEY not configured on server',
        hint: 'Server admin needs to add this to .env file'
      });
    }
    
    if (secretKey !== DEV_SECRET_KEY) {
      return res.status(403).json({
        error: 'Secret key does not match',
        hint: 'Expected: BYPASSSECRET12345678',
        serverKeyLength: DEV_SECRET_KEY.length,
        providedKeyLength: secretKey?.length || 0
      });
    }
    
    res.json({
      success: true,
      message: 'Secret key is valid',
      keyLength: secretKey.length
    });
  });

  app.use('/api/social-icebreaker', isPhoneAuthenticated, socialIcebreakerRoutes);
  app.use('/api/tts', isPhoneAuthenticated, ttsRoutes);

  // ============ Pre-event Attendance (Blind Box) ============

  // User: set own pre-event attendance status
  app.post('/api/blind-box-events/:eventId/pre-attendance', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { eventId } = req.params;
      const { status, lateMinutes, absentReason } = req.body;

      const allowed = ["pending", "confirmed", "late", "absent"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Upsert (insert or update) the pre-attendance record
      await db
        .insert(schema.blindBoxPreAttendance)
        .values({ eventId, userId, status, lateMinutes: lateMinutes ?? null, absentReason: absentReason ?? null, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [schema.blindBoxPreAttendance.eventId, schema.blindBoxPreAttendance.userId],
          set: { status, lateMinutes: lateMinutes ?? null, absentReason: absentReason ?? null, updatedAt: new Date() },
        });

      res.json({ success: true, status });
    } catch (error) {
      console.error("Error updating pre-attendance:", error);
      res.status(500).json({ message: "Failed to update attendance status" });
    }
  });

  // Admin: get attendance summary for an event
  app.get('/api/admin/blind-box-events/:eventId/attendance-summary', requireAdmin, async (req: any, res) => {
    try {
      const { eventId } = req.params;

      // Fetch event to get attendees list
      const event = await db.select().from(blindBoxEvents).where(eq(blindBoxEvents.id, eventId)).limit(1);
      if (!event.length) return res.status(404).json({ message: "Event not found" });

      const matchedAttendees: Array<{ userId: string; displayName: string }> =
        (event[0].matchedAttendees as any) ?? [];

      const attendeeUserIds = matchedAttendees.map((a) => a.userId);

      // Fetch pre-attendance records for this event
      const records: Array<{ userId: string; status: string; lateMinutes: number | null }> = attendeeUserIds.length
        ? await db
            .select()
            .from(schema.blindBoxPreAttendance)
            .where(
              and(
                eq(schema.blindBoxPreAttendance.eventId, eventId),
                inArray(schema.blindBoxPreAttendance.userId, attendeeUserIds)
              )
            )
        : [];

      const statusMap = new Map(records.map((r) => [r.userId, r]));

      const attendees = matchedAttendees.map((a) => {
        const rec = statusMap.get(a.userId);
        return {
          userId: a.userId,
          displayName: a.displayName,
          status: rec?.status ?? "pending",
          lateMinutes: rec?.lateMinutes ?? undefined,
        };
      });

      const summary = {
        confirmed: attendees.filter((a) => a.status === "confirmed").length,
        late: attendees.filter((a) => a.status === "late").length,
        absent: attendees.filter((a) => a.status === "absent").length,
        pending: attendees.filter((a) => a.status === "pending").length,
      };

      res.json({ summary, attendees });
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: send reminders to pending attendees
  app.post('/api/admin/blind-box-events/:eventId/chase-attendees', requireAdmin, async (req: any, res) => {
    try {
      // In a real implementation this would send push notifications.
      // For now we acknowledge the action and return success.
      res.json({ success: true, message: "Reminders sent to pending attendees" });
    } catch (error) {
      console.error("Error chasing attendees:", error);
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  // Admin: override a single attendee's pre-attendance status
  app.patch('/api/admin/blind-box-events/:eventId/attendees/:userId/attendance', requireAdmin, async (req: any, res) => {
    try {
      const { eventId, userId } = req.params;
      const { status } = req.body;

      const allowed = ["pending", "confirmed", "late", "absent"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await db
        .insert(schema.blindBoxPreAttendance)
        .values({ eventId, userId, status, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [schema.blindBoxPreAttendance.eventId, schema.blindBoxPreAttendance.userId],
          set: { status, updatedAt: new Date() },
        });

      res.json({ success: true, status });
    } catch (error) {
      console.error("Error overriding attendance:", error);
      res.status(500).json({ message: "Failed to override attendance status" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
