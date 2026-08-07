import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { registerAdminRoutes } from "./routes/domains/admin";
import { registerAdminAlangRoutes } from "./routes/domains/adminAlang";
import { registerAdminEquipmentRoutes } from "./routes/domains/adminEquipment";
import { registerAdminBillingRoutes } from "./routes/domains/adminBilling";
import { registerAdminEventManagementRoutes } from "./routes/domains/adminEventManagement";
import { registerAdminEventPoolRoutes } from "./routes/domains/adminEventPools";
import { registerAdminGeolocationRoutes } from "./routes/domains/adminGeolocation";
import { registerAdminOperationsRoutes } from "./routes/domains/adminOperations";
import { registerAdminUserRoutes } from "./routes/domains/adminUsers";
import { registerAIServiceRoutes } from "./routes/domains/aiServices";
import { registerAnalyticsRoutes } from "./routes/domains/analytics";
import { registerAssessmentRoutes } from "./routes/domains/assessment";
import { registerAssessmentResultRoutes } from "./routes/domains/assessmentResults";
import { registerAssessmentV4Routes } from "./routes/domains/assessmentV4";
import { registerAttendanceRoutes } from "./routes/domains/attendance";
import { registerAuthRoutes } from "./routes/domains/auth";
import { registerBlindBoxEventRoutes } from "./routes/domains/blindBoxEvents";
import { registerDemoRoutes } from "./routes/domains/demo";
import { registerDevToolRoutes } from "./routes/domains/devTools";
import { registerEventGroupOutcomeRoutes } from "./routes/domains/eventGroupOutcomes";
import { registerEventPoolRoutes } from "./routes/domains/eventPools";
import { registerGeoRoutes } from "./routes/domains/geo";
import { registerIcebreakerContentRoutes } from "./routes/domains/icebreakerContent";
import { registerIcebreakerRoutes } from "./routes/domains/icebreaker";
import { registerMatchExplanationRoutes } from "./routes/domains/matchExplanations";
import { registerMatchingAdminRoutes } from "./routes/domains/matchingAdmin";
import { registerMatchingConfigRoutes } from "./routes/domains/matchingConfig";
import { registerAdminMatchingReviewRoutes } from "./routes/domains/adminMatchingReview";
import { registerOnboardingRoutes } from "./routes/domains/onboarding";
import { registerPaymentRoutes } from "./routes/domains/payments";
import { registerProfileRoutes } from "./routes/domains/profile";
import { registerReportRoutes } from "./routes/domains/reports";
import { registerReferralRoutes } from "./routes/domains/referrals";
import { registerSocialRoutes } from "./routes/domains/social";
import { registerTelemetryRoutes } from "./routes/domains/telemetry";
import { registerUserEventPoolRoutes } from "./routes/domains/userEventPools";
import { registerDuoRoutes } from "./routes/domains/duo";
import { registerVenueRoutes } from "./routes/domains/venues";
import { registerOccupationSearchRoutes } from "./routes/domains/occupationSearch";
import { registerXiaoyueRoutes } from "./routes/domains/xiaoyue";
import { registerCityUnlockRoutes } from "./routes/domains/cityUnlock";
import { registerShellRoutes } from "./routes/domains/shell";
import { registerEventRoutes } from "./routes/domains/events";
import { registerConnectionRoutes } from "./routes/domains/connections";
import { registerMatchCompassRoutes } from "./routes/domains/matchCompass";
import { registerProfessionUnderstandingRoutes } from "./routes/domains/professionUnderstanding";
import { registerTestAdminRoutes } from "./routes/domains/testAdmin";
import { registerSingleTestRoutes } from "./routes/domains/singleTest";
import { registerMatchingTestRoutes } from "./routes/domains/matchingTest";
import { registerMonitoringWebhookRoutes } from "./routes/domains/monitoringWebhooks";
import { registerAlangRoutes } from "./routes/domains/alang";
import { registerAlangFlashRoutes } from "./routes/domains/alangFlash";
import { registerEquipmentRoutes } from "./routes/domains/equipment";
import { registerPersonalStoryRoutes } from "./routes/domains/personalStory";
import { registerShareClipRoutes } from "./routes/domains/shareClip";
import { registerHealthRoutes } from "./healthRoutes";
import { logger } from "./lib/logger";
import { isTestMode } from "./auth/getAuthStrategy";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { sign as signCookie } from 'cookie-signature';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Ensure trust proxy is set before session middleware
  app.set('trust proxy', 1);

  // API v1 backward compat: /api/v1/* routes work identically to /api/* routes.
  app.use((req: Request, _res, next) => {
    if (req.url) {
      if (req.url.startsWith('/api/v1/')) {
        req.url = '/api/' + req.url.slice('/api/v1/'.length);
      } else if (req.url === '/api/v1' || req.url.startsWith('/api/v1?')) {
        req.url = '/api' + req.url.slice('/api/v1'.length);
      }
    }
    next();
  });

  // Debug identity headers on all API responses
  app.use((req, res, next) => {
    res.setHeader("X-App", "joyjoin-api");
    res.setHeader("X-Instance", process.env.HOSTNAME || "replit");
    res.setHeader("X-Git", process.env.GIT_SHA || "unknown");
    next();
  });

  // Health and readiness endpoints must be before session middleware for cloud checks
  registerHealthRoutes(app);

  registerAnalyticsRoutes(app);

  // Session token middleware: WeChat Mini Program on real devices does not
  // persist Set-Cookie from HTTPS responses. The client stores the session ID
  // from the login response body and sends it as X-Session-Token header on
  // subsequent requests. This middleware injects it as a signed cookie so
  // express-session can load the session from the store transparently.
  app.use((req, _res, next) => {
    const sessionToken = req.headers['x-session-token'];
    if (sessionToken && !req.headers.cookie) {
      const token = Array.isArray(sessionToken) ? sessionToken[0] : sessionToken;
      // express-session requires the cookie value to be signed (s:<sid>.<hmac>).
      // Unsigned cookies are ignored when a secret is configured.
      const signed = 's:' + signCookie(token, process.env.SESSION_SECRET!);
      req.headers.cookie = `connect.sid=${signed}`;
      logger.info('[X-Session-Token] Restored session from header', {
        sessionId: token.substring(0, 12) + '...',
      });
    }
    next();
  });

  // Session middleware — use correct DB URL based on APP_MODE
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const sessionDbUrl = isTestMode() && process.env.TEST_DATABASE_URL?.trim()
    ? process.env.TEST_DATABASE_URL.trim()
    : process.env.DATABASE_URL;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: sessionDbUrl,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      domain: cookieDomain,
      httpOnly: true,
      secure: isProduction,
      maxAge: sessionTtl,
      sameSite: isProduction ? 'none' : 'lax',
    },
  }));

  registerAuthRoutes(app);
  registerShellRoutes(app);
  registerEventRoutes(app);
  registerConnectionRoutes(app);
  registerOnboardingRoutes(app);
  registerPaymentRoutes(app);
  registerAssessmentRoutes(app);
  registerAssessmentV4Routes(app);
  registerAssessmentResultRoutes(app);
  registerShareClipRoutes(app);
  registerProfileRoutes(app);
  registerSocialRoutes(app);
  registerReferralRoutes(app);
  registerReportRoutes(app);
  registerEventPoolRoutes(app);
  registerUserEventPoolRoutes(app);
  registerDuoRoutes(app);
  registerAdminEventPoolRoutes(app);
  registerAdminEventManagementRoutes(app);
  registerEventGroupOutcomeRoutes(app);
  registerVenueRoutes(app);
  registerOccupationSearchRoutes(app);
  registerGeoRoutes(app);
  registerAttendanceRoutes(app);
  registerIcebreakerRoutes(app);
  registerIcebreakerContentRoutes(app);
  registerBlindBoxEventRoutes(app);
  registerDemoRoutes(app);
  registerDevToolRoutes(app);
  registerAdminRoutes(app);
  registerAdminAlangRoutes(app);
  registerAdminEquipmentRoutes(app);
  registerAdminBillingRoutes(app);
  registerAdminUserRoutes(app);
  registerAdminOperationsRoutes(app);
  registerAdminGeolocationRoutes(app);
  registerMatchingAdminRoutes(app);
  registerAdminMatchingReviewRoutes(app);
  registerMatchExplanationRoutes(app);
  registerMatchCompassRoutes(app);
  registerAIServiceRoutes(app);
  registerTelemetryRoutes(app);
  registerXiaoyueRoutes(app);
  registerCityUnlockRoutes(app);
  registerProfessionUnderstandingRoutes(app);
  registerMonitoringWebhookRoutes(app);

  registerTestAdminRoutes(app);
  registerSingleTestRoutes(app);
  registerMatchingTestRoutes(app);
  registerAlangRoutes(app);
  registerAlangFlashRoutes(app);
  registerEquipmentRoutes(app);
  registerPersonalStoryRoutes(app);

  return httpServer;
}
