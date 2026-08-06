import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkTextWithMsgSecCheck,
  getWechatAccessToken,
  resetWechatAccessTokenCache,
  warmWechatAccessToken,
  mapLabel,
  severityForLabel,
} from "../lib/wechatMsgSecCheck";

const originalEnv = { ...process.env };

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("wechatMsgSecCheck", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetWechatAccessTokenCache();
    process.env.WECHAT_APPID = "appid-test";
    process.env.WECHAT_SECRET = "secret-test";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getWechatAccessToken", () => {
    it("fetches and caches the token", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "tok-1", expires_in: 7200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const first = await getWechatAccessToken();
      expect(first).toBe("tok-1");

      const second = await getWechatAccessToken();
      expect(second).toBe("tok-1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns null when env credentials are missing", async () => {
      delete process.env.WECHAT_APPID;
      delete process.env.WECHAT_SECRET;
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(await getWechatAccessToken()).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns null and does not cache when the API errors", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ errcode: -1, errmsg: "boom" }),
      );
      vi.stubGlobal("fetch", fetchMock);

      expect(await getWechatAccessToken()).toBeNull();
      expect(await getWechatAccessToken()).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe("checkTextWithMsgSecCheck", () => {
    it("returns risky for errcode 87014 with mapped violation", async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-1", expires_in: 7200 }))
        .mockResolvedValueOnce(
          jsonResponse({ errcode: 87014, errmsg: "risky", result: { suggest: "risky", label: 20003 } }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const verdict = await checkTextWithMsgSecCheck("some bad text", "openid-1");
      expect(verdict).not.toBeNull();
      expect(verdict!.risky).toBe(true);
      expect(verdict!.violationType).toBe("pornographic");
      expect(verdict!.severity).toBe("severe");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("returns risky for suggest=risky without 87014", async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-1", expires_in: 7200 }))
        .mockResolvedValueOnce(
          jsonResponse({ errcode: 0, result: { suggest: "risky", label: 20004 } }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const verdict = await checkTextWithMsgSecCheck("abusive text", "openid-1");
      expect(verdict!.risky).toBe(true);
      expect(verdict!.violationType).toBe("harassment");
      expect(verdict!.severity).toBe("warning");
    });

    it("passes clean text", async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-1", expires_in: 7200 }))
        .mockResolvedValueOnce(jsonResponse({ errcode: 0, result: { suggest: "pass" } }));
      vi.stubGlobal("fetch", fetchMock);

      const verdict = await checkTextWithMsgSecCheck("clean text", "openid-1");
      expect(verdict).not.toBeNull();
      expect(verdict!.risky).toBe(false);
    });

    it("refreshes the token once and retries on 42001", async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-stale", expires_in: 7200 }))
        .mockResolvedValueOnce(jsonResponse({ errcode: 42001, errmsg: "token expired" }))
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-fresh", expires_in: 7200 }))
        .mockResolvedValueOnce(jsonResponse({ errcode: 0, result: { suggest: "pass" } }));
      vi.stubGlobal("fetch", fetchMock);

      const verdict = await checkTextWithMsgSecCheck("text", "openid-1");
      expect(verdict!.risky).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("fails open on unexpected errcode", async () => {
      const fetchMock = vi.fn();
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: "tok-1", expires_in: 7200 }))
        .mockResolvedValueOnce(jsonResponse({ errcode: 45009, errmsg: "rate limit" }));
      vi.stubGlobal("fetch", fetchMock);

      expect(await checkTextWithMsgSecCheck("text", "openid-1")).toBeNull();
    });

    it("fails open on transport error", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
      vi.stubGlobal("fetch", fetchMock);

      expect(await checkTextWithMsgSecCheck("text", "openid-1")).toBeNull();
    });

    it("returns null for empty content", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      expect(await checkTextWithMsgSecCheck("   ", "openid-1")).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("skips (fail-open) >5000-char content with an explicit warn log, no msgSecCheck call", async () => {
      const { logger } = await import("../lib/logger");
      const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const longText = "x".repeat(5001);
      const verdict = await checkTextWithMsgSecCheck(longText, "openid-1", {
        field: "bio",
        userId: "u1",
      });

      expect(verdict).toBeNull();
      // The WeChat client is never invoked for over-limit content.
      expect(fetchMock).not.toHaveBeenCalled();
      // The skip is loud: audit trail distinguishes "skipped: too long" from "clean".
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("5000-char limit"),
        expect.objectContaining({ length: 5001, field: "bio", userId: "u1" }),
      );
      warnSpy.mockRestore();
    });
  });

  describe("warmWechatAccessToken", () => {
    it("pre-warms the token in the background without a critical-path round-trip", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "tok-warm", expires_in: 7200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      warmWechatAccessToken();
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

      const token = await getWechatAccessToken();
      expect(token).toBe("tok-warm");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when a fresh token is already cached", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse({ access_token: "tok-1", expires_in: 7200 }),
      );
      vi.stubGlobal("fetch", fetchMock);

      await getWechatAccessToken();
      warmWechatAccessToken();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("label mapping", () => {
    it("maps known labels to violation types", () => {
      expect(mapLabel(20003)).toBe("pornographic");
      expect(mapLabel(20004)).toBe("harassment");
      expect(mapLabel(20002)).toBe("political");
      expect(mapLabel(20011)).toBe("illegal");
      expect(mapLabel(20001)).toBe("spam");
      expect(mapLabel(99999)).toBe("harassment");
      expect(mapLabel(undefined)).toBe("harassment");
    });

    it("marks severe labels", () => {
      expect(severityForLabel(20003)).toBe("severe");
      expect(severityForLabel(20004)).toBe("warning");
      expect(severityForLabel(undefined)).toBe("warning");
    });
  });
});
