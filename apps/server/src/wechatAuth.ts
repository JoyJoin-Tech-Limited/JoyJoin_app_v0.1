import type { Express } from "express";
import { storage } from "./storage";
import { assessmentSessions } from "@shared/schema";
import { db } from "./db";
import { findBestMatchingArchetypesV2 } from "@shared/personality/matcherV2";

const DEBUG_AUTH = process.env.DEBUG_AUTH === "1";

/**
 * Exchange a WeChat Mini Program login code for an openid.
 * In development (NODE_ENV !== 'production'), uses the code directly as a mock openid.
 * In production, calls the WeChat jscode2session API.
 */
async function getWechatOpenId(
  code: string
): Promise<{ openid: string; session_key: string }> {
  if (process.env.NODE_ENV !== "production") {
    return {
      openid: `mock_openid_${code}`,
      session_key: `mock_session_${Date.now()}`,
    };
  }

  const appid = process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_SECRET;

  if (!appid || !secret) {
    throw Object.assign(
      new Error("Server configuration error: WeChat credentials missing"),
      { code: "WECHAT_CONFIG_ERROR" }
    );
  }

  const url =
    `https://api.weixin.qq.com/sns/jscode2session` +
    `?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&js_code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`;

  const wechatRes = await fetch(url);
  const wechatData = (await wechatRes.json()) as {
    openid?: string;
    session_key?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (wechatData.errcode) {
    console.error("[WeChat Auth] jscode2session error:", wechatData);
    throw Object.assign(
      new Error(wechatData.errmsg || "WeChat authentication failed"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  if (!wechatData.openid) {
    throw Object.assign(
      new Error("WeChat authentication failed: no openid returned"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  return {
    openid: wechatData.openid,
    session_key: wechatData.session_key ?? "",
  };
}

/**
 * Find or create a user by WeChat openid, updating the session key if existing.
 */
async function findOrCreateWechatUser(
  openid: string,
  session_key: string
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof storage.getUserByWechatOpenId>>>; isNewUser: boolean }> {
  let existingUser = await storage.getUserByWechatOpenId(openid);

  if (!existingUser) {
    const newUser = await storage.createUserWithWechat({
      wechatOpenId: openid,
      wechatSessionKey: session_key,
    });
    console.log(`[WeChat Auth] Created new user via WeChat: ${newUser.id}`);
    return { user: newUser, isNewUser: true };
  }

  await storage.updateUser(existingUser.id, { wechatSessionKey: session_key });
  console.log(`[WeChat Auth] Updated session for existing user: ${existingUser.id}`);
  // Re-fetch to get updated data
  const updated = await storage.getUserById(existingUser.id);
  return { user: updated ?? existingUser, isNewUser: false };
}

/**
 * Process test answers and update the user's personality archetype.
 * Returns the updated user (refreshed from DB).
 */
async function processTestAnswers(
  userId: string,
  testAnswers: unknown[]
): Promise<void> {
  if (!Array.isArray(testAnswers) || testAnswers.length === 0) return;

  console.log(
    `[WeChat Auth] Processing ${testAnswers.length} test answers for user ${userId}`
  );

  const traitScores: Record<string, number> = {
    A: 0, C: 0, E: 0, O: 0, X: 0, P: 0,
  };

  for (let i = 0; i < testAnswers.length; i++) {
    const answer = testAnswers[i] as any;
    if (!answer || typeof answer !== "object") {
      console.warn(
        `[WeChat Auth] Skipping invalid test answer at index ${i} for user ${userId}`
      );
      continue;
    }
    try {
      if (answer.traitScores && typeof answer.traitScores === "object") {
        Object.keys(answer.traitScores).forEach((trait: string) => {
          if (Object.prototype.hasOwnProperty.call(traitScores, trait)) {
            const delta = answer.traitScores[trait];
            if (typeof delta === "number" && !Number.isNaN(delta)) {
              traitScores[trait] += delta;
            }
          }
        });
      }
    } catch (err) {
      console.error(
        `[WeChat Auth] Failed to process test answer at index ${i} for user ${userId}:`,
        err
      );
    }
  }

  // Normalize to 0-100 range
  Object.keys(traitScores).forEach((trait) => {
    traitScores[trait] = Math.max(0, Math.min(100, 50 + traitScores[trait]));
  });

  const matchResults = findBestMatchingArchetypesV2(
    traitScores as any,
    undefined,
    3
  );

  const primaryArchetype = matchResults[0]?.archetype ?? "开心柯基";
  const secondaryArchetype = matchResults[1]?.archetype ?? "太阳鸡";

  const HIGH_CONFIDENCE_THRESHOLD = 0.8;
  const DECISIVE_SCORE_DIFFERENCE_THRESHOLD = 10;
  const DEFAULT_TRAIT_CONFIDENCE = Math.min(
    0.85,
    0.5 + testAnswers.length / 100
  );

  const traitConfidences: Record<
    string,
    { score: number; confidence: number; sampleCount: number }
  > = {};
  Object.keys(traitScores).forEach((trait) => {
    traitConfidences[trait] = {
      score: traitScores[trait],
      confidence: DEFAULT_TRAIT_CONFIDENCE,
      sampleCount: testAnswers.length,
    };
  });

  const matchDetailsJson = {
    primaryArchetype,
    secondaryArchetype,
    traitDeltas: traitScores,
    decisiveReason:
      (matchResults[0]?.confidence ?? 0) > HIGH_CONFIDENCE_THRESHOLD
        ? "high_confidence"
        : "normal",
    score: matchResults[0]?.score ?? 0,
  };

  const isDecisive =
    (matchResults[0]?.confidence ?? 0) > HIGH_CONFIDENCE_THRESHOLD &&
    ((matchResults[0]?.score ?? 0) - (matchResults[1]?.score ?? 0)) >
      DECISIVE_SCORE_DIFFERENCE_THRESHOLD;

  await db.insert(assessmentSessions).values({
    userId,
    phase: "completed",
    currentQuestionIndex: testAnswers.length,
    traitScores: traitScores as any,
    traitConfidences: traitConfidences as any,
    topArchetypes: matchResults.map((r) => ({
      archetype: r.archetype,
      score: r.score,
      confidence: r.confidence,
    })) as any,
    algorithmVersion: "v2",
    matchDetailsJson: matchDetailsJson as any,
    primaryArchetype,
    isDecisive,
    completedAt: new Date(),
    createdAt: new Date(),
  });

  await storage.updateUser(userId, {
    hasCompletedPersonalityTest: true,
    archetype: primaryArchetype,
    primaryArchetype,
    secondaryArchetype,
  } as any);

  console.log(
    `[WeChat Auth] Saved personality test results for user ${userId}: ${primaryArchetype}`
  );
}

export function setupWechatAuth(app: Express) {
  /**
   * POST /api/auth/wechat/login-with-test
   * WeChat Mini Program authentication with optional personality test answers.
   * Used after the pre-signup personality test flow.
   */
  app.post("/api/auth/wechat/login-with-test", async (req: any, res) => {
    try {
      const { code, testAnswers } = req.body;

      if (!code) {
        return res.status(400).json({ error: "WeChat code is required" });
      }

      const { openid, session_key } = await getWechatOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(
        openid,
        session_key
      );

      if (testAnswers && Array.isArray(testAnswers) && testAnswers.length > 0) {
        await processTestAnswers(user.id, testAnswers);
      }

      // Fetch updated full user record
      const fullUser = (await storage.getUserById(user.id)) ?? user;

      if (DEBUG_AUTH) {
        console.log("[WeChat Auth] before session save", {
          userId: fullUser.id,
          sid: req.sessionID,
        });
      }

      req.session.userId = fullUser.id;
      req.session.save(async (err: any) => {
        if (DEBUG_AUTH) {
          console.log("[WeChat Auth] after session save", {
            err: err ? String(err) : null,
            sid: req.sessionID,
            setCookie: res.getHeader("set-cookie") || null,
          });
        }

        if (err) {
          console.error("[WeChat Auth] Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        
        console.log(
          "[WeChat Auth] Session saved successfully! sessionID:",
          req.sessionID
        );

        res.json({
          success: true,
          isNewUser,
          user: fullUser,
        });
      });
    } catch (error) {
      const err: any = error;
      console.error("[WeChat Auth] Error during WeChat login-with-test:", {
        message: err?.message,
        code: err?.code,
        name: err?.name,
        stack: err?.stack,
      });

      let status = 500;
      let errorCode = "AUTH_SERVER_ERROR";
      let clientMessage = "Server error during authentication";

      if (err?.code === "WECHAT_AUTH_FAILED") {
        status = 401;
        errorCode = "WECHAT_AUTH_FAILED";
        clientMessage = "WeChat authentication failed";
      } else if (err?.code === "INVALID_TEST_RESULTS") {
        status = 400;
        errorCode = "INVALID_TEST_RESULTS";
        clientMessage = "Invalid test results";
      } else if (err?.code === "DB_ERROR") {
        status = 503;
        errorCode = "DB_ERROR";
        clientMessage = "Database error";
      }

      res.status(status).json({ error: clientMessage, code: errorCode });
    }
  });

  /**
   * POST /api/auth/wechat/login
   * WeChat Mini Program authentication for returning users (no test answers needed).
   */
  app.post("/api/auth/wechat/login", async (req: any, res) => {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: "WeChat code is required" });
      }

      const { openid, session_key } = await getWechatOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(
        openid,
        session_key
      );

      const fullUser = (await storage.getUserById(user.id)) ?? user;

      req.session.userId = fullUser.id;
      req.session.save((err: any) => {
        if (err) {
          console.error("[WeChat Auth] Session save error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }

        res.json({
          success: true,
          isNewUser,
          user: fullUser,
        });
      });
    } catch (error) {
      const err: any = error;
      console.error("[WeChat Auth] Error during WeChat login:", {
        message: err?.message,
        code: err?.code,
        name: err?.name,
        stack: err?.stack,
      });

      let status = 500;
      let clientMessage = "Server error during authentication";

      if (err?.code === "WECHAT_AUTH_FAILED") {
        status = 401;
        clientMessage = "WeChat authentication failed";
      }

      res.status(status).json({ error: clientMessage });
    }
  });
}
