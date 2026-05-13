import { logger } from "../../lib/logger";
import type { Express } from "express";
import { requireAuth } from "../../middleware/auth";
import socialIcebreakerRoutes from "../socialIcebreaker";
import ttsRoutes from "../tts";
import miniscriptRoutes from "./miniscript";

export function registerIcebreakerRoutes(app: Express): void {
  app.use('/api/social-icebreaker', requireAuth, socialIcebreakerRoutes);
  app.use('/api/miniscript', requireAuth, miniscriptRoutes);
  app.use('/api/tts', requireAuth, ttsRoutes);
}
