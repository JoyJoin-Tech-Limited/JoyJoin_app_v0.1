import type { Request, Response, NextFunction } from "express";
import { describe, expect, it, vi } from "vitest";
import { requireAuth } from "../phoneAuth";

function mockReq(session: Record<string, unknown> | undefined): Partial<Request> {
  return { session: session as any };
}

function mockRes(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
}

const mockNext = vi.fn() as NextFunction;

describe("requireAuth middleware", () => {
  it("calls next() when session has userId", async () => {
    const req = mockReq({ userId: "user-123" }) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when session has no userId", async () => {
    const req = mockReq({}) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });

  it("returns 401 when session is undefined", async () => {
    const req = mockReq(undefined) as Request;
    const res = mockRes() as Response;
    const next = vi.fn() as NextFunction;

    await requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized" });
  });
});
