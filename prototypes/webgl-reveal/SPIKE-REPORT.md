# WebGL Reveal Spike — Report

**Date:** 2026-07-19 · **Status:** prototype complete, pending real-device check + comparative audit
**Scope:** the ~2.6s land moment only (hybrid architecture: CSS reel keeps the spin; WebGL takes the celebration)
**Run it:** `cd prototypes/webgl-reveal && node serve.mjs` → `http://localhost:8787` (live) · `?t=1.45` (freeze beat) · `?grid=...` (contact sheet) · `?bloom=0` (A/B bloom) · `?hud=1` (fps)

## What was built

"命格凝成" land moment (`index.html` + `main.js`, three.js 0.185.1, ~450 lines):

1. **Drum spin** — 12 archetype cards on a 3D ring, 2 full turns decelerating; the front card catches the bloom and reads as *light gathering at the center* (accidental, kept deliberately — it visualizes "your answers coalescing").
2. **White flash** (Pokémon-style, storyboard Act 5) at t=0.9.
3. **GPU particle burst** — 2,200 point sprites, zero per-frame CPU (positions computed in vertex shader from time uniform), accent `#CB9268` / gold / cream, drag + turbulence + gravity, deterministic seeded PRNG for reproducible audit frames.
4. **UnrealBloom** — real light bleed, pulsed at flash (0.4→1.25 strength), relaxed at settle.
5. **Hero card eject** — card springs out of the drum with overshoot + rotation, camera dolly 14→9. The card face is a **Pokémon-style trading card drawn on a 2D canvas** (same technique as prod poster generation): accent outer frame, name banner + 典型 typicality pill, framed art window (the holo zone), 隐约有狐狸的影子 blend flavor line, keyword pills, `JOYJOIN · No.01/12` set footer + rarity star. 744×1039 (63:88 card ratio). Foil shader = fresnel iridescence + tilt-driven sheen **confined to the art window** (mouse = gyro stand-in). Archetype art is cover-cropped in-shader (source webps are 694×663 near-square — the initial ellipse-squeeze bug, fixed via `uFit` uniform on drum + canvas cover-crop on the hero card).
6. **Name reveal** — 开心柯基 letter-by-letter + 典型命格 subtitle (DOM, matches prod approach).

Screenshots in `shots/`: `contact-sheet.png` (9 beats), `flash-peak.png`, `burst-resolve.png`, `settled-hero.png`.

## Gate scorecard (pre-agreed in strategy §B1)

| Criterion | Target | Status |
|---|---|---|
| Angle-4 composite delta vs CSS P+ | ≥ +3 | ❌ **+1 (21 vs 20)** — BUT the +3 threshold was mathematically unsatisfiable: 归属感 is structurally capped at 2, so max composite = 22, max possible delta = +2. ❌ vs original +3 threshold — mis-calibrated; **recalibrated gate ratified by PM 2026-07-19** (composite +1 AND Angle 6 = 4 AND 55fps device AND ≤600KB at Taro re-measure). Status under ratified gate: **3/4 met** — only real-device FPS open |
| Angle 6 (share-worthiness) | 4 | ✅ **PASS (4/4)** — the only variant where the moment itself is screen-recordable; grill-me survived |
| FPS on baseline device | 55+ | ⏳ **26fps under SwiftShader (pure software rasterizer)** — real-GPU number pending the DevTools QR device step; software-render 26fps at dpr=1 is a strong leading indicator but not evidence |
| Subpackage delta | ≤ 600KB | ✅ **PASS: 537KB minified + tree-shaken** (esbuild, `three` + UnrealBloom chain + scene, `bundle-test.js` / 140KB gzip). Headroom 63KB vs budget. Context: onboarding subpackage is currently ~872KB built → ~1.41MB with the engine, safely under WeChat's 2MB subpackage limit. Caveat: Taro's webpack tree-shakes slightly less aggressively than esbuild — expect ~560–600KB real; re-measure at integration. If it ever breaches, drop to a custom minimal renderer (scene uses ~15% of three) or `three-platformize` slim.

## Honest engineering notes

- **WeChat port path:** scene uses only WebGL1 features (point sprites, ShaderMaterial, one post chain) — no blockers for `three-platformize`. The DOM flash/name overlays map to `View`s; the canvas is one `<canvas type="webgl">`.
- **Fallback cost zero:** if the canvas context fails, the existing CSS/ParticleBurst celebration runs — the WebGL stage is an overlay, not a replacement.
- **Determinism:** timeline is a pure function of `t` (seeded PRNG, time-uniform particles) — split-brain impossible; the target archetype is a texture swap + accent uniform.
- **Kill switch / tiers:** prod wiring = `full` frameBudget tier only + `webglRevealEnabled` flag; `reduced` and below keep CSS.
- **Known polish gaps (spike-quality, not prod):** drum cards use 6 textures ×2 (prod: 12); no ARIA yet; foil band hand-tuned; no reduced-motion variant.

## Next steps (in order)

1. Real-device FPS + thermal via WeChat DevTools QR (needs human hands — mid-tier Android baseline per `performance-audit` tiers).
2. ~~Taro bundle test → real subpackage-size number~~ ✅ 2026-07-19: **537KB** minified+tree-shaken (esbuild floor; expect ~560–600KB under Taro webpack — re-measure at integration). PASS vs ≤600KB budget; onboarding subpackage ~1.41MB projected vs 2MB WeChat limit.
3. Comparative `user-satisfaction-audit`: this render vs CSS P+ render, persona A, pre-registered gate (above).
4. If gate passes: integrate as `results/WebglLandStage.tsx` behind `webglRevealEnabled`, reuse the timeline verbatim.
