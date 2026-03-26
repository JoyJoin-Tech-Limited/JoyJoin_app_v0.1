import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    /** New admin_accounts-based admin session */
    adminAccountId: string;
    /** Cached admin role for quick RBAC checks */
    adminRole: string;
  }
}
