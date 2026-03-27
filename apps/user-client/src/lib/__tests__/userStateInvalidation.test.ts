import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateQueries } = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
}));

vi.mock("../queryClient", () => ({
  queryClient: {
    invalidateQueries,
  },
}));

import { USER_DERIVED_QUERY_KEYS, invalidateUserDerivedQueries } from "../userStateInvalidation";

describe("invalidateUserDerivedQueries", () => {
  beforeEach(() => {
    invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  it("invalidates every user-derived cache key", async () => {
    await invalidateUserDerivedQueries();

    expect(invalidateQueries).toHaveBeenCalledTimes(USER_DERIVED_QUERY_KEYS.length);
    expect(invalidateQueries.mock.calls).toEqual(
      USER_DERIVED_QUERY_KEYS.map((queryKey) => [{ queryKey: [...queryKey] }]),
    );
  });
});
