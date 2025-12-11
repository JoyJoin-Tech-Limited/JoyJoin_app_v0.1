//my path:/Users/felixg/projects/JoyJoin3/server/routes.ts
import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupPhoneAuth, isPhoneAuthenticated } from "./phoneAuth";
import { paymentService } from "./paymentService";
import { subscriptionService } from "./subscriptionService";
import { venueMatchingService } from "./venueMatchingService";
import { calculateUserMatchScore, matchUsersToGroups, validateWeights, DEFAULT_WEIGHTS, type MatchingWeights } from "./userMatchingService";
import { broadcastEventStatusChanged, broadcastAdminAction } from "./eventBroadcast";
import { matchEventPool, saveMatchResults } from "./poolMatchingService";
import { roleTraits, roleInsights } from "./archetypeConfig";
import { processTestV2, type AnswerV2 } from "./personalityMatchingV2";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { updateProfileSchema, updateFullProfileSchema, updatePersonalitySchema, insertChatMessageSchema, insertDirectMessageSchema, insertEventFeedbackSchema, registerUserSchema, interestsTopicsSchema, insertChatReportSchema, insertChatLogSchema, events, eventAttendance, chatMessages, users, directMessageThreads, directMessages, eventPools, eventPoolRegistrations, eventPoolGroups, insertEventPoolSchema, insertEventPoolRegistrationSchema, invitations, invitationUses, matchingThresholds, poolMatchingLogs, blindBoxEvents, type User } from "@shared/schema";
import { db } from "./db";
import { eq, or, and, desc, inArray, isNotNull, gt, sql } from "drizzle-orm";

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

  Object.entries(responses).forEach(([questionId, answer]) => {
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

function determineSubtype(primaryRole: string, responses: Record<number, any>): string {
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

  return nicknames[primaryRole] || "";
}

function calculateTraitScores(primaryRole: string, secondaryRole: string | null): {
  affinityScore: number;
  opennessScore: number;
  conscientiousnessScore: number;
  emotionalStabilityScore: number;
  extraversionScore: number;
  positivityScore: number;
} {
  // Use imported roleTraits from archetypeConfig.ts
  const primary = roleTraits[primaryRole] || roleTraits["淡定海豚"]; // Default to 淡定海豚
  const secondary = secondaryRole ? roleTraits[secondaryRole] : null;

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

function generateInsights(primaryRole: string, secondaryRole: string | null): {
  strengths: string;
  challenges: string;
  idealFriendTypes: string[];
} {
  // Use imported roleInsights from archetypeConfig.ts
  return roleInsights[primaryRole] || roleInsights["淡定海豚"]; // Default to 淡定海豚
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: 'lax',
    },
  }));

  // Phone auth setup
  setupPhoneAuth(app);

  // Admin password login endpoint
  app.post('/api/auth/admin-login', async (req: any, res) => {
    try {
      const { phoneNumber, password } = req.body;

      if (!phoneNumber || !password) {
        return res.status(400).json({ message: "Phone number and password are required" });
      }

      // Get user by phone number
      const users = await storage.getUserByPhone(phoneNumber);
      
      if (users.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = users[0];

      // Check if user is admin
      if (!user.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check if user has password set
      if (!user.password) {
        return res.status(401).json({ message: "Password not set for this account" });
      }

      // Verify password
      const bcrypt = await import('bcrypt');
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      req.session.regenerate((err: any) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ message: "Login failed" });
        }

        req.session.userId = user.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ message: "Login failed" });
          }

          res.json({ 
            message: "Login successful",
            userId: user.id
          });
        });
      });
    } catch (error) {
      console.error("Error during admin login:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post('/api/auth/logout', async (req: any, res) => {
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

  // Profile stats endpoint
  app.get('/api/profile/stats', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      
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
      
      // Calculate connections made: count direct message threads where user is participant
      const connectionsResult = await db
        .select({ count: directMessageThreads.id })
        .from(directMessageThreads)
        .where(
          or(
            eq(directMessageThreads.user1Id, userId),
            eq(directMessageThreads.user2Id, userId)
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
        const primaryRole = top1[0];
        const secondaryRole = top2[0];
        const roleSubtype = determineSubtype(primaryRole, responses);
        const traitScores = calculateTraitScores(primaryRole, secondaryRole);
        const insights = generateInsights(primaryRole, secondaryRole);

        res.json({
          needsSupplementary: false,
          result: {
            primaryRole,
            primaryRoleScore: top1[1],
            secondaryRole,
            secondaryRoleScore: top2[1],
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

      const primaryRole = sortedRoles[0][0];
      const primaryRoleScore = sortedRoles[0][1];
      const secondaryRole = sortedRoles[1]?.[0] || null;
      const secondaryRoleScore = sortedRoles[1]?.[1] || 0;

      // Determine subtype (simplified - based on highest scoring items)
      const roleSubtype = determineSubtype(primaryRole, responses);

      // Calculate six-dimensional trait scores
      const traitScores = calculateTraitScores(primaryRole, secondaryRole);

      // Generate insights
      const insights = generateInsights(primaryRole, secondaryRole);

      // Save responses and result
      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryRole,
        primaryRoleScore,
        secondaryRole,
        secondaryRoleScore,
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

  // V2 Personality Test Submit Endpoint (using trait-based matching)
  app.post('/api/personality-test/v2/submit', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { responses } = req.body as { responses: Record<number, AnswerV2> };

      // Process V2 test using Euclidean distance matching
      const matchResult = processTestV2(responses);

      const primaryRole = matchResult.primaryRole;
      const secondaryRole = matchResult.secondaryRole;
      const roleSubtype = determineSubtype(primaryRole, responses);
      const insights = generateInsights(primaryRole, secondaryRole);

      // Save responses and result
      await storage.saveTestResponses(userId, responses);
      const roleResult = await storage.saveRoleResult(userId, {
        userId,
        primaryRole,
        primaryRoleScore: matchResult.primaryMatchScore,
        secondaryRole,
        secondaryRoleScore: matchResult.secondaryMatchScore,
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

      res.json({
        ...roleResult,
        matchDetails: {
          primaryDistance: matchResult.primaryDistance,
          secondaryDistance: matchResult.secondaryDistance,
          userTraits: matchResult.userTraits,
        },
      });
    } catch (error) {
      console.error("Error submitting V2 personality test:", error);
      res.status(500).json({ message: "Failed to submit V2 personality test" });
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
      const allUsers = await db.select({ primaryRole: users.primaryRole }).from(users).where(isNotNull(users.primaryRole));
      
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

      allUsers.forEach((user) => {
        if (user.primaryRole && distribution.hasOwnProperty(user.primaryRole)) {
          distribution[user.primaryRole] += 1;
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

  app.post('/api/user/interests-topics', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const result = interestsTopicsSchema.safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updateInterestsTopics(userId, result.data);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating interests and topics:", error);
      res.status(500).json({ message: "Failed to update interests and topics" });
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
        return res.status(400).json({ error: result.error });
      }

      const user = await storage.updateFullProfile(userId, result.data);
      
      res.json(user);
    } catch (error) {
      console.error("Error updating full profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
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

  // Direct message routes (1-on-1 chats unlocked via mutual matching)
  app.get('/api/direct-messages', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const threads = await storage.getUserDirectMessageThreads(userId);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching direct message threads:", error);
      res.status(500).json({ message: "Failed to fetch direct message threads" });
    }
  });

  app.get('/api/direct-messages/:threadId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const { threadId } = req.params;
      const messages = await storage.getThreadMessages(threadId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching thread messages:", error);
      res.status(500).json({ message: "Failed to fetch thread messages" });
    }
  });

  app.post('/api/direct-messages/:threadId', isPhoneAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const { threadId } = req.params;
      const result = insertDirectMessageSchema.safeParse({
        ...req.body,
        threadId,
      });
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const message = await storage.sendDirectMessage(userId, result.data);
      res.json(message);
    } catch (error) {
      console.error("Error sending direct message:", error);
      res.status(500).json({ message: "Failed to send direct message" });
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

      // Award points for completing feedback
      const feedback = await storage.createEventFeedback(userId, result.data);
      
      // Check for mutual matches if user has new connections
      const mutualMatches: string[] = [];
      if (feedback.hasNewConnections && feedback.connections && feedback.connections.length > 0) {
        // Get all feedbacks for this event to check for mutual matches
        const eventFeedbacks = await storage.getEventFeedbacks(eventId);
        
        for (const selectedUserId of feedback.connections) {
          // Find the feedback from the selected user
          const otherUserFeedback = eventFeedbacks.find(f => f.userId === selectedUserId);
          
          // Check if they also selected the current user
          if (otherUserFeedback?.hasNewConnections && 
              otherUserFeedback.connections && 
              otherUserFeedback.connections.includes(userId)) {
            mutualMatches.push(selectedUserId);
            
            // Create direct message thread if it doesn't exist
            const existingThread = await storage.findDirectMessageThread(userId, selectedUserId, eventId);
            if (!existingThread) {
              await storage.createDirectMessageThread({
                user1Id: userId,
                user2Id: selectedUserId,
                eventId: eventId,
              });
              
              // Send mutual match notifications to both users
              await storage.createNotification({
                userId: userId,
                category: 'chat',
                type: 'mutual_match',
                title: '🎉 双向匹配成功',
                message: `你和另一位参与者互相选择，现在可以开始私聊了！`,
                relatedResourceId: eventId,
              });
              
              await storage.createNotification({
                userId: selectedUserId,
                category: 'chat',
                type: 'mutual_match',
                title: '🎉 双向匹配成功',
                message: `你和另一位参与者互相选择，现在可以开始私聊了！`,
                relatedResourceId: eventId,
              });
            }
          }
        }
      }
      
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
      const hasMatchedDemo = existingEvents.some(e => e.status === 'matched' && e.restaurantName?.includes('Sushi'));
      const hasCompletedDemo = existingEvents.some(e => e.status === 'completed' && e.restaurantName?.includes('Tap House'));
      
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

      const registrationsToInsert: any[] = [];
      for (let i = 0; i < insertCount; i++) {
        registrationsToInsert.push({
          poolId,
          userId,
          budgetRange: [finalBudget],
          preferredLanguages: [],
          tasteIntensity: [],
          cuisinePreferences: [],
          socialGoals: [],
          dietaryRestrictions: [],
          matchStatus: "pending",
        });
      }

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
        userId,
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
        socialGoals,
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
        socialGoals,
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
        socialGoals: Array.isArray(socialGoals) ? socialGoals : [],
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
  //       socialGoals,
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
  //       socialGoals,
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
  //       socialGoals: Array.isArray(socialGoals) ? socialGoals : [],
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
  //       socialGoals,
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
  //       socialGoals,
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
  //       socialGoals: Array.isArray(socialGoals) ? socialGoals : [],
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
  //       socialGoals,
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
  //       socialGoals,
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
  //       socialGoals: Array.isArray(socialGoals) ? socialGoals : [],
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
      const { eventId } = req.params;

      if (!userId) {
        console.error("[BlindBoxCancel] No userId in session");
        return res.status(401).json({ message: "Unauthorized" });
      }

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
          cancelledIds: deletedRegistrations.map((r) => r.id),
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
          cancelledRegistrationIds: deletedRegistrations.map((r) => r.id),
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
        cancelledIds: deletedRegistrations.map((r) => r.id),
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
        cancelledRegistrationIds: deletedRegistrations.map((r) => r.id),
      });
    } catch (error) {
      console.error("[BlindBoxCancel] Error canceling blind box event / pool registration:", error);
      res.status(500).json({ message: "Failed to cancel blind box event" });
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

      const selectedIds = selected.map((r) => r.id);

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
      const event = await storage.getBlindBoxEventByIdAndUser(eventId, userId);
      if (!event) {
        return res.status(404).json({ message: "Event not found or access denied" });
      }

      // Check if invitation already exists for this user and event
      const existingInvite = await db.query.invitations.findFirst({
        where: (invites, { and, eq }) => and(
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
          where: (invites, { eq }) => eq(invites.code, code)
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

      // Fetch event info
      const event = await storage.getBlindBoxEventById(invitation.eventId);

      // Increment click count
      await db.update(invitations)
        .set({ totalClicks: invitation.totalClicks + 1 })
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
        languagesComfort: ['粤语', '普通话', '英语'],
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
        languagesComfort: ['粤语', '普通话'],
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
        languagesComfort: ['粤语', '普通话', '英语'],
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

      // Create direct message threads (private 1-1 chats)
      console.log(`[SEED-DEMO] Creating direct message thread 1: ${userId} <-> ${demoUser1.id}`);
      // Thread 1: Current user with demoUser1 (小明-开心柯基)
      const [thread1] = await db.insert(directMessageThreads).values({
        user1Id: userId,
        user2Id: demoUser1.id,
        eventId: event3.id, // They matched at the past event
        lastMessageAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 mins ago
      }).returning();
      console.log(`[SEED-DEMO] Thread 1 created with ID: ${thread1.id}`);

      // Messages in thread 1
      const thread1Messages = [
        { senderId: demoUser1.id, message: '今天玩得很开心！我们可以加个好友吗？', createdAt: new Date(now.getTime() - 60 * 60 * 1000) },
        { senderId: userId, message: '当然可以！我也觉得今天很有趣', createdAt: new Date(now.getTime() - 55 * 60 * 1000) },
        { senderId: demoUser1.id, message: '下次有类似的活动记得叫我！', createdAt: new Date(now.getTime() - 30 * 60 * 1000) },
      ];

      for (const msg of thread1Messages) {
        await db.insert(directMessages).values({
          threadId: thread1.id,
          senderId: msg.senderId,
          message: msg.message,
          createdAt: msg.createdAt,
        });
      }

      // Thread 2: Current user with demoUser2 (小红-织网蛛)
      console.log(`[SEED-DEMO] Creating direct message thread 2: ${userId} <-> ${demoUser2.id}`);
      const [thread2] = await db.insert(directMessageThreads).values({
        user1Id: userId,
        user2Id: demoUser2.id,
        eventId: event3.id,
        lastMessageAt: new Date(now.getTime() - 10 * 60 * 1000), // 10 mins ago
      }).returning();
      console.log(`[SEED-DEMO] Thread 2 created with ID: ${thread2.id}`);

      // Messages in thread 2
      const thread2Messages = [
        { senderId: demoUser2.id, message: '嗨！刚才的狼人杀你玩得真棒', createdAt: new Date(now.getTime() - 45 * 60 * 1000) },
        { senderId: userId, message: '谢谢！你也很厉害呀', createdAt: new Date(now.getTime() - 40 * 60 * 1000) },
        { senderId: demoUser2.id, message: '我们下周还有个咖啡聚会，要来吗？', createdAt: new Date(now.getTime() - 35 * 60 * 1000) },
        { senderId: userId, message: '好啊！具体什么时间？', createdAt: new Date(now.getTime() - 10 * 60 * 1000) },
      ];

      for (const msg of thread2Messages) {
        await db.insert(directMessages).values({
          threadId: thread2.id,
          senderId: msg.senderId,
          message: msg.message,
          createdAt: msg.createdAt,
        });
      }

      console.log(`[SEED-DEMO] Demo data creation completed successfully for user: ${userId}`);
      res.json({ 
        success: true, 
        message: 'Demo chat data created (including 2 private chats)',
        events: [
          { title: event1.title, status: 'unlocked', dateTime: event1.dateTime },
          { title: event2.title, status: 'locked', dateTime: event2.dateTime },
          { title: event3.title, status: 'past', dateTime: event3.dateTime },
        ],
        privateChats: [
          { with: '小明 (开心柯基)', messages: 3, threadId: thread1.id },
          { with: '小红 (织网蛛)', messages: 4, threadId: thread2.id },
        ]
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

  // ============ ADMIN MIDDLEWARE ============
  
  async function requireAuth(req: Request, res: any, next: any) {
    const session = req.session as any;
    if (!session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }
  
  async function requireAdmin(req: Request, res: any, next: any) {
    const session = req.session as any;
    if (!session?.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = await storage.getUser(session.userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Forbidden - Admin access required" });
      }
      
      next();
    } catch (error) {
      console.error("Error checking admin status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // ============ ADMIN API ROUTES ============

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
      
      // Personality distribution
      const personalityDistribution = allUsers.reduce((acc: Record<string, number>, user: any) => {
        if (user.primaryRole) {
          acc[user.primaryRole] = (acc[user.primaryRole] || 0) + 1;
        }
        return acc;
      }, {});

      res.json({
        totalUsers,
        subscribedUsers,
        eventsThisMonth,
        monthlyRevenue,
        newUsersThisWeek,
        userGrowth,
        personalityDistribution,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User Management - Get all users with filters and pagination
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, filter } = req.query;
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
          user.email?.toLowerCase().includes(searchLower) ||
          user.phoneNumber?.includes(search)
        );
      }

      // Apply status filter
      if (filter === "banned") {
        users = users.filter((user: any) => user.isBanned);
      } else if (filter === "subscribed") {
        // TODO: Filter by subscription status when subscriptions table is implemented
        users = [];
      } else if (filter === "non-subscribed") {
        // TODO: Filter by non-subscription status
        users = users;
      }

      const totalUsers = users.length;
      const paginatedUsers = users.slice(offset, offset + limit);

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

  // User Management - Get user details
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's events
      const events = await storage.getUserBlindBoxEvents(req.params.id);
      
      res.json({
        ...user,
        events,
        subscriptions: [], // TODO: Get from subscriptions table
        payments: [], // TODO: Get from payments table
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ message: "Failed to fetch user details" });
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
      const { name, type, address, city, district, contactName, contactPhone, commissionRate, tags, cuisines, priceRange, maxConcurrentEvents, notes } = req.body;
      
      if (!name || !type || !address || !city || !district) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const venue = await storage.createVenue({
        name,
        type,
        address,
        city,
        district,
        contactName: contactName || null,
        contactPhone: contactPhone || null,
        commissionRate: commissionRate || 20,
        tags: tags || [],
        cuisines: cuisines || [],
        priceRange: priceRange || null,
        maxConcurrentEvents: maxConcurrentEvents || 1,
        isActive: true,
        notes: notes || null,
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
        pools.map(async (pool) => {
          const registrations = await db.query.eventPoolRegistrations.findMany({
            where: (regs, { eq }) => eq(regs.poolId, pool.id),
          });

          return {
            ...pool,
            registrationCount: registrations.length,
            matchedCount: registrations.filter((r) => r.matchStatus === "matched").length,
            pendingCount: registrations.filter((r) => r.matchStatus === "pending").length,
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
          socialGoals: eventPoolRegistrations.socialGoals,
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
          userAge: users.age,
          userIndustry: users.industry,
          userSeniority: users.seniority,
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
        where: (groups, { eq }) => eq(groups.poolId, req.params.id),
        orderBy: (groups, { asc }) => [asc(groups.groupNumber)],
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
            userIndustry: users.industry,
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
        where: (pools, { eq }) => eq(pools.id, poolId)
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

      const poolIds = pools.map((p) => p.id);

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

      const registeredPoolIds = new Set(userRegistrations.map((r) => r.poolId));

      // 过滤掉已经报名过的池子
      const visiblePools = pools.filter((p) => !registeredPoolIds.has(p.id));

      console.log("[EventPools] visible pools for user:", {
        userId,
        total: pools.length,
        registeredCount: userRegistrations.length,
        visibleCount: visiblePools.length,
      });

      return res.json(visiblePools);
    } catch (error) {
      console.error("Error fetching event pools:", error);
      return res.status(500).json({ message: "Failed to fetch event pools" });
    }
  });

  // Get single event pool details
  app.get("/api/event-pools/:id", async (req, res) => {
    try {
      const pool = await db.query.eventPools.findFirst({
        where: (pools, { eq }) => eq(pools.id, req.params.id),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      // Get registration count
      const registrations = await db.query.eventPoolRegistrations.findMany({
        where: (regs, { eq }) => eq(regs.poolId, req.params.id)
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

  // User register for event pool with preferences
  app.post("/api/event-pools/:id/register", requireAuth, async (req, res) => {
    try {
      const poolId = req.params.id;
      const userId = (req.user as User).id;
      const invitationCode = req.body.invitationCode;

      // Check if pool exists and is active
      const pool = await db.query.eventPools.findFirst({
        where: (pools, { eq }) => eq(pools.id, poolId)
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      if (pool.status !== 'active') {
        return res.status(400).json({ message: "This event pool is no longer accepting registrations" });
      }

      // Check if user already registered
      const existingReg = await db.query.eventPoolRegistrations.findFirst({
        where: (regs, { eq, and }) => and(
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
        socialGoals: req.body.socialGoals || [],
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
          .set({ totalAcceptances: db.raw('total_acceptances + 1') })
          .where(eq(invitations.code, invitationCode));
      }

      // Trigger realtime matching scan after registration
      // Import at top: import { scanPoolAndMatch } from "./poolRealtimeMatchingService";
      const { scanPoolAndMatch } = await import("./poolRealtimeMatchingService");
      
      // Async trigger (don't block response)
      scanPoolAndMatch(poolId, "realtime", "user_registration").catch(err => {
        console.error(`[Realtime Matching] Scan failed after registration:`, err);
      });

      res.json(registration);
    } catch (error: any) {
      console.error("Error registering for event pool:", error);
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
        socialGoals: eventPoolRegistrations.socialGoals,
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
      registrations.map(async (reg) => {
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
            const codes = userInvitations.map((inv) => inv.code);
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
        ids: deletedRegistrations.map((r) => r.id),
        poolIds: deletedRegistrations.map((r) => r.poolId),
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
        cancelledRegistrationIds: deletedRegistrations.map((r) => r.id),
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
      const userId = (req.user as User).id;

      // Get group info
      const group = await db.query.eventPoolGroups.findFirst({
        where: (groups, { eq }) => eq(groups.id, groupId),
      });

      if (!group) {
        return res.status(404).json({ message: "Group not found" });
      }

      // Get pool info
      const pool = await db.query.eventPools.findFirst({
        where: (pools, { eq }) => eq(pools.id, group.poolId),
      });

      if (!pool) {
        return res.status(404).json({ message: "Event pool not found" });
      }

      // Check if user is in this group
      const userRegistration = await db.query.eventPoolRegistrations.findFirst({
        where: (regs, { eq, and }) => and(
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
          industry: users.industry,
          ageVisible: users.ageVisible,
          industryVisible: users.industryVisible,
          gender: users.gender,
          educationLevel: users.educationLevel,
          hometownCountry: users.hometownCountry,
          hometownRegionCity: users.hometownRegionCity,
          hometownAffinityOptin: users.hometownAffinityOptin,
          educationVisible: users.educationVisible,
          relationshipStatus: users.relationshipStatus,
          children: users.children,
          studyLocale: users.studyLocale,
          overseasRegions: users.overseasRegions,
          seniority: users.seniority,
          fieldOfStudy: users.fieldOfStudy,
          languagesComfort: users.languagesComfort,
          // Event-specific preferences from registration
          intent: eventPoolRegistrations.socialGoals,
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

  // Finance - Get statistics
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
        paymentType: "subscription",
        relatedId: renewalData.subscriptionId,
        originalAmount: renewalData.amount,
        couponId,
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
      await paymentService.handleWebhook(req.body);
      res.json({ code: "SUCCESS", message: "OK" });
    } catch (error) {
      console.error("Error processing WeChat Pay webhook:", error);
      res.status(500).json({ code: "FAIL", message: "Internal server error" });
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
      
      const user1 = await storage.getUserById(userId1);
      const user2 = await storage.getUserById(userId2);
      
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

  // ============ CHAT LOGS ROUTES ============
  
  // POST /api/chat-logs - Internal logging endpoint
  app.post("/api/chat-logs", async (req, res) => {
    try {
      const validatedData = insertChatLogSchema.parse(req.body);
      
      const log = await storage.createChatLog(validatedData);
      
      res.json(log);
    } catch (error: any) {
      console.error("Error creating chat log:", error);
      res.status(400).json({ message: error.message || "Failed to create log" });
    }
  });

  // GET /api/admin/chat-logs - Admin queries logs with filters
  app.get("/api/admin/chat-logs", requireAdmin, async (req, res) => {
    try {
      const { eventId, userId, severity, startDate, endDate } = req.query;
      
      const filters: any = {};
      if (eventId) filters.eventId = eventId as string;
      if (userId) filters.userId = userId as string;
      if (severity) filters.severity = severity as string;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      
      const logs = await storage.getChatLogs(filters);
      
      res.json(logs);
    } catch (error: any) {
      console.error("Error fetching chat logs:", error);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  // GET /api/admin/chat-logs/stats - Admin gets log statistics
  app.get("/api/admin/chat-logs/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getChatLogStats();
      
      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching chat log stats:", error);
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

  const httpServer = createServer(app);

  return httpServer;
}
