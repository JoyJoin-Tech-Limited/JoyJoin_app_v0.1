import type { Express } from "express";
import { z } from "zod";
import { db } from "../../db";
import { eq, desc, sql } from "drizzle-orm";
import { referralCodes, referralConversions, users, invitations } from "@shared/schema";
import { requireAuth } from "../../middleware/auth";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";

const invitationSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  message: z.string().optional(),
});

export function registerReferralRoutes(app: Express): void {
  // ============ INVITATION SYSTEM ROUTES ============

  const WECHAT_APPID = process.env.WECHAT_APPID ?? '';

  function generateInviteCode(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  function buildInviteLink(code: string): string {
    return `weixin://dl/business/?appid=${WECHAT_APPID}&path=pages/pool-registration/index&query=invitationCode%3D${encodeURIComponent(code)}`;
  }

  // POST /api/events/:id/create-invitation - Generate invitation link
  app.post('/api/events/:id/create-invitation', requireAuth, async (req: any, res) => {
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
          inviteLink: buildInviteLink(existingInvite.code),
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
        inviteLink: buildInviteLink(invitation.code),
      });
    } catch (error: any) {
      logger.error("Error creating invitation", { error: String(error) });
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  // ============ User Referral System API ============

  // GET /api/referrals/stats - Get user's referral code and stats
  app.get('/api/referrals/stats', requireAuth, async (req: any, res) => {
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
        platformTotal,
        inviteLink: buildInviteLink(existingCode.code),
      });
    } catch (error: any) {
      logger.error("Error fetching referral stats", { error: String(error) });
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
      logger.error("Error checking referral code", { error: String(error) });
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
      logger.error("Error fetching referral", { error: String(error) });
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
      logger.error("Error fetching invitation", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch invitation" });
    }
  });

}
