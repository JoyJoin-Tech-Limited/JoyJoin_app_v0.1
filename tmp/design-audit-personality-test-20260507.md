## Design Audit: Personality Test (Onboarding)

**Target:** `apps/mini-program/src/pages/onboarding/personality-test/` + `results/`
**Auditor:** Kimi Code (post-Phase 3–6 implementation)
**Date:** 2026-05-07

---

### Health Score: 15/20 (Good)

| Dimension | Score | Key Finding |
|-----------|-------|-------------|
| 1. Brand Fidelity | 3/4 | Warm voice, mascot present, custom archetype art. Unicode emoji in answer interactions is the main generic tell. |
| 2. State Completeness | 3/4 | 7/8 states handled. Missing skeleton loaders for question card and results loading phase. |
| 3. Theming & Tokens | 3/4 | Heavy token usage; recent normalization fixed most hardcoded values. `56rpx` pill radius and some box-shadows still inline. |
| 4. Responsive & Safety | 3/4 | `rpx` throughout, safe-area respected. `100dvh` has no older-Android fallback. Host zone `min-height` is a magic number. |
| 5. Performance & Motion | 3/4 | GPU-safe animations only, reduced-motion respected. Slot spin loop triggers sequential `setState`. Spring bounce easing on question transition is borderline. |

---

### Anti-Patterns Found

| # | Violation | Dimension | Location |
|---|-----------|-----------|----------|
| 1 | **Generic Unicode emoji** (🍿💬🤫🕊️🔥😮‍💨🥳) used as primary answer-interaction visuals | Brand Fidelity | `PersonalityTestAnswerArea.tsx:74,78,132` |
| 2 | **Missing skeleton loader** — question card shows nothing between submit and next question render | State Completeness | `index.tsx:736-750` (answer zone) |
| 3 | **Missing skeleton loader** — results page shows only text "准备揭晓…" during initial load | State Completeness | `results/index.tsx:975` (`LoadingStage`) |
| 4 | **Hardcoded `border-radius: 56rpx`** — not a design token | Token Discipline | `PersonalityTestAnswerArea.scss:21,44,70`, `index.scss:576,602,637,644` |
| 5 | **`100dvh` without fallback** — unsupported on older WeChat Android WebViews | Platform Safety | `index.scss:62,750` |
| 6 | **Sequential `setState` in tight loop** — `setReelIndex` + `setProgress` every 120ms during slot spin | Performance | `results/index.tsx:436-438` |
| 7 | **Spring bounce easing** — `cubic-bezier(0.34, 1.56, 0.64, 1)` creates overshoot; framework recommends avoiding bounce | Motion Hygiene | `QuestionTransition.scss:8` |
| 8 | **Legacy CSS duplication** — `index.scss` duplicates `PersonalityTestAnswerArea.scss` for `ENABLE_MASCOT_QUESTIONER` fallback | Token Discipline | `index.scss:550-722` |

---

### Fix List

**P0 — Ship-blocking:**
- [ ] **#1: Replace emoji with branded assets** — Run Lovart brief (`tmp/lovart-brief-personality-emoji-assets.md`), generate 7 PNGs, wire into `PersonalityTestAnswerArea.tsx` + SCSS. Blocked on design delivery.

**P1 — Should fix before merge:**
- [ ] **#2: Add question-card skeleton** — While `isSubmitting`, render a skeleton that mimics the question card shape (same padding, option pill heights) instead of showing the old question with disabled buttons. Prevents "stuck" feeling.
- [ ] **#3: Add results loading skeleton** — Replace `LoadingStage` text-only with a skeleton that mirrors the slot stage layout (progress bar shape + placeholder reel).
- [ ] **#5: Add `100dvh` fallback** — `index.scss`: add `min-height: 100vh` before `min-height: 100dvh` for older WeChat Android.

**P2 — Polish:**
- [ ] **#4: Tokenize pill radius** — Add `$radius-pill: 56rpx` to variables and replace all `border-radius: 56rpx` usages.
- [ ] **#6: Batch slot spin state updates** — In the spin loop, use a single state object `{ reelIndex, progress }` or React 18 automatic batching. Profile with DevTools Performance tab.
- [ ] **#7: Soften question transition easing** — Change from `cubic-bezier(0.34, 1.56, 0.64, 1)` to `cubic-bezier(0.22, 1, 0.36, 1)` (no overshoot) or `cubic-bezier(0.16, 1, 0.3, 1)` (snappy expo-out).
- [ ] **#8: Schedule legacy CSS removal** — Add `@deprecated` comment with target date for `ENABLE_MASCOT_QUESTIONER` gate removal.

---

### Dimension-by-Dimension Evidence

#### D1: Brand Fidelity (3/4)

**What works:**
- Warm beige/cream page backgrounds via `page-gradient-bg` and `page-clean-bg` mixins
- Xiaoyue mascot present at every phase: intro float animation, question expressions (choice/slider/emoji_tap), milestone coaching bubbles (Q4/Q8), results celebration
- Conversational copy: "按直觉选择就好", "悦仔在整理你的回答…", "我在把这份结果装进一张更好分享的 JoyJoin 卡面"
- Custom low-poly archetype illustrations for result cards (corgi, fox, koala, etc.)
- Brand gradient (`$brand-gradient`) used on progress bar and CTAs — warm coral-to-purple, not generic AI blue-purple
- Pill buttons at `56rpx` radius feel soft and approachable
- Typography mixins (`type-display-accent-line`, `type-brand-cta-label`) give Chinese display moments personality

**What breaks it:**
- **Unicode emoji are the primary answer interaction visuals.** Users tap 🍿, 💬, 🤫, 🕊️, 🔥 repeatedly. These are generic, unbranded, and could appear in any app. This is the #1 AI tell on this surface.
- Slider value shown as raw number ("50") feels clinical against the warm copy

**Path to 4/4:** Complete Phase 2 (Lovart emoji assets) + add branded slider thumb/scale labels.

#### D2: State Completeness (3/4)

**Present states:**
| Element | Default | Active | Disabled | Loading | Error | Success | Empty |
|---------|---------|--------|----------|---------|-------|---------|-------|
| Answer option | ✅ | ✅ (`hoverClass`) | ✅ | ✅ | — | ✅ (`--selected`) | — |
| Start button | ✅ | ✅ | ✅ | ✅ (`loading`) | ✅ (inline) | — | — |
| Slider submit | ✅ | ✅ | ✅ | ✅ (`loading`) | ✅ (inline) | — | — |
| Results flow | ✅ (slot) | ✅ (reveal) | — | ✅ (holding) | ✅ (`ErrorStage`) | ✅ (`FinalStage`) | ✅ (`EmptyStage`) |
| Test page | ✅ (intro) | ✅ (testing) | — | ✅ (`completing`) | ✅ (inline) | — | — |

**Missing:**
- **Skeleton for question transition** — When user taps an answer, the old question stays visible with disabled buttons until the API returns. A skeleton matching the next question's card shape would prevent the "stuck" feeling.
- **Skeleton for results loading** — `LoadingStage` is just text. A skeleton mimicking the slot machine layout would set expectations better.
- **Retry affordance on answer failure** — Error shows inline text but no explicit "重试" button; user must re-tap the same option.

**Path to 4/4:** Add skeleton loaders for question transition and results loading; add explicit retry button on answer error.

#### D3: Theming & Token Discipline (3/4)

**Token usage:**
- Colors: `$color-primary`, `$color-primary-dark`, `$color-primary-light`, `$color-surface`, `$color-bg`, `$color-text-primary/secondary/muted`, `$color-error`, `$color-divider`, `$brand-gradient`, `$brand-gradient-to` — all used consistently
- Spacing: `$spacing-xs/sm/md/lg/xl/2xl`, `$container-padding` — 8rpx grid mostly enforced after Phase 5 normalization
- Typography: `$font-size-xs` through `$font-size-4xl`, `$font-weight-*`, mixins `type-label`, `type-body`, `type-title`, `type-display-accent-line`, `type-brand-cta-label`
- Components: `button-primary`, `button-premium`, `card-premium` mixins

**Hardcoded values remaining:**
- `border-radius: 56rpx` (used 6+ times across files) — should be `$radius-pill`
- `box-shadow` values mostly hardcoded (though using rgba with token colors)
- Animation durations hardcoded in SCSS keyframes
- Legacy CSS in `index.scss` duplicates `PersonalityTestAnswerArea.scss` values

**Path to 4/4:** Tokenize `56rpx` pill radius; remove legacy CSS duplication; audit all `box-shadow` values for tokenization.

#### D4: Responsive & Platform Safety (3/4)

**What works:**
- `rpx` units throughout — responsive by design
- `safe-area-inline` mixin for notched devices
- `overflow-wrap: anywhere` + `word-break: break-word` for CJK text
- `ScrollView` with `enhanced` and `showScrollbar={false}`
- `-webkit-overflow-scrolling: touch`
- `min-height: $button-height` ensures reasonable touch targets
- `prefers-reduced-motion` media queries in SCSS

**Issues:**
- `100dvh` used in `index.scss` for viewport lock — not supported on WeChat Android <8.0 / older WebViews. Needs `100vh` fallback.
- `__host-zone` `min-height: 180rpx` is a magic number. May not be sufficient on very small screens or excessive on tablets.
- Slider pill emoji displayed at ~28rpx (small) — as an image replacement this will be ~32rpx, which is below the 44×44rpx touch target recommendation. However, the entire pill button is the tap target, not just the emoji.

**Path to 4/4:** Add `100vh` fallback; test host-zone height across device sizes; verify touch targets meet 44×44rpx.

#### D5: Performance & Motion Hygiene (3/4)

**What works:**
- Only `transform` and `opacity` animated — no layout property animation
- `will-change: transform` on hero visual and mascot
- `prefers-reduced-motion` respected in all SCSS files
- Staggered entrance capped at `index * 0.05s` (max ~200ms for 4 options)
- Slot machine uses `setTimeout`-based state updates, not `requestAnimationFrame` loops
- Frame budget measurement (`getDegradationTier()`) with tiered degradation: minimal/emergency skips all effects; reduced skips glow/sparkle
- Canvas poster generation is async and off-main-thread

**Issues:**
- Slot spin loop calls `setReelIndex` + `setProgress` every 120ms. In React <18 this causes two re-renders per tick. React 18 auto-batching may help, but should be verified.
- `cubic-bezier(0.34, 1.56, 0.64, 1)` on question transition has intentional overshoot (spring). Framework guidance says "Avoid: bounce or elastic easing." This is borderline — it's purposeful (spring feel for question change), but the overshoot could feel slightly toy-like.
- Share poster canvas operations may be heavy on low-end devices; no resolution cap documented.

**Path to 4/4:** Batch slot spin state updates; replace spring bounce with expo-out easing; add canvas resolution cap comment.

---

### Verdict

**Fix then ship.**

The surface is well-crafted and unmistakably JoyJoin. The P0 (emoji replacement) is acknowledged as blocked on design assets. Address the P1 skeleton loaders and `100dvh` fallback before merge; P2 polish can follow in a subsequent PR.
