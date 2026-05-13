import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = async (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
