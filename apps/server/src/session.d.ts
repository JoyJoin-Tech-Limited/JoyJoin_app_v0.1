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

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
    adminAccount?: AdminAccount;
    adminRole?: AdminRole;
  }
}
