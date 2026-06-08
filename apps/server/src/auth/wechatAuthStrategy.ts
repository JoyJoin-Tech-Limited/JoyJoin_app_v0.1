import type { AuthStrategy, LoginResult } from "./authStrategy";
import type { Request } from "express";
import { getWechatOpenId, findOrCreateWechatUser } from "../wechatAuth";
import { sanitizeAuthUser } from "./sanitizeAuthUser";
import { logger } from "../lib/logger";

export class WeChatAuthStrategy implements AuthStrategy {
  async login(req: Request, credentials: Record<string, unknown>): Promise<LoginResult> {
    const code = credentials.code as string | undefined;
    if (!code) {
      return { success: false, error: "Missing WeChat login code" };
    }

    try {
      const wechatResult = await getWechatOpenId(code);
      if (!wechatResult?.openid) {
        return { success: false, error: "Invalid WeChat login code" };
      }

      const { user } = await findOrCreateWechatUser(wechatResult.openid, wechatResult.session_key);

      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) return reject(err);
          req.session.userId = user.id;
          req.session.save((saveErr) => {
            if (saveErr) return reject(saveErr);
            resolve();
          });
        });
      });

      return {
        success: true,
        user: sanitizeAuthUser(user),
        sessionToken: req.sessionID,
      };
    } catch (error) {
      logger.error("[WeChatAuthStrategy] Login failed", { error: String(error) });
      return { success: false, error: "WeChat login failed. Please try again." };
    }
  }
}
