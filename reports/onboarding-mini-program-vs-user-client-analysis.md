# Onboarding: Mini-Program vs User-Client — Critical Analysis & Gap Closure Plan

**Scope:** `apps/mini-program/src/pages/onboarding/` vs `apps/user-client/src/features/onboarding/active/pages/`  
**Date:** 2026-04-21  
**Skills leveraged:** `mini-program-frontend-excellence`, `wow-elements`, `platform-coordination-protocol`, `frontend-component-architecture`, `onboarding-state-architecture`

---

## 1. Executive Summary

Both platforms implement the same **server-driven V4 onboarding flow** (`personality-test` → `essential-data` → `extended-data` → `profile-review`). However, the **user-client (web)** has invested significantly more in **emotional micro-interactions, progress visualization, and completion-moment polish**. The **mini-program** has a stronger **results-page reveal** and **native WeChat integration**, but lags in mid-flow delight and form-component richness.

**Verdict:** The mini-program is functionally complete but emotionally thinner. Closing the gaps will require targeted Taro-native implementations of 5–7 high-impact web patterns, not a wholesale port.

---

## 2. What Mini-Program Does Better

### 2.1 Results-Page Reveal (Slot-Machine Animation)
| Aspect | Mini-Program | User-Client |
|---|---|---|
| Animation stages | 6-phase slot: anticipation → spin → hold → slow → near-miss → landed | Static result card with archetype narrative |
| Emotional arc | High-tension gamification; feels like opening a loot box | Informative but flat |
| Shareability | Canvas-based share poster (`sharePoster.ts`) | No native share poster |
| Assets | 12 archetype PNGs + Xiaoyue WebP/PNG pairs | SVG avatars + PNG Xiaoyue poses |

**Analysis:** The mini-program's results page is the single most polished screen in either onboarding flow. The slot-machine mechanic, multi-stage reveal, and Canvas share poster are **product-differentiating** and should be preserved as the canonical reference for the results experience.

### 2.2 Formalized Exit Transitions
The mini-program has a reusable SCSS mixin (`onboarding-page-exit-transition`) that applies `opacity` + `translateX(-18rpx)` + `scale(0.986)` on `&--exiting`. This gives every onboarding page a consistent, tactile departure. The web has `AnimatePresence` page transitions but no formalized exit-class pattern.

### 2.3 Xiaoyue Expression System
Semantic expression mapping (`xiaoyueExpressions.ts`) with 9 shipped expressions (WebP + PNG for base-library compatibility) and canonical IDs like `loadingSystem`, `coachGuide`, `paymentTrust`. The web uses 3 static PNG poses (thinking, casual, pointing) without a semantic registry.

### 2.4 Subpackage Architecture
Onboarding is a **lazy-loaded WeChat subpackage** (`pages/onboarding`), preloaded from landing/login. This is a genuine performance advantage over the web's monolithic bundle.

### 2.5 Native WeChat Hooks
Built-in `useShareAppMessage` and `useShareTimeline` for organic viral spread. The web has no equivalent native sharing surface.

---

## 3. What User-Client Does Better

### 3.1 Progress Visualization (Critical Gap)
| Feature | User-Client | Mini-Program |
|---|---|---|
| Progress style | **Duolingo-style segmented bar** (3 variants: duolingo/minimal/dots) + smooth morphing at Q8→Q9 | Basic footer progress meter |
| Milestone rewards | **TransitionOverlay** at Q8 with Xiaoyue celebration | None |
| Progress physics | Monotonic increase guard, milestone detection (25/50/75%) | Simple percentage calc |
| Question transitions | `AnimatePresence` with 3D card rotateY, spring physics | Fade / slide |

**Impact:** Progress visualization is the **#1 emotional anchor** during the personality test. The web's segmented bar makes every question feel consequential. The mini-program's basic meter feels utilitarian.

### 3.2 Xiaoyue Chat Bubble Coaching (Critical Gap)
The web has `XiaoyueChatBubble.tsx` — an **animated, pose-switching mascot** with:
- 3 poses (thinking, casual, pointing)
- Pulsing ring glow animation
- Intelligent score highlighting (`亲和力95分`)
- Horizontal and vertical layouts
- Staggered sentence entrance (Framer Motion)

The mini-program shows a **static Xiaoyue image** with orbiting dots. There is no conversational coaching during the test.

### 3.3 Analyzing Phase Animation (Critical Gap)
The web's `FinalProfileReviewPage` has a dedicated **"Analyzing" phase**:
- `SpiralWaveAnimation`: 5 breathing rings, rotating spiral path, 8 sparkle particles, purple-pink gradient glow
- Minimum 1200ms wait (skippable after 600ms)
- Respects `prefers-reduced-motion` (static ✨ fallback)

The mini-program's profile review uses `OnboardingLoadingShell` — a static card with skeleton lines and orbiting dots. It signals "loading" rather than "magic happening."

### 3.4 Profile Review Card (Critical Gap)
| Feature | User-Client | Mini-Program |
|---|---|---|
| Card name | `ProfilePortraitCard` | Basic "JoyJoin 入场卡" |
| Radar chart | `PersonalityRadarChart` (6 traits) | None |
| Interest heat map | Category distribution + top priorities | Interest list only |
| Match power preview | Connection-point tier breakdown | None |
| AI tagline | Fetched + displayed with sparkle | Fetched + plain text |
| Industry display | L1→L2→L3 hierarchy | Single line |
| Limited browse CTA | Experimental secondary CTA | None |
| Stagger animation | Framer Motion staggerChildren | CSS fade-in |

### 3.5 Form Component Richness
| Component | User-Client | Mini-Program |
|---|---|---|
| Occupation selector | `EnhancedOccupationSelector` (3-tier: category → segment → niche) + AI normalization | Basic picker |
| Birth date | `BirthDatePicker` (custom month/day/year) | Taro `Picker` (year only) |
| Social intent | Multi-select with "flexible" mutual exclusion logic | Toggle chips |
| Data caching | `localStorage` with 24h expiry + server checkpoint | Server checkpoint only |
| Real-time validation | Age ≥ 18, display name length, etc. | Basic validation on submit |

### 3.6 Celebration & Completion Moments
| Moment | User-Client | Mini-Program |
|---|---|---|
| Interest completion | `FancyLineLoadingScreen` with looping line animation | Redirect to next step |
| Milestone (Q8) | `TransitionOverlay` with reward text + mascot | None |
| Profile completion | `SpiralWaveAnimation` → staggered card reveal | `isRevealReady` timer + fade |
| Archetype reveal | Holographic card effect, glassmorphism | Static card |

### 3.7 Accessibility & Haptics
- **Reduced motion:** The web comprehensively checks `useReducedMotion()` and disables animations. The mini-program has `@media (prefers-reduced-motion: reduce)` for entrance animations but not for loading shells or transitions.
- **Haptics:** The web uses `haptics.ts` for tactile feedback on selections. The mini-program has no haptic integration.

### 3.8 Dynamic Theming
The web shifts CSS accent variables (`--accent-dynamic-h/s/l`) based on the user's archetype. The mini-program uses static brand colors.

### 3.9 Viewport-Zero-Scroll Policy Compliance (Critical Architecture Gap)

**Reference:** `.cursor/skills/viewport-zero-scroll/SKILL.md` (viewport lockdown, FormStepper density, ResponsiveSpacer)

| Policy Rule | User-Client | Mini-Program | Status |
|---|---|---|---|
| **Viewport lock** | `.no-scroll-container` on all onboarding pages; `html/body { overflow: hidden }` | `page-gradient-bg` + flex column, but essential-data uses unbounded `ScrollView` | ⚠️ Partial |
| **≤4 inputs per step** | `EssentialDataPage` uses `STEP_CONFIG` (5-step wizard, each step ≤4 fields) | `essential-data` has **13 Input/Picker fields in one page** — **violates density rule** | ❌ Violation |
| **ResponsiveSpacer** | Used in `EssentialDataPage` (`collapseBelow={700}`) to protect CTA visibility on short screens | **Not used** in any onboarding page | ❌ Missing |
| **ScrollSentinel** | Dev-only overflow detector mounted in `App.tsx` | No equivalent (DevTools manual check only) | ⚠️ Acceptable |
| **Explicit scroll ports** | `#jj-scroll-chassis` for legacy routes; inner scroll regions documented | `ScrollView` used but not consistently documented with exception comments | ⚠️ Partial |

**Impact:** The mini-program's `essential-data` page is a **long scrolling form** (13 fields) whereas the web breaks it into a **5-step viewport-locked wizard**. This creates:
1. **Higher cognitive load** — users see all fields at once and feel overwhelmed
2. **CTA visibility risk** — the submit button can be pushed far below the fold on small screens
3. **No step-completion dopamine** — web users get a progress tick and celebration micro-moment per step; mini-program users just scroll
4. **Platform parity failure** — `platform-coordination-protocol` requires `BOTH_REQUIRED` for duplicated journeys; the density treatment differs materially

---

## 4. Gap Priority Matrix

| # | Gap | Impact | Effort (Taro) | Priority |
|---|-----|--------|---------------|----------|
| 1 | **Segmented progress bar** | High — every user sees this | Medium | **P0** |
| 2 | **Xiaoyue chat bubble coaching** | High — personality test emotional core | Medium | **P0** |
| 3 | **Analyzing phase animation** | High — profile review climax | Medium-High | **P0** |
| 4 | **Rich profile review card** | High — completion payoff | High | **P1** |
| 5 | **Enhanced occupation selector** | Medium — form friction reduction | Medium | **P1** |
| 6 | **Celebration moments** | Medium — emotional reinforcement | Low-Medium | **P1** |
| 7 | **Interest carousel with particles** | Medium — extended data engagement | Medium | **P2** |
| 8 | **Haptics** | Low-Medium — tactile polish | Low | **P2** |
| 9 | **Dynamic accent theming** | Low — brand consistency | Low | **P2** |
| 10 | **Limited browse CTA** | Low — experimental feature | Low | **P3** |

---

## 5. Actionable Recommendations

### P0: Close the Emotional Core + Architecture Gaps

#### 5.0 FormStepper Density Rewrite (Highest Architecture Priority)
**Reference:** `.cursor/skills/viewport-zero-scroll/SKILL.md` § FormStepper density + `apps/user-client/src/features/onboarding/active/pages/EssentialDataPage.tsx` `STEP_CONFIG`

**Problem:** `essential-data/index.tsx` has 13 Input/Picker fields in one page, violating the ≤4 inputs-per-step rule and creating a long scrolling form.

**Taro implementation strategy:**
- Split `essential-data` into a **4-step wizard** matching the web's `STEP_CONFIG` pattern:
  - **Step 1:** Display name + gender + birth year (3 fields)
  - **Step 2:** Relationship status + education (2 fields)
  - **Step 3:** Occupation (industry + work mode) — use `EnhancedOccupationSelector` (P1)
  - **Step 4:** Hometown + current city + social intent (3 fields)
- Each step is a **viewport-locked screen** (`no-scroll-page-shell` mixin) with:
  - Sticky header with back arrow + step indicator
  - Step content in flex column
  - Fixed bottom CTA tray
  - `ResponsiveSpacer` with `collapseBelow` to protect CTA on short screens
- Add `FormStepper` component showing "Step X of 4" with progress
- Cache progress in Taro `localStorage` (same 24h expiry as web)
- On final step, submit all accumulated data in one API call

**File placement:**
- `apps/mini-program/src/pages/onboarding/essential-data/index.tsx` (rewrite)
- `apps/mini-program/src/components/FormStepper.tsx` + `.scss` (new)

**Cross-platform note:** This changes the **information architecture** of a duplicated journey. Per `platform-coordination-protocol`, flag this as `BOTH_REQUIRED` — the web `EssentialDataPage` `STEP_CONFIG` becomes the canonical reference.

#### 5.1 Segmented Progress Bar for Mini-Program
**Reference:** `apps/user-client/src/components/ui/progress-segmented.tsx`

**Taro implementation strategy:**
- Build a `SegmentedProgress` component using Taro `View` + `Text`
- Support 3 variants: `duolingo` (filled segments), `minimal` (thin line), `dots` (circles)
- Implement milestone detection at 25/50/75% with Xiaoyue expression change
- Add morphing animation from segmented → smooth at anchor→adaptive transition (Q8→Q9)
- Use WXSS `transition` for segment fill animation (Framer Motion equivalent)

**File placement:** `apps/mini-program/src/components/SegmentedProgress.tsx` + `.scss`

#### 5.2 Xiaoyue Chat Bubble Coaching
**Reference:** `apps/user-client/src/components/XiaoyueChatBubble.tsx`

**Taro implementation strategy:**
- Build `XiaoyueChatBubble` component with `View`, `Text`, `Image`
- Use `xiaoyueExpressions.ts` semantic IDs (already exists)
- Implement 3 layout modes: horizontal (avatar left + text right), vertical (stacked), compact
- Add pulsing ring glow via WXSS `@keyframes` (not `box-shadow` animation — use `scale` + `opacity` on a pseudo-element for GPU safety)
- Stagger sentence entrance with `animation-delay` on each sentence `View`
- Integrate into `personality-test/index.tsx` at anchor-phase milestones

**File placement:** `apps/mini-program/src/components/XiaoyueChatBubble.tsx` + `.scss`

#### 5.3 Analyzing Phase Animation
**Reference:** `apps/user-client/src/components/SpiralWaveAnimation.tsx`

**Taro implementation strategy:**
- Taro does not support arbitrary SVG path animation like Framer Motion's `pathLength`
- **Translate the intent, not the implementation:**
  - Use a sequence of 3–5 pre-rendered animation frames (Lottie-style) or a CSS-animated SVG
  - Alternative: concentric `View` circles with `animation: breathe` (scale + opacity stagger)
  - Add 6–8 sparkle `Image` components with random drift via WXSS `animation`
  - Respect `prefers-reduced-motion` with static archetype image fallback
- Keep minimum 1200ms / skippable-after-600ms behavior

**File placement:** `apps/mini-program/src/components/AnalyzingAnimation.tsx` + `.scss`

### P1: Close the Completion & Form Gaps

#### 5.4 Rich Profile Review Card
**Reference:** `apps/user-client/src/components/ProfilePortraitCard.tsx`

**Taro implementation strategy (phased):**
- **Phase 1:** Enhance existing "入场卡" with:
  - Archetype badge with gradient background
  - Interest category chips with heat-level colors
  - AI tagline with sparkle icon
  - Industry L1→L2 display (from shared `getIndustryDisplayLabel`)
- **Phase 2:** Add radar chart using a Taro-compatible chart library or Canvas
- **Phase 3:** Add match-power preview section

**File placement:** Enhance `apps/mini-program/src/pages/onboarding/profile-review/index.tsx` + `.scss`

#### 5.5 Enhanced Occupation Selector
**Reference:** `apps/user-client/src/components/EnhancedOccupationSelector.tsx`

**Taro implementation strategy:**
- Build a 3-tier picker using Taro `Picker` in multi-selector mode or cascading `Picker`s
- Add "hot occupations" quick-select chips at top
- Integrate AI normalization flow (same shared API)
- Use `Sheet`-like bottom-modal pattern (Taro `showActionSheet` or custom modal)

**File placement:** `apps/mini-program/src/components/EnhancedOccupationSelector.tsx` + `.scss`

#### 5.6 Celebration Moments
**Quick wins:**
- Add `FancyLineLoadingScreen` equivalent: animated SVG line loop during interest submission
- Add milestone burst at interest completion (confetti-like particle burst using Taro `Canvas`)
- Reuse existing `OnboardingLoadingShell` but add Xiaoyue expression change on completion

### P2: Polish & Accessibility

#### 5.7 Haptics
**Reference:** `apps/user-client/src/lib/haptics.ts`

**Taro implementation:**
- Wrap `Taro.vibrateShort()` and `Taro.vibrateLong()` in a `haptics.ts` utility
- Add light haptic on question answer, medium haptic on milestone, heavy haptic on completion
- Gate behind capability check (`Taro.canIUse('vibrateShort')`)

#### 5.8 Dynamic Accent Theming
- Read archetype color from `@shared/archetypeColors` (already imported in `visuals.ts`)
- Apply as CSS custom properties (`--accent`) on the page container
- Use for CTA gradient, progress bar fill, and badge backgrounds

#### 5.9 Reduced Motion
- Audit all onboarding pages for `prefers-reduced-motion` support
- Add `animation: none !important` + `transition: none` fallback
- Disable slot-machine animation in results page when reduced motion is preferred

---

## 6. Implementation Order Recommendation

**Sprint 0 (Architecture fix — blocks all other onboarding work):**
1. FormStepper density rewrite: split `essential-data` into 4-step wizard
2. Add `ResponsiveSpacer` to all onboarding pages with fixed CTAs
3. Audit all onboarding pages for `viewport-min-height` / `no-scroll-page-shell` compliance

**Sprint 1 (Immediate UI impact):**
4. SegmentedProgress component + integrate into personality test
5. XiaoyueChatBubble component + integrate into personality test milestones
6. Reduced-motion audit pass

**Sprint 2 (Completion payoff):**
4. AnalyzingAnimation component + integrate into profile review
5. Profile review card enhancements (Phase 1: badges, chips, tagline)
6. Celebration moments (interest completion burst)

**Sprint 3 (Form friction):**
7. EnhancedOccupationSelector
8. Dynamic accent theming
9. Haptics utility

**Sprint 4 (Depth):**
10. Profile review radar chart (Canvas)
11. Interest carousel with particles
12. Limited browse CTA experiment

---

## 7. Validation Checklist

Before any onboarding UI PR merges:
- [ ] **Viewport-zero-scroll compliance:** page uses `no-scroll-page-shell` or documented `ScrollView` — not unbounded stacking
- [ ] **FormStepper density:** no step contains > 4 text/numeric inputs without explicit step split
- [ ] **ResponsiveSpacer:** short-viewport gaps use `ResponsiveSpacer` with `collapseBelow` where CTAs risk being pushed off-screen
- [ ] WeChat DevTools inspection: padding, gaps, CTA height, font sizes match spec or 8rpx rhythm
- [ ] One real-device spot check
- [ ] `prefers-reduced-motion` fallback tested
- [ ] `npm run typecheck` passes for mini-program workspace
- [ ] `node scripts/validate-skill-routing.mjs` passes
- [ ] Sibling-platform review: does this change need a web equivalent?

---

*Analysis conducted using `mini-program-frontend-excellence`, `wow-elements`, `platform-coordination-protocol`, `frontend-component-architecture`, and `onboarding-state-architecture` skills.*
