import { describe, it, expect } from "vitest";
import { renderShareClipMp4 } from "../lib/shareClipRenderer";

/**
 * Phase 3 / B3 (2026-08-01): animated share clip renderer.
 * Requires the `ffmpeg` binary on the host (available in dev + production
 * Docker image). Verifies MP4 magic bytes and a sane size floor.
 */

describe("renderShareClipMp4", () => {
  it("renders a valid muted MP4 for a basic input", async () => {
    const mp4 = await renderShareClipMp4({
      archetype: "corgi",
      archetypeNameCn: "开心柯基",
      blendLine: "隐约有太阳鸡的影子",
    });

    expect(mp4).toBeInstanceOf(Buffer);
    // 24 frames @ 640×640 should be well above a few KB
    expect(mp4.length).toBeGreaterThan(10_000);
    // MP4 ftyp box signature ('ftyp' at bytes 4-7)
    expect(mp4[4]).toBe(0x66); // f
    expect(mp4[5]).toBe(0x74); // t
    expect(mp4[6]).toBe(0x79); // y
    expect(mp4[7]).toBe(0x70); // p
  }, 60_000);

  it("renders without art when the image URL is unreachable", async () => {
    const mp4 = await renderShareClipMp4({
      archetype: "fox",
      archetypeNameCn: "智慧狐",
      archetypeImageUrl: "https://joyjoinapp.com/static/does-not-exist.webp",
    });

    expect(mp4).toBeInstanceOf(Buffer);
    expect(mp4.length).toBeGreaterThan(10_000);
    expect(mp4[4]).toBe(0x66);
  }, 60_000);
});
