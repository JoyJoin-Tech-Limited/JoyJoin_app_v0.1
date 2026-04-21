import type { Express } from "express";
import { isPhoneAuthenticated } from "../../phoneAuth";
import socialIcebreakerRoutes from "../socialIcebreaker";
import ttsRoutes from "../tts";
import miniscriptRoutes from "./miniscript";

export function registerIcebreakerRoutes(app: Express): void {
  app.use('/api/social-icebreaker', isPhoneAuthenticated, socialIcebreakerRoutes);
  app.use('/api/miniscript', isPhoneAuthenticated, miniscriptRoutes);
  app.use('/api/tts', isPhoneAuthenticated, ttsRoutes);
}
