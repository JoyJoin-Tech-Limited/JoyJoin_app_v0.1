import type { Express } from "express";
import { requireAdmin } from "../../adminAuth";
import { logger } from "../../lib/logger";
import { storage } from "../../storage";

export function registerTelemetryRoutes(app: Express): void {
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
      logger.error("Error creating registration session", { error: String(error) });
      res.status(500).json({ message: "Failed to create session" });
    }
  });
  
  // Update registration session (lifecycle updates)
  app.patch('/api/registration/sessions/:id', async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
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
      logger.error("Error updating registration session", { error: String(error) });
      res.status(500).json({ message: "Failed to update session" });
    }
  });
  
  // Get registration session stats (admin endpoint)
  app.get('/api/registration/sessions/stats', requireAdmin, async (req: any, res) => {
    try {
      const stats = await storage.getRegistrationSessionStats();
      res.json(stats);
    } catch (error) {
      logger.error("Error getting registration session stats", { error: String(error) });
      res.status(500).json({ message: "Failed to get stats" });
    }
  });
}
