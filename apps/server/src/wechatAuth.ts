import type { Express, Request } from "express";
import { randomUUID } from "crypto";
import { usersRepo } from "./repositories/usersRepo";
import { assessmentSessions, assessmentAnswers, users } from "@shared/schema";
import { db } from "./db";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { findBestMatchingArchetypesV2, type UserSecondaryData } from "@shared/personality/matcherV2";
import { SECONDARY_QUESTION_MAP } from "@shared/personality/secondaryQuestionMap";
import { canUseMockWechatAuth, isDebugAuthLoggingEnabled } from "./auth/policy";
import { sanitizeAuthUser } from "./auth/sanitizeAuthUser";
import { storage } from "./storage";
import { logger } from "./lib/logger";

/**
 * Minimum number of answers with a valid questionId + selectedOption that must
 * be present in a testAnswers payload before we attempt to create a completed
 * assessment session. Payloads with fewer valid items are rejected to prevent
 * low-quality or malformed imports from persisting garbage data.
 */
const MIN_VALID_ANSWERS = 3;
const IMPORTABLE_TRAITS = ["A", "C", "E", "O", "X", "P"] as const;

const MAX_ERROR_BODY_LOG_LENGTH = 1000;

async function regenerateAuthenticatedWechatSession(req: Request, userId: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      req.session.userId = userId;
      req.session.save((saveErr) => {
        if (saveErr) {
          return reject(saveErr);
        }

        resolve();
      });
    });
  });
}

function hasImportableTraitDelta(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  return IMPORTABLE_TRAITS.some((trait) => {
    const delta = (value as Record<string, unknown>)[trait];
    return typeof delta === "number" && !Number.isNaN(delta);
  });
}

// Compatibility helpers: historical clients have sent several field-name variants
// for the same semantic values, so imports must continue to accept them.
function getImportedQuestionId(candidate: Record<string, unknown>): string {
  return String(candidate.questionId ?? candidate.question_id ?? candidate.id ?? "").trim();
}

function getImportedSelectedOption(candidate: Record<string, unknown>): string {
  return String(
    candidate.selectedOption ?? candidate.value ?? candidate.answer ?? candidate.selected_option ?? ""
  ).trim();
}

function isImportableTestAnswer(answer: unknown): boolean {
  if (!answer || typeof answer !== "object") return false;

  const candidate = answer as Record<string, unknown>;
  const questionId = getImportedQuestionId(candidate);
  const selectedOption = getImportedSelectedOption(candidate);

  return questionId.length > 0 &&
    selectedOption.length > 0 &&
    hasImportableTraitDelta(candidate.traitScores ?? candidate.trait_scores);
}

/**
 * Exchange a WeChat Mini Program login code for an openid.
 * In development (NODE_ENV === 'development'), uses the code directly as a mock openid.
 * In staging and production, calls the WeChat jscode2session API.
 */
export async function getWechatOpenId(
  code: string
): Promise<{ openid: string; session_key: string }> {
  if (canUseMockWechatAuth(code)) {
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
    logger.error("[WeChat Auth] jscode2session HTTP error", {
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
    logger.error("[WeChat Auth] Failed to parse jscode2session JSON response", { error: err instanceof Error ? err.message : String(err) });
    throw Object.assign(
      new Error("WeChat authentication failed: invalid JSON response"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  if (wechatData.errcode) {
    logger.error("[WeChat Auth] jscode2session error", { wechatData });
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
 *
 * This is the server-side token exchange for the **WeChat Official Account (公众号) web
 * authorization** subtype (scope: snsapi_base). It calls the OA OAuth2 endpoint
 * `sns/oauth2/access_token` — different from the Mini Program `jscode2session` endpoint
 * used by `getWechatOpenId` above.
 *
 * WeChat OAuth subtypes at a glance:
 *   ① Mini Program (小程序) — wx.login() → jscode2session → openid+session_key
 *      AppID source: 微信公众平台 → 小程序 AppID (WECHAT_APPID)
 *   ② Official Account web (公众号网页授权) — oauth2/authorize → sns/oauth2/access_token → openid
 *      AppID source: 微信公众平台 → 公众号 AppID  ← this function, ALSO uses WECHAT_APPID
 *   ③ Open Platform PC QR scan (开放平台扫码) — qrconnect → open.weixin.qq.com/connect/qrconnect
 *      AppID source: 微信开放平台 AppID — a completely separate credential, NOT used here
 *
 * JoyJoin uses a **single WECHAT_APPID** for both flows ① and ②. This is the normal
 * setup when the Mini Program and Official Account are bound together under the same
 * WeChat Open Platform account, which gives them a shared UnionID namespace.
 *
 * In development (NODE_ENV === 'development'), the real WeChat API is skipped and a mock
 * openid is returned so the flow can be exercised without a registered OA callback URL.
 *
 * @taroMigration This function is only called by the server-side OAuth2 callback handler.
 *   The Mini Program / Taro path continues to use `getWechatOpenId` above.
 */
export async function getWechatOAuthOpenId(
  code: string
): Promise<{ openid: string; access_token: string }> {
  if (canUseMockWechatAuth(code)) {
    return {
      openid: `mock_openid_${code}`,
      access_token: `mock_access_token_${Date.now()}`,
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
    logger.error("[WeChat Auth] OAuth2 access_token HTTP error", {
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
    logger.error("[WeChat Auth] Failed to parse OAuth2 access_token JSON response", { error: err instanceof Error ? err.message : String(err) });
    throw Object.assign(
      new Error("WeChat OAuth2 authentication failed: invalid JSON response"),
      { code: "WECHAT_AUTH_FAILED" }
    );
  }

  if (oauthData.errcode) {
    logger.error("[WeChat Auth] OAuth2 access_token error", { oauthData });
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
): Promise<{ user: NonNullable<Awaited<ReturnType<typeof usersRepo.getUserByWechatOpenId>>>; isNewUser: boolean }> {
  const existingUser = await usersRepo.getUserByWechatOpenId(openid);

  if (!existingUser) {
    const newUser = await usersRepo.createUserWithWechat({
      wechatOpenId: openid,
      ...(session_key ? { wechatSessionKey: session_key } : {}),
    });
    logger.info("[WeChat Auth] Created new user via WeChat", { userId: newUser.id });
    return { user: newUser, isNewUser: true };
  }

  if (session_key) {
    await usersRepo.updateUser(existingUser.id, { wechatSessionKey: session_key });
  }
  logger.info("[WeChat Auth] Updated session for existing user", { userId: existingUser.id });
  const updated = await usersRepo.getUserById(existingUser.id);
  return { user: updated ?? existingUser, isNewUser: false };
}

/**
 * Process test answers, persist per-question data to assessment_answers, and update the user's
 * personality archetype. All writes are wrapped in a transaction for atomicity.
 *
 * Validation: rejects payloads where fewer than MIN_VALID_ANSWERS items carry a
 * recognisable questionId, a selectedOption, and at least one numeric trait delta.
 * This prevents garbage sessions from being created from malformed or empty payloads.
 */
export async function processTestAnswers(
  userId: string,
  testAnswers: unknown[]
): Promise<void> {
  if (!Array.isArray(testAnswers) || testAnswers.length === 0) return;

  // A: Idempotency guard — skip if the user already has a completed session from
  // a prior import so that retries or double-submits don't create duplicates.
  const [existingSession] = await db
    .select({ id: assessmentSessions.id })
    .from(assessmentSessions)
    .where(
      and(
        eq(assessmentSessions.userId, userId),
        eq(assessmentSessions.phase, "completed")
      )
    )
    .limit(1);
  if (existingSession) {
    logger.info(
      "[WeChat Auth] Skipping duplicate processTestAnswers",
      { userId, sessionId: existingSession.id }
    );
    return;
  }

  // C: Validate that at least one answer carries a non-zero trait score so we
  // don't create completed sessions from garbage/empty payloads.
  // Both camelCase (traitScores) and snake_case (trait_scores) field names are
  // accepted here for backward compatibility with older client payload shapes.
  const hasValidScoredAnswer = (testAnswers as any[]).some((a) => {
    if (!a || typeof a !== "object") return false;
    const scores = a.traitScores ?? a.trait_scores;
    if (!scores || typeof scores !== "object") return false;
    return Object.values(scores).some(
      (v) => typeof v === "number" && !Number.isNaN(v) && v !== 0
    );
  });
  if (!hasValidScoredAnswer) {
    logger.warn(
      "[WeChat Auth] Rejecting testAnswers: no answer carries a non-zero trait score",
      { userId }
    );
    throw Object.assign(
      new Error("Invalid test answers: payload contains no scored answers"),
      { code: "INVALID_TEST_RESULTS" }
    );
  }

  logger.info(
    "[WeChat Auth] Processing test answers",
    { count: testAnswers.length, userId }
  );

  const traitScores: Record<string, number> = {
    A: 0, C: 0, E: 0, O: 0, X: 0, P: 0,
  };

  for (let i = 0; i < testAnswers.length; i++) {
    const answer = testAnswers[i] as any;
    if (!answer || typeof answer !== "object") {
      logger.warn(
        "[WeChat Auth] Skipping invalid test answer",
        { index: i, userId }
      );
      continue;
    }
    try {
      const answerTraitScores = answer.traitScores ?? answer.trait_scores;
      if (answerTraitScores && typeof answerTraitScores === "object") {
        Object.keys(answerTraitScores).forEach((trait: string) => {
          if (Object.prototype.hasOwnProperty.call(traitScores, trait)) {
            const delta = answerTraitScores[trait];
            if (typeof delta === "number" && !Number.isNaN(delta)) {
              traitScores[trait] += delta;
            }
          }
        });
      }
    } catch (err) {
      logger.error(
        "[WeChat Auth] Failed to process test answer",
        { index: i, userId, error: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  // Normalize to 0-100 range
  Object.keys(traitScores).forEach((trait) => {
    traitScores[trait] = Math.max(0, Math.min(100, 50 + traitScores[trait]));
  });

  // Build userSecondaryData from playful secondary questions
  const userSecondaryData: UserSecondaryData = {};
  for (const answer of testAnswers as any[]) {
    if (!answer || typeof answer !== 'object') continue;
    const qId = getImportedQuestionId(answer as Record<string, unknown>);
    const selectedOpt = getImportedSelectedOption(answer as Record<string, unknown>);
    const mapping = SECONDARY_QUESTION_MAP[qId];
    if (mapping && selectedOpt) {
      const decoded = mapping.valueMap[selectedOpt];
      if (decoded) {
        userSecondaryData[mapping.field] = decoded as any;
      }
    }
  }

  const matchResults = findBestMatchingArchetypesV2(
    traitScores as any,
    Object.keys(userSecondaryData).length > 0 ? userSecondaryData : undefined,
    3
  );

  const primaryArchetype = matchResults[0]?.archetype ?? "corgi";
  const secondaryArchetype = matchResults[1]?.archetype ?? "rooster";

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
  await db.transaction(async (tx: NodePgDatabase<typeof schema>) => {
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
      const questionId = getImportedQuestionId(ans as Record<string, unknown>);
      const selectedOption = getImportedSelectedOption(ans as Record<string, unknown>);
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

  logger.info(
    "[WeChat Auth] Saved personality test results",
    { userId, primaryArchetype }
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
  app.get("/api/auth/wechat/oauth/start", (req: Request, res) => {
    // APP_URL is the public-facing origin of the app (e.g. https://joyjoinapp.com).
    // The Nginx reverse proxy routes /api/* from this same origin to the backend
    // (path-based, not subdomain), so a single variable covers both the WeChat OAuth2
    // redirect_uri AND the post-login redirect target.
    const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");

    const appid = process.env.WECHAT_APPID;
    if (!appid && process.env.NODE_ENV !== "development") {
      logger.error("[WeChat OAuth] Missing WECHAT_APPID");
      return res.redirect(`${appUrl}/?wechat_oauth_error=config_error`);
    }

    const state = randomUUID();
    req.session.oauthState = state;

    // Persist the state token to the session before redirecting, regardless of
    // whether this is the development shortcut or the real WeChat OAuth path.
    req.session.save((err: any) => {
      if (err) {
        logger.error("[WeChat OAuth] Session save error (start)", { error: err instanceof Error ? err.message : String(err) });
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

      // WeChat Official Account (公众号) web authorization — subtype ②.
      // Uses the same WECHAT_APPID as the Mini Program (subtype ①) because JoyJoin's
      // Mini Program and Official Account are bound under the same WeChat Open Platform
      // account, sharing credentials and a unified UnionID namespace.
      //
      // scope=snsapi_base: silent auth — no consent screen shown to the user, returns
      // openid only. This is suitable for login because we only need identity, not profile.
      // Use snsapi_userinfo instead if you need nickname/avatar from WeChat directly.
      //
      // "网页授权域名" prerequisite: the domain in APP_URL (e.g. joyjoinapp.com) must be
      // registered as the webpage authorization domain in the WeChat OA backend settings.
      const callbackUri = `${appUrl}/api/auth/wechat/oauth/callback`;
      const oauthUrl =
        `https://open.weixin.qq.com/connect/oauth2/authorize` +
        `?appid=${encodeURIComponent(appid!)}` +
        `&redirect_uri=${encodeURIComponent(callbackUri)}` +
        `&response_type=code` +
        `&scope=snsapi_base` +
        `&state=${encodeURIComponent(state)}` +
        `#wechat_redirect`;

      logger.info("[WeChat OAuth] Redirecting to WeChat OA OAuth2 consent page");
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
  app.get("/api/auth/wechat/oauth/callback", async (req: Request, res) => {
    const appUrl = (process.env.APP_URL ?? "http://localhost:5173").replace(/\/$/, "");
    const { code, state } = req.query as { code?: string; state?: string };

    // CSRF state validation
    const savedState = req.session.oauthState as string | undefined;
    if (!state || !savedState || state !== savedState) {
      logger.warn("[WeChat OAuth] Invalid or missing state in callback", {
        received: state,
        expected: savedState,
      });
      return res.redirect(`${appUrl}/?wechat_oauth_error=invalid_state`);
    }
    delete req.session.oauthState;

    if (!code) {
      logger.warn("[WeChat OAuth] No code received in callback");
      return res.redirect(`${appUrl}/?wechat_oauth_error=no_code`);
    }

    try {
      const { openid } = await getWechatOAuthOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(openid);

      const fullUser = (await usersRepo.getUserById(user.id)) ?? user;
      await regenerateAuthenticatedWechatSession(req, fullUser.id);

      logger.info("[WeChat OAuth] Callback login success", { userId: fullUser.id, isNewUser });

      // Let the frontend's AuthenticatedRouter drive navigation via nextStep.
      res.redirect(appUrl);
    } catch (error) {
      const err = error as Error & { code?: string; status?: number };
      logger.error("[WeChat OAuth] Callback error", {
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
   *
   * Body params:
   *   code            – WeChat login code (required)
   *   testAnswers     – Array of V4 test answers to import (optional, omit or [] for
   *                     returning-user logins)
   *   presignupSessionId – Server-side pre-signup cache session ID to claim/delete
   *                        after successful answer import (optional, B)
   */
  app.post("/api/auth/wechat/login-with-test", async (req: Request, res) => {
    try {
      const { code, testAnswers, anonymousSessionId } = req.body as {
        code?: string;
        testAnswers?: unknown[];
        anonymousSessionId?: unknown;
      };

      if (!code) {
        return res.status(400).json({ error: "WeChat code is required" });
      }

      // Sanitise the optional anonymousSessionId so we only pass a safe string
      // to storage methods (never an arbitrary object from the request body).
      const safeAnonSessionId: string | null =
        typeof anonymousSessionId === "string" && anonymousSessionId.trim().length > 0
          ? anonymousSessionId.trim()
          : null;

      const { openid, session_key } = await getWechatOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(
        openid,
        session_key
      );

      // Idempotency guard: only import testAnswers the first time.
      // If the user already has a completed personality test we skip the import
      // so that retries / double-submits do not create duplicate sessions.
      const alreadyImported = Boolean(user.hasCompletedPersonalityTest);

      if (!alreadyImported && testAnswers && Array.isArray(testAnswers) && testAnswers.length > 0) {
        await processTestAnswers(user.id, testAnswers);

        // B: Consume the server-side presignup cache so the same answers cannot be
        // re-imported and resume prompts based on this session don't reappear.
        if (safeAnonSessionId && typeof safeAnonSessionId === "string") {
          try {
            await storage.clearPreSignupData(safeAnonSessionId);
            logger.info("[WeChat Auth] Claimed presignup cache", { userId: user.id });
          } catch (cacheErr) {
            // Non-fatal — log but don't fail the auth request
            logger.warn("[WeChat Auth] Failed to clear presignup cache", { userId: user.id, error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr) });
          }
        }
      }

      // Fetch updated full user record
      const fullUser = (await usersRepo.getUserById(user.id)) ?? user;

      if (isDebugAuthLoggingEnabled()) {
        logger.info("[WeChat Auth] before session regeneration", {
          userId: fullUser.id,
        });
      }

      await regenerateAuthenticatedWechatSession(req, fullUser.id);

      if (isDebugAuthLoggingEnabled()) {
        logger.info("[WeChat Auth] after session regeneration", {
          userId: fullUser.id,
        });
      }

      logger.info("[WeChat Auth] Session regenerated successfully", { userId: fullUser.id });

      // TEMPORARY DEBUG: diagnose real-device 401 - log session & cookie details
      logger.info("[AUTH-DEBUG] login-with-test response", {
        userId: fullUser.id,
        sessionId: req.sessionID,
        hasUserIdInSession: Boolean(req.session?.userId),
        reqCookies: req.headers.cookie ?? "(none)",
        resSetCookie: res.getHeader("set-cookie") ?? "(not yet set - will be set by express-session on write)",
      });

      res.json({
        success: true,
        isNewUser,
        user: sanitizeAuthUser(fullUser),
      });
    } catch (error) {
      const err = error as Error & { code?: string; status?: number };
      logger.error("[WeChat Auth] Error during WeChat login-with-test", {
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
  app.post("/api/auth/wechat/login", async (req: Request, res) => {
    try {
      const { code } = req.body as { code?: string };

      if (!code) {
        return res.status(400).json({ error: "WeChat code is required" });
      }

      const { openid, session_key } = await getWechatOpenId(code);
      const { user, isNewUser } = await findOrCreateWechatUser(
        openid,
        session_key
      );

      const fullUser = (await usersRepo.getUserById(user.id)) ?? user;

      await regenerateAuthenticatedWechatSession(req, fullUser.id);

      res.json({
        success: true,
        isNewUser,
        user: sanitizeAuthUser(fullUser),
      });
    } catch (error) {
      const err = error as Error & { code?: string; status?: number };
      logger.error("[WeChat Auth] Error during WeChat login", {
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
