# PRD: Unified Connection Reveal (Mini-Program)

> **Status:** Implemented (2026-04-29)  
> **Scope:** Mini-program matching-status screen (`apps/mini-program/src/pages/matching-status/`)  
> **Harness Tier:** 2 — multi-file UI flow, state machine extension, CSS-only animations  
> **Related:** `docs/architecture/connection-points-system.md`, `docs/tech-debt/connection-points-cleanup.md`

---

## 1. Problem Statement

Users see **two disconnected pieces of information** after matching:
1. A generic group-level chemistry card: "这一桌的聊天温度已经被点燃"
2. Small disconnected pills on member cards: "同乡（广州）", "性格互补"

These feel like a **data dump**, not a personal story. The emotional "why we matched" moment feels mechanical instead of magical. Users should feel a spark of recognition — "The algorithm really gets me" — by weaving pair-level rarity evidence into the group-level chemistry narrative as one theatrical reveal.

---

## 2. Target Users and Scenario

| | |
|---|---|
| **Primary user** | Matched pool registrant on WeChat mini-program |
| **Moment** | Immediately after `POOL_MATCHED` WebSocket event, or when revisiting an already-matched registration |
| **Emotional goal** | Feel personally seen and excited about who they're meeting |
| **Business goal** | Drive event attendance and post-match sharing |

---

## 3. Goals and Non-Goals

### Goals
- [x] Fuse `chemistryPayoff` (group narrative) and `connectionPoints` (pair evidence) into a single presentational surface
- [x] Create "wow" emotional impact without breaking bundle budget or Taro performance constraints
- [x] Preserve all existing fallback behavior when server analysis is missing or stale
- [x] Skip repeat theater when user revisits an already-revealed group

### Non-Goals
- No server/API contract changes
- No new animation libraries (Lottie, Framer Motion, Canvas)
- No web client parity in this sprint — mini-program is launch-primary
- No redesign of squad-unboxing or pool-group-detail pages

---

## 4. User Stories

### Story 1: First reveal
> As a matched user, when I see my match notification, I want to discover why **I specifically** was paired with this person, so that I feel excited to meet them.

**Acceptance:**
- Overlay shows group chemistry headline
- Member cards reveal connection points with rarity-colored borders
- Chemistry card shows my spotlight pair's explanation as the main body
- Group-level chemistry line appears as subtitle when overridden

### Story 2: Revisit
> As a matched user, when I reopen the matching-status page, I don't want to sit through the reveal animation again.

**Acceptance:**
- `hasRevealed` flag stored per `groupId`
- Overlay skips stagger animation on revisit
- All content visible instantly

### Story 3: Low-end device
> As a user on an entry-level Android phone, I want the reveal to feel smooth, not stuttery.

**Acceptance:**
- CSS-only `transform` + `opacity` animations
- `shouldReduceMotion` forces instant state when benchmark ≤ 8
- No `scale`, `blur`, or `box-shadow` transitions

---

## 5. Acceptance Criteria

| ID | Criterion | Verification |
|---|---|---|
| AC-01 | `composeUnifiedReveal()` returns correct `UnifiedRevealTokens` with spotlight body overriding group body | `npm run test -w mini-program -- --run matchingStatusViewModels.test.ts` |
| AC-02 | Legacy `connectionPoints: string[]` normalizes to `{text, rarity: 'common'}[]` | Unit test in matchingStatusViewModels.test.ts |
| AC-03 | `hasRevealed` flag persists across app restarts for same `groupId` | Manual: close and reopen mini-program, verify instant reveal |
| AC-04 | `shouldReduceMotion=true` shows all content instantly with no stagger | Manual: set `?motion=reduce` query param |
| AC-05 | Timer leak fix: no stale `setLiveStage` callbacks after page hide | Code review + `useDidHide` inspection |
| AC-06 | Bundle size: matching-status chunk remains ≤ 100 KB | `npm run bundle-size:check` |
| AC-07 | TypeScript typecheck clean | `npm run typecheck -w mini-program` |
| AC-08 | Guardrails pass (0 errors) | `npm run guardrails` |

---

## 6. Constraints, Risks, and Dependencies

### Constraints
| Constraint | Implication |
|---|---|
| Taro/WeChat runtime | No nested ScrollView inside reveal card; flex-wrap pills only |
| Bundle budget | No new dependencies; component must be < 2 KB gzipped |
| CSS-only animations | `transform` + `opacity` only; no JS animation libraries |

### Risks
| Risk | Mitigation |
|---|---|
| Narrative dissonance (group vs pair copy contradict) | Spotlight body always wins; group body becomes subtitle |
| Stale analysis cache references departed member | `composeUnifiedReveal` guards against missing lookups |
| Timer leak on fast navigation | `mountedRef` + `useDidHide` + clear on `liveStage` change |
| Low-end device frame drops | Max 3 simultaneous animations, 120ms stagger, instant reduce-motion |

### Dependencies
- `chemistryPayoff.ts` (already ported to mini-program)
- `connectionPointsWithRarity` field in `PairExplanation` (server already emits)
- `calculateMatchQuality` from `packages/shared/src/ui/connectionPointCompat.ts` (already shared)

---

## 7. Success Metrics

| Metric | Baseline | Target | Measurement |
|---|---|---|---|
| Event attendance rate (matched → attended) | TBD | +5% | Post-event check-in data |
| Matching-status screen revisit rate | TBD | No regression | Analytics: `screen_view` event for `matching-status` |
| Share card generation from match result | TBD | +10% | Share poster analytics |
| Client-side crash rate | TBD | No increase | Sentry / WeChat crash reports |

---

## 8. Architecture Decisions

| ADR | Decision | Rationale |
|---|---|---|
| ADR-001 | Fuse at view-model layer, not server | `chemistryPayoff.ts` must remain pure and cross-platform; connection points come from separate cached endpoint |
| ADR-002 | CSS-only animations | Taro/WeChat low-end devices cannot reliably run JS-driven animations |
| ADR-003 | Static glow for Epic rarity | Animated box-shadow causes frame drops; static radial-gradient achieves visual distinction without animation cost |
| ADR-004 | Spotlight body overrides group body | Pair-level explanation is more emotionally resonant than generic group line |
| ADR-005 | No nested ScrollView | WeChat gesture-capture deadlock risk with nested ScrollView |

---

## 9. Implementation Summary

**Shipped 2026-04-29:**
- `composeUnifiedReveal()` in `matchingStatusViewModels.ts`
- `UnifiedRevealCard.tsx` component
- `hasRevealed` Taro storage flag
- Timer leak fixes (`mountedRef`, `useDidHide`)
- 12 regression tests
- Bundle impact: matching-status chunk unchanged at ~84 KB

**Files changed:**
- `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.ts`
- `apps/mini-program/src/pages/matching-status/useMatchingStatusController.ts`
- `apps/mini-program/src/pages/matching-status/MatchingStatusSections.tsx`
- `apps/mini-program/src/pages/matching-status/index.tsx`
- `apps/mini-program/src/pages/matching-status/_chemistry-card.scss`
- `apps/mini-program/src/pages/matching-status/UnifiedRevealCard.tsx` *(new)*
- `apps/mini-program/src/pages/matching-status/matchingStatusViewModels.test.ts` *(new)*
