import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMatchSuccessSubscribeMessages } from "../lib/wechatSubscribeMessage";

/**
 * Dark-ship contract for the match-success subscribe push (四-1): until the
 * template id is configured in the WeChat MP console and set as
 * WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS, the pipeline must be a silent no-op
 * and must never throw into the matching side-effect chain.
 */
describe("sendMatchSuccessSubscribeMessages", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is a no-op when WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS is unset", async () => {
    vi.stubEnv("WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS", "");
    await expect(
      sendMatchSuccessSubscribeMessages(["user-1"], { poolId: "pool-1", poolTitle: "周末饭局", eventTime: null }),
    ).resolves.toBeUndefined();
  });

  it("is a no-op for an empty member list even when configured", async () => {
    vi.stubEnv("WECHAT_SUBSCRIBE_TMPL_MATCH_SUCCESS", "tmpl-match-success");
    await expect(
      sendMatchSuccessSubscribeMessages([], { poolId: "pool-1", poolTitle: "周末饭局", eventTime: new Date() }),
    ).resolves.toBeUndefined();
  });
});
