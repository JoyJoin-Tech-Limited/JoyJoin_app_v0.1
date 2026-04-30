# JoyJoin Mini-Program UI Aesthetic Scorecard

> **Purpose:** Systematic, repeatable assessment of every mini-program screen against JoyJoin's premium aesthetic standards.
> **Scope:** `apps/mini-program/src/pages/` — all Taro pages and their state matrices.
> **Last updated:** 2026-04-22

---

## The 5-Pillar Aesthetic Scorecard

Each screen is scored across 5 pillars on a 0–10 scale. The overall grade is the weighted sum.

### Pillar 1: Brand Consistency (25%)

*Source: `joyjoin-brand-guidelines`*

| Check | Pass criteria |
|-------|--------------|
| Color discipline | Uses only the 8 core colors with exact hex codes; no ad-hoc colors |
| Typography roles | `font-cn-display` only on short emotional bursts; `font-ui` for body/dense UI; `font-en-brand` for English identity only |
| Mascot usage | Uses canonical 12 archetypes only; one mascot per screen, placed intentionally |
| Anti-generic aesthetics | No purple-gradient-on-white, no symmetrical filler layouts, no decorative mascot wallpaper, no system font on hero copy |
| Illustration style | If illustrations present: 插画风 low-poly geometric, painterly textures, circular vignettes, warm palette |

**Scoring:**
- 10 — Every element is unmistakably JoyJoin; would never appear in a generic app
- 7–9 — Minor drift (one off-brand color, one generic pattern)
- 4–6 — Notable drift (multiple generic patterns, mascot misuse, color narrowing)
- 1–3 — Severe drift (looks like a template, corporate, or cold)
- 0 — No brand identity whatsoever

### Pillar 2: Structural Quality (25%)

*Source: `mini-program-frontend-excellence`*

| Check | Pass criteria |
|-------|--------------|
| State completeness | Default, loading, empty, error, disabled, busy, success, pressed states all explicit |
| Taro-native patterns | Uses `View`, `Text`, `Image`, `Button`, `Input`, `ScrollView` appropriately; no browser-first shortcuts |
| Spacing rhythm | 8rpx multiples when unspecced; 4rpx only for hairlines; internal consistency across sibling screens |
| Pixel precision | Matches design spec within ≤1px; DevTools-verified for touched screens |
| WXSS safety | No browser-only selectors; no `dangerouslySetInnerHTML`; `RichText` for rich content |

**Scoring:**
- 10 — All states explicit, Taro-native, pixel-precise, WXSS-safe
- 7–9 — Minor gaps (one missing state, one spacing inconsistency)
- 4–6 — Notable gaps (multiple missing states, browser patterns, spacing drift)
- 1–3 — Poor structure (many missing states, DOM assumptions, unverified layout)
- 0 — Broken or non-functional

### Pillar 3: Interaction Clarity (20%)

*Source: `frontend-hook-engine` (Seven Deadly Sins)*

| Sin | Assessment question |
|-----|---------------------|
| Blindness | Does this screen solve a clear user task? Is the purpose obvious in < 3 seconds? |
| Clutter | Is there one clear primary action? Is information hierarchy visible at a glance? |
| Misfit | Is the interaction pattern appropriate for WeChat Mini Program (not browser-first)? |
| Myopia | Are loading, empty, error, and retry states handled with as much care as the happy path? |
| Disrespect | Are touch targets ≥ 44pt? Is feedback immediate? Is copy warm and helpful? |

**Scoring:**
- 10 — Crystal clear purpose, one strong CTA, perfect state coverage, native feel
- 7–9 — Minor confusion (secondary action competes with primary, one weak state)
- 4–6 — Notable confusion (unclear purpose, competing CTAs, multiple weak states)
- 1–3 — Confusing (user doesn't know what to do, broken states, cold copy)
- 0 — Unusable

### Pillar 4: Emotional Polish (20%)

*Source: `wow-elements`*

| Check | Pass criteria |
|-------|--------------|
| Focal moment | The screen has one clear emotional peak, not a flat wall of equal elements |
| Empty/loading states | Feel like possibility/momentum, not absence/waiting; include mascot or warm copy |
| Completion payoff | Success/confirmation moments have emotional resonance (scale pulse, checkmark, warm copy) |
| Pressed/active states | Touch feedback is immediate and visible (`hoverClass`, active styling) |
| Anti-generic | Does not feel like it could appear in any other social app without modification |

**Scoring:**
- 10 — Every moment feels crafted and emotionally intelligent; unmistakably JoyJoin
- 7–9 — One or two moments could use more polish
- 4–6 — Generic feel; empty states are cold; no emotional peaks
- 1–3 — Dead feeling; silent states; no personality
- 0 — No consideration for emotion whatsoever

### Pillar 5: Performance Safety (10%)

*Source: `mini-program-frontend-excellence` + `frontend-performance-and-loading`*

| Check | Pass criteria |
|-------|--------------|
| Asset weight | No new/changed assets exceed size budgets; raster images compressed |
| Animation cost | Only `transform` and `opacity` animations; no layout-triggering properties |
| List performance | Long lists use `VirtualList` or `CustomWrapper`; no unbounded rendering |
| Bundle impact | Heavy assets in subpackages, not main bundle |
| Scroll/jank | No scroll jank on tap-heavy or media-heavy surfaces |

**Scoring:**
- 10 — Perfect performance discipline
- 7–9 — Minor concern (one oversized asset, one unoptimized list)
- 4–6 — Notable concern (multiple heavy assets, layout animations, jank)
- 1–3 — Severe concern (main bundle bloat, scroll-breaking animations)
- 0 — Causes crashes or unresponsive UI

---

## Overall Grade Calculation

```
Overall = (Brand × 0.25) + (Structural × 0.25) + (Interaction × 0.20) + (Emotional × 0.20) + (Performance × 0.10)
```

| Grade | Range | Action |
|-------|-------|--------|
| **A** | 42–50 | Ship-ready; minimal polish only |
| **B** | 35–41 | Good with known gaps; schedule targeted improvements |
| **C** | 25–34 | Mediocre; **Stitch redesign brief recommended** |
| **D** | 15–24 | Poor; **mandatory Stitch redesign** before next release |
| **F** | 0–14 | Broken or fundamentally flawed; **block release** |

## Stitch Candidacy Rules

- **Auto-Stitch:** Any screen graded **D or F**
- **Candidate-Stitch:** Any screen graded **C** with **Brand Consistency < 5** or **Emotional Polish < 4**
- **No-Stitch:** **A or B** grades (use manual polish or `wow-elements` instead)

---

## Inventory Table

| # | Page File | Route | Journey Position | Brand | Structural | Interaction | Emotional | Performance | Overall | Grade | Stitch? | Priority |
|---|-----------|-------|-----------------|-------|------------|-------------|-----------|-------------|---------|-------|---------|----------|
| 1 | `pages/index/index.tsx` | `/pages/index/index` | Landing / first impression | | | | | | | | | |
| 2 | `pages/index/LandingPage.tsx` | (component) | Landing content | | | | | | | | | |
| 3 | `pages/login/index.tsx` | `/pages/login/index` | Auth entry | | | | | | | | | |
| 4 | `pages/onboarding/onboarding/index.tsx` | `/pages/onboarding/onboarding/index` | Onboarding hub | | | | | | | | | |
| 5 | `pages/onboarding/essential-data/index.tsx` | `/pages/onboarding/essential-data/index` | Onboarding step 1 | | | | | | | | | |
| 6 | `pages/onboarding/extended-data/index.tsx` | `/pages/onboarding/extended-data/index` | Onboarding step 2 | | | | | | | | | |
| 7 | `pages/onboarding/personality-test/index.tsx` | `/pages/onboarding/personality-test/index` | Personality test | | | | | | | | | |
| 8 | `pages/onboarding/personality-test/auth-gate/index.tsx` | `/pages/onboarding/personality-test/auth-gate/index` | Test auth gate | | | | | | | | | |
| 9 | `pages/onboarding/personality-test/results/index.tsx` | `/pages/onboarding/personality-test/results/index` | Results reveal | | | | | | | | | |
| 10 | `pages/onboarding/profile-review/index.tsx` | `/pages/onboarding/profile-review/index` | Profile review | | | | | | | | | |
| 11 | `pages/discover/index.tsx` | `/pages/discover/index` | Event discovery | | | | | | | | | |
| 12 | `pages/events/index.tsx` | `/pages/events/index` | Events list | | | | | | | | | |
| 13 | `pages/event-detail/index.tsx` | `/pages/event-detail/index` | Event detail | | | | | | | | | |
| 14 | `pages/pool-registration/index.tsx` | `/pages/pool-registration/index` | Pool registration | | | | | | | | | |
| 15 | `pages/matching-status/index.tsx` | `/pages/matching-status/index` | Matching status | | | | | | | | | |
| 16 | `pages/squad-unboxing/index.tsx` | `/pages/squad-unboxing/index` | Squad unboxing | | | | | | | | | |
| 17 | `pages/blind-box-payment/index.tsx` | `/pages/blind-box-payment/index` | Payment | | | | | | | | | |
| 18 | `pages/event-coordination/index.tsx` | `/pages/event-coordination/index` | Event coordination | | | | | | | | | |
| 19 | `pages/connections/index.tsx` | `/pages/connections/index` | Connections | | | | | | | | | |
| 20 | `pages/invite/index.tsx` | `/pages/invite/index` | Invite friends | | | | | | | | | |
| 21 | `pages/icebreaker-session/index.tsx` | `/pages/icebreaker-session/index` | Icebreaker session | | | | | | | | | |
| 22 | `pages/profile/index.tsx` | `/pages/profile/index` | User profile | | | | | | | | | |
| 23 | `pages/edit-profile/index.tsx` | `/pages/edit-profile/index` | Edit profile | | | | | | | | | |
| 24 | `pages/rewards/index.tsx` | `/pages/rewards/index` | Rewards | | | | | | | | | |
| 25 | `pages/center-tab-empty/index.tsx` | `/pages/center-tab-empty/index` | Empty tab state | | | | | | | | | |
| 26 | `pages/payment-verification/index.tsx` | `/pages/payment-verification/index` | Payment verification | | | | | | | | | |
| 27 | `pages/event-feedback/index.tsx` | `/pages/event-feedback/index` | Event feedback | | | | | | | | | |
| 28 | `pages/terms/index.tsx` | `/pages/terms/index` | Terms of service | | | | | | | | | |
| 29 | `pages/pool-group-detail/index.tsx` | `/pages/pool-group-detail/index` | Pool group detail | | | | | | | | | |
| 30 | `pages/onboarding/personality-test/results/stages/BridgeStage.tsx` | (component) | Results bridge | | | | | | | | | |
| 31 | `pages/onboarding/personality-test/results/stages/EmptyStage.tsx` | (component) | Results empty | | | | | | | | | |
| 32 | `pages/onboarding/personality-test/results/stages/ErrorStage.tsx` | (component) | Results error | | | | | | | | | |
| 33 | `pages/onboarding/personality-test/results/stages/FinalStage.tsx` | (component) | Results final | | | | | | | | | |
| 34 | `pages/onboarding/personality-test/results/stages/LoadingStage.tsx` | (component) | Results loading | | | | | | | | | |
| 35 | `pages/onboarding/personality-test/results/stages/RevealStage.tsx` | (component) | Results reveal | | | | | | | | | |
| 36 | `pages/onboarding/personality-test/results/stages/SlotStage.tsx` | (component) | Results slot | | | | | | | | | |
| 37 | `pages/matching-status/MatchingStatusSections.tsx` | (component) | Matching sections | | | | | | | | | |
| 38 | `pages/squad-unboxing/BlindBoxVisual.tsx` | (component) | Blind box visual | | | | | | | | | |
| 39 | `pages/icebreaker-session/IcebreakerToolSelector.tsx` | (component) | Tool selector | | | | | | | | | |
| 40 | `pages/icebreaker-session/MiniScriptConfigModal.tsx` | (component) | MiniScript config | | | | | | | | | |
| 41 | `pages/icebreaker-session/phaseViews.tsx` | (component) | Phase views | | | | | | | | | |

---

## Audit Process

1. **Read** the `.tsx` and `.scss` files for the screen
2. **Score** each pillar using the rubric above
3. **Calculate** the overall grade
4. **Determine** Stitch candidacy using the rules above
5. **Write** a 2–3 sentence gap summary
6. **Repeat** for all screens
7. **Generate** Stitch redesign briefs for all D/F/Candidate-C screens

## Audit Output Template (per screen)

```markdown
### Screen: [Name] ([route])

**Scores:**
- Brand Consistency: [0–10]
- Structural Quality: [0–10]
- Interaction Clarity: [0–10]
- Emotional Polish: [0–10]
- Performance Safety: [0–10]
- **Overall: [X/50] — Grade [A/B/C/D/F]**

**Stitch Candidacy:** [Auto / Candidate / No]

**Gap Summary:**
[2–3 sentences describing the most significant aesthetic and UX gaps]

**Stitch Brief (if applicable):**
[Using stitch-design-workflow skill template]
```
