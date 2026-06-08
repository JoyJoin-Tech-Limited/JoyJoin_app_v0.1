import type { AuthStrategy } from "./authStrategy";
import { WeChatAuthStrategy } from "./wechatAuthStrategy";
import { LocalAuthStrategy } from "./localAuthStrategy";

export function getAuthStrategy(): AuthStrategy {
  const mode = process.env.APP_MODE ?? "production";
  if (mode === "test") {
    return new LocalAuthStrategy();
  }
  return new WeChatAuthStrategy();
}

export function isTestMode(): boolean {
  return (process.env.APP_MODE ?? "production") === "test";
}
