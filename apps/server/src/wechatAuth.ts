import type { Express } from "express";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { assessmentSessions, assessmentAnswers, users } from "@shared/schema";
import { db } from "./db";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { findBestMatchingArchetypesV2 } from "@shared/personality/matcherV2";

const DEBUG_AUTH = process.env.DEBUG_AUTH === "1";
const MAX_ERROR_BODY_LOG_LENGTH = 1000;

/**
 * Exchange a WeChat Mini Program login code for an openid.
 * In development (NODE_ENV === 'development'), uses the code directly as a mock openid.
 * In staging and production, calls the WeChat jscode2session API.
 */
export async function getWechatOpenId(
  code: string
): Promise<{ openid: string; session_key: string }> {
  if (process.env.NODE_ENV === "development") {
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

  if (!wechatRes.ok) {
    let bodyText: string | undefined;
    try {
      bodyText = await wechatRes.text();
    } catch {
      bodyText = undefined;
    }
    console.error("[WeChat Auth] jscode2session HTTP error:", {
      status: wechatRes.status,
      statusText: wechatRes.statusText,
      bodySnippet: bodyText?.slice(0, MAX_ERROR_BODY_LOG_LENGTH),
    });
    throw Object.assign(
      new Error(
        `WeChat authentication HTTP error: ${wechatRes.status} ${wechatRes.statusText}`
      ),
      {
        code: "WECHAT_AUTH_FAILED",
        status: wechatRes.status,
      }
    );
  }

  let wechatData: {
    openid?: string;
    session_key?: string;
    errcode?: number;
    errmsg?: string;
  };

  try {
    wechatData = (await wechatRes.json()) as {
      openid?: string;
      session_key?: string;
      errcode?: number;
      errmsg?: string;
    };
  } catch (err) {
    console.error("[WeChat Auth] Failed to parse jscode2session JSON response:", err);
    throw Object.assign(
      new Error("WeChat authentication failed: invalid JSON response"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

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

  if (!wechatData.session_key) {
    throw Object.assign(
      new Error("WeChat authentication failed: no session_key returned"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  return {
    openid: wechatData.openid,
    session_key: wechatData.session_key,
  };
}

/**
 * Exchange a WeChat OAuth2 web authorization code for an openid.
 * Used by the Official Account (公众号) OAuth2 web flow (`oauth2/authorize`).
 *
 * In development (NODE_ENV === 'development'), uses the code directly as a mock openid
 * so the flow can be exercised without a registered WeChat Official Account callback URL.
 *
 * @taroMigration This function is only called by the server-side OAuth2 callback handler.
 *   The Mini Program / Taro path continues to use `getWechatOpenId` above.
 */
export async function getWechatOAuthOpenId(
  code: string
): Promise<{ openid: string; access_token: string }> {
  if (process.env.NODE_ENV === "development") {
    return {
      openid: `mock_openid_${code}`,
      access_token: `mock_access_token_${Date.now()}`,
    };
  }

  const appid = process.env.WECHAT_OA_APPID ?? process.env.WECHAT_APPID;
  const secret = process.env.WECHAT_OA_SECRET ?? process.env.WECHAT_SECRET;

  if (!appid || !secret) {
    throw Object.assign(
      new Error("Server configuration error: WeChat credentials missing"),
      { code: "WECHAT_CONFIG_ERROR" }
    );
  }

  const url =
    `https://api.weixin.qq.com/sns/oauth2/access_token` +
    `?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&code=${encodeURIComponent(code)}` +
    `&grant_type=authorization_code`;

  const wechatRes = await fetch(url);

  if (!wechatRes.ok) {
    let bodyText: string | undefined;
    try {
      bodyText = await wechatRes.text();
    } catch {
      bodyText = undefined;
    }
    console.error("[WeChat Auth] OAuth2 access_token HTTP error:", {
      status: wechatRes.status,
      statusText: wechatRes.statusText,
      bodySnippet: bodyText?.slice(0, MAX_ERROR_BODY_LOG_LENGTH),
    });
    throw Object.assign(
      new Error(
        `WeChat OAuth2 HTTP error: ${wechatRes.status} ${wechatRes.statusText}`
      ),
      { code: "WECHAT_AUTH_FAILED", status: wechatRes.status }
    );
  }

  let oauthData: {
    access_token?: string;
    openid?: string;
    errcode?: number;
    errmsg?: string;
  };

  try {
    oauthData = (await wechatRes.json()) as {
      access_token?: string;
      openid?: string;
      errcode?: number;
      errmsg?: string;
    };
  } catch (err) {
    console.error("[WeChat Auth] Failed to parse OAuth2 access_token JSON response:", err);
    throw Object.assign(
      new Error("WeChat OAuth2 authentication failed: invalid JSON response"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  if (oauthData.errcode) {
    console.error("[WeChat Auth] OAuth2 access_token error:", oauthData);
    throw Object.assign(
      new Error(oauthData.errmsg || "WeChat OAuth2 authentication failed"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  if (!oauthData.openid || !oauthData.access_token) {
    throw Object.assign(
      new Error("WeChat OAuth2 authentication failed: missing openid or access_token"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  return { openid: oauthData.openid, access_token: oauthData.access_token };
}

/**
 * Find or create a user by WeChat openid.
 * `session_key` is optional: it is present in the Mini Program flow but absent in the
 * OAuth2 web flow. When provided it is persisted so the Mini Program can use it for
 * encrypted-data decryption; when absent the existing value is left unchanged.
 */
export async function findOrCreateWechatUser(
  openid: string,
  session_key?: string
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof storage.getUserByWechatOpenId>>>; isNewUser: boolean }> {
  const existingUser = await storage.getUserByWechatOpenId(openid);

  if (!existingUser) {
    const newUser = await storage.createUserWithWechat({
      wechatOpenId: openid,
      ...(session_key ? { wechatSessionKey: session_key } : {}),
    });
    console.log(`[WeChat Auth] Created new user via WeChat: ${newUser.id}`);
    return { user: newUser, isNewUser: true };
  }

  if (session_key) {
    await storage.updateUser(existingUser.id, { wechatSessionKey: session_key });
  }
  console.log(`[WeChat Auth] Updated session for existing user: ${existingUser.id}`);
  const updated = await storage.getUserById(existingUser.id);
  return { user: updated ?? existingUser, isNewUser: false };
}

/**
 * Process test answers, persist per-question data to assessment_answers, and update the user's
 * personality archetype. All writes are wrapped in a transaction for atomicity.
 */
export async function processTestAnswers(
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

  // Wrap assessment_sessions insert + per-question assessment_answers inserts + user update
  // in a single transaction so a partial failure cannot leave the DB inconsistent.
  await db.transaction(async (tx: NeonDatabase<typeof schema>) => {
    const [session] = await tx.insert(assessmentSessions).values({
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
    }).returning();

    // Persist per-question answers to assessment_answers
    for (const ans of testAnswers as any[]) {
      if (!ans || typeof ans !== "object") continue;
      const questionId = String(ans.questionId ?? ans.question_id ?? ans.id ?? "");
      const selectedOption = String(
        ans.selectedOption ?? ans.value ?? ans.answer ?? ans.selected_option ?? ""
      );
      if (!questionId || !selectedOption) continue;

      await tx.insert(assessmentAnswers).values({
        sessionId: session.id,
        questionId,
        questionLevel: Number(ans.questionLevel ?? ans.question_level ?? 1),
        selectedOption,
        traitScores: ans.traitScores ?? ans.trait_scores ?? {},
      }).onConflictDoUpdate({
        target: [assessmentAnswers.sessionId, assessmentAnswers.questionId],
        set: {
          selectedOption,
          traitScores: ans.traitScores ?? ans.trait_scores ?? {},
          answeredAt: new Date(),
        },
      });
    }

    // Update user flags and archetype within the same transaction
    await tx
      .update(users)
      .set({
        hasCompletedPersonalityTest: true,
        archetype: primaryArchetype,
        primaryArchetype,
        secondaryArchetype,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  });

  console.log(
    `[WeChat Auth] Saved personality test results for user ${userId}: ${primaryArchetype}`
  );
}

export function setupWechatAuth(app: Express) {
  /**
   * GET /api/auth/wechat/oauth/start
   *
   * Step 1 of the WeChat Official Account OAuth2 web login flow.
   * Generates a CSRF state token, saves it to the session, then redirects the browser
   * to WeChat's OAuth consent/authorize page.
   *
   * In development (NODE_ENV === 'development') the WeChat redirect is skipped and
   * the user is bounced directly to the callback with a mock code so the flow can be
   * tested without a registered WeChat Official Account.
   */
  app.get("/api/auth/wechat/oauth/start", (req: any, res) => {
    // APP_URL is the public-facing base URL of the app (e.g. https://yuejuapp.com).
    // Both the frontend and /api/* are served from this same origin via the Caddy reverse
    // proxy, so a single variable covers the OAuth2 redirect_uri and the post-login redirect.
    const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

    const appid = process.env.WECHAT_OA_APPID ?? process.env.WECHAT_APPID;
    if (!appid && process.env.NODE_ENV !== "development") {
      console.error("[WeChat OAuth] Missing WECHAT_OA_APPID / WECHAT_APPID");
      return res.redirect(`${appUrl}/?wechat_oauth_error=config_error`);
    }

    const state = randomUUID();
    req.session.oauthState = state;

    // Persist the state token to the session before redirecting, regardless of
    // whether this is the development shortcut or the real WeChat OAuth path.
    req.session.save((err: any) => {
      if (err) {
        console.error("[WeChat OAuth] Session save error (start):", err);
        return res.redirect(`${appUrl}/?wechat_oauth_error=session_error`);
      }

      // Development shortcut: bypass the real WeChat OAuth redirect so the flow
      // can be exercised locally without a registered Official Account callback URL.
      if (process.env.NODE_ENV === "development") {
        const mockCode = `mock_oauth_code_${randomUUID()}`;
        return res.redirect(
          `${appUrl}/api/auth/wechat/oauth/callback` +
          `?code=${encodeURIComponent(mockCode)}` +
          `&state=${encodeURIComponent(state)}`
        );
      }

      // WeChat Official Account (公众号) OAuth2 web authorization.
      // This flow works inside WeChat's browser (微信内置浏览器) using snsapi_base scope,
      // which performs a silent authorization and returns only the openid — no consent screen.
      //
      // Prerequisites:
      //   - WECHAT_OA_APPID must be the Official Account appid (公众号 AppID), not the
      //     Mini Program appid. They are different credentials for different platforms.
      //   - The "网页授权域名" (webpage authorization domain) in the WeChat OA backend must
      //     include the domain in APP_URL (e.g. yuejuapp.com).
      //
      // Scope options:
      //   snsapi_base   — silent, returns openid only (no user approval screen). ✅ Used here.
      //   snsapi_userinfo — shows consent screen, returns openid + nickname + avatar.
      //
      // Note: this endpoint is for the Official Account web flow only.
      // For PC login via QR scan (开放平台), use the open.weixin.qq.com/connect/qrconnect
      // endpoint with an Open Platform appid — that is a different subtype entirely.
      const callbackUri = `${appUrl}/api/auth/wechat/oauth/callback`;
      const oauthUrl =
        `https://open.weixin.qq.com/connect/oauth2/authorize` +
        `?appid=${encodeURIComponent(appid!)}` +
        `&redirect_uri=${encodeURIComponent(callbackUri)}` +
        `&response_type=code` +
        `&scope=snsapi_base` +
        `&state=${encodeURIComponent(state)}` +
        `#wechat_redirect`;

      console.log("[WeChat OAuth] Redirecting to WeChat OA OAuth2 consent page");
      res.redirect(oauthUrl);
    });
  });

  /**
   * GET /api/auth/wechat/oauth/callback
   *
   * Step 2 of the WeChat Official Account OAuth2 web login flow.
   * WeChat redirects here with `?code=<code>&state=<state>` after user consent.
   * The handler validates the CSRF state, exchanges the code for an openid, finds or
   * creates the user, persists the session, then redirects the browser to the frontend.
   */
  app.get("/api/auth/wechat/oauth/callback", async (req: any, res) => {
    const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
    const { code, state } = req.query as { code?: string; state?: string };

    // CSRF state validation
    const savedState = req.session.oauthState as string | undefined;
    if (!state || !savedState || state !== savedState) {
      console.warn("[WeChat OAuth] Invalid or missing state in callback", {
        received: state,
        expected: savedState,
      });
      return res.redirect(`${appUrl}/?wechat_oauth_error=invalid_state`);
    }
    delete req.session.oauthState;

    if (!code) {
      console.warn("[WeChat OAuth] No code received in callback");
      return res.redirect(`${appUrl}/?wechat_oauth_error=no_code`);
    }

    try {
      const { openid } = await getWechatOAuthOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(openid);

      const fullUser = (await storage.getUserById(user.id)) ?? user;
      req.session.userId = fullUser.id;

      await new Promise<void>((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log(`[WeChat OAuth] Callback login success; userId=${fullUser.id} isNewUser=${isNewUser}`);

      // Let the frontend's AuthenticatedRouter drive navigation via nextStep.
      res.redirect(appUrl);
    } catch (error) {
      const err: any = error;
      console.error("[WeChat OAuth] Callback error:", {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
      res.redirect(`${appUrl}/?wechat_oauth_error=auth_failed`);
    }
  });

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
      } else if (err?.code === "WECHAT_CONFIG_ERROR") {
        status = 500;
        errorCode = "WECHAT_CONFIG_ERROR";
        clientMessage = "Server configuration error";
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

      if (err?.code === "WECHAT_AUTH_FAILED" || err?.code === "WECHAT_CONFIG_ERROR") {
        status = 401;
        clientMessage = "WeChat authentication failed";
      }

      res.status(status).json({ error: clientMessage });
    }
  });
}
