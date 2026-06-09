import type { Request } from "express";

export interface LoginResult {
  success: boolean;
  user?: Record<string, unknown>;
  sessionToken?: string;
  error?: string;
}

export interface AuthStrategy {
  login(req: Request, credentials: Record<string, unknown>): Promise<LoginResult>;
}
