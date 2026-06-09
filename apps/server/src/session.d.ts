import "express-session";
import type { AdminAccount } from "@shared/schema";

type AdminRole = AdminAccount["role"];

declare module "express-session" {
  interface SessionData {
    userId?: string;
    adminAccountId?: string;
    adminRole?: AdminRole;
    verifiedPhoneNumber?: string;
    debugTest?: number;
    isAdmin?: boolean;
    oauthState?: string;
    pendingReferralCode?: string;
  }
}

declare module "@napi-rs/canvas" {
  export function createCanvas(width: number, height: number): any;
  export function loadImage(src: string | Buffer): Promise<any>;
  export const GlobalFonts: {
    register(fontPath: string, name?: string): void;
    families: string[];
  };
  export type SKRSContext2D = any;
  export function clearAllCache(): void;
}

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
    adminAccount?: AdminAccount;
    adminRole?: AdminRole;
  }
}
