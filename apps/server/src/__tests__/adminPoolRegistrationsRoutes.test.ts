/**
 * Route tests for POST /api/admin/pool-registrations/:id/cancel.
 *
 * Verifies the admin wrapper contract: Zod reason validation, owner
 * resolution before delegating to the SHARED orchestrator (unchanged),
 * orchestrator result passthrough, and the admin audit
 * entry carrying identity + reason.
 */

import express from "express";
import { withServerForApp as withServer } from "../test-utils/withServer";
import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  selectResults: [] as any[][],
  mockCancel: null as any,
  mockAudit: null as any,
}));

vi.mock("../db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(h.selectResults.shift() ?? []),
        }),
      }),
    }),
  },
}));

vi.mock("../lib/poolRegistrationCancel", () => ({
  cancelPoolRegistrationWithPolicy: (...args: unknown[]) => h.mockCancel(...args),
}));

vi.mock("../lib/adminAuditLogger", () => ({
  logAdminAudit: (...args: unknown[]) => h.mockAudit(...args),
}));

vi.mock("../adminAuth", async () => {
  const actual = await vi.importActual<typeof import("../adminAuth")>("../adminAuth");
  return {
    ...actual,
    requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireOperatorOrAbove: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })),
  },
}));

const { registerAdminPoolRegistrationRoutes } = await import("../routes/domains/adminPoolRegistrations");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  registerAdminPoolRegistrationRoutes(app);
  return app;
}

const SUCCESS_RESULT = {
  ok: true,
  branch: "legacy",
  registrationId: "reg-1",
  poolId: "pool-1",
  refundedMoney: false,
  reversedCredit: false,
  alreadyRefunded: false,
  remainingCount: null,
  collapsed: false,
};

describe("POST /api/admin/pool-registrations/:id/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.selectResults.length = 0;
    h.mockCancel = vi.fn().mockResolvedValue(SUCCESS_RESULT);
    h.mockAudit = vi.fn();
  });

  it("rejects a missing/short reason with 400", async () => {
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/pool-registrations/reg-1/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "bad" }),
      });
      expect(res.status).toBe(400);
      expect(h.mockCancel).not.toHaveBeenCalled();
    });
  });

  it("404s when the registration does not exist", async () => {
    h.selectResults.push([]);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/pool-registrations/reg-1/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "no-show abuse" }),
      });
      expect(res.status).toBe(404);
      expect(h.mockCancel).not.toHaveBeenCalled();
    });
  });

  it("delegates to the shared orchestrator with the OWNER userId and audits", async () => {
    h.selectResults.push([{ id: "reg-1", userId: "owner-1", poolId: "pool-1" }]);
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/pool-registrations/reg-1/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "duplicate payment refund" }),
      });
      expect(res.status).toBe(200);

      expect(h.mockCancel).toHaveBeenCalledWith({
        registrationId: "reg-1",
        userId: "owner-1",
        logPrefix: "[AdminPoolRegistrationCancel]",
      });

      const body = (await res.json()) as any;
      expect(body.branch).toBe("legacy");
      // cancelPolicy is user-facing vocabulary ("refundable"/"non_refundable")
      // and must NOT be overloaded with the orchestrator branch name.
      expect(body.cancelPolicy).toBeUndefined();

      expect(h.mockAudit).toHaveBeenCalledTimes(1);
      const audit = h.mockAudit.mock.calls[0][0];
      expect(audit.action).toBe("POOL_REGISTRATION_CANCELLED_BY_ADMIN");
      expect(audit.targetEntityType).toBe("event_pool_registration");
      expect(audit.targetEntityId).toBe("reg-1");
      expect(audit.context.reason).toBe("duplicate payment refund");
      expect(audit.context.userId).toBe("owner-1");
      expect(audit.context.branch).toBe("legacy");
    });
  });

  it("passes through orchestrator failure status + message", async () => {
    h.selectResults.push([{ id: "reg-1", userId: "owner-1", poolId: "pool-1" }]);
    h.mockCancel.mockResolvedValueOnce({
      ok: false,
      status: 502,
      message: "退款失败，报名记录已保留，请稍后重试",
      code: "REFUND_FAILED_RETRYABLE",
    });
    await withServer(buildTestApp(), async (base) => {
      const res = await fetch(`${base}/api/admin/pool-registrations/reg-1/cancel`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: "duplicate payment refund" }),
      });
      expect(res.status).toBe(502);
      const body = (await res.json()) as any;
      expect(body.code).toBe("REFUND_FAILED_RETRYABLE");
      expect(h.mockAudit).not.toHaveBeenCalled();
    });
  });
});
