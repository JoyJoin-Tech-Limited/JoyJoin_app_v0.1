import { logger } from "../../lib/logger";
import type { Express, Request } from "express";
import { isDevAuthToolsEnabled } from "../../auth/policy";
import { storage } from "../../storage";
import { ARCHETYPE_NAMES, type ArchetypeName } from "../../archetypeConfig";
import { requireAuth } from "../../middleware/auth";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { db } from "../../db";
import * as schema from "@shared/schema";
import { blindBoxEvents } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { getActingAdminId } from "../../lib/getActingAdminId";

function getCookieDiagnostics(cookieHeader: string | string[] | undefined) {
  const normalizedHeader = Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader ?? "";
  const cookieEntries = normalizedHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return {
    hasCookieHeader: cookieEntries.length > 0,
    cookieCount: cookieEntries.length,
    hasConnectSidCookie: cookieEntries.some((entry) => entry.startsWith("connect.sid=")),
  };
}

export function registerDevToolRoutes(app: Express): void {
  // ============ Development Tools API Endpoints ============
  // Opt-in only outside production; omitted entirely from production registrations.
  if (isDevAuthToolsEnabled()) {

  // ---------- Debug cookie / session diagnostics ----------
  const isProduction = process.env.NODE_ENV === 'production';

  app.get("/api/debug/cookie-direct", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/cookie-direct called");
    res.cookie("debug_direct", "1", {
      path: "/",
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax"
    });
    res.json({ ok: true, message: "Check for Set-Cookie: debug_direct=1" });
  });

  app.get("/api/debug/session-set", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/session-set called");
    req.session.userId = "debug-user";
    req.session.isAdmin = true;
    req.session.save((err) => {
      if (err) {
        console.error("🔧 [DEBUG] Session save error:", err);
        return res.status(500).json({ ok: false, err: String(err) });
      }

      const hasSetCookie = Boolean(res.getHeader("set-cookie"));
      console.log("🔧 [DEBUG] Session saved", { hasSetCookie });
      res.json({
        ok: true,
        sessionSaved: true,
        hasSessionUserId: Boolean(req.session.userId),
        sessionIsAdmin: Boolean(req.session.isAdmin),
        hasSetCookie,
      });
    });
  });

  app.get("/api/debug/echo-cookie", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/echo-cookie called");
    const cookieDiagnostics = getCookieDiagnostics(req.headers.cookie);

    res.json({
      ...cookieDiagnostics,
      hasSessionUserId: Boolean(req.session?.userId),
      sessionIsAdmin: req.session?.isAdmin ?? null,
      hasDebugSessionFlag: typeof req.session?.debugTest === "number",
      reqSecure: req.secure,
      xForwardedProto: req.headers['x-forwarded-proto'] || null,
      protocol: req.protocol,
      xForwardedHost: req.headers['x-forwarded-host'] || null,
      xForwardedFor: req.headers['x-forwarded-for'] || null,
      host: req.headers.host || null,
    });
  });

  app.get("/api/debug/set-cookie", (req, res) => {
    console.log("🔧 [DEBUG] /api/debug/set-cookie called");
    res.cookie("debug_direct", "1", {
      httpOnly: false,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: "/",
    });
    req.session.debugTest = Date.now();
    req.session.save((err) => {
      if (err) {
        console.error("🔧 [DEBUG] Session save error:", err);
        return res.status(500).json({ ok: false, error: String(err) });
      }

      const hasSetCookie = Boolean(res.getHeader("set-cookie"));
      console.log("🔧 [DEBUG] Session saved successfully", { hasSetCookie });
      res.json({
        ok: true,
        hasSetCookie,
        debugCookieQueued: true,
        hasDebugSessionFlag: typeof req.session.debugTest === "number",
        message: "Check response headers for Set-Cookie",
      });
    });
  });

  // Helper function to verify secret key
  function verifySecretKey(secretKey: string): { valid: boolean; error?: string; hint?: string } {
    const expectedKey = process.env.ADMIN_CREATE_SECRET_KEY;
    
    if (!expectedKey) {
      logger.error('[DEV TOOLS] ADMIN_CREATE_SECRET_KEY not set in environment');
      return { 
        valid: false, 
        error: 'ADMIN_CREATE_SECRET_KEY not configured on server',
        hint: 'Add ADMIN_CREATE_SECRET_KEY to your local server environment before using dev auth tools.'
      };
    }
    
    if (secretKey !== expectedKey) {
      logger.error('[DEV TOOLS] Secret key mismatch');
      return { 
        valid: false, 
        error: 'Invalid secret key',
        hint: 'Confirm the local ADMIN_CREATE_SECRET_KEY value matches your current shell/.env configuration.'
      };
    }
    
    return { valid: true };
  }

  // Create admin account
  app.post('/api/dev/admin/create', async (req: Request, res) => {
    try {
      const { phoneNumber, password, secretKey } = req.body;

      logger.info('[DEV] Admin create attempt');
      logger.info('[DEV] Secret key provided', { data: secretKey ? 'Yes' : 'No' });
      
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
        logger.info(`[Dev Tools] Updated user ${user.id} to admin account`);
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
        logger.info(`[Dev Tools] Created new admin account ${user.id}`);
      }

      res.json({
        success: true,
        message: 'Admin account created/updated successfully',
        userId: user.id,
        phoneNumber: user.phoneNumber,
      });
    } catch (error: any) {
      logger.error('[Dev Tools] Error creating admin', { error: String(error) });
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
  app.post('/api/dev/user/create', async (req: Request, res) => {
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

      logger.info('[DEV] User create attempt');
      logger.info('[DEV] Secret key provided', { data: secretKey ? 'Yes' : 'No' });

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

      const userData: Record<string, unknown> = {
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
        logger.info(`[Dev Tools] Updated user ${user.id}`);
      } else {
        // Create new user
        user = await storage.createUserWithPhone({
          phoneNumber,
          email: `user_${Date.now()}@joyjoin.app`,
          firstName: displayName.split(' ')[0] || displayName,
          lastName: displayName.split(' ')[1] || '',
        });
        user = await storage.updateUser(user.id, userData);
        logger.info(`[Dev Tools] Created new user ${user.id}`);
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
      logger.error('[Dev Tools] Error creating user', { error: String(error) });
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
  app.post('/api/dev/personality-test/bypass', requireAuth, async (req: Request, res) => {
    try {
      const { secretKey } = req.body;
      const userId = req.session.userId;

      logger.info('[DEV] Personality test bypass attempt');
      logger.info('[DEV] Secret key provided', { data: secretKey ? 'Yes' : 'No' });

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
      const updates: Record<string, unknown> = {
        hasCompletedPersonalityTest: true,
      };

      if (!user.primaryArchetype) {
        updates.primaryArchetype = '开心柯基'; // Default archetype
      }

      await storage.updateUser(userId, updates);

      logger.info(`[Dev Tools] Bypassed personality test for user ${userId}`);

      res.json({
        success: true,
        message: 'Personality test bypassed successfully',
        archetype: user.primaryArchetype || '开心柯基',
      });
    } catch (error: any) {
      logger.error('[Dev Tools] Error bypassing test', { error: String(error) });
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
  app.post('/api/dev/check-secret', async (req: Request, res) => {
    const { secretKey } = req.body;
    
    const DEV_SECRET_KEY = process.env.ADMIN_CREATE_SECRET_KEY;
    
    logger.info('[DEV] Secret key check');
    logger.info('[DEV] Server has key', { data: DEV_SECRET_KEY ? 'Yes' : 'No' });
    logger.info('[DEV] Key length', { data: DEV_SECRET_KEY?.length || 0 });
    logger.info('[DEV] Provided key length', { data: secretKey?.length || 0 });
    logger.info('[DEV] Match', { data: secretKey === DEV_SECRET_KEY });
    
    if (!DEV_SECRET_KEY) {
      return res.status(500).json({
        error: 'ADMIN_CREATE_SECRET_KEY not configured on server',
        hint: 'Add ADMIN_CREATE_SECRET_KEY to the local server environment before retrying.'
      });
    }
    
    if (secretKey !== DEV_SECRET_KEY) {
      return res.status(403).json({
        error: 'Secret key does not match',
        hint: 'Confirm the local ADMIN_CREATE_SECRET_KEY value matches your current shell/.env configuration.'
      });
    }
    
    res.json({
      success: true,
      message: 'Secret key is valid',
      keyLength: secretKey.length
    });
  });

  }

  // ============ Pre-event Attendance (Blind Box) ============

  // User: set own pre-event attendance status

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
      logger.error("Error fetching attendance summary", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch attendance summary" });
    }
  });

  // Admin: send reminders to pending attendees
  app.post('/api/admin/blind-box-events/:eventId/chase-attendees', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
    try {
      // In a real implementation this would send push notifications.
      // For now we acknowledge the action and return success.
      res.json({ success: true, message: "Reminders sent to pending attendees" });
    } catch (error) {
      logger.error("Error chasing attendees", { error: String(error) });
      res.status(500).json({ message: "Failed to send reminders" });
    }
  });

  // Admin: override a single attendee's pre-attendance status
  app.patch('/api/admin/blind-box-events/:eventId/attendees/:userId/attendance', requireAdmin, requireOperatorOrAbove, async (req: any, res) => {
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

      logAdminAudit({
        action: 'ATTENDANCE_OVERRIDE',
        adminId: getActingAdminId(req),
        adminRole: req.adminRole,
        targetEntityType: 'blind_box_pre_attendance',
        targetEntityId: `${eventId}:${userId}`,
        context: { eventId, userId, newStatus: status },
      });

      res.json({ success: true, status });
    } catch (error) {
      logger.error("Error overriding attendance", { error: String(error) });
      res.status(500).json({ message: "Failed to override attendance status" });
    }
  });
}
