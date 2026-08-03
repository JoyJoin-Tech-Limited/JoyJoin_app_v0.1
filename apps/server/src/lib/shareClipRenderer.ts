/**
 * Phase 3 / B3 (2026-08-01): personalized animated share clip.
 *
 * WeChat canvas cannot captureStream, and client-side frame-by-frame encode is
 * jank-prone, so the reveal moment is composed SERVER-side: render N PNG
 * frames with @napi-rs/canvas (same engine as the moment-card renderer), then
 * mux a short muted MP4 with ffmpeg. The mini-program saves the returned
 * bytes to the photo album.
 *
 * Design: 2s loop @ 12fps (24 frames), 640×640 square, slot-dark background,
 * accent glow pulse, archetype art scale-in, letter-by-letter name reveal,
 * rising sparkle particles. Deterministic per (archetype, name) — no random
 * output across runs (seeded RNG).
 *
 * Feature-flagged: SHARE_ANIMATED_CLIP_ENABLED (default false).
 * Requires the `ffmpeg` binary on the host (Dockerfile installs it).
 */

import { createCanvas, loadImage, GlobalFonts, SKRSContext2D } from "@napi-rs/canvas";
import { spawn } from "child_process";
import { mkdtemp, rm, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { getArchetypeHSL } from "@joyjoin/shared";
import { logger } from "./logger";

// ── CJK font registration (mirrors momentCardRenderer.ts) ──────────────────
const CJK_FONT_CANDIDATES = [
  "/System/Library/Fonts/PingFang.ttc",
  "/System/Library/Fonts/Hiragino Sans GB.ttc",
  "/Library/Fonts/Arial Unicode.ttf",
  "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
  "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
];

let cjkFontRegistered = false;
for (const path of CJK_FONT_CANDIDATES) {
  if (existsSync(path)) {
    try {
      GlobalFonts.registerFromPath(path);
      cjkFontRegistered = true;
      break;
    } catch {
      // try next candidate
    }
  }
}

if (!cjkFontRegistered) {
  logger.warn("[ShareClip] No CJK font registered — Chinese text may render as boxes");
}

const FONT_FAMILY = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif';

const CLIP_SIZE = 640;
const FRAME_COUNT = 24;
const FRAME_RATE = 12;

const SLOT_DARK = "#23123d";
const SLOT_GOLD = "#ffd55e";
const TEXT_WARM = "#fff7d6";

export interface ShareClipInput {
  archetype: string
  archetypeNameCn: string
  displayName?: string
  blendLine?: string
  /** CDN URL of the archetype hero art (WebP). Optional — clip renders without it. */
  archetypeImageUrl?: string
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const col = light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(col * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function archetypeAccentHex(archetype: string): string {
  const hsl = getArchetypeHSL(archetype);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Deterministic seeded RNG (mulberry32) — identical frames across runs. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Particle {
  x: number
  y: number
  size: number
  speed: number
  phase: number
}

function buildParticles(rand: () => number, count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand() * CLIP_SIZE,
      y: rand() * CLIP_SIZE,
      size: 2 + rand() * 5,
      speed: 18 + rand() * 30,
      phase: rand() * Math.PI * 2,
    });
  }
  return particles;
}

/** Fetch the archetype art once (best-effort — the clip works without it). */
async function loadArchetypeImage(url?: string) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return await loadImage(buffer);
  } catch (error) {
    logger.warn("[ShareClip] archetype image fetch failed; rendering without art", {
      url,
      error: String(error),
    });
    return null;
  }
}

function drawFrame(
  ctx: SKRSContext2D,
  frameIndex: number,
  input: ShareClipInput,
  accent: string,
  particles: Particle[],
  archetypeImage: Awaited<ReturnType<typeof loadArchetypeImage>>,
): void {
  const t = frameIndex / FRAME_COUNT; // 0..1 progress through the loop
  const seconds = frameIndex / FRAME_RATE;

  // ── Background ──
  ctx.fillStyle = SLOT_DARK;
  ctx.fillRect(0, 0, CLIP_SIZE, CLIP_SIZE);

  // Accent glow pulse (0.35 → 0.55 → 0.35 over the loop)
  const pulse = 0.45 + Math.sin(t * Math.PI * 2) * 0.12;
  const glow = ctx.createRadialGradient(
    CLIP_SIZE / 2, CLIP_SIZE * 0.42, 0,
    CLIP_SIZE / 2, CLIP_SIZE * 0.42, CLIP_SIZE * 0.62,
  );
  glow.addColorStop(0, hexToRgba(accent, pulse * 0.5));
  glow.addColorStop(1, hexToRgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CLIP_SIZE, CLIP_SIZE);

  // ── Rising sparkle particles ──
  for (const p of particles) {
    const drift = (seconds * p.speed) % (CLIP_SIZE + 40);
    const y = CLIP_SIZE + 20 - drift;
    const twinkle = 0.4 + Math.sin(seconds * 3 + p.phase) * 0.35;
    ctx.fillStyle = hexToRgba(accent, Math.max(0, twinkle) * 0.75);
    ctx.beginPath();
    ctx.arc(p.x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Archetype art: scale 0.72 → 1 over the first 0.6s, then hold ──
  const artScale = Math.min(1, seconds / 0.6);
  const easeOut = 1 - Math.pow(1 - artScale, 3);
  if (archetypeImage) {
    const artSize = 300 * (0.72 + easeOut * 0.28);
    ctx.save();
    ctx.globalAlpha = 0.35 + easeOut * 0.65;
    ctx.drawImage(
      archetypeImage,
      (CLIP_SIZE - artSize) / 2,
      CLIP_SIZE * 0.42 - artSize / 2,
      artSize,
      artSize,
    );
    ctx.restore();
  } else {
    // Fallback: accent orb
    const orbRadius = 110 * (0.72 + easeOut * 0.28);
    ctx.fillStyle = hexToRgba(accent, 0.35 + easeOut * 0.5);
    ctx.beginPath();
    ctx.arc(CLIP_SIZE / 2, CLIP_SIZE * 0.42, orbRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Letter-by-letter name reveal (one char per ~83ms from 0.7s) ──
  const nameChars = [...input.archetypeNameCn];
  const revealStart = 0.7;
  const charsVisible = Math.max(
    0,
    Math.min(nameChars.length, Math.floor((seconds - revealStart) / 0.083) + 1),
  );
  if (charsVisible > 0 && seconds >= revealStart) {
    const visible = nameChars.slice(0, charsVisible).join("");
    ctx.textAlign = "center";
    ctx.font = `600 52px ${FONT_FAMILY}`;
    ctx.fillStyle = TEXT_WARM;
    ctx.fillText(visible, CLIP_SIZE / 2, CLIP_SIZE * 0.72);
  }

  // ── Display name / blend line (fades in after name) ──
  const subtitle = input.blendLine?.trim() || input.displayName?.trim() || "";
  if (subtitle && seconds > 1.2) {
    const subtitleAlpha = Math.min(1, (seconds - 1.2) / 0.4);
    ctx.font = `400 26px ${FONT_FAMILY}`;
    ctx.fillStyle = hexToRgba(TEXT_WARM, subtitleAlpha * 0.72);
    const clipped = subtitle.length > 18 ? `${subtitle.slice(0, 17)}…` : subtitle;
    ctx.fillText(clipped, CLIP_SIZE / 2, CLIP_SIZE * 0.79);
  }

  // ── Gold frame border: sweeps in during the first 0.8s ──
  const borderProgress = Math.min(1, seconds / 0.8);
  ctx.strokeStyle = hexToRgba(SLOT_GOLD, 0.55 * borderProgress);
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, CLIP_SIZE - 32, CLIP_SIZE - 32);

  // ── Brand mark ──
  ctx.font = `600 22px ${FONT_FAMILY}`;
  ctx.fillStyle = hexToRgba(TEXT_WARM, 0.55);
  ctx.fillText("JoyJoin 命格揭晓", CLIP_SIZE / 2, CLIP_SIZE - 34);
}

function runFfmpeg(framesDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-framerate", String(FRAME_RATE),
      "-i", join(framesDir, "frame-%03d.png"),
      "-c:v", "libx264",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-an", // muted — WeChat share clips play inline silently
      outputPath,
    ];
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

/**
 * Render the animated share clip and return the MP4 bytes.
 * Throws when ffmpeg is unavailable or rendering fails — the route maps this
 * to 503 so the client falls back to the static poster.
 */
export async function renderShareClipMp4(input: ShareClipInput): Promise<Buffer> {
  const accent = archetypeAccentHex(input.archetype);
  const seed = [...input.archetype].reduce((sum, ch) => sum + ch.charCodeAt(0), 7);
  const particles = buildParticles(seededRandom(seed), 22);
  const archetypeImage = await loadArchetypeImage(input.archetypeImageUrl);

  const workDir = await mkdtemp(join(tmpdir(), "joyjoin-share-clip-"));
  try {
    const canvas = createCanvas(CLIP_SIZE, CLIP_SIZE);
    const ctx = canvas.getContext("2d");

    for (let frame = 0; frame < FRAME_COUNT; frame++) {
      drawFrame(ctx, frame, input, accent, particles, archetypeImage);
      const png = await canvas.encode("png");
      const filename = `frame-${String(frame).padStart(3, "0")}.png`;
      await writeFile(join(workDir, filename), png);
    }

    const outputPath = join(workDir, "share-clip.mp4");
    await runFfmpeg(workDir, outputPath);
    return await readFile(outputPath);
  } finally {
    rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
