/**
 * Auth/dev registration policy (single source of truth for auth-adjacent debug surfaces)
 *
 * - Production fails closed by default.
 * - Dev/debug tooling requires explicit opt-in via ENABLE_DEV_AUTH_TOOLS=1.
 * - WeChat mock login is limited to non-production test codes with the wechat_test_ prefix.
 * - Production overrides require ALLOW_PRODUCTION_AUTH_DEBUG=1 and should only be used
 *   for short-lived, audited emergency sessions.
 */
export const DEV_AUTH_TOOLS_FLAG = "ENABLE_DEV_AUTH_TOOLS";
export const PROD_AUTH_DEBUG_OVERRIDE_FLAG = "ALLOW_PRODUCTION_AUTH_DEBUG";
export const WECHAT_TEST_CODE_PREFIX = "wechat_test_";

function readFlag(name: string): boolean {
  return process.env[name] === "1";
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isNonProductionEnvironment(): boolean {
  return !isProductionEnvironment();
}

export function isDebugAuthLoggingEnabled(): boolean {
  return isNonProductionEnvironment() && readFlag("DEBUG_AUTH");
}

export function isDevAuthToolsEnabled(): boolean {
  return isNonProductionEnvironment() && readFlag(DEV_AUTH_TOOLS_FLAG);
}

export function canUseMockWechatAuth(code: string): boolean {
  return isNonProductionEnvironment() && code.startsWith(WECHAT_TEST_CODE_PREFIX);
}

export function assertProductionAuthDebugSurfaceAllowed(surfaceName: string): void {
  if (isProductionEnvironment() && !readFlag(PROD_AUTH_DEBUG_OVERRIDE_FLAG)) {
    throw new Error(
      `${surfaceName} is disabled in production. ` +
      `Set ${PROD_AUTH_DEBUG_OVERRIDE_FLAG}=1 only for an audited emergency session.`
    );
  }
}
