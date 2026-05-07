import type { Express } from "express";
import { z } from "zod";
import { requireAdmin, requireOperatorOrAbove } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { getActingAdminId } from "../../lib/getActingAdminId";
import { logAdminAudit } from "../../lib/adminAuditLogger";
import { storage } from "../../storage";
import { broadcastEventStatusChanged, broadcastAdminAction } from "../../eventBroadcast";
import type { User } from "@shared/schema";

const eventTemplateSchema = z.object({
  name: z.string().min(1),
  eventType: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  timeOfDay: z.string().min(1),
  theme: z.string().optional(),
  genderRestriction: z.string().optional(),
  minAge: z.number().int().optional(),
  maxAge: z.number().int().optional(),
  minParticipants: z.number().int().min(1).default(5),
  maxParticipants: z.number().int().min(1).default(10),
  customPrice: z.number().optional(),
});

const updateEventSchema = z.object({
  status: z.string().optional(),
  reason: z.string().optional(),
}).catchall(z.unknown());

export function registerAdminEventManagementRoutes(app: Express): void {
  // Event Templates - Get all templates
  app.get("/api/admin/event-templates", requireAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
      const templates = (await storage.getAllEventTemplates()).slice(0, limit);
      res.json(templates);
    } catch (error) {
      logger.error("Error fetching event templates", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch event templates" });
    }
  });

  // Event Templates - Create template
  app.post("/api/admin/event-templates", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const parsed = eventTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid template data",
          errors: parsed.error.issues,
        });
      }

      const { name, eventType, dayOfWeek, timeOfDay, theme, genderRestriction, minAge, maxAge, minParticipants, maxParticipants, customPrice } = parsed.data;

      const template = await storage.createEventTemplate({
        name,
        eventType,
        dayOfWeek,
        timeOfDay,
        theme: theme || null,
        genderRestriction: genderRestriction || null,
        minAge: minAge || null,
        maxAge: maxAge || null,
        minParticipants,
        maxParticipants,
        customPrice: customPrice || null,
        isActive: true,
      });

      res.json(template);
    } catch (error) {
      logger.error("Error creating event template", { error: String(error) });
      res.status(500).json({ message: "Failed to create event template" });
    }
  });

  // Event Templates - Update template
  app.patch("/api/admin/event-templates/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const template = await storage.updateEventTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error) {
      logger.error("Error updating event template", { error: String(error) });
      res.status(500).json({ message: "Failed to update event template" });
    }
  });

  // Event Templates - Delete template
  app.delete("/api/admin/event-templates/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      await storage.deleteEventTemplate(req.params.id);
      res.json({ message: "Event template deleted successfully" });
    } catch (error) {
      logger.error("Error deleting event template", { error: String(error) });
      res.status(500).json({ message: "Failed to delete event template" });
    }
  });

  // Event Management - Get event (admin view)
  app.get("/api/admin/events/:id", requireAdmin, async (req, res) => {
    try {
      const event = await storage.getBlindBoxEventAdmin(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      logger.error("Error fetching event", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  // Event Management - Update event status
  app.patch("/api/admin/events/:id", requireAdmin, requireOperatorOrAbove, async (req, res) => {
    try {
      const eventId = req.params.id;
      const user = req.user as User;

      const parsed = updateEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid update data",
          errors: parsed.error.issues,
        });
      }

      const oldEvent = await storage.getBlindBoxEventAdmin(eventId);
      if (!oldEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      const updatedEvent = await storage.updateBlindBoxEventAdmin(eventId, parsed.data);

      if (parsed.data.status && parsed.data.status !== oldEvent.status) {
        await broadcastEventStatusChanged(
          eventId,
          oldEvent.status,
          parsed.data.status,
          user.id,
          parsed.data.reason
        );
      }

      if (Object.keys(parsed.data).length > 0 && !parsed.data.status) {
        await broadcastAdminAction(
          eventId,
          "update_event",
          user.id,
          parsed.data
        );
      }

      if (parsed.data.status && parsed.data.status !== oldEvent.status) {
        logAdminAudit({
          action: "EVENT_STATUS_CHANGED",
          adminId: getActingAdminId(req),
          adminRole: (req as any).adminRole,
          targetEntityType: "event",
          targetEntityId: eventId,
          before: { status: oldEvent.status },
          after: { status: parsed.data.status },
          context: { reason: parsed.data.reason },
        });
      }

      res.json(updatedEvent);
    } catch (error) {
      logger.error("Error updating event", { eventId: req.params.id, error: String(error) });
      res.status(500).json({ message: "Failed to update event" });
    }
  });
}
