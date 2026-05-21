# JoyJoin Mini-Program 20/20 Design Roadmap

> **Produced by:** Product Manager Agent  
> **Date:** 2026-05-21  
> **Scope:** All 13 screen groups in `apps/mini-program/src/pages/*`  
> **Framework:** 5-Dimension Audit (Brand Fidelity · State Completeness · Theming & Tokens · Responsive & Platform Safety · Performance & Motion) — 4 pts each, 20 total

---

## Executive Summary: Top 5 Needle-Movers

| # | Change | Screens Lifted | Est. Score Delta |
|---|--------|---------------|------------------|
| 1 | **Fix P0 bug** (`window.location.reload` → `Taro.reLaunch`) + add Xiaoyue to center-hub non-empty cards | Center Hub | 13 → 17 (+4) |
| 2 | **Enforce `line-height` token** across all text blocks (add `$line-height-relaxed` to theme, audit every `.scss`) | Event Detail, Matching Status, Pool Registration, Icebreaker, Edit Profile, Profile | +1 to +2 per screen |
| 3 | **Standardize card visual richness** — apply OracleCard gradient/shadow/progress-bar pattern to Events list and Center Hub state cards | Events, Center Hub | 14 → 17 (+3), 13 → 16 (+3) |
| 4 | **Inject mascot moments** into empty & non-empty states (reuse existing `xiaoyue-*` WebP assets; generate 2 new poses for events-empty + event-detail) | Events, Event Detail, Center Hub, Profile | +1 to +2 per screen |
| 5 | **Touch target sweep** — replace all `Text` with `onClick` with `View` wrappers (Edit Profile tags, any remaining across flow) | Edit Profile, +cross-cutting | 14 → 16 (+2) |

**Bottom line:** The above 5 changes require ~3 dev-days and move the aggregate average from **15.8/20 → 17.6/20** without touching a single Stitch redesign.

---

## Prioritized Backlog Table

| Screen Group | Current | Target | Effort | Impact | Quick Win? | Rationale |
|-------------|---------|--------|--------|--------|-----------|-----------|
| **Center Hub** | 13 | 18 | Low | Very High | ✅ | P0 bug fix is 1 line; card enrichment is pattern reuse; mascot asset already exists |
| **Events** | 14 | 18 | Low | Very High | ✅ | Empty state needs mascot swap; cards need OracleCard shell + progress bar |
| **Event Detail** | 14 | 17 | Low | High | ✅ | Add `line-height` token + mascot bubble + explicit desc line-height |
| **Edit Profile** | 14 | 17 | Low | High | ✅ | Text→View touch targets + interest-tag heat colors + form line-height |
| **Matching Status** | 16 | 18 | Low | Medium | ✅ | Hint line-height + remove "当前状态" confusion + Compass chip alignment |
| **Connections** | 15 | 17 | Low | Medium | ✅ | Archetype glyphs already built; swap text initials + add empty mascot |
| **Discover** | 17 | 19 | Low | Medium | ✅ | Emoji alignment flex fix + filter chip active-state polish |
| **Profile** | 15 | 17 | Medium | Medium | ❌ | Redesign stat row + add mascot greeting + archetype celebration card |
| **Pool Registration** | 16 | 18 | Medium | Medium | ❌ | Deduplicate bar/non-bar copy + add tier illustration + line-height |
| **Icebreaker Session** | 16 | 18 | Medium | Medium | ❌ | Lazy-load phase backgrounds + add phase-transition mascot toast |
| **Squad Unboxing** | 18 | 20 | Low | Low | ✅ | Remove blur filter (perf) + micro-copy warmth tweak |
| **Onboarding Flow** | 18 | 20 | Low | Low | ✅ | Line-height on legal text + landing card border token swap |
| **Login Page** | 18 | 20 | Low | Low | ✅ | Ad-hoc text color → token swap only |

**Ranking logic:** Center Hub and Events are at the bottom of the scoreboard but have the highest traffic and the lowest-effest fixes (pattern reuse from Discover's OracleCard + existing mascot assets). Everything scoring 18+ is deprioritized to Phase 3 polish.

---

## Cross-Cutting Quick Wins (The Multipliers)

These 4 changes apply across ≥3 screens and should be built as shared infra first:

### QW-1: Line-Height Token Enforcement
- **What:** Add `$line-height-tight: 1.4`, `$line-height-relaxed: 1.6` to `variables.scss`; enforce on all multi-line text.
- **Affected:** Event Detail desc, Matching Status hints, Pool Registration notes, Icebreaker phase copy, Edit Profile labels, Profile bio.
- **Effort:** 1 dev-day (find/replace + visual regression).
- **Lift:** +1 point on 6 screens.

### QW-2: Mascot Empty-State Component
- **What:** Create `<XiaoyueEmptyState emotion="coaching|celebration|waiting" message={} action={} />` wrapper using existing `xiaoyue-connections-empty.webp`, `xiaoyue-coach-guide.webp`, `xiaoyue-neutral-information.webp`.
- **Affected:** Events empty, Connections empty, Center Hub empty, Edit Profile error retry.
- **Effort:** 2 hours.
- **Lift:** +1–2 points on 4 screens.

### QW-3: Touch Target Safety Sweep
- **What:** Lint rule + manual fix: any `Text` with `onClick` must be wrapped in `View` with `min-height: 88rpx` (44px equivalent) or replaced with `Button`.
- **Affected:** Edit Profile interest tags, Discover filter chips (if any), Event Detail expandable sections.
- **Effort:** 2 hours.
- **Lift:** +1 point on 2 screens; prevents WeChat accessibility rejection.

### QW-4: OracleCard Shell for List Cards
- **What:** Extract a `RichListCard` component from `OracleCard` (gradient header, progress bar, accent shadow, ecosystem bar) and apply to Events page cards and Center Hub matched-event cards.
- **Affected:** Events, Center Hub.
- **Effort:** 4 hours.
- **Lift:** +2–3 points on 2 screens.

---

## Dependency Map

```
Layer 0: Design Tokens (blocks everything)
  ├─ Add $line-height-relaxed, $line-height-tight
  └─ Standardize bg-gradient token (replace #FAFAFA→#FFF5F7→#FFE4E1)

Layer 1: Shared Components (blocks Layer 2)
  ├─ RichListCard (from OracleCard)
  ├─ XiaoyueEmptyState
  └─ TouchTarget lint rule

Layer 2: Screen Groups (can run in parallel once Layer 1 is ready)
  ├─ Center Hub (needs RichListCard + XiaoyueEmptyState + P0 fix)
  ├─ Events (needs RichListCard + XiaoyueEmptyState)
  ├─ Event Detail (needs line-height token + Xiaoyue bubble)
  ├─ Edit Profile (needs touch target + line-height)
  ├─ Matching Status (needs line-height + copy fix)
  ├─ Connections (needs archetype glyph + XiaoyueEmptyState)
  └─ Discover (needs emoji alignment + token swap)

Layer 3: Deep Polish (lowest priority, no blockers)
  ├─ Icebreaker lazy backgrounds
  ├─ Squad unboxing blur removal
  ├─ Onboarding/Login token cleanup
  └─ Profile archetype celebration
```

**Critical path:** Layer 0 → Layer 1 → Center Hub + Events (these two screens drive the most daily active sessions and have the lowest current scores).

---

## 3-Phase Rollout Plan

### Phase 1: Quick Wins + P0 Bug — 1 Week (Sprint 24W21)
**Goal:** Move the average from 15.8 → 17.2 by fixing everything that requires zero design assets.

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 1 | **P0:** Replace `window.location.reload?.()` with `Taro.reLaunch({url:'/pages/center-hub/index'})` in `center-hub/index.tsx:111` | FE | PR merged, bug closed |
| 1 | **Layer 0:** Add `$line-height-tight` / `$line-height-relaxed` to theme; replace ad-hoc gradients with `$color-bg-gradient` token on Discover, Event Detail, EventCoordination | FE | Token PR |
| 2 | **Layer 1:** Build `RichListCard` (extracted from OracleCard) | FE | Component + Storybook/demo |
| 2 | **Layer 1:** Build `XiaoyueEmptyState` wrapper | FE | Component + demo |
| 3 | **QW-3:** Touch target sweep: Edit Profile tags `Text→View`, lint rule added | FE | PR |
| 3 | **Events:** Swap empty state emoji for `XiaoyueEmptyState`; apply `RichListCard` to event list | FE | Screen audit score 14 → 17 |
| 4 | **Center Hub:** Apply `RichListCard` to matched-event card; add `xiaoyue-match-waiting.webp` to pending state; fix error state reload | FE | Screen audit score 13 → 17 |
| 4 | **Matching Status:** Set hint `line-height` to `$line-height-relaxed`; replace "当前状态" with "匹配进度" | FE | Screen audit score 16 → 17 |
| 5 | **Connections:** Swap text initials for `ArchetypeGlyph` (already built); add `XiaoyueEmptyState` | FE | Screen audit score 15 → 17 |
| 5 | **Discover:** Fix action emoji flex alignment; filter chip active-state polish | FE | Screen audit score 17 → 18 |
| 5 | **Regression:** Run `npm run design:audit` on all changed screens | QA | Pass list |

**Exit criteria:** Average score ≥ 17.0; P0 bug verified fixed on iOS + Android WeChat.

---

### Phase 2: Core Screens — 2 Weeks (Sprint 24W22–23)
**Goal:** Push Discover, Events, Profile, Center Hub into the 18–19 band with deeper visual polish.

| Week | Screen | Work |
|------|--------|------|
| W22 | **Event Detail** | Add `xiaoyue-neutral-information.webp` tip bubble; set desc `line-height: $line-height-relaxed`; add hero image gradient overlay; add "活动氛围" preview card |
| W22 | **Profile** | Redesign stat row (remove confusing "当前状态"); add archetype celebration card with `ArchetypeGlyph`; add `xiaoyue-home-welcome.webp` greeting bubble; celebrate menu cards with count badges |
| W22 | **Edit Profile** | Add live preview card at top; add `xiaoyue-coach-guide.webp` coaching bubble; interest tags use heat-level colors; form section line-height fixes |
| W23 | **Center Hub** | Deepen `RichListCard` with countdown pill + location icon + event-type badge; add Xiaoyue peeking from bottom on non-empty states |
| W23 | **Events** | Add VirtualList safety threshold logging; add event-type badge to cards; add "即将开始" countdown on upcoming events |
| W23 | **Discover** | Add Xiaoyue greeting header ("[Name]，今晚想怎么玩？"); polish OracleCard micro-animation (scale entrance on filter change) |

**Exit criteria:** Discover ≥ 18, Events ≥ 18, Profile ≥ 17, Center Hub ≥ 18.

---

### Phase 3: Deep Polish — 1 Week (Sprint 24W24)
**Goal:** Push all screens to 19–20 with surgical fixes. No new components.

| Screen | Polish Task | Target |
|--------|-------------|--------|
| **Icebreaker Session** | Lazy-load phase background images (`loading="lazy"` or intersection observer); add Xiaoyue phase-transition toast; set all phase copy `line-height: $line-height-relaxed` | 16 → 18 |
| **Matching Status** | Compass preference chips touch-target padding; waiting card orbit animation reduced-motion guard verification | 16 → 18 |
| **Pool Registration** | Deduplicate bar/non-bar tier copy into single source of truth; add tier selector mascot illustration | 16 → 18 |
| **Squad Unboxing** | Remove CSS blur filter (replace with pre-blurred asset or opacity fade); tighten unboxing sequence timing | 18 → 20 |
| **Onboarding Flow** | LandingPage card border colors → brand palette; legal text line-height; onboarding entry mascot consistency | 18 → 20 |
| **Login Page** | Ad-hoc text color `#7B6A96` → token; button pressed-state scale consistency | 18 → 20 |
| **Connections** | Chemistry badge color token alignment; group header typography polish | 15 → 17 |

**Exit criteria:** Zero screens below 17; 80% of screens at 18+.

---

## 20/20 Definition Per Screen (One Sentence Each)

| Screen Group | 20/20 Definition |
|-------------|------------------|
| **Onboarding Flow** | Every step uses brand tokens exclusively, Xiaoyue coaches consistently, legal text is readable with `$line-height-relaxed`, and the landing hero cards use only palette colors. |
| **Login Page** | All text colors are tokenized, the primary CTA has a crisp pressed-state scale, and the warm cream background is applied via `$color-bg-gradient` with zero ad-hoc hexes. |
| **Squad Unboxing** | The unboxing sequence runs at 60 fps on mid-tier Android with no CSS blur filters, every frame uses pre-blurred WebP assets, and the celebration moment triggers a Xiaoyue burst animation. |
| **Discover Page** | The OracleCard feed has perfect flex alignment on filter chips and action emojis, every gradient is brand-tokenized, and Xiaoyue greets the user by name in the sticky header. |
| **Icebreaker Session** | Phase backgrounds load lazily below the fold, all instructional copy uses `$line-height-relaxed`, and Xiaoyue appears with a contextual tip on every phase transition. |
| **Pool Registration** | Tier selection uses a single source of truth for copy (no bar/non-bar duplication), the description block has explicit line-height, and a Xiaoyue illustration accompanies the tier explainer. |
| **Matching Status** | The "匹配进度" stat is instantly scannable, Compass preference chips have 88 rpx touch targets, hint text breathes with `$line-height-relaxed`, and reduced-motion is respected globally. |
| **Connections** | Every connection shows an `ArchetypeGlyph` avatar (not text initials), empty state displays Xiaoyue with a warm action prompt, and chemistry badges use tokenized family colors. |
| **Profile Page** | The archetype is celebrated with a color-matched card, stats are labeled unambiguously (no "当前状态"), Xiaoyue greets from the header, and menu items use rich cards with count badges. |
| **Event Detail** | The description has `line-height: 1.6`, a Xiaoyue tip bubble contextualizes the event vibe, the hero image has a brand-gradient overlay, and every info row uses an icon from `JoyJoinIcon`. |
| **Events Page** | List cards use the `RichListCard` shell (gradient, progress bar, type badge), empty state shows Xiaoyue, and upcoming events display a live countdown pill. |
| **Edit Profile** | Interest tags are `View`-wrapped with 88 rpx touch targets, form sections use `$line-height-relaxed`, a live preview card sits at the top, and Xiaoyue coaches the user to save. |
| **Center Hub** | The error state reloads via `Taro.reLaunch`, matched-event cards are `RichListCard`-grade with countdown pills, pending states show `xiaoyue-match-waiting.webp`, and no state uses a plain text card. |

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Mascot overload** — Xiaoyue appears on too many screens and feels spammy | Medium | Medium | Enforce the "one mascot moment per screen" rule; use small peeking poses (≤120 rpx) on functional screens, reserve full illustrations for empty/success states only. |
| **Animation jank on low-end devices** — OracleCard entrance animations + RichListCard shadows cause frame drops | Medium | High | Add `prefers-reduced-motion` media query guard (already present in matching-status); use `transform` + `opacity` only, no `box-shadow` animation; test on WeChat DevTools performance panel with CPU throttling. |
| **Bundle size bloat** — New Xiaoyue WebP assets add >200 KB | Low | Medium | Reuse existing assets from `src/assets/personality/xiaoyue/` (already 20+ poses); only generate 2 new assets (events-empty, event-detail-tip); run `npm run build:weapp` and verify total app.json subpackages stay under 2 MB. |
| **Token cascade breakage** — Swapping `$color-bg-gradient` breaks screens that relied on the old ad-hoc gradient | Low | High | The old gradient was `#FAFAFA→#FFF5F7→#FFE4E1`; replace with a token that renders the identical visual first, then iterate to brand gradient in a follow-up PR. |
| **Touch target regression** — Converting `Text` to `View` changes layout or text alignment | Low | Medium | Wrap `Text` inside `View` (keep Text for copy, View for hit area), or use `display: inline-flex` with `min-height`; add visual regression snapshot in WeChat DevTools. |
| **Icebreaker lazy-load delay** — Lazy backgrounds cause white flash on phase transition | Medium | Medium | Use `preload` for next-phase background on advance; keep current phase background in DOM until next phase has loaded; add low-opacity placeholder color matching the phase theme. |

---

## Success Metrics

### Per-Screen Gates (Design Audit Scorecard)

For each screen to be called **20/20**, it must satisfy:

| Dimension | Criteria | How to Measure |
|-----------|----------|---------------|
| **Brand Fidelity** (4 pts) | Zero ad-hoc hex colors; all colors from `$color-*` tokens; mascot present where specified; illustration style consistent (low-poly / 插画风) | `npm run design:audit <screen>` + manual color picker check |
| **State Completeness** (4 pts) | Loading, empty, error, success, and disabled states all handled; empty states use `XiaoyueEmptyState` or custom illustration; error states offer retry | Visual inspection of each state; simulate network offline |
| **Theming & Tokens** (4 pts) | All spacing uses `$spacing-*`; all typography uses `$font-size-*` + `$font-weight-*`; line-height explicitly set to `$line-height-tight` or `$line-height-relaxed` on every multi-line text block | Regex scan for `line-height:` and `px` / `rpx` hard-codes |
| **Responsive & Platform Safety** (4 pts) | All interactive elements ≥ 88 rpx touch target; no `Text` with `onClick`; safe-area respected; works on 320 px–430 px widths | WeChat DevTools device simulation + tap-test |
| **Performance & Motion** (4 pts) | Animations use `transform`/`opacity` only; images have explicit dimensions; no CSS blur filters; backgrounds lazy-loaded where off-screen; `prefers-reduced-motion` respected | Performance panel audit; Lighthouse-like check for layout thrash |

### Aggregate Metrics

| Metric | Baseline | Phase 1 Target | Phase 2 Target | Phase 3 Target |
|--------|----------|---------------|---------------|---------------|
| Average score (all 13 screens) | 15.8 | 17.2 | 18.1 | 18.8 |
| Screens at 18+ | 3 | 7 | 9 | 11 |
| Screens below 15 | 4 | 0 | 0 | 0 |
| Ad-hoc hex colors remaining | ~12 | ≤4 | ≤2 | 0 |
| `Text` elements with `onClick` | ~6 | 0 | 0 | 0 |
| Missing mascot moments | 7 | ≤3 | ≤1 | 0 |

### Verification Ritual

At the end of each phase:
1. Run `npm run design:audit` on all 13 screen groups.
2. Capture WeChat DevTools screenshots on iPhone 14 Pro + Xiaomi Redmi (375 px and 390 px).
3. File any screen scoring < 17 as a P1 follow-up ticket before proceeding to the next phase.

---

## Appendix: Asset Checklist

| Asset | Status | Needed For |
|-------|--------|-----------|
| `xiaoyue-events-empty.webp` | ❌ New | Events empty state |
| `xiaoyue-event-detail-tip.webp` | ❌ New | Event detail tip bubble |
| `xiaoyue-center-hub-peek.webp` | ✅ Exists (`xiaoyue-home-welcome.webp` reusable) | Center Hub non-empty |
| `xiaoyue-match-waiting.webp` | ✅ Exists | Center Hub pending |
| `xiaoyue-coach-guide.webp` | ✅ Exists | Edit Profile coaching |
| `xiaoyue-connections-empty.webp` | ✅ Exists | Connections empty |
| `ArchetypeGlyph` (12 types) | ✅ Exists | Connections avatars, Profile celebration |
| `RichListCard` component | ❌ New (extract) | Events, Center Hub |
| `XiaoyueEmptyState` component | ❌ New (compose) | Events, Connections, Center Hub, Edit Profile error |

**Recommendation:** Generate only 2 new Lovart assets this quarter (events-empty, event-detail-tip). Everything else is composable from existing inventory.

---

*End of roadmap. Ready for engineering kickoff.*
