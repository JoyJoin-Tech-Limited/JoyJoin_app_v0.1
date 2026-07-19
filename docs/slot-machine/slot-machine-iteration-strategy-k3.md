# Slot Machine Animation Iteration Strategy — K3-Assisted "Wow" Roadmap

> **Date:** 2026-07-19 · **Status:** Strategy proposal (not yet approved)
> **Scope:** `apps/mini-program/src/pages/onboarding/personality-test/results/` slot-machine reveal flow
> **Companion docs:** `slot-machine-animation-storyboard.md` (canonical 7-act spec), `docs/systems/PERSONALITY_TEST_SYSTEM.md`

---

## 1. Why this strategy exists

Kimi K3 (released 2026-07-17) is demonstrably strong at **motion design, animation, and video editing** — its native multimodal architecture can read brand reference images and produce matching animation code, easing choreography, and edited/pre-rendered motion assets. That capability maps directly onto the two things our slot machine needs most: **richer choreography** and **richer motion assets**.

But K3 changes *how we produce* the animation, not *what the platform can run*. The WeChat mini-program runtime constraints already discovered the hard way still bind everything:

- CSS `backgroundImage` silently fails → `<Image>` + positioned-crop pattern only
- CSS custom properties inside `@keyframes` unreliable → JS-driven frame stepping
- No WebGL in the animation path today; 2D `<Canvas>` only
- Subpackage size budget; archetype sprites already trimmed 9→7 frames for size
- `frameBudget.ts` degradation tiers (`full/reduced/minimal/emergency`) are the runtime authority

**So the operating principle is: K3 works in the production pipeline (asset + choreography generation, sandbox prototyping). It never becomes a runtime dependency, and every output passes the existing WeChat-safe adaptation patterns and degradation gates.**

Also note K3's documented limitation of *excessive proactiveness* — it must be used with tightly-scoped prompts and human/agent review gates, in the sandbox lane only. It is not qualified to make product calls (e.g., near-miss probability, timing budgets) on its own.

---

## 2. What "wow" means — PM and user perspective first

Before iterating pixels, define the measurable target. The storyboard's own "Analytics & Optimization" section (§Future Enhancements) was never built — **we are currently flying blind on whether the existing animation is even watched**.

### User-perspective wow (the emotional beats)

The reveal is the **payoff moment of the entire onboarding funnel** — the user just answered 8–16 personal questions. Wow =

1. **Anticipation** — "something is being figured out *about me*" (personalization tension, not casino randomness)
2. **Spectacle** — a moment worth watching rather than skipping
3. **Ownership** — the landed archetype feels *mine* (name, art, blend line)
4. **Shareability** — a moment worth screenshotting/posting (the poster exists; the *moment* should earn it)

### PM-perspective wow (the metrics)

| Metric | Why | Current state |
|---|---|---|
| Skip rate (`跳过动画` button taps / animation starts) | Direct "is it wow or is it a wait" signal | **Not instrumented** |
| Stage dwell + abandon (leave during slot/reveal/bridge) | Find where attention breaks | Not instrumented (we have the pattern: `social_icebreaker_phase_metrics`) |
| Result→poster-share conversion | The wow pays off as organic acquisition | Exists, but not attributed to animation variant |
| Onboarding completion rate | Guard metric — wow must not cost completion | Exists |
| FPS distribution by device tier (`frameBudget` tier counts) | Wow that janks is anti-wow | Partially measured, not reported |

**Phase 0 is instrumentation, not animation.** Without skip-rate baseline, every subsequent iteration is unverifiable taste.

---

## 3. The cheapest wow: close the storyboard gap

The 2026-06-05 implementation note in the storyboard is the key fact: **the shipped version is a deliberately simplified version of an already-approved, richer design.** A large fraction of "make it wow" is *finishing what was already designed*, not inventing new things.

| Storyboard element (approved) | Shipped status | Gap cost |
|---|---|---|
| Act 4 near-miss overshoot (70% design) | Implemented differently: deterministic 30% hash-based, no overshoot mechanic | Small — keep the 30% cap (anti-casino-feel decision), add the *overshoot choreography* |
| Act 6 particle celebration (40 particles, brand palette) | Collapsed to 3 CSS burst rings; archetype-accent colors | **Big** — `components/reveal/ParticleBurst.tsx` (rAF canvas particle system, brand palettes, reduce-motion aware) **already exists and is battle-tested in squad-unboxing** — reuse it |
| Act 5 white flash + growth bounce landing | `slot-land-pop` keyframes only | Medium — cheap to add |
| Act 7 letter-by-letter name reveal | Not implemented | Medium — high perceived-craft win |
| A/B timing variants (`baseline/fast/dramatic`) | Only `?animationProfile=fast` in web sandbox | Framework half-exists |

**Phase 1 = storyboard completion pass.** No K3 needed, lowest risk, immediately shippable behind the existing flag infrastructure.

---

## 4. Iteration ladder (phases, ROI-ordered)

### Phase 0 — Instrument & baseline (~2–3 days)
- Add analytics events: `slot_animation_start`, `slot_animation_skip`, `slot_stage_abandon` (per FlowStage), `reveal_completed`, plus `frameBudget` tier reporting.
- Add a `slot_reveal_metrics`-style table or reuse the existing analytics pipeline (see `analytics-tracking` skill).
- **Exit:** baseline skip rate + dwell curve known. This becomes the A/B control.

### Phase 1 — Storyboard completion (~1 week)
- Reuse `ParticleBurst.tsx` for Act 6 (accent-colored, tier-gated: `reduced` tier gets ring-burst fallback).
- Add white-flash + growth-bounce landing; letter-by-letter archetype name reveal in `FinalStage`.
- Add overshoot-and-settle choreography to the existing 30% near-miss path (keep probability cap).
- **F1 blend near-miss reframe (from the 2026-07-19 satisfaction audit — highest wow-per-hour item):** the near-miss overshoot card is always the user's **secondary/blend archetype** (`NEAR_MISS_MODE: 'blend'`, legacy `'random'` kept for rollback). "You almost won" becomes "you're almost X — but really Y with a shadow of X", matching the existing `隐约有[x]的影子` blend indicator. Converts a casino mechanic into 被理解感; trivial cost (target selection only; secondary already resolved server-side).
- Wire the `baseline/fast/dramatic` timing variants into `resultHelpers.ts` `AnimationProfile` so they're remotely selectable (not just a sandbox query param).
- **Gate:** `performance-audit` PASS (60fps on reduced tier, no package-size regression — particles are code, not assets) + `user-satisfaction-audit`.

### Phase 2 — K3-assisted asset & choreography upgrade (~2–3 weeks)

This is where K3 earns its keep. Three workstreams:

**2a. K3 motion-design prototyping (sandbox-first).**
Feed K3 the current `SlotStage.tsx` + `index.scss` + storyboard and have it generate **choreography variants**: easing curves, anticipation micro-motion (reel shudder, light-chase around the frame), deceleration feel. Preview in the **web sandbox** (extend the existing `?animationProfile=` mechanism) — this is the perfect K3 playground because iteration is free and nothing ships. Human picks winners; winning curves get ported to the phase-scoped CSS transition classes. **K3 output accepted only as numbers/curves/markup reviewed like any PR.**

**2b. Pre-rendered motion assets (K3 video/motion pipeline → sprite strips).**
The highest-leverage visual upgrade: give each of the 12 archetypes a short **reveal motion loop** (e.g., 6–9 frame celebration strip, 200×200 or 384×512 cells) instead of a static WebP at land time. K3's motion-design/video capability generates candidate sequences from the existing archetype art + mascot reference; we export as **WebP sprite strips consumed through the proven `XiaoyueSpriteAnimator` pattern** (JS-driven frames, CDN-first with local fallback, manifest JSON — all already solved problems). Budget: ≤9 frames/state, ~30–50KB/archetype on CDN, only the *landed* archetype's strip fetched (lazy, after target known — zero upfront package cost).
- Fallback chain mirrors existing rules: strip → static `archetype-<id>.webp` → accent circle. Degradation tiers `minimal/emergency` never load strips.

**2c. Fake-3D depth (CSS-only, K3-prototyped).**
"3D" on this platform means illusion, not WebGL: reel drum curvature (per-card `rotateX`/scale by distance from center — the transform infrastructure already exists in the reel), perspective card-flip at reveal, parallax between frame/reel/glow layers. K3 is good at generating exactly this class of transform math. Hard rule: **transforms and opacity only** (compositor-safe), `will-change` discipline, everything behind `reduced`-or-better tier.

### Phase 3 — Differentiated moments (later, data-gated)
- Rare-variant reveals (e.g., special treatment for highly typical matches — the `典型/非典型` badge already classifies this).
- Animated share poster (short looping WebP/video export of the reveal — storyboard Phase-2 item "GIF/video export").
- Sound design (storyboard Phase-2 item; needs WeChat audio policy review, user opt-in).
- **Entry condition:** Phase 0 metrics show skip rate < target and share rate responsive to Phase 1/2.

---

## 5. Guardrails (non-negotiable, carry forward)

1. **Kill switch stays absolute:** `personalitySlotAnimationEnabled=false` must bypass everything new exactly as today.
2. **30% near-miss cap is a product ethics decision** (casino-feel manipulation) — choreography may improve, probability may not rise.
3. **Deterministic correctness:** slot always lands on the server-resolved archetype; split-brain detection stays; K3 never touches result resolution.
4. **Degradation tiers are the runtime authority** — every new effect declares its tier (`full` only / `reduced+` / all) and its fallback.
5. **Package size:** all new raster/motion assets CDN-first with local fallback *only where AGENTS.md asset rules require it* (spritesheet stays local-first as the split-brain-immune authority).
6. **Accessibility:** per-phase ARIA labels extended to new acts; the 2026-06-18 product decision (reduced-motion does not bypass the slot) stands — new *secondary* effects still suppress under reduced-motion.
7. **AIGC provenance:** if K3-generated art ships, follow the existing `AIGCLabel` disclosure pattern where user-facing.
8. **Process:** each phase goes through `pre-ship-pipeline` (review → swarm → completeness/performance audits → consolidated grill-me). Mini-program UI changes get `completeness-audit`; perf gate is PASS/WARN/BLOCK.
9. **K3 containment:** sandbox and asset-generation lanes only; tightly-scoped prompts (counter its excessive-proactiveness limitation); all output PR-reviewed; no runtime calls to any LLM in the animation path.

---

## 6. Decision mechanism (PM layer) — no A/B testing

Per product decision (2026-07-19), variant selection is **audit- and metrics-driven, not randomized**:

1. **Comparative user-satisfaction audit** (existing vs proposed) — done 2026-07-19, see `reports/user-satisfaction-audit-slot-machine-existing-vs-proposed-2026-07-19.md`. Verdict: build **P+** (Phase 1 + F1 reframe + Phase 2b strips); P without the reframe does not move the band and is not worth its cost.
2. **Instrumentation baseline** (Phase 0) — skip rate, stage dwell, share conversion measured pre-change.
3. **Post-ship delta review** — same metrics re-measured 2–4 weeks after each phase; regression on skip rate or onboarding completion → roll back via the existing kill switch / `NEAR_MISS_MODE` / profile flags.
4. **Quarterly re-audit** against the 20+ (爱不释手) bar; the 2026-07-19 audit is the baseline scorecard (E=19/24, P+=19–20).
5. **North-star backlog (not scope):** rotating answer-echo whispers during spin (fixes the "is this random?" Angle-2 drag — echoes already exist).

---

## 6.5 Path to 24/24 (PM directive, 2026-07-19): maximum scope, strictest measure

PM greenlit maximum scope with the target **24/24 on the user-satisfaction audit, scored at the strictest measure** (grill-me on every 4; unbuilt/unrendered claims capped at 3; evidence or it didn't happen). This section supersedes the phase ladder's conservative ceilings.

### What 24/24 requires — six 4s, no weak angle

| Angle | P+ score | Gap to 4 | Fix (and barrier class) |
|---|---|---|---|
| 1 · 3s clarity | 3 | Flow doesn't state its own purpose | Pre-spin headline: "你的答案正在凝成你的命格卡"; single dominant post-land CTA. **Barrier: none (copy/layout).** |
| 2 · Cognitive smoothness | 3 | "Is this random?" decode | **Answer-echo whispers** during spin (real quotes: "你说过「周末更喜欢独处」…") + **progressive trait lock-in** (ACOEXP trait names light up one by one as the reel decelerates — proof of analysis, and it needs the result resolved early: already concurrent-fetched with holding-phase fallback). **Barrier: low-medium.** |
| 3 · Cleanliness | 4 | Hold, don't regress | ≤40 particles, accent-palette-only, single focal point, tier-gated. **Barrier: discipline, not tech.** |
| 4 · Emotional resonance | 4 | Hold at strictest | 惊喜感 3→4 needs strips *built and rendered* + one rare-variant easter egg (typical-match "闪光" variant); 被理解感 3→4 comes free with echo whispers (the system literally quotes you). **Barrier: strips pipeline (B2 below).** |
| 5 · Return hooks | 3 | Animation invests identity but plants no *pending thread* | Seed the first scheduled reveal at the result moment: "你的命格已就位——第一批同频伙伴正在匹配中" + animated strip persists in Profile ("你的柯基在个人页等你"). Leaving = abandoning a scheduled reveal. **Barrier: medium (wire pool/matching status + profile strip reuse).** |
| 6 · Share-worthiness | 3→4 | Moment must survive as an artifact | Blend-tease caption ("差点把我判成[x]") + **personalized animated share clip**. **Barrier: highest (B3 below).** |

### The three real technical barriers, and how each is overcome

**B1 — True 3D on the WeChat runtime (PM-endorsed 2026-07-19, conditional on proven wow delta).**
Ecosystem verified 2026-07-19: `<canvas type="webgl">` is supported; three integration options are `threejs-miniprogram` (official port, aging), **`three-platformize`** (full three.js API, reported 60fps/85MB vs port's 45fps/120MB in complex scenes — preferred), and WeChat's own **XR-Frame** (official, component-style, smallest integration surface, weaker post-processing ecosystem). For a bloom/particle-driven showcase, **three-platformize + UnrealBloom** is the pragmatic pick.

*What WebGL uniquely buys (that CSS/Canvas2D cannot):*

| Effect | CSS/Canvas2D ceiling | WebGL delta | Wow class |
|---|---|---|---|
| Bloom / light bleed on land | `shadowBlur` = expensive, fake | UnrealBloom post-processing — light that *bleeds* | **High** (the cinematic tell) |
| GPU particles | ~40 DOM/canvas particles | 2–5k particles with trails + turbulence | **High** at land |
| Camera choreography | none (fixed viewport) | Dolly-in + rack focus drum→card | **High** (cinematic feel) |
| Holographic foil + gyro tilt | exists (touch-drag holo card, 2D) | True specular/env reflection, physics tilt | Moderate (incremental) |
| 3D drum curvature + DOF | fake-3D transforms approximates | Real perspective + depth-of-field blur | Moderate-high |
| Answer-echo vortex | rotating copy lines only | Text sprites spiraling INTO the drum — "proof of analysis" made physical | High — and it's the **Angle-2 fix** |

*Architecture — hybrid, not replacement:* keep the proven CSS reel for the spin (it's correct, accessible, tiered); **WebGL takes over only the land moment (~2.5s)** as a `<canvas type="webgl">` overlay stage: white flash → camera dolly → bloom burst → 2k accent particles → foil card with gyro tilt. WebGL init failure or tier < `full` → existing CSS/ParticleBurst celebration. One WebGL context; existing 2D canvases (poster) unaffected. Engine cost ~400–600KB lives in the onboarding subpackage.

*Bundle test (2026-07-19):* **537KB** minified + tree-shaken (esbuild: three + UnrealBloom chain + scene; 140KB gzip) — PASS vs the ≤600KB budget. Onboarding subpackage currently ~872KB built → ~1.41MB projected, safely under WeChat's 2MB subpackage limit. Taro webpack tree-shakes less aggressively than esbuild; expect ~560–600KB real and re-measure at integration.

*Spike (timeboxed 2–3 days) before any production commitment:*
1. Build the land-moment stage only, in the onboarding subpackage, behind `?renderer=webgl` + `webglRevealEnabled` flag.
2. Render it two ways: H5 build (same three.js code runs in browser → Playwright pipeline gives us rendered-truth for the audit) and real device via DevTools QR (FPS + thermal on a mid-tier Android baseline per `performance-audit` device tiers).
3. **Decision gate ("much wow" defined in advance):** comparative `user-satisfaction-audit` on the two renders — pre-registered threshold was Angle-4 +3 AND Angle 6 = 4 AND 55fps+ AND ≤600KB. **Audit run 2026-07-19** (`reports/user-satisfaction-audit-webgl-vs-css-2026-07-19.md`): Angle 6 = 4 ✅, size 537KB ✅, composite delta +1 (21 vs 20) ❌ vs the +3 threshold — **but the threshold was unsatisfiable** (归属感 structurally capped at 2 → max delta was +2). Recalibrated gate **ratified by PM 2026-07-19**: composite +1 AND Angle 6 = 4 AND 55fps device AND ≤600KB at Taro re-measure. WebGL currently meets 3/4 (Angle 6 ✅, composite +1 ✅, 537KB ✅); real-device FPS is the last open criterion.

**B2 — 12-archetype motion strip pipeline (K3's core job).**
Style consistency across 12 AI-generated sequences is the hard part. Mitigations: single locked style-prompt + seed discipline per batch; human art-direction pass on all 12 before export; WebP with alpha at ≤9 frames; consumed via the proven `XiaoyueSpriteAnimator` JS-frame pattern (CSS keyframes unreliable in WeChat); manifest mirrors `xiaoyue-spritesheet-manifest.json`; CDN-first + static local fallback; strips double as Profile/matching assets (amortize, and it's what lifts Angle 5).

**B3 — Personalized animated share artifact.**
WeChat canvas cannot captureStream; frame-by-frame export + client encode is jank-prone. The feasible path is **server-side composition**: client posts archetype + display name + blend line → server renders frames (existing canvas poster code reused per frame) → ffmpeg → short muted MP4/looping WebP → save-to-album. Precedent exists: the moment-card server render (`SOCIAL_ICEBREAKER_ENABLE_MOMENT_CARD_SERVER_RENDER`) already proves server-side image generation. Ship static poster first, clip behind a feature flag (`shareAnimatedClipEnabled`).

### Strictest-measure honesty

A 24/24 can only be *scored* after building, rendering, and a fresh persona walk — by the rubric's own rules, anything unbuilt caps at 3 today. This plan makes each 4 *earnable*; the post-Phase-1 and post-Phase-2b re-audits are the checkpoints where scores are actually awarded. Angle 5 is flagged as the hardest 4: it's structural (pending thread), not motion, and depends on matching-pool integration, not the animation team alone.

### Revised sequencing under maximum scope

1. **Phase 0** — instrumentation ✅ **shipped 2026-07-19** (`slot_animation_start`, `result_degradation_tier`, `result_stage_dwell`; `skip_animation` pre-existing).
2. **Phase 1+** — storyboard completion **+ F1 blend reframe + Angle 1/2 fixes**. Shipped 2026-07-19: ✅ F1 blend near-miss, ✅ echo whispers, ✅ purpose headline, ✅ flash + ParticleBurst + letter-by-letter (slice 5), ✅ 命格卡 shared generator + poster wiring (slice 4), ✅ return-hook line (slice 6). Remaining: timing-variant wiring (`baseline/fast/dramatic` → remote-selectable `AnimationProfile`). Targets 21–22.
3. **Phase 2b** — K3 strip pipeline + Profile reuse + return-hook wiring (targets Angle 5). Targets 22–23.
4. **Phase 2c** — **WebGL land-moment spike (PM-endorsed 2026-07-19)** per B1: hybrid architecture (CSS reel + WebGL celebration stage), rendered A/B-free comparison via `user-satisfaction-audit` on both renders, pre-agreed ship gate (Angle-4 +3, Angle 6 = 4, 55fps mid-tier, ≤600KB). Fake-3D transforms remain the fallback if the spike fails its gate.
5. **Phase 3** — animated share clip (B3, feature-flagged) + rare-variant easter eggs. Targets 24.

---

## 7. TL;DR recommendation

**PM directive (2026-07-19):** maximum scope, target 24/24 under the strictest audit measure — sequencing per §6.5.

1. Instrument first (Phase 0) — you can't iterate wow you can't measure.
2. Finish the approved storyboard with the particle system you already own, **including the F1 blend-archetype near-miss reframe** (Phase 1) — biggest wow-per-hour, and the only change that moves Angle 4 (emotional resonance) to 4/4.
3. Point K3 at its two genuine strengths: **sandbox choreography prototyping** and **pre-rendered per-archetype reveal strips** through the existing sprite/CDN/fallback infrastructure (Phase 2) — never as a runtime dependency.
4. Keep the ethics cap, the kill switch, and the degradation tiers untouched; let skip-rate data decide what graduates.
