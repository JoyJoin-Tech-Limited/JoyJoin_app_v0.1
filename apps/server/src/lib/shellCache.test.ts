import { beforeEach, describe, expect, it } from "vitest";
import { shellCache } from "./shellCache";

describe("shellCache.invalidateDiscover", () => {
  beforeEach(() => {
    shellCache.flushAll();
  });

  it("removes all Discover entries without clearing other shells", () => {
    shellCache.set("shell-discover-user-1-0-20", { pools: [] });
    shellCache.set("shell-discover-user-2-0-20", { pools: [] });
    shellCache.set("shell-profile-user-1", { user: {} });

    shellCache.invalidateDiscover();

    expect(shellCache.get("shell-discover-user-1-0-20")).toBeUndefined();
    expect(shellCache.get("shell-discover-user-2-0-20")).toBeUndefined();
    expect(shellCache.get("shell-profile-user-1")).toEqual({ user: {} });
  });
});
