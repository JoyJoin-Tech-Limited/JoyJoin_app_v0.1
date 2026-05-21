# JoyJoin Mini-Program 20/20 Plan — Expert Review Synthesis

> **Reviewers:** Harness Verification Gate (agent) · Taro Mini-Program Frontend Engineer (supervisor-led) · QA Agent (supervisor-led)  
> **Date:** 2026-05-21  
> **Scope:** `reports/mini-program-20-20-engineering-plan.md`

---

## 1. Harness Verification Gate

**Verdict:** GATE: PASS

| Pillar | Score | Reason |
|--------|-------|--------|
| Reliability | **CONCERN** | No `Image onError` fallback for mascot CDN assets in `XiaoyueEmptyState`; CSS animations have `prefers-reduced-motion` guards but no explicit JS animation cleanup/atomicity plan. |
| Scalability | **PASS** | Animations are bounded (`forwards` fill, no infinite keyframes); bundle impact is limited to ~2 WebPs + optional SVG reuse; no data-layer or N+1 query changes. |
| Security | **PASS** | UI-only surface with no new auth/permission paths; `Taro.reLaunch` uses hardcoded internal route; zero secret exposure risk. |
| Observability | **CONCERN** | No structured logging for asset load failures or animation jank; score improvement is measurable via `design:audit`, but failure paths are not instrumented. |
| Maintainability | **PASS** | Components live in correct app layer (`apps/mini-program/src/components/`); tokens extend existing `variables.scss`; established patterns (`cdnAsset`, Taro primitives) are followed. |

**Blocking concerns:** None.

**Non-blocking concerns:**
- Add `onError` fallback to `XiaoyueEmptyState` Image (hide mascot, fall back to text-only).
- Instrument Image `onError` handlers with lightweight analytics event.
- `RichListCard` defines an unused `GRADIENT_MAP` constant — remove dead code.
- Extract repetitive `@media (prefers-reduced-motion: reduce)` block into a shared mixin to avoid boilerplate across 25+ files.

---

## 2. Taro / WeChat Mini-Program Feasibility Review

**Verdict:** FEASIBLE with 5 amendments required

### 2.1 `@media (prefers-reduced-motion: reduce)` — ✅ SUPPORTED

**Finding:** Already used in 10+ locations across the codebase (`_stagger.scss`, `Button.scss`, `PageMorphWrapper.scss`, `BondingCloud.tsx/js`, `AiMatchPromoCarousel.scss`, etc.).

**Assessment:** Safe pattern. WeChat Mini Program WXSS supports `@media (prefers-reduced-motion: reduce)` on iOS. On Android, the media query may not fire (system limitation), but the CSS itself is valid and won't break compilation.

**Recommendation:** Keep the pattern. Add a JS fallback for Android using `wx.getSystemInfo` to detect low-end devices and conditionally disable animations when `benchmarkLevel <= 20`.

### 2.2 Animation Keyframes — ✅ SAFE

**Finding:** The codebase already uses identical easing (`cubic-bezier(0.22, 1, 0.36, 1)`) in `_stagger.scss`. The proposed keyframes (`staggered-rise`, `card-slide-in`, `mascot-bounce-in`) are pure `transform`/`opacity` — GPU-composited and safe.

**Assessment:** No performance concerns. `translate3d` (existing) vs `translateY` (proposed) are equivalent for GPU compositing in WeChat.

### 2.3 `env(safe-area-inset-*)` — ✅ SUPPORTED

**Finding:** Already used in 6 pages (`center-hub`, `icebreaker-session`, `index`, `pool-registration`, `onboarding/essential-data`, `onboarding/extended-data`).

**Assessment:** Safe pattern. Works on iOS with notch devices. On Android, falls back to `0` gracefully.

### 2.4 `Image onError` Fallback — ⚠️ MUST ADD

**Finding:** The codebase already uses `onError` handlers for Images (`JoyJoinIcon.tsx`, `OnboardingLoadingShell.tsx`, `JoyJoinLoadingScreen.tsx`, `ArchetypeHead.tsx`, `XiaoyueChatBubble.tsx`, `ChemistryBadge.tsx`).

**Assessment:** `XiaoyueEmptyState` must include `onError` on its `Image` component. Without it, a CDN failure breaks the empty-state UI entirely.

**Fix:**
```tsx
const [imgError, setImgError] = useState(false)
// ...
<Image
  onError={() => setImgError(true)}
  style={{ display: imgError ? 'none' : 'block', ... }}
  // ...
/>
```

### 2.5 Component Placement — ⚠️ USE `mascot/` SUBDIRECTORY

**Finding:** Existing mascot components live in `src/components/mascot/` (`ArchetypeHead.tsx`, `XiaoyueChatBubble.tsx`, `ChemistryBadge.tsx`).

**Assessment:** `XiaoyueEmptyState` should be placed in `src/components/mascot/` for consistency, not at `src/components/XiaoyueEmptyState/`.

**Fix:** Move to `src/components/mascot/XiaoyueEmptyState/index.tsx`.

### 2.6 `filter: blur` / `backdrop-filter: blur` — 🔴 UNDER-SCOPED

**Finding:** Found **7 instances** across **4 files** — the plan only addresses 1:

| File | Instance | Plan Coverage |
|------|----------|---------------|
| `squad-unboxing/index.scss:256` | `filter: blur(10rpx)` | ✅ Covered |
| `matching-status/styles/_overlay.scss:20` | `backdrop-filter: blur(12rpx)` | ❌ Missed |
| `matching-status/styles/_hero.scss:73` | `filter: blur(28rpx)` | ❌ Missed |
| `icebreaker-session/index.scss:885` | `backdrop-filter: blur(6rpx)` | ❌ Missed |
| `icebreaker-session/index.scss:2373` | `backdrop-filter: blur(6rpx)` | ❌ Missed |
| `icebreaker-session/index.scss:2445` | `backdrop-filter: blur(6rpx)` | ❌ Missed |
| `icebreaker-session/index.scss:2463` | `backdrop-filter: blur(12rpx)` | ❌ Missed |

**Assessment:** The onboarding code already acknowledges `backdrop-filter` is unreliable in WeChat (`MascotQuestionHeader.scss:44`: "WeChat: backdrop-filter unreliable — solid fallback for production"). All blur instances should be addressed.

**Recommendation:** Expand the blur-removal scope in Phase 1 to include all 7 instances. Replace with:
- `backdrop-filter: blur(Nrpx)` → `background: rgba(0,0,0,0.X)` solid overlay
- `filter: blur(Nrpx)` → pre-blurred asset or opacity-based shadow

### 2.7 `Text` with `onClick` — 🔴 UNDER-SCOPED

**Finding:** Found **4 instances** across **3 files** — the plan only addresses 2:

| File | Line | Element | Plan Coverage |
|------|------|---------|---------------|
| `edit-profile/index.tsx:260` | Gender option `<Text>` | ❌ Missed |
| `edit-profile/index.tsx:333` | Interest tag `<Text>` | ✅ Covered |
| `squad-unboxing/index.tsx:530` | Skip link `<Text>` | ❌ Missed |
| `icebreaker-session/overlays/MiniScriptConfigModal.tsx:215` | Back button `<Text>` | ❌ Missed |

**Assessment:** All 4 must be fixed. The gender option and skip link are particularly problematic as they may be smaller than 88rpx touch targets.

**Fix:** Wrap all 4 in `<View>` or replace with `<Button>`.

### 2.8 `calc()` with SCSS Variables in `animation-delay` — ⚠️ PLATFORM RISK

**Finding:** The plan proposes:
```scss
animation-delay: calc(#{$base-delay} + #{$index} * #{$stagger});
```

**Assessment:** WeChat Mini Program's WXSS compiler (Taro → wxss) handles `calc()` with CSS custom properties well, but `calc()` with SCSS-interpolated values may be pre-computed at build time. If not, the runtime `calc()` expression must use valid CSS units.

**Recommendation:** Test the compiled output in `dist/` to verify `calc()` is correctly resolved. If not, use inline styles with computed delays in TSX instead:
```tsx
style={{ animationDelay: `${baseDelay + index * stagger}ms` }}
```

### 2.9 `RichListCard` Gradient Performance — ✅ ACCEPTABLE

**Finding:** CSS `linear-gradient` is GPU-composited in WeChat's rendering engine. The proposed gradients are simple 2–3 color stops.

**Assessment:** No performance concern. The existing `$brand-gradient` (2-stop) is already used extensively.

### 2.10 Token Naming Conflict — ✅ NO CONFLICT

**Finding:** Existing `_variables.scss` has `$color-bg-gradient`, `$color-bg-warm-*`, `$color-bg-tint-*`. The plan proposes `$card-gradient-warm`, `$card-gradient-cool`, etc.

**Assessment:** No naming conflicts. The new token names are distinct and follow the established pattern.

### 2.11 Day 1 Scope Realism — ⚠️ TOO AMBITIOUS

**Finding:** Day 1 proposes: tokens + mixins + keyframes + P0 bug + 5 quick fixes + host badge fix.

**Assessment:** That's ~8 distinct changes in one day. The token additions alone (with verification) take half a day.

**Recommendation:** Split Day 1 into Day 1a (tokens + keyframes + P0 bug) and Day 1b (remaining quick fixes). Or accept a 2-day Phase 1.

---

## 3. QA / Verification Review

**Verdict:** NEEDS_STRENGTHENING

### 3.1 Test Infrastructure Gap

**Finding:** `apps/mini-program` has `vitest` configured but **zero test files** in `src/__tests__/`. The `test` script runs but with no actual coverage.

**Assessment:** No automated regression tests exist for the changed screens. All verification is manual.

**Recommendation:**
- Add at least **structural tests** for `XiaoyueEmptyState` and `RichListCard` (render without crash, props propagate correctly).
- Add a **guardrails check** for `Text` with `onClick` — a simple grep-based CI script.
- The existing `npm run guardrails` at root should be extended to catch `filter: blur` and `backdrop-filter: blur`.

### 3.2 Verification Ritual Gaps

| Gap | Severity | Fix |
|-----|----------|-----|
| No automated check for `Text` with `onClick` | Medium | Add `grep -rn '<Text.*onClick=' src/pages/` to guardrails |
| No automated check for `filter: blur` | Medium | Add `grep -rn 'filter.*blur\|backdrop-filter.*blur' src/` to guardrails |
| No automated check for ad-hoc hex colors | Low | Extend `design:audit` or add regex scan |
| No real-device testing mentioned | Medium | Add iOS + Android real-device smoke test to exit criteria |
| No bundle size check | Low | Add `npm run build:weapp && du -sh dist/` to verify < 2MB |
| No `Image onError` verification | Medium | Simulate CDN failure (point to bad URL) and verify fallback |

### 3.3 Regression Risk Ranking

| Change | Risk | Why |
|--------|------|-----|
| P0 bug fix (`window.location.reload`) | **Low** | One-line change, well-understood fix |
| Token additions | **Low** | Additive only, no breaking changes |
| `XiaoyueEmptyState` component | **Low** | New component, isolated usage |
| `RichListCard` component | **Medium** | Used on Events + Center Hub — affects DAU screens; test both thoroughly |
| Touch target sweep (4 instances) | **Medium** | Layout may shift; visual regression needed |
| Blur removal (7 instances) | **Medium** | Visual appearance changes; need before/after comparison |
| Animation additions | **Low** | Purely additive; reduced-motion guards present |
| Line-height token sweep | **Low** | Visual only, no functional change |

### 3.4 Missing Verification Steps

1. **Accessibility:** Test with VoiceOver (iOS) and TalkBack (Android) on changed screens.
2. **Low-end device:** Test on a budget Android device (e.g., Redmi 9A) to verify no animation jank.
3. **Offline mode:** Verify empty states render correctly when CDN assets fail to load.
4. **Dark mode:** Check if any new tokens break in dark mode (if supported).

---

## 4. Consolidated Amendments to the Plan

### Must-Fix Before Kickoff (Blocking)

1. **Expand blur removal scope** from 1 to 7 instances (see §2.6).
2. **Expand `Text` with `onClick` sweep** from 2 to 4 instances (see §2.7).
3. **Add `Image onError` fallback** to `XiaoyueEmptyState` (see §2.4).
4. **Add guardrails checks** for `Text onClick` and `filter: blur` (see §3.1).

### Should-Fix Before Phase 1 Complete (Non-blocking but Important)

5. **Move `XiaoyueEmptyState`** to `src/components/mascot/` (see §2.5).
6. **Split Day 1** into Day 1a + 1b or accept 2-day Phase 1 (see §2.11).
7. **Remove dead code** (`GRADIENT_MAP` in `RichListCard`) (see Harness review).
8. **Extract reduced-motion mixin** to avoid boilerplate across 25+ files (see Harness review).
9. **Add low-end device test** to verification ritual (see §3.3).

### Nice-to-Have (Phase 2+)

10. Add component-level vitest tests for `XiaoyueEmptyState` and `RichListCard`.
11. Add JS fallback for Android `prefers-reduced-motion` via `wx.getSystemInfo` benchmark.
12. Consider extracting `JoyJoinIcon` SVG expansion (11 icons) into a separate asset sprint.

---

## 5. Revised Timeline

| Phase | Original | Revised | Change |
|-------|----------|---------|--------|
| Phase 1: Safety & Tokens | 3 days | **4 days** | +1 day for expanded blur/Text sweep + guardrails |
| Phase 2: Core Screens | 5 days | **5 days** | No change |
| Phase 3: Deep Polish | 3 days | **3 days** | No change |
| Phase 4: Assets | Async | **Async** | No change |
| **Total** | **11 days** | **12 days** | +1 day for scope expansion |

---

## 6. Bottom Line

**The plan is sound, feasible, and well-structured.** The Harness gate passes with no blockers. However, **three scope expansions are required** before kickoff:

1. **Blur removal:** 1 → 7 instances (adds ~2 hours)
2. **Text-onClick sweep:** 2 → 4 instances (adds ~1 hour)
3. **Guardrails automation:** Add 2 regex checks (adds ~1 hour)

These are **findings from actual code inspection**, not theoretical concerns. The extra day in the revised timeline is conservative and accounts for verification overhead.

**Recommendation:** Accept the plan with the amendments above, then proceed to Phase 1 implementation.
