import type { Request, Response } from "express";

export function getAuthenticatedUserId(req: Request): string | null {
  const anyReq = req as any;
  const session = anyReq.session;
  const reqUser = anyReq.user;

  return reqUser?.id ?? session?.userId ?? session?.user?.id ?? null;
}

export function requireAuthenticatedUserId(req: Request, res: Response): string | null {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }

  return userId;
}
