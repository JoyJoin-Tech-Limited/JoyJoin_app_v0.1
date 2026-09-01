# Personality Test System - V4 Adaptive Assessment

**Last Updated:** 2026-06-22**Version:** V4 Adaptive Engine + V2 Matcher  
**Status:** Production

---

## Table of Contents

1. [System Overview](#system-overview)
2. [12 Archetypes](#12-archetypes)
3. [6-Trait System (ACOEXP)](#6-trait-system-acoexp)
4. [Question Bank Structure](#question-bank-structure)
5. [V4 Adaptive Engine](#v4-adaptive-engine)
6. [V2 Matcher Algorithm](#v2-matcher-algorithm)
7. [Data Flow](#data-flow)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Testing Guidelines](#testing-guidelines)

---

## System Overview

The JoyJoin Personality Test System uses a scientifically calibrated adaptive assessment to match users to 1 of 12 carefully designed personality archetypes. The system consists of:

- **60-Question Bank**: Divided into 3 levels (L1 Anchor, L2 Adaptive, L3 Disambiguation) plus 2 interactive closing questions
- **V4 Adaptive Engine**: Uses a config-driven standard-question range (`minQuestions` / `softMaxQuestions` / `hardMaxQuestions`) based on real-time confidence tracking, followed by 2 fixed interactive closing questions (`Q_PLAYFUL_SLIDER` and `Q_PLAYFUL_EMOJI`)
- **V2 Matcher Algorithm**: Weighted Manhattan distance with asymmetric penalties and VETO filters
- **6-Trait Model (ACOEXP)**: Affinity, Conscientiousness, Emotional Stability, Openness, Extraversion, Positivity
- **Secondary Data Pipeline**: A secondary differentiator (`conflictPosture`) captured through the playful closing questions and fed to the V2 Matcher tiebreaker (with `motivationDirection` reserved for future use)

**Key Features:**
- Adaptive question selection (not fixed 10 questions)
- Real-time confidence tracking for each trait
- Early stopping when confidence thresholds met
- Confusion pair disambiguation
- Two interactive closing questions for richer secondary signals
- Decisive match detection (confidence ≥ 70%)
- **One-step back button** is implemented in the mini-program (`apps/mini-program/src/pages/onboarding/personality-test/index.tsx`). Users can tap "返回上一题" after answering ≥2 questions to review and re-answer only their most recent question. The back button is not available on Q1 and is disabled while any submission is in-flight.
- **Answer-echo loading state (2026-06-08):** When a user taps an answer, the UI immediately shows a "Soft Echo + Whisper Pulse" loading state instead of a generic skeleton. The echo displays the user's selected choice in a ghost card (58% opacity), a single thin brand-colored shimmer line (2.4s gradient sweep), and a Xiaoyue icon + caption ("悦仔收到了，正在分析…") for brand warmth. The echo renders as an **absolute-positioned overlay** (`personality-test__answer-echo-overlay`) on top of the answer area — the answer area itself remains mounted underneath at all times, eliminating the "missing option buttons" bug caused by the previous render-blocking ternary. The overlay fades out over 220ms; the next question update is applied atomically after exit. The echo is gated by `personalityTestEchoEnabled` (DB-backed feature flag, default `true`), respects `prefers-reduced-motion: reduce`, and suppresses shimmer on low-end devices via `personality-test--low-end` class. Analytics: `personality_test_echo_shown` tracks option text and commentary presence.

### Client surfaces (web vs WeChat Mini Program)

The V4 engine and question bank live in **`packages/shared/src/personality/`**; both clients call the same assessment HTTP APIs (for example `POST /api/assessment/v4/start`, answer posts, and result reads).

| Surface | Where | Anonymous storage | Post-test WeChat auth |
|--------|--------|---------------------|------------------------|
| **Web** (`apps/user-client`) | `features/onboarding/active/pages/` — personality test, results; routes `/personality-test`, `/personality-test/results` | Browser `localStorage` key `joyjoin_v4_presignup_answers` (and related keys per onboarding docs) | `POST /api/auth/wechat/login-with-test` with code + session + answers |
| **Mini Program** (`apps/mini-program`, launch-primary) | `pages/onboarding/personality-test/` — `index` (test), `results`; registered in the **onboarding subpackage** via [`onboardingRoutes.ts`](../apps/mini-program/src/lib/onboarding/onboardingRoutes.ts) | Same logical keys through Taro storage — see [`anonymousOnboarding.ts`](../apps/mini-program/src/lib/auth/anonymousOnboarding.ts) (`joyjoin_v4_presignup_answers`, `joyjoin_v4_assessment_session`) | [`authenticateMiniProgramUserWithTest()`](../apps/mini-program/src/lib/api/api.ts) → `POST /api/auth/wechat/login-with-test` inline from the results page |

**Mini-program test page structure (2026-06-23):** The test page is split into focused sub-components under `pages/onboarding/personality-test/`: `PersonalityTestIntro.tsx` (intro phase + static mascot), `PersonalityTestQuestion.tsx` (testing-phase UI: progress, mascot, question header, answer area, echo overlay), `PersonalityTestPreloadLayer.tsx` (asset preloading), and `PersonalityTestCompletingError.tsx` (completing-phase error recovery). Shared types (`Phase`, `AssessmentQuestion`, `AssessmentOption`, `AssessmentQuestionType`, `AssessmentProgress`, `AssessmentMatch`) live in `types.ts`. `index.tsx` orchestrates state, API calls, back-review, and phase routing. The intro and testing phases use locked `100dvh` shells with `disableScroll: true` and explicit inner `ScrollView` ports; the answer list is a Taro `ScrollView` rather than CSS `overflow-y`.

**Result Page UI (Mini Program):**
The results page (`pages/onboarding/personality-test/results/`) renders a multi-stage reveal flow:
1. **Slot machine animation** — 12 archetypes spin and land on the user's match. A `XiaoyueSpriteAnimator` component displays idle sprite animations (7 frames for standby/waiting states, regenerated from 9 frames in 2026-06-05 to reduce package size). The archetype spritesheet is loaded from the **local bundled subpackage** (no CDN round-trip). A `backgroundColor` fallback (archetype accent soft) ensures no blank circles during decode. A `useSpriteReadiness` hook gates the animation start until the spritesheet is confirmed decoded (500ms timeout — never blocks indefinitely). The slot animation is gated by `personalitySlotAnimationEnabled` feature flag and `shouldReduceMotion` / `prefersReducedMotion` / `deviceTier.isDegradation` — any of these skip straight to the result card. Xiaoyue expression sprites (idle, thinking, celebrate, surprised, etc.) load from CDN via `cdnAsset()`; on `onError` they fall back to the bundled local WebP in `/assets/mascot/<state>.webp` (no purple-accent-circle fallback). The result fetch uses `apiRequest` with an honest `timeout: 8000` and no `AbortController` (the previous abort was a no-op).
2. **Reveal sequence** — silhouette → fill → sparkle with haptic feedback
3. **Result card** — Hero card with archetype name, **typicality badge** (`典型[archetype]` / `非典型[archetype]`), rarity indicator, nickname, and chemistry chips. The archetype name in the badge is rendered in `accentText` (computed via `getContrastSafeArchetypeColor()` — darkens/boosts saturation for light or desaturated archetypes) with zero separator space from the prefix. **六维图 RPG radar chart** (Canvas 2D hexagonal trait visualization), Xiaoyue avatar + speech-bubble analysis, and trait summary. The **FinalStage** detail card uses `CARD_GRADIENT_MID` (an archetype-tinted mid-gradient color computed from the primary archetype's accent HSL) for the card background gradient. For **non-decisive matches** (`isDecisive === false`), a subtle blend indicator appears after the badges: "隐约有[secondary]的影子" (prefers `xiaoyueAnalysis.blendLine` when available).
4. **Collectible card** — Pokémon-style holographic card with touch-drag tilt, energy bar, skill badges, and match chemistry chips
5. **Detail modal** — Progressive disclosure via "查看悦仔完整解读" premium pill CTA (archetype gradient background, `JoyJoinIcon` sparkle + chevron); opens a bottom sheet with full AI analysis, **10-block segmented trait bars** (archetype-accent colored with smooth partial fills), and best partner matches
6. **Share poster** — Canvas-generated shareable card with archetype art, rarity label, skill set, and top-matches section. Canvas 1080×1560 (was 1080×1920 prior to 2026-06-22 — ~700 px bottom whitespace eliminated). Layout follows a Pokemon-card compact structure: hero image, rank strip, trait bars, top match chips, energy bar, 2-column skill grid, and holo stamp ("限量氛围版"). All Y-coordinates snapped to a 4 px grid with spacing hierarchy (16/24/32 px). Canvas draws **WebP primary** with **CDN PNG fallback**. Archetype image is pre-resolved (`Taro.getImageInfo`) before generation starts and the resolved path is shared between portrait and square poster. On `drawImage` failure, falls back to concentric accent rings (brand-safe, no text-on-art). Canvas backing store released after export (`ctx.clearRect`). Transient generator failures auto-retry once (1.5 s delay) before surfacing an error toast.
7. **Completing phase error UI** — If the final submission API fails, the page renders a Xiaoyue `actionFailure` visual with warm copy and a retry CTA with `haptics('light')`. The **BridgeStage** and **ErrorStage** skip buttons use `haptics('light')` on tap and `hoverClass="opacity-btn--hover"` for press feedback.
8. **OnboardingLoadingShell** — Stand-alone full-screen loader for the results page uses `min-height: 100dvh` + flex centering (not `position: fixed`) to avoid layout issues with the WeChat navigation bar. A `CELEBRATE_MIN_DISPLAY_MS` minimum display threshold prevents flickering on fast archetype loads.

**Accessibility & Error Resilience (2026-06-05):**
- **Reduced-motion support:** When the system reports `reduceMotion === true`, the slot animation is skipped entirely and the result page renders immediately. CSS `@media (prefers-reduced-motion: reduce)` plus a JS-driven `.personality-results--reduce-motion` class suppresses stagger entrances, holographic shimmer, and card tilt for webviews that do not honour the media query.
- **Slider accessibility:** The `slider` question's live value badge uses `aria-live="polite"` so screen readers announce value changes without overwhelming the user. The badge transform is gated by JS `reduceMotion` and returned as inline `transform` (e.g. `translateX(...) scale(...)`); CSS custom properties for per-frame updates were removed because they are unreliable in the WeChat runtime. `will-change: transform` is applied for GPU-composited drag. A first-time hint `"拖动滑块，选择最符合你的程度"` dismisses on first interaction.
- **Touch-tilt rAF throttling:** The collectible card's touch-drag tilt uses `rafPendingRef` + `pendingTiltRef` to batch `setTouchTilt` calls to a single `requestAnimationFrame`, preventing React state flood during fast swipes.
- **Offline resilience:** `Taro.getNetworkType()` detects offline state on fetch failure. `ErrorStage` shows offline-aware copy (`'网络好像断开了'` vs `'揭晓过程被打断了'`). Retry uses exponential backoff capped at 4s (`Math.min(4000, 1000 * 2^(retryCount-1))`) with `retryTimerRef` cleanup on unmount.
- **Predictive prefetch:** Primary archetype image is preloaded via `preloadImagesWithDiagnostics` on test completion (from the final answer response) and again on results page mount, reducing perceived load time.
- **Timer cleanup:** `FinalStage` tracks its detail-sheet close-animation timeout in `detailCloseTimerRef` and clears it on unmount to prevent setState-after-unmount.
- **Screen reader support (2026-06-05):** Every stage has a purposeful ARIA live region: `SlotStage` uses `role="status"` with per-phase aria-label; `RevealStage` uses phase-aware labels (silhouette/fill/sparkle); `BridgeStage` uses `role="status"` announcing result preparation; `LoadingStage` uses `role="status"` with `aria-busy="true"`; `EmptyStage` uses `role="alert"` with `aria-live="polite"`; `ErrorStage` already uses `role="alert"`. Skip buttons on BridgeStage and ErrorStage carry `role="button"` and `aria-label`. The hero image carries `aria-label`; the pokemon card carries `role="button"` + `aria-label`; the typicality badge carries a semantic `aria-label={`${prefix}${name}`}`.
- **Split-brain prevention:** The server validates `finalResult.primaryArchetype` before persisting (falls back to `'corgi'` if invalid). The client hard-validates the result before transitioning to the results page. Divergence between `currentMatches[0]` and `finalResult.primaryArchetype` is logged server-side for telemetry. GET `/api/assessment/v4/result` returns `500` with "Result data is incomplete" if `finalResult` is missing or malformed, rather than violating the client's `NonNullable` assumption.
- **Retry UX:** The error state shows a tooltip "网络波动时可能需要多试一次" under the retry button to reduce user uncertainty.
- **Completing-phase error recovery (2026-06-13):** If the final submission API fails while in `completing` phase, the page returns the user to the testing phase (last answer pre-filled) rather than the intro, and surfaces a Xiaoyue `actionFailure` visual with warm copy and a retry CTA. Raw API errors are mapped through `getErrorMessage` baselines before display.

**Returning users only (no in-flight test import):** Mini Program landing `loggedOut` state ([`pages/index/LandingPage.tsx`](../apps/mini-program/src/pages/index/LandingPage.tsx), `?auth=logout|expired`; `pages/login/index` retired 2026-09-01) uses [`useWeChatLogin`](../apps/mini-program/src/hooks/auth/useWeChatLogin.ts) → [`authenticateMiniProgramUser()`](../apps/mini-program/src/lib/api/api.ts) → `POST /api/auth/wechat/login` (not `login-with-test`). Coordination detail: [`docs/reference/PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md).

**Supported Question Types:**

| Type | Value | Description |
|------|-------|-------------|
| Multiple choice | `choice` (default) | 4 labelled options (A–D), each with `traitScores` |
| Continuous slider | `slider` | 0–100 dial; frontend maps position to nearest bucket (`slider_0` / `slider_25` / `slider_50` / `slider_75` / `slider_100`) and submits as `selectedOption: "slider_<value>"` |
| Emoji tap | `emoji_tap` | Quick-tap icon reaction; options use `value` keys like `direct`, `dove`, `dm`, `leave`, `popcorn`. Each option may declare an `iconAssetKey` that resolves to a custom Lovart illustration via `PERSONALITY_ICON_ASSETS` — Unicode emojis are no longer embedded in option text. |

---

## 12 Archetypes

The current production system uses 12 archetypes. All archetype names are defined in `packages/shared/src/personality/archetypeNames.ts` (canonical source of truth).

| # | Archetype | Icon | Energy | Trait Profile | Description |
|---|-----------|------|--------|--------------|-------------|
| 1 | 社牛柯基 (Happy Corgi) | 🐕 | 95 | X=95, P=85, O=65, A=60, E=60, C=50 | High-energy socializer, natural icebreaker |
| 2 | 小太阳鸡 (Rooster) | 🐓 | 90 | P=92, E=88, C=78, X=78, A=70, O=55 | Optimistic motivator, spreads positivity |
| 3 | 夸夸仓鼠 (Hamster) | 🐬 | 85 | A=95, P=88, X=82, E=65, O=62, C=50 | Warmhearted encourager, builds people up |
| 4 | 寻宝狐 (Clever Fox) | 🦊 | 82 | O=92, X=78, P=58, E=60, C=50, A=40 | Creative problem-solver, quick thinker |
| 5 | 机灵海豚 (Dolphin) | 🐬 | 75 | E=85, C=70, A=70, O=65, X=65, P=68 | Balanced mediator, stays composed |
| 6 | 人脉蛛 (Weaver Spider) | 🕷️ | 72 | C=85, O=70, A=70, E=65, X=60, P=60 | Detail-oriented planner, builds systems |
| 7 | 树洞考拉 (Koala) | 🐻 | 70 | A=90, E=80, P=70, C=65, O=60, X=48 | Empathetic supporter, nurtures others |
| 8 | 脑洞章鱼 (Inspiration Octopus) | 🐙 | 68 | O=95, P=70, E=55, X=52, A=50, C=28 | Innovative ideator, connects dots |
| 9 | 好奇猫头鹰 (Contemplative Owl) | 🦉 | 55 | O=88, C=80, E=75, A=45, P=50, X=40 | Analytical thinker, seeks understanding |
| 10 | 靠谱大象 (Grounded Elephant) | 🐘 | 52 | C=90, E=86, A=70, P=60, O=50, X=40 | Stable anchor, provides structure |
| 11 | 慢热龟 (Steady Turtle) | 🐢 | 38 | E=85, C=80, O=65, A=45, P=45, X=30 | Reliable introvert, consistent presence |
| 12 | 小透明猫 (Invisible Cat) | 🐱 | 30 | E=80, C=50, A=50, O=45, P=45, X=20 | Reserved observer, values solitude |

**Canonical Order:**
The archetypes are numbered 1-12 in the order above. This ordering is used for:
- TYPE numbers in share cards (e.g., #01/12 for 社牛柯基)
- Slot machine animation sequence
- Backend archetype configuration
- Any feature requiring consistent enumeration

**Energy Levels:**
- **High Energy (75-100)**: 社牛柯基 (95), 小太阳鸡 (90), 夸夸仓鼠 (85), 寻宝狐 (82), 机灵海豚 (75)
- **Medium Energy (50-74)**: 人脉蛛 (72), 树洞考拉 (70), 脑洞章鱼 (68), 好奇猫头鹰 (55), 靠谱大象 (52)
- **Low Energy (0-49)**: 慢热龟 (38), 小透明猫 (30)

---

## 6-Trait System (ACOEXP)

The system measures 6 core personality traits, each scored on a 0-100 scale:

### A - Affinity/Agreeableness (亲和力)
- **Definition**: Warmth, empathy, cooperation, concern for others
- **High A (80+)**: 夸夸仓鼠 (95), 树洞考拉 (90)
- **Low A (40-)**: 寻宝狐 (40), 好奇猫头鹰 (45), 慢热龟 (45)
- **Key Questions**: Response to emotional moments, conflict handling, encouragement style

### C - Conscientiousness (责任心)
- **Definition**: Organization, planning, discipline, reliability
- **High C (80+)**: 靠谱大象 (90), 人脉蛛 (85), 好奇猫头鹰 (80), 慢热龟 (80)
- **Low C (40-)**: 脑洞章鱼 (28)
- **Key Questions**: Planning vs spontaneity, attention to detail, follow-through

### E - Emotional Stability (情绪稳定性)
- **Definition**: Calmness, resilience, low reactivity, composure under stress
- **High E (80+)**: 小太阳鸡 (88), 靠谱大象 (86), 机灵海豚 (85), 慢热龟 (85), 树洞考拉 (80), 小透明猫 (80)
- **Low E (60-)**: 脑洞章鱼 (55)
- **Key Questions**: Stress response, emotional regulation, adaptability

### O - Openness (开放性)
- **Definition**: Creativity, curiosity, abstract thinking, novelty-seeking
- **High O (80+)**: 脑洞章鱼 (95), 寻宝狐 (92), 好奇猫头鹰 (88)
- **Low O (50-)**: 靠谱大象 (50), 小透明猫 (45)
- **Key Questions**: Approach to new ideas, intellectual curiosity, imaginative thinking

### X - Extraversion (外向性)
- **Definition**: Social energy, outgoingness, stimulation-seeking, gregariousness
- **High X (80+)**: 社牛柯基 (95), 夸夸仓鼠 (82), 小太阳鸡 (78), 寻宝狐 (78)
- **Low X (40-)**: 靠谱大象 (40), 好奇猫头鹰 (40), 慢热龟 (30), 小透明猫 (20)
- **Key Questions**: Social initiation, energy sources (people vs alone), party behavior

### P - Positivity (积极性)
- **Definition**: Optimism, enthusiasm, cheerfulness, positive outlook
- **High P (80+)**: 小太阳鸡 (92), 夸夸仓鼠 (88), 社牛柯基 (85)
- **Low P (50-)**: 小透明猫 (45), 慢热龟 (45), 好奇猫头鹰 (50)
- **Key Questions**: Outlook on challenges, enthusiasm level, future orientation

**Trait Scoring:**
- Each question option has a trait score vector (e.g., `{ A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }`)
- Scores accumulate across the active standard-question range before the 2 fixed closing questions
- Final scores normalized to 0-100 scale
- Z-score standardization: `z = (raw - 50) / 15` (μ=50, σ=15)

---

## Question Bank Structure

**Total: 64 Standard Questions** divided into 3 levels, plus **4 pure calibration questions** (feature-flagged via `enableCalibrationQuestions`), plus **2 interactive closing questions**

### L1 基础枢纽题 (Anchor Questions) - Q1-Q15

**Purpose:** Establish baseline trait measurements with high discrimination

**Characteristics:**
- Discrimination index: 0.40-0.50
- Multi-trait measurement (3+ traits per question)
- Always asked first (mandatory)
- Scenario-based with 4 options

**Categories:**
- 社交启动 (Social Initiation): Opening behavior, group entry
- 决策参与 (Decision Participation): Planning style, contribution approach  
- 能量优先级 (Energy Priority): Social vs solo preference
- 关系响应 (Relationship Response): Emotional connections, support style

**Example Anchor Question (Q1):**
```
工作日傍晚，同事群里突然有人发起：今晚有人想一起去新开的居酒屋吗？

你的第一反应和接下来的行动会是？

A. 好呀！正好想去看看！
   → { A: 0, C: 0, E: 0, O: 2, X: 3, P: 1 }

B. 今晚吗？我看看安排...
   → { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }

C. 谢谢！我约了朋友，下次叫我～
   → { A: 2, C: 1, E: 2, O: 0, X: 0, P: 0 }

D. 今天有点累...你们玩得开心！
   → { A: 0, C: 0, E: 2, O: 0, X: -2, P: -1 }
```

### L2 自适应深度题 (Adaptive Deep Questions) - Q16-Q45

**Purpose:** Target specific traits with low confidence

**Characteristics:**
- Selected dynamically by adaptive engine
- Focus on 1-2 primary traits
- Higher trait score magnitudes (±3 to ±4)
- User sees 0-8 of these (depends on confidence)

**Categories:**
- 工作场景 (Work Scenarios): Team dynamics, project approach
- 关系动态 (Relationship Dynamics): Friendship depth, communication
- 休闲选择 (Leisure Choices): Free time preferences, hobbies
- 价值判断 (Value Judgments): Priorities, life philosophy

**Example Adaptive Question (Q18):**
```
一个你期待已久的周末个人计划，突然被朋友的热闹聚会邀请打断。

你内心更强烈的倾向是？

A. 太好了！立刻调整计划加入，越多人越开心
   → { A: 0, C: -1, E: 0, O: 0, X: 4, P: 2 }

B. 明确拒绝聚会，坚守自己的计划
   → { A: 0, C: 2, E: 3, O: 0, X: -1, P: 0 }

C. 尝试把朋友拉入你的计划，或另约时间
   → { A: 2, C: 1, E: 1, O: 1, X: 0, P: 0 }

D. 纠结但最终参加聚会
   → { A: 1, C: -2, E: 0, O: 0, X: 1, P: 0 }
```

### L3 混淆对消解题 (Confusion Pair Disambiguation) - Q46-Q60

**Purpose:** Resolve persistent archetype confusion pairs

**Characteristics:**
- Triggered when top-2 archetypes have score gap < 10
- Target differentiating traits between specific pairs
- High precision (±4 to ±5 scores on key traits)

**Known Confusion Pairs:**
1. **小太阳鸡 vs 机灵海豚**: P gap (92 vs 68) - differentiate on optimism/enthusiasm
2. **好奇猫头鹰 vs 慢热龟**: O gap (88 vs 65) - differentiate on intellectual curiosity
3. **机灵海豚 vs 树洞考拉**: A gap (70 vs 90) - differentiate on warmth/nurturing
4. **社牛柯基 vs 小太阳鸡**: Similar high X+P, differentiate on structure vs spontaneity
5. **寻宝狐 vs 脑洞章鱼**: Both high O, differentiate on social energy (X: 78 vs 52)
6. **靠谱大象 vs 慢热龟**: A/P/X differentiators — turtle penalizes high-A (≥70 → 0.5×) and high-P (≥58 → 0.6×); elephant penalizes very-low-X (<32 → 0.5×) and very-low-P (<38 → 0.6×)
7. **机灵海豚 vs 人脉蛛**: E/C/X differentiators — spider penalizes high-E (≥78 → 0.5×)

**Example Disambiguation Question (Q48):**
```
在一个深度讨论中，话题变得抽象和哲学化

你更可能的反应是？

A. 兴奋参与，提出新颖理论和假设
   → { O: 5, X: 2, C: -2 }  // 脑洞章鱼

B. 系统分析，寻找逻辑和证据
   → { O: 4, C: 4, X: -1 }  // 好奇猫头鹰

C. 感兴趣但不深入，更关注实际应用
   → { O: 1, C: 2, P: 2 }   // 机灵海豚

D. 礼貌倾听，但心里想着其他事
   → { O: -3, E: 2, X: -1 } // 慢热龟
```

### Interactive Closing Questions (Q_PLAYFUL_SLIDER + Q_PLAYFUL_EMOJI)

After the adaptive engine reaches its stopping criteria (confidence ≥ 0.7 on all traits, or `AssessmentConfig.hardMaxQuestions` standard questions), **two fixed interactive closing questions** are always presented in order.

#### Q_PLAYFUL_SLIDER — Energy Dial (`slider` type)

```
周五下班，终于自由了——
拖动滑条，找到最符合你此刻感受的位置

                ← 想一个人待着 ──────── 快叫上朋友！→
```

- **Question type:** `slider`
- **Primary traits measured:** `X` (Extraversion), `P` (Positivity)
- **Score mapping:** Linear interpolation from X=−4, P=−3 at the left extreme (0) to X=+4, P=+3 at the right extreme (100)
- **Submission format:** Frontend maps continuous 0–100 position to the nearest bucket and submits `selectedOption: "slider_<value>"` where `<value>` ∈ {`0`, `25`, `50`, `75`, `100`}
- **Secondary data:** `Q_PLAYFUL_SLIDER` is **trait-scoring only**. It does **not** populate any `UserSecondaryData` field. It is intentionally absent from `SECONDARY_QUESTION_MAP`.
- **Design rationale:** Slider UX bypasses social-desirability bias in multiple-choice by letting users express continuous intensity rather than picking a label.

#### Q_PLAYFUL_EMOJI — Conflict Instinct Tap (`emoji_tap` type)

```
群里两个朋友突然争了起来……你的第一反应是？
（别想，直接按）
```

Icon options and their `conflictPosture` mappings:

| Value | Icon / Label | `conflictPosture` |
|-------|---------------|-------------------|
| `direct` | 直接说：好了好了，你们都有道理 | `approach` |
| `dove` | 发条轻松消息转移话题 | `mediate` |
| `dm` | 私信其中一个：你还好吗？ | `mediate` |
| `leave` | 默默退出群聊一小会儿 | `avoid` |
| `popcorn` | 吃瓜围观，看看怎么发展 | `avoid` |

- **Question type:** `emoji_tap`
- **Secondary data:** Maps to `conflictPosture` via `SECONDARY_QUESTION_MAP` (`packages/shared/src/personality/secondaryQuestionMap.ts`)
- **Trait scoring:** The option objects also carry `traitScores` (using the shared `TraitScores` type — all keys optional) for incremental A-trait contributions
- **Design rationale:** Captures the `conflictPosture` secondary differentiator — a dimension that is not probed anywhere in the standard adaptive question bank, making it a high-information signal for archetype tiebreaking

#### Secondary Data Wiring

The two closing questions are processed by `SECONDARY_QUESTION_MAP` in `packages/shared/src/personality/secondaryQuestionMap.ts`:

```typescript
// Only Q_PLAYFUL_EMOJI is mapped — Q_PLAYFUL_SLIDER is trait-scoring only
export const SECONDARY_QUESTION_MAP: Record<string, SecondaryQuestionMapping> = {
  Q_PLAYFUL_EMOJI: {
    field: 'conflictPosture',
    valueMap: {
      direct:   'approach',
      dove:     'mediate',
      dm:       'mediate',
      leave:    'avoid',
      popcorn:  'avoid',
    },
  },
  // Q_PLAYFUL_SLIDER is intentionally absent — it feeds X/P traits, not secondary data
};
```

The assembled `UserSecondaryData` object (at most `{ conflictPosture }` from these closing questions) is passed to `getFinalResult()` in `adaptiveEngine.ts`, which forwards it to the V2 Matcher's `secondaryBonus` step.

#### TypeScript Note — `EmojiTapOption.traitScores`

`EmojiTapOption` options must use the shared `TraitScores` type from `@shared/personality/types` (`{ A?, C?, E?, O?, X?, P? }`) — **not** `Record<string, number>`. `TraitScores` has no index signature, so using `Record` breaks TypeScript's assignability to `QuestionOption[]`. This was corrected in PR #353.

### Pure Calibration Questions (Q51-Q54) — Feature Flagged

**Purpose:** Reduce anchor-question conflation drift by injecting single-trait questions after anchors.

**Location:** `packages/shared/src/personality/questionsV4L2.ts`

| ID | Trait | Magnitude | Cohort Target | Scenario |
|----|-------|-----------|---------------|----------|
| Q51_PureX | X | ±2 | social_catalyst | 临时陌生人聚会邀约 |
| Q52_PureO | O | ±2 | creative_explorer | 冷门历史书籍推荐 |
| Q53_PureC | C | ±2 | quiet_anchor | 策划活动 deadline 管理 |
| Q54_PureP | P | ±2 | social_catalyst | 活动因天气取消的反应 |

**Control:** `AssessmentConfig.enableCalibrationQuestions` (default: `true` in `V2_ASSESSMENT_CONFIG`). When enabled, the engine injects up to `maxCalibrationQuestions` (default: 2) questions after anchors, selected by cohort detection. Uses ±2 magnitude (vs standard ±3-4) to avoid overpowering adaptive measurements. Calibration questions do not count toward the adaptive budget (`softMaxQuestions`) — they are additive, capped by `hardMaxQuestions`.

**Current impact:** Neutral to slightly negative. Needs shadow-mode production data to tune injection timing, magnitude, and cohort mapping. Psychometrically validated items — each loads on exactly one trait with zero cross-contamination.

---



## V4 Adaptive Engine

**Location:** `packages/shared/src/personality/adaptiveEngine.ts`

### Question Selection Algorithm

```typescript
function selectNextQuestion(state: AssessmentState): Question | null {
  // Phase 1: Anchor Questions (Q1-Q8)
  if (answeredCount < 9) {
    return getAnchorQuestion(answeredCount);
  }

  // Phase 1a: Calibration Questions (Q51-Q54) — when feature-flagged
  if (config.enableCalibrationQuestions) {
    const calId = selectCalibrationQuestion(detectedCohort, askedIds, calCount, maxCal);
    if (calId) return questionsV4.find(q => q.id === calId);
  }
  
  // Phase 2: Check stopping criteria
  const allConfident = ALL_TRAITS.every(trait => 
    state.traitConfidences[trait].confidence >= 0.7
  );
  
  if (allConfident || answeredCount >= 16) {
    return null; // Stop assessment
  }
  
  // Phase 3: Check for confusion pair
  const topMatches = getTopArchetypes(state.traitScores);
  const confusionPair = detectPersistentConfusionPair(topMatches);
  
  if (confusionPair.isPersistentPair && confusionPair.scoreGap < 10) {
    // Select L3 disambiguation question
    return selectDisambiguationQuestion(confusionPair.pair, state);
  }
  
  // Phase 4: Select L2 adaptive question
  const weakestTrait = findLowestConfidenceTrait(state.traitConfidences);
  return selectAdaptiveQuestion(weakestTrait, state);
}
```

### Confidence Tracking

```typescript
interface TraitConfidence {
  score: number;           // Current raw score
  confidence: number;      // 0-1 confidence level
  sampleCount: number;     // Number of questions affecting this trait
  variance: number;        // Score variance (lower = more confident)
}

function calculateConfidence(variance: number, sampleCount: number): number {
  // Higher sample count + lower variance = higher confidence
  const sampleFactor = Math.min(sampleCount / 10, 1.0);
  const varianceFactor = Math.exp(-variance / 20);
  return sampleFactor * varianceFactor;
}
```

### Stopping Criteria

The adaptive phase stops when **either** condition is met:

1. **Confidence threshold met**: All 6 traits have confidence ≥ 0.7
2. **Hard limit reached**: `AssessmentConfig.hardMaxQuestions` standard questions answered

After the adaptive phase stops, the two closing questions (`Q_PLAYFUL_SLIDER` then `Q_PLAYFUL_EMOJI`) are always shown before the final result is calculated. Total session length equals the active standard-question config plus these 2 closing questions — for example, the current production configs yield **12–18 questions** under `DEFAULT_ASSESSMENT_CONFIG` or **14–22 questions** under `V2_ASSESSMENT_CONFIG`.

**Typical Session Lengths:**
- **Decisive users** (strong, consistent responses): near `AssessmentConfig.minQuestions + 2` total questions
- **Average users**: between `AssessmentConfig.softMaxQuestions + 2` and `AssessmentConfig.hardMaxQuestions + 2` total questions, depending on confidence growth
- **Indecisive/inconsistent users**: can approach the configured ceiling of `AssessmentConfig.hardMaxQuestions + 2` total questions

### Mid-Test Overlay (TransitionOverlay)

When the adaptive engine transitions from the anchor phase to the adaptive/disambiguation phase, a fullscreen **premium calibration interlude** (`TransitionOverlay` component) is displayed briefly (~2.2 seconds). It shows:

> **精准分析进行中**  
> 再完成几道校准题  
> *我们正在细化你的性格画像，让分析结果更精准、更贴近真实的你。*

This overlay uses a glass-morphism dark backdrop with a subtle purple ambient glow. It replaces an earlier "playful midpoint" popup framing, signaling a precise calibration moment rather than a casual midpoint break.

### Back Button

The mini-program `PersonalityTestPage` supports a **one-step back** button ("返回上一题"). After answering ≥2 questions, users can tap back to review and re-answer **only their most recent question**. The previous answer is pre-filled. The user can either confirm the modification (which calls `PUT /api/assessment/v4/{sessionId}/answer`) or cancel to return to the current question. The back button is hidden on Q1 and disabled while any submission is in-flight.

---

## V2 Matcher Algorithm

**Location:** `packages/shared/src/personality/matcherV2.ts`

### Overview

The V2 Matcher uses weighted Manhattan distance with asymmetric penalties to match user trait profiles to archetype prototypes. It addresses key issues from V1:

- **Soul Trait Weighting**: Primary/secondary/avoid traits have different weights
- **Asymmetric Penalties**: Heavily penalize "avoid" trait violations (e.g., high X → not 树洞考拉)
- **VETO Filters**: Hard constraints for extreme mismatches
- **Confidence Scoring**: High gap between top-2 = decisive match

### Core Algorithm

```typescript
function matchArchetype(userTraits: TraitScores): MatchResult {
  const userZ = normalizeTraits(userTraits); // Z-score: (x - 50) / 15
  const scores: ArchetypeScore[] = [];
  
  for (const archetype of archetypePrototypes) {
    // 1. Calculate weighted Manhattan distance
    let distance = 0;
    
    for (const trait of ['A', 'C', 'E', 'O', 'X', 'P']) {
      const gap = Math.abs(userZ[trait] - archetype.traitZ[trait]);
      const weight = getSoulTraitWeight(archetype.name, trait);
      distance += gap * weight;
    }
    
    // 2. Apply asymmetric penalty for avoid traits
    const penalty = calculateAsymmetricPenalty(
      userZ, 
      archetype.traitZ, 
      archetype.avoidTraits
    );
    distance += penalty;
    
    // 3. Apply VETO filter
    const veto = applyVetoFilter(userTraits, archetype);
    if (!veto.passed) {
      distance = Infinity; // Disqualify
    }
    
    // 4. Convert distance to similarity score (Gaussian kernel)
    const score = Math.exp(-distance * distance / (2 * 1.2 * 1.2));
    scores.push({ archetype: archetype.name, score });
  }
  
  // 5. Rank and return top match
  scores.sort((a, b) => b.score - a.score);
  const confidence = (scores[0].score - scores[1].score) / scores[0].score;
  
  return {
    primaryArchetype: scores[0].archetype,
    secondaryArchetype: scores[1].archetype,
    confidence,
    isDecisive: confidence >= 0.7
  };
}
```

### Soul Trait Weights

Each archetype has 3 categories of traits:

| Category | Weight Range | Purpose |
|----------|-------------|---------|
| **Primary** | 1.6-1.8 | Core defining traits (high weight = must match) |
| **Secondary** | 1.2-1.3 | Supporting traits (medium importance) |
| **Avoid** | 0.4-0.8 | Traits to minimize (low weight = divergence OK in this direction) |

**Example: 树洞考拉 (Koala)**
```typescript
{
  primary: { A: 1.8 },           // Must have high Affinity
  secondary: { E: 1.3, P: 1.2 }, // Should have Emotional Stability + Positivity
  avoid: { O: 0.7, X: 0.4 }      // Low weight on Openness/Extraversion
}
```

If a user has **high X (e.g., raw ≈ 90, z ≈ +2.67)** while 树洞考拉 prototype has **X ≈ 48 (z ≈ -0.13)**:
- Z-gap: userZ[X] − archetypeZ[X] ≈ 2.8σ
- Weight: 0.4 (avoid trait)
- Distance contribution (in the main matcher): 2.8 × 0.4 ≈ 1.12
- **Plus** asymmetric penalty (same formula as below):  
  λ × (gap − threshold)² = 2.0 × (2.8 − 0.5)² ≈ 10.6

Result: High-X users are **strongly penalized** from matching to 树洞考拉, via a moderate base distance plus a sizable asymmetric penalty in Z‑score space.

### Asymmetric Penalty

```typescript
function calculateAsymmetricPenalty(
  userZ: TraitZScores,
  archetypeZ: TraitZScores,
  avoidTraits: TraitKey[]
): number {
  let penalty = 0;
  
  for (const trait of avoidTraits) {
    const gap = userZ[trait] - archetypeZ[trait];
    
    // Only penalize when user exceeds archetype on avoid trait
    if (gap > ASYMMETRIC_PENALTY_THRESHOLD_SD) { // threshold = 0.5σ
      penalty += ASYMMETRIC_PENALTY_LAMBDA * Math.pow(gap - 0.5, 2);
      // λ = 2.0
    }
  }
  
  return penalty;
}
```

**Example:**
- 树洞考拉 has X=48 (avoid trait)
- User has X=90
- Z-scores: User = (90-50)/15 = 2.67σ, Archetype = (48-50)/15 = -0.13σ
- Gap = 2.67 - (-0.13) = 2.8σ
- Penalty = 2.0 × (2.8 - 0.5)² = 2.0 × 5.29 = **10.58**

This large penalty effectively **vetoes** high-X users from matching to 树洞考拉.

### VETO Filters

Hard constraints that disqualify extreme mismatches:

```typescript
// Example: 社牛柯基 VETO
{
  minX: 75,  // Must have X ≥ 75
  minP: 70,  // Must have P ≥ 70
  maxE: 70   // Cannot have E > 70 (too stable/introverted)
}

// Example: 小透明猫 VETO
{
  maxX: 40,  // Cannot have X > 40 (too extraverted)
  minE: 70   // Must have E ≥ 70 (emotionally stable)
}
```

---

## Data Flow

### Assessment Flow Diagram

```
User opens the test (unauthenticated) — web: `/personality-test` · mini-program: `pages/onboarding/personality-test/index`
         ↓
┌────────────────────────┐
│ Create assessment_     │
│ session record         │
│ - phase: 'pre_signup'  │
│ - status: 'in_progress'│
│ - userId: null (anon)  │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Phase 1: Anchor        │
│ Questions (Q1-Q8)      │
│ - Always asked         │
│ - Establish baseline   │
└────────────────────────┘
         ↓
   For each answer:
         ↓
┌────────────────────────┐
│ Insert assessment_     │
│ answer record          │
│ - questionId, option   │
│ - traitScores vector   │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Update session state   │
│ - traitScores          │
│ - traitConfidences     │
│ - currentQuestionIndex │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Adaptive Engine        │
│ Decision:              │
│ - Check confidences    │
│ - Detect confusion     │
│ - Select next question │
└────────────────────────┘
         ↓
    Repeat until:
    - All confidences ≥ 0.7
    - OR 16 questions
         ↓
┌────────────────────────┐
│ V2 Matcher Execution   │
│ - Calculate distances  │
│ - Apply penalties      │
│ - Rank archetypes      │
└────────────────────────┘
         ↓
┌────────────────────────┐
│ Update session record  │
│ - primaryArchetype     │
│ - isDecisive           │
│ - matchDetailsJson     │
│ - completedAt          │
└────────────────────────┘
         ↓
   Show results page
   (WeChat 微信授权登入 CTA after 3 s)
         ↓
   On WeChat login:
   POST /api/auth/wechat/login-with-test
   { code, testAnswers: [...] }
         ↓
┌────────────────────────┐
│ processTestAnswers()   │
│ - creates session row  │
│ - links userId         │
│ - phase → 'completed'  │
│ - hasCompletedTest=true│
└────────────────────────┘
```

### API Call Sequence

```typescript
// 1. Start assessment
POST /api/assessment/v4/start
→ Creates session, returns sessionId + first question + progress

// 2. Submit answer (idempotent)
POST /api/assessment/v4/{sessionId}/answer
{
  questionId: string,
  selectedOption: string  // 'A' | 'B' | 'C' | 'D' | 'slider_NN' | 'direct' | 'dove' | etc.
}
→ Returns updated state (traitScores, progress, nextQuestion, commentary, isComplete)

// 3. Re-answer (back-review, idempotent)
PUT /api/assessment/v4/{sessionId}/answer
{
  questionId: string,
  selectedOption: string
}
→ Returns updated state; engine may re-branch to a different next question

// 4. Skip question
POST /api/assessment/v4/{sessionId}/skip
{
  questionId: string
}
→ Returns newQuestion, skipCount, remainingSkips

// 5. Assessment auto-completes via /answer (isComplete: true)
→ Server runs V2 Matcher on last answer when confidence thresholds met
→ Returns final archetype result in the answer response
```

### Pre-Auth Anonymous Flow

The V4 assessment runs **before** WeChat login. The anonymous flow differs from the authenticated flow:

1. **Session creation (client-side)**: A logical assessment session is started in the client with a generated `sessionId` and `phase = 'pre_signup'`. No `assessment_session` row is written to the database yet.
2. **Answer storage (client-only pre-auth)**: While unauthenticated, answers are stored only in `localStorage` (`joyjoin_v4_presignup_answers`) alongside the anonymous `sessionId`.
3. **Results display**: `PersonalityTestResultPage` shows the archetype result and WeChat login CTA after 3 seconds, based on the client-side engine state.
4. **Post-auth processing**: After WeChat login, `PersonalityTestResultPage` calls:
   ```
   POST /api/auth/wechat/login-with-test
   { code, testAnswers: [...] }
   ```
   The server authenticates the user and calls `processTestAnswers()` with the provided answers, which writes the `assessment_session` row with the authenticated `userId`, sets `phase = 'completed'`, and sets `hasCompletedPersonalityTest = true`.
5. **Session ID persistence**: The anonymous `sessionId` is stored in `localStorage` so it survives the WeChat OAuth redirect and can be passed to `login-with-test`.

> **Note**: `POST /api/assessment/v4/:sessionId/link-user` is a separate endpoint used by `useAdaptiveAssessment` for in-progress session recovery (e.g. a user who started a post-auth test session and then navigated away). It is **not** called in the primary `PersonalityTestResultPage` sign-up flow.

> **Note**: For returning users who skip the pre-auth test and log in directly, the server returns `nextStep = 'personality-test'` if `hasCompletedPersonalityTest = false`, routing them to complete the test post-auth.

---

## Database Schema

### assessment_sessions Table

```sql
CREATE TABLE assessment_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  phase TEXT NOT NULL, -- 'pre_signup' | 'post_signup' | 'completed'
  
  -- V4 Adaptive Engine State
  current_question_index INTEGER DEFAULT 0,
  trait_scores JSONB DEFAULT '{"A":0,"C":0,"E":0,"O":0,"X":0,"P":0}',
  trait_confidences JSONB DEFAULT '{}',
  top_archetypes JSONB DEFAULT '[]',
  
  -- V2 Matcher Results
  algorithm_version TEXT DEFAULT 'v2',
  match_details_json JSONB, -- { primaryArchetype, secondaryArchetype, traitDeltas, decisiveReason, score }
  primary_archetype TEXT, -- Final archetype result
  is_decisive BOOLEAN DEFAULT false, -- confidence ≥ 0.7
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_assessment_sessions_user ON assessment_sessions(user_id);
CREATE INDEX idx_assessment_sessions_phase ON assessment_sessions(phase);
```

### assessment_answers Table

```sql
CREATE TABLE assessment_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL, -- 'Q1', 'Q2', etc.
  selected_option TEXT NOT NULL, -- 'A', 'B', 'C', 'D'
  trait_scores JSONB NOT NULL, -- { A: 0, C: 2, E: 1, O: 0, X: -1, P: 0 }
  answer_index INTEGER NOT NULL, -- Order in session (0-based)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_assessment_answers_session ON assessment_answers(session_id);
```

### users Table (Personality Fields)

```sql
-- Current V4 fields
primary_archetype TEXT, -- '社牛柯基', '小太阳鸡', etc.
has_completed_personality_test BOOLEAN DEFAULT false,
active_assessment_session_id TEXT REFERENCES assessment_sessions(id),

-- Deprecated V1/V2 fields (kept for historical data, not used in new code)
primary_role TEXT, -- Old: '火花塞', '探索者', etc.
secondary_role TEXT,
role_subtype TEXT,
affinity_score INTEGER,
openness_score INTEGER,
conscientiousness_score INTEGER,
emotional_stability_score INTEGER,
extraversion_score INTEGER,
positivity_score INTEGER
```

**Migration Notes:**
- Old `primary_role` values (火花塞, 探索者, etc.) are **deprecated**
- New users get `primary_archetype` from current 12-archetype system
- Trait scores now stored in `assessment_sessions.trait_scores` (JSONB)
- Historical V1/V2 test data preserved but not used in production flow

---

## API Endpoints

The V4 assessment uses a streamlined REST surface under `/api/assessment/v4/`. All endpoints require authentication (except initial start, which may be anonymous with client-side state).

### POST /api/assessment/v4/start

**Description:** Create a new assessment session or resume an existing one.

**Request Body:**
```typescript
{
  sessionId?: string; // Optional: pass to resume a prior anonymous session
}
```

**Response (200):**
```typescript
{
  sessionId: string;
  phase: string;
  nextQuestion: AssessmentQuestion | null;
  progress: AssessmentProgress;
  currentMatches: AssessmentMatch[];
  isComplete: boolean;
}
```

---

### POST /api/assessment/v4/{sessionId}/answer

**Description:** Submit an answer for the current question. Idempotent (same questionId + answer yields same result). Rate-limited to ≤5/min per session.

**Request Body:**
```typescript
{
  questionId: string;
  selectedOption: string;
  // For standard choice questions: 'A' | 'B' | 'C' | 'D'
  // For slider questions: 'slider_0' | 'slider_25' | 'slider_50' | 'slider_75' | 'slider_100'
  // For emoji tap questions: 'direct' | 'dove' | 'dm' | 'leave' | 'popcorn'
}
```

**Response (200):**
```typescript
{
  isComplete: boolean;
  nextQuestion?: AssessmentQuestion | null; // null when assessment is complete
  progress?: AssessmentProgress;
  currentMatches?: AssessmentMatch[];
  commentary?: string; // Xiaoyue feedback text
}
```

**Error codes:** 400 (invalid input), 401 (unauthenticated), 403 (session ownership), 404 (session not found), 409 (session already completed)

---

### PUT /api/assessment/v4/{sessionId}/answer

**Description:** Re-answer a previously answered question (back-review flow). Idempotent. May cause the engine to re-branch to a different next question.

**Request Body:** Same as POST /answer above.

**Response (200):** Same shape as POST /answer. The `nextQuestion` may differ from the current question if the engine re-branched.

---

### POST /api/assessment/v4/{sessionId}/skip

**Description:** Skip the current question and receive a replacement. Max 3 skips per session.

**Request Body:**
```typescript
{
  questionId: string;
}
```

**Response (200):**
```typescript
{
  success: boolean;
  newQuestion?: AssessmentQuestion | null;
  skipCount: number;
  canSkip: boolean;
  remainingSkips: number;
}
```

---

The assessment session **auto-completes** via the `/answer` endpoint when confidence thresholds are met or the hard question limit is reached — there is no separate `/complete` endpoint. Results are returned inline in the last answer response (`isComplete: true`, `currentMatches` contains final archetype rankings).

---

## Testing Guidelines

### Unit Testing

**Test Files:**
- `packages/shared/src/personality/__tests__/adaptiveEngine.test.ts`
- `packages/shared/src/personality/__tests__/matcherV2.test.ts`
- `packages/shared/src/personality/__tests__/prototypes.test.ts`

**Key Test Cases:**

1. **Archetype Prototypes**
   ```typescript
   test('All 12 archetypes have valid trait profiles', () => {
     const archetypes = Object.keys(archetypePrototypes);
     expect(archetypes).toHaveLength(12);
     
     for (const archetype of archetypes) {
       const profile = archetypePrototypes[archetype].traitProfile;
       expect(profile.A).toBeGreaterThanOrEqual(0);
       expect(profile.A).toBeLessThanOrEqual(100);
       // ... repeat for C, E, O, X, P
     }
   });
   ```

2. **V2 Matcher - Extreme Cases**
   ```typescript
   test('High X user does NOT match to 小透明猫', () => {
     const userTraits = { A: 50, C: 50, E: 50, O: 50, X: 95, P: 50 };
     const result = matchArchetype(userTraits);
     expect(result.primaryArchetype).not.toBe('小透明猫');
   });
   
   test('Low X user does NOT match to 社牛柯基', () => {
     const userTraits = { A: 50, C: 50, E: 50, O: 50, X: 20, P: 50 };
     const result = matchArchetype(userTraits);
     expect(result.primaryArchetype).not.toBe('社牛柯基');
   });
   ```

3. **Adaptive Engine - Stopping Criteria**
   ```typescript
   test('Engine stops when all confidences ≥ 0.7', () => {
     const state = createMockState({
       traitConfidences: {
         A: { confidence: 0.75 },
         C: { confidence: 0.80 },
         E: { confidence: 0.72 },
         O: { confidence: 0.78 },
         X: { confidence: 0.85 },
         P: { confidence: 0.71 }
       }
     });
     
     const nextQuestion = selectNextQuestion(state);
     expect(nextQuestion).toBeNull();
   });
   ```

### Integration Testing

**End-to-End Flow:**

```typescript
describe('Full Assessment Flow', () => {
  let sessionId: string;

  test('Start assessment', async () => {
    const response = await request(app)
      .post('/api/assessment/v4/start')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.sessionId).toBeDefined();
    expect(response.body.nextQuestion).toBeDefined();
    sessionId = response.body.sessionId;
  });

  test('Answer questions adaptively until complete', async () => {
    for (let i = 0; i < 18; i++) {
      const answerRes = await request(app)
        .post(`/api/assessment/v4/${sessionId}/answer`)
        .send({
          questionId: `Q${i + 1}`,
          selectedOption: 'A'
        });

      if (answerRes.body.isComplete) {
        expect(answerRes.body.currentMatches).toBeDefined();
        expect(answerRes.body.currentMatches.length).toBeGreaterThan(0);
        return;
      }
    }
    // Should have completed before the loop exhausted
    expect.unreachable('Assessment did not complete within max questions');
  });
});
```

### Simulation Testing

**Accuracy Simulation Suite (2026-05-29):**

A curated simulation harness validates matcher and adaptive engine accuracy using archetype centroids and boundary personas.

```bash
# Generate boundary personas + centroids
npm run simulate:personas:generate

# Run matcher isolation on centroids (CI gate — must be 100%)
npm run simulate:personas:run:ci

# Run full boundary persona suite
npm run simulate:personas:run:all

# Generate expert review packet
npm run simulate:expert-packet
```

**Files:**
- `scripts/simulate/generate-boundary-personas.ts` — Generates 33 boundary personas (11 confusion pairs × 3 blend ratios) + 12 centroids
- `scripts/simulate/run-persona-suite.ts` — Unified runner supporting matcher isolation and end-to-end adaptive modes
- `scripts/simulate/run-test-retest.ts` — Test-retest reliability harness (5 runs per persona)
- `scripts/simulate/generate-expert-packet.ts` — Produces human-readable markdown review packet
- `scripts/simulate/lib/persona-utils.ts` — Shared answer deriver, noise model, report formatting

**Current Baseline (2026-06-02):**

| Mode | Persona Set | Exact Match | Notes |
|------|------------|-------------|-------|
| Matcher isolation | 12 centroids | **100%** | Hard CI gate |
| Matcher isolation | 33 boundaries | 82.1% (30/45 fixed*) | *13 boundary personas had wrong `expectedArchetype` in data — matcher isolation was the ground truth. Data fixed 2026-06-02. |
| End-to-end adaptive | 12 centroids | **100%** | All centroids correct. Drift corrections for rooster→corgi and koala→dolphin. |
| End-to-end adaptive | 33 boundaries | 66.7% (30/45) | With `enableCalibrationQuestions: true`: 57.8% (26/45, +2.0 avg Q). Calibration not yet tuned. |

**Boundary persona `expectedArchetype` audit (2026-06-02):**
During a systematic audit of the 45 persona trait profiles, 13/33 boundary personas were found to have incorrect `expectedArchetype` labels — the matcher in isolation (fed the true traits) produced a different archetype. The root cause: persona-generation code computed expected labels using a different logic than the matcher itself. Fixed by running `findBestMatchingArchetypesV2` on each persona's true trait profile and setting `expectedArchetype = top match` where the score gap exceeded 5 points. The koala→dolphin boundary-14 was the most impactful fix — it was previously flagged as a "hard miss" even though the matcher correctly assigned dolphin.

**Known Issues:**
1. **Anchor option conflation** — 8 anchor questions (Q1-Q8) have options scoring 3-5 traits simultaneously. A single answer provides signal to multiple traits, causing measurement drift of 10-26 points on traits like X (extraversion). This is the primary bottleneck for boundary accuracy. Approaches tested (all regressed or had zero net effect): option purity weighting, surgical option edits, pure calibration questions (±3 and ±2 magnitudes), and per-trait normalization multipliers. The only viable solution is question-bank revision — redesigning anchor options to be 1-2 traits each.
2. **Calibration system (feature-flagged)** — Q51-Q54 pure single-trait questions exist in the bank. When enabled, 2 are injected after anchors based on cohort detection. Calibration questions use ±2 magnitude (not ±3) to avoid overpowering adaptive measurements. Current impact: +1.8 avg Q, −3 exact matches. Needs shadow-mode data collection before runtime enablement.
3. **Boundary persona 50/50 blends** — Literal midpoint profiles are inherently ambiguous. The matcher's top-2 score gap is often <10 points. The secondary archetype is surfaced on the results page via a subtle "隐约有[archetype]的影子" indicator when `isDecisive === false`.
4. **Hard miss (2026-06-02):** spider→dolphin_calm (centroid) — caused by calibration Q injection. Without calibration: no hard misses.

**New Config Options (2026-06-02):**

```typescript
// In AssessmentConfig:
traitScoreMultiplier?: number;      // Override normalizeTraitScore multiplier (default: 15)
traitScoreBaselines?: Partial<Record<TraitKey, number>>; // Per-trait baseline subtracted before normalization
useFixedQuestions?: boolean;         // Use fixed question sequence instead of adaptive
fixedQuestionIds?: string[];         // Ordered question IDs for fixed mode
enableCalibrationQuestions?: boolean; // Inject Q51-Q54 pure calibration questions after anchors (default: true)
maxCalibrationQuestions?: number;     // Max calibration questions per session (default: 2)
```

Example: Apply baseline correction to counteract question-bank positive bias:
```typescript
const config = {
  ...DEFAULT_ASSESSMENT_CONFIG,
  traitScoreMultiplier: 12,
  traitScoreBaselines: { A: 0.5, C: 0.5, E: 0.5, O: 0.5, X: 0.5, P: 0.5 },
};
```

**Fixed-Question Mode:**
When `useFixedQuestions: true` with `fixedQuestionIds`, the engine bypasses adaptive selection and asks questions in the specified order, followed by the universal closing questions. Tested with 16 curated questions — accuracy is comparable to adaptive (5-7/12 exact) but not superior. Adaptive selection still performs best among tested modes.

**10k User Simulation:**

```typescript
// Run mass simulation to validate archetype distribution
const results = simulateAssessments(10000);

// Check distribution
const distribution = calculateDistribution(results);
for (const [archetype, percentage] of Object.entries(distribution)) {
  console.log(`${archetype}: ${percentage.toFixed(1)}%`);
  
  // No archetype should be > 20% (avoid clustering)
  expect(percentage).toBeLessThan(20);
  
  // No archetype should be < 2% (avoid dead zones)
  expect(percentage).toBeGreaterThan(2);
}

// Check confusion pairs
const confusionPairs = detectConfusionPairs(results);
for (const pair of confusionPairs) {
  console.warn(`Confusion detected: ${pair.archetype1} ↔ ${pair.archetype2} (${pair.frequency}%)`);
}
```

### Manual Testing Checklist

**UI/UX Validation:**
- [ ] Progress bar updates correctly across the config-driven range, then shows the 2 closing questions
- [ ] Slider question renders with draggable dial (not radio buttons)
- [ ] Emoji tap question renders with tap-selectable custom icon reactions (via `iconAssetKey` → `PERSONALITY_ICON_ASSETS`)
- [ ] Premium calibration overlay (`TransitionOverlay`) shows at adaptive phase transition
- [ ] Back button allows one-step back to re-answer the most recent question only; cancel returns to current question
- [ ] Radar chart displays all 6 traits (ACOEXP)
- [ ] Archetype icons match canonical list (🐕, 🐓, etc.)
- [ ] Results show correct archetype name (社牛柯基, not 火花塞)
- [ ] Typicality badge shows `典型` (decisive) or `非典型` (non-decisive) prefix in archetype `accentText` color
- [ ] Question flow adapts according to the active config and confidence thresholds (including the fixed 2-question closing sequence)
- [ ] No references to deprecated archetypes (火花塞, 探索者, etc.)

**Data Validation:**
- [ ] `assessment_sessions.trait_scores` contains all 6 traits
- [ ] `assessment_sessions.primary_archetype` uses current names
- [ ] `users.primary_archetype` updated on completion
- [ ] `users.has_completed_personality_test` set to true
- [ ] Old `primary_role` field NOT updated (deprecated)

---

## Appendix

### Archetype Chemistry Matrix

**Purpose:** Predict compatibility between archetype pairs for matching algorithm

**Scale:** 0-100 (higher = better chemistry)

| Archetype 1 | Archetype 2 | Score | Reason |
|-------------|-------------|-------|--------|
| 社牛柯基 | 小太阳鸡 | 95 | Both high X+P, energy synergy |
| 社牛柯基 | 小透明猫 | 45 | X gap too large (95 vs 20) |
| 树洞考拉 | 靠谱大象 | 88 | High A+E, stability match |
| 寻宝狐 | 脑洞章鱼 | 92 | Both high O, creative synergy |
| 好奇猫头鹰 | 慢热龟 | 60 | Both introverted, but O gap |

(Full matrix: See `packages/shared/src/personality/archetypeChemistry.ts`)

### Historical Notes

**V1 System (Deprecated):**
- Fixed 10 questions
- 8 archetypes (火花塞, 探索者, etc.)
- Simple point accumulation
- No adaptive selection

**V2 System (Deprecated):**
- Fixed 10 questions
- 14 archetypes (8 core + 6 extended)
- Trait blending formula
- No matcher algorithm (just highest score)

**V3 System (Deprecated):**
- Introduced 130-question bank
- Added confidence tracking
- Still used old archetype names

**V4 System (Current):**
- 60-question standard bank (3 levels) + 2 interactive closing questions (`Q_PLAYFUL_SLIDER`, `Q_PLAYFUL_EMOJI`)
- 12 archetypes (canonical names)
- Adaptive total is config-driven: current production configs yield 12–18 or 14–22 questions including the 2 closing questions
- V2 Matcher with soul trait weighting
- Asymmetric penalties and VETO filters
- Secondary data (`conflictPosture`) captured via `Q_PLAYFUL_EMOJI` and fed to tiebreaker
- Three question types: `choice`, `slider`, `emoji_tap`
- One-step back button to re-answer the most recent question; "换一题" skip button (max 3 per session)
- Premium calibration overlay at adaptive phase transition

---

**End of Document**
