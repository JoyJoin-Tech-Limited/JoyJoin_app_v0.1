import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("prefetchEmptyStateAssets", () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalImage = globalThis.Image;

  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, "window", {
      value: {},
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Image", {
      value: originalImage,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it("preloads both assets only once per page lifecycle", async () => {
    const loadedSources: string[] = [];

    class MockImage {
      set src(value: string) {
        loadedSources.push(value);
      }
    }

    Object.defineProperty(globalThis, "navigator", {
      value: { connection: { effectiveType: "4g", saveData: false } },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Image", {
      value: MockImage,
      configurable: true,
      writable: true,
    });

    const { prefetchEmptyStateAssets } = await import("../prefetchEmptyStateAssets");

    prefetchEmptyStateAssets();
    prefetchEmptyStateAssets();

    expect(loadedSources).toHaveLength(2);
    expect(decodeURIComponent(loadedSources[0])).toContain("gift box + animals");
    expect(decodeURIComponent(loadedSources[1])).toContain("purple gradient background");
  });

  it("skips prefetch on save-data and very slow connections", async () => {
    const imageConstructor = vi.fn();

    Object.defineProperty(globalThis, "navigator", {
      value: { connection: { effectiveType: "slow-2g", saveData: false } },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, "Image", {
      value: imageConstructor,
      configurable: true,
      writable: true,
    });

    const { prefetchEmptyStateAssets } = await import("../prefetchEmptyStateAssets");

    prefetchEmptyStateAssets();

    expect(imageConstructor).not.toHaveBeenCalled();
  });
});
