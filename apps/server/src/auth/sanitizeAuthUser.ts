const SENSITIVE_AUTH_USER_FIELDS = new Set([
  "password",
  "passwordHash",
  "wechatSessionKey",
  "wechatOpenId",
  "sessionKey",
  "session_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "secretKey",
  "secret_key",
  "credential",
  "credentials",
]);

export function sanitizeAuthUser<T extends Record<string, unknown>>(user: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(user).filter(([key]) => !SENSITIVE_AUTH_USER_FIELDS.has(key))
  ) as Partial<T>;
}