# 📋 Remaining Debt Master Plan — 2026-05-09
## Social Icebreaker Phase Boost: DB Tooling + Recap + Warmup + Auction

**Document version:** 1.0  
**Author:** Prometheus Planning Agent  
**Last updated:** 2026-05-09  
**Parent plan:** `docs/icebreaker/icebreaker-execution-plan.md` v1.1 (2026-05-07)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Phases at ≥8.0 target | 7 / 10 |
| Phases below target | 3: **warmup (7.1)**, **recap (7.0)**, **auction (3.2)** |
| Server test baseline | 1171 passing |
| Scoring rubric | `Composite = V×0.25 + I×0.25 + E×0.30 + T×0.20` |
| Shared infra proven | CardFlip, IdentityReveal, ParticleBurst, SwipeCard, TapRhythm, TapReaction (7+ games) |
| DB migration state | `0000_snapshot.json` stale (66 vs 86 tables); `_journal.json` idx 37 out-of-order |

**Strategic rationale:** Three below-target phases block the "all phases ≥8.0" launch gate. Additionally, DB migration tooling debt prevents safe schema iteration for all feature work. This plan carves four Tier-2 Sprint Contracts out of the parent execution plan's SE (Batch Boost) scope, plus SA.5 (DB Tooling).

**Sequencing principle:** DB tooling must go first (unblocks schema changes for all subsequent work). Recap and Warmup have highest user-facing value per effort and should follow in parallel. Auction is highest effort/risk and goes last, after shared infra patterns are re-validated on Recap/Warmup.

---

## Sprint Contract A: DB Migration Tooling Debt

```json
{
  "sprintId": "SA.5-DB-TOOLING-2026-05-09",
  "parentPlanId": "icebreaker-execution-plan-v1.1",
  "status": "proposed",
  "tier": 2,
  "goal": "Restore reliable db:generate auto-diff so schema changes can be generated without --custom workaround",
  "area": "database-migration-safety",
  "owner": "server-infrastructure"
}
```

### 1. Goal
Fix the Drizzle migration snapshot drift so that `npm run db:generate` produces a valid diff from schema changes without requiring the `--custom` flag and hand-written SQL. This unblocks all subsequent sprints that may need schema changes.

### 2. Current State
- `apps/server/migrations/meta/0000_snapshot.json` reflects **66 tables**; actual schema in `packages/shared/src/schema/` defines **86 tables** (+20 drift).
- `_journal.json` entry `idx: 37` (`add_attendance_status`) has timestamp `1776958939444`, which is **earlier** than `idx: 36` (`1778141820000`), breaking monotonicity.
- Current workaround: `drizzle-kit generate --custom` + hand-written SQL + manual `_journal.json` edits.
- `--from-db` baseline workflow (GitHub drizzle-orm#5528) is **not yet shipped** in Drizzle Kit (still open as of 2026-03-24).

### 3. Acceptance Criteria

| ID | Criterion | Verification Method | Threshold |
|---|---|---|---|
| A1 | `db:generate` produces valid diff for a test schema change | Run `npm run db:generate` after adding a test column; inspect generated `.sql` | Migration SQL contains exactly the test column `ALTER TABLE`; no spurious table drops/creates |
| A2 | `_journal.json` timestamps are monotonically increasing | Script: parse all `when` fields; assert `sorted(whens) === whens` | All 38 entries (including new) have non-decreasing timestamps |
| A3 | Snapshot reflects ≥85 tables | Parse `0000_snapshot.json` or latest snapshot; count `tables` keys | `Object.keys(snapshot.tables).length >= 85` |
| A4 | `db:verify` passes against live DB | `npm run db:verify` | Exit code 0; no drift reported |
| A5 | No regression in existing migrations | `npm run db:migrate` (dry-run or against staging) | All 37 existing migrations still apply cleanly |
| A6 | Documented rollback path | Add `docs/migrations/DB_TOOLING_ROLLBACK.md` | File exists with step-by-step revert instructions |

### 4. Harness Pillar Criteria

| Pillar | Criterion |
|---|---|
| **Reliability** | Snapshot regeneration is idempotent; running twice produces identical output. |
| **Scalability** | New workflow must not require manual SQL for routine schema changes (add column, add index, add enum value). |
| **Security** | No secrets in generated migration files; no `DROP TABLE` in auto-generated diffs without explicit `--force`. |
| **Observability** | `db:verify` output is captured in CI logs; migration generation logs include snapshot table count. |
| **Maintainability** | Document the fix approach in `docs/migrations/`; update `AGENTS.md` §3 if workflow changes. |

### 5. Out-of-Scope
- Migration to Drizzle Kit v1.0 folders-v3 format (future migration).
- `--from-db` baseline workflow (wait for Drizzle to ship #5528).
- Any schema changes for Recap/Warmup/Auction features (those are Sprint B/C/D).
- Production DDL application (handled separately per `AGENTS.md` §3).

### 6. Verification Method Summary
1. **Deterministic check:** Add a test column to an existing table in schema, run `db:generate`, verify diff is correct, then revert schema change.
2. **Structural check:** Parse `_journal.json` and assert monotonic timestamps.
3. **Integration check:** `db:verify` against live staging DB.
4. **Regression check:** Full test suite (`npm run test -w @joyjoin/server`) still passes.

---

## Sprint Contract B: Recap UI Redesign (7.0 → 8.0+)

```json
{
  "sprintId": "SE-RECAP-BOOST-2026-05-09",
  "parentPlanId": "icebreaker-execution-plan-v1.1",
  "status": "proposed",
  "tier": 2,
  "goal": "Redesign RecapPhaseView and recap data pipeline to achieve composite score ≥8.0",
  "area": "mini-program-frontend-excellence",
  "owner": "mini-program-frontend"
}
```

### 1. Goal
Transform the Recap phase from its current static, card-stacked layout (composite 7.0) into a compelling, emotionally resonant session conclusion that scores ≥8.0 across all four dimensions. Leverage the existing V2 data pipeline (already aggregates lieDetectiveV2Stats, personalityDiceHighlights, undercoverWordResult, microChallengeHighlights, groupMirrorHighlights) and shared infra components.

### 2. Current State
- **Component:** `RecapPhaseView.tsx` (381 lines) — static Card stacks, basic medal stagger animation, static share card, AI feedback bar.
- **Data pipeline:** `buildRecapHighlights()` in `socialIcebreakerExtended.ts` already aggregates all V2 phase data.
- **Server route:** `GET /:socialSessionId/recap` builds medals + AI summary + highlights.
- **Scores:** Visual 6.5, Interaction 6.8, Engagement 7.5, Technical 7.2 → **Composite 7.0**.

### 3. Acceptance Criteria

| ID | Criterion | Verification Method | Threshold |
|---|---|---|---|
| B1 | Composite score ≥8.0 | Run `frontend-design-audit` skill on Recap screen | `Composite >= 8.0` with no single dimension < 7.5 |
| B2 | Uses ≥2 shared infra components | Code review of `RecapPhaseView.tsx` | Imports and uses ≥2 from: IdentityReveal, ParticleBurst, CardFlip, SwipeCard |
| B3 | All V2 data fields rendered | Static analysis: verify each `recapData.*` field has UI representation | `lieDetective`, `personalityDice`, `undercoverWord`, `microChallenge`, `groupMirror` all present |
| B4 | Moment card generation E2E | Manual test: complete session → recap → tap "生成专属回忆卡" | Card renders with session-specific data; no 500 from `/moment-card` |
| B5 | Medals reveal with IdentityReveal | Code review + visual inspection | Each medal uses `IdentityReveal` or staggered entrance animation |
| B6 | Share card is dynamic (not static) | Code review | Share card pulls from `recapSnapshot` data, not hardcoded template |
| B7 | No regression in server tests | `npm run test -w @joyjoin/server` | All 1171 tests pass |
| B8 | No regression in guardrails | `npm run guardrails` | Exit code 0 |

### 4. Harness Pillar Criteria

| Pillar | Criterion |
|---|---|
| **Reliability** | Recap renders correctly when `recapSnapshot` is missing (fallback to on-the-fly generation). |
| **Scalability** | Medal count scales to 8+ players without layout breakage. |
| **Security** | No PII leakage in share card; moment card endpoint still requires auth. |
| **Observability** | AI feedback bar telemetry preserved; new components log render errors. |
| **Maintainability** | Shared infra components reused (no one-off animation code); CSS follows 8rpx rhythm. |

### 5. Out-of-Scope
- Changes to `buildRecapHighlights()` data pipeline (it already provides all needed data).
- Changes to medal curation logic in `medalCuration.ts`.
- New server routes (reuse existing `GET /recap` and `GET /moment-card`).
- Audio/voice features.
- Real-time collaborative recap editing.

---

## Sprint Contract C: Warmup Boost (7.1 → 8.0+)

```json
{
  "sprintId": "SE-WARMUP-BOOST-2026-05-09",
  "parentPlanId": "icebreaker-execution-plan-v1.1",
  "status": "proposed",
  "tier": 2,
  "goal": "Enhance WarmupPhaseView and topic generation to achieve composite score ≥8.0",
  "area": "mini-program-frontend-excellence",
  "owner": "mini-program-frontend"
}
```

### 1. Goal
Elevate the Warmup phase from its current functional-but-plain state (composite 7.1) to a delightful, archetype-aware icebreaker opener that scores ≥8.0. Leverage existing server-side context injection (`buildArchetypeContext` already wired into `generateWarmupTopics`) and shared infra components.

### 2. Current State
- **Component:** `WarmupPhaseView.tsx` (204 lines) — mood selection grid, topic card with emoji, ready toggle, participant roster with archetype glyphs.
- **Server:** `generateWarmupTopics` uses `buildWarmupTopicsPrompt` with `sessionContext.mixText` injection (already wired).
- **Context injection:** `buildArchetypeContext(roster)` produces mix text like `气氛组柯基×2、情绪稳定鸡×1`.
- **Scores:** Visual 6.8, Interaction 7.0, Engagement 7.5, Technical 7.0 → **Composite 7.1**.

### 3. Acceptance Criteria

| ID | Criterion | Verification Method | Threshold |
|---|---|---|---|
| C1 | Composite score ≥8.0 | Run `frontend-design-audit` skill on Warmup screen | `Composite >= 8.0` with no single dimension < 7.5 |
| C2 | Uses ≥2 shared infra components | Code review of `WarmupPhaseView.tsx` | Imports and uses ≥2 from: ParticleBurst, TapReaction, TapRhythm, CardFlip |
| C3 | Archetype mix visible in UI | Code review + visual inspection | Participant roster or topic card displays group archetype mix (e.g., "今晚气氛组：柯基×2、鸡×1") |
| C4 | Mood selection has visual feedback | Visual inspection | Selected mood has animated/scale state; unselected moods dim |
| C5 | "Everyone ready" celebration | Code review | When `readyUserIds.length === participants.length`, triggers ParticleBurst or similar |
| C6 | Topic cards have entrance animation | Code review | New topic uses CardFlip or slide-in animation on `currentIndex` change |
| C7 | No regression in server tests | `npm run test -w @joyjoin/server` | All 1171 tests pass |
| C8 | No regression in guardrails | `npm run guardrails` | Exit code 0 |

### 4. Harness Pillar Criteria

| Pillar | Criterion |
|---|---|
| **Reliability** | Warmup works with 2–8 players; topic generation falls back to curated set on AI failure. |
| **Scalability** | Mood grid and participant list scroll correctly on small screens (iPhone SE). |
| **Security** | No new API surface; all existing auth checks preserved. |
| **Observability** | Topic generation logs include `promptVersion` and `fallbackUsed` telemetry. |
| **Maintainability** | Shared infra reused; no custom animation libraries. |

### 5. Out-of-Scope
- Changes to `generateWarmupTopics` prompt or AI pipeline (context injection already sufficient).
- New server routes (reuse existing `POST /advance` warmup guard).
- New mood options beyond existing `MOOD_OPTIONS`.
- Topic card swiping/gestural navigation (future enhancement).

---

## Sprint Contract D: Auction Dedicated Sprint (3.2 → 8.0+)

```json
{
  "sprintId": "SE-AUCTION-BOOST-2026-05-09",
  "parentPlanId": "icebreaker-execution-plan-v1.1",
  "status": "proposed",
  "tier": 2,
  "goal": "Major overhaul of AuctionPhaseView and auction mechanics to achieve composite score ≥8.0",
  "area": "mini-program-frontend-excellence + server-domain-architecture",
  "owner": "mini-program-frontend + server"
}
```

### 1. Goal
Rebuild the Auction phase from its current bare-bones state (composite 3.2) into a visually compelling, mechanically sound virtual-coin auction that scores ≥8.0. This is the highest-risk sprint due to the large gap (3.2 → 8.0 = +4.8 points) and the need for both UI and server mechanic improvements.

### 2. Current State
- **Component:** `AuctionPhaseView.tsx` (337 lines) — basic English auction, 30s timer (client-side only, drifts), quick bid buttons (+5, +10, ALL IN), basic bid history, simple celebration overlay.
- **Server:** `POST /auction/generate-lots`, `/auction/bid`, `/auction/close-lot`. `advance` guard blocks until `auctionAllLotsClosed`.
- **AI:** `generateAuctionLots` with `SOCIAL_AUCTION_LLM_ENABLED` flag; 3 curated fallback lots.
- **Scores:** Visual 2.5, Interaction 3.5, Engagement 3.0, Technical 4.0 → **Composite 3.2**.
- **Issues:** Timer drifts; no outbid notification; basic lot presentation; no archetype-aware lots; bid history lost on rejoin; celebration overlay is generic.

### 3. Acceptance Criteria

| ID | Criterion | Verification Method | Threshold |
|---|---|---|---|
| D1 | Composite score ≥8.0 | Run `frontend-design-audit` skill on Auction screen | `Composite >= 8.0` with no single dimension < 7.5 |
| D2 | Uses ≥3 shared infra components | Code review of `AuctionPhaseView.tsx` | Imports and uses ≥3 from: CardFlip, IdentityReveal, ParticleBurst, TapReaction, SwipeCard |
| D3 | Timer accuracy within 1s | Manual test: start auction → compare client timer to server phaseStartedAt + 30s | `|clientTimeLeft - serverTimeLeft| <= 1` at any point |
| D4 | Outbid notification | Manual test: Player A bids → Player B outbids → Player A sees notification | Notification appears within 2s of outbid |
| D5 | Bid history persists across rejoin | Test: place bids → leave session → rejoin → verify history | All prior bids visible in history |
| D6 | Archetype-aware lot generation | Code review of `generateAuctionLots` or prompt | Prompt includes `sessionContext.mixText` (archetype mix) |
| D7 | Host advance guard maintained | Code review of `socialIcebreakerExtended.ts` | `auctionAllLotsClosed` check still present in `/advance` |
| D8 | Virtual coin economy balanced | Unit test: verify no negative balances possible | All bid validations prevent `balance < 0` |
| D9 | Lot presentation with imagery | Visual inspection | Lots display with category icon/emoji + teaser text in styled card |
| D10 | No regression in server tests | `npm run test -w @joyjoin/server` | All 1171 tests pass |
| D11 | No regression in guardrails | `npm run guardrails` | Exit code 0 |

### 4. Harness Pillar Criteria

| Pillar | Criterion |
|---|---|
| **Reliability** | Auction completes gracefully with 0 bids (flow pass). Timer syncs from server, not client drift. |
| **Scalability** | UI handles 8 players bidding concurrently without jank. |
| **Security** | Virtual coins only — no real money path. Bid validation server-side (client can be bypassed). |
| **Observability** | Auction events logged: lot generated, bid placed, lot closed, winner. |
| **Maintainability** | Reuse shared infra; no custom countdown logic (use server-synced timer). |

### 5. Out-of-Scope
- Real money integration (virtual coins only per product spec).
- Real-time WebSocket bidding (HTTP polling is sufficient for current scale).
- Auction house / marketplace persistence beyond session.
- New AI model for lot generation (reuse existing `social-auction-lots-v2` prompt).
- Bid sniping prevention (future enhancement).

---

## Master Sequencing Plan

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│  Sprint A: DB Migration Tooling Debt (Week 1)                  │
│  ├─ Unblocks: schema changes for B, C, D                      │
│  └─ Gate: A1–A6 all PASS                                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ (hard dependency)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Parallel Track 1: Sprint B (Recap)  ──┐                       │
│  Parallel Track 2: Sprint C (Warmup) ──┼─ Week 2–3             │
│  │                                      │                       │
│  │  Shared infra validation             │                       │
│  │  └─ CardFlip, IdentityReveal,       │                       │
│  │     ParticleBurst, TapReaction       │                       │
│  │                                      │                       │
│  └─ Gates: B1–B8, C1–C8 all PASS      │                       │
└──────────────────────────┬─────────────┘
                           │ (soft dependency: infra patterns proven)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Sprint D: Auction Dedicated Sprint (Week 4–5)                 │
│  ├─ Leverages: shared infra validated in B/C                  │
│  ├─ May need: schema changes (e.g., auctionBidHistory table)  │
│  │             → requires Sprint A complete                   │
│  └─ Gate: D1–D11 all PASS                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Sequencing Rationale

| Order | Sprint | Why this position |
|-------|--------|-------------------|
| **1** | **A (DB Tooling)** | Hard blocker for all schema-dependent work. If D needs a new `auction_bids` table or C needs a `warmup_reactions` column, A must be done first. |
| **2a** | **B (Recap)** | High user-facing value (every session ends here). Lower risk than D. Shared infra rehearsal. |
| **2b** | **C (Warmup)** | High user-facing value (every session starts here). Can parallel with B due to independent codebases. |
| **3** | **D (Auction)** | Highest effort/risk (+4.8 point gap). Benefits from shared infra patterns validated in B/C. May need schema changes → requires A. |

### Risk Register

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Snapshot regeneration breaks existing migrations** | Medium | High | Test on staging clone first; keep `--custom` workaround documented as rollback. |
| R2 | **Recap redesign over-scopes into server pipeline** | Medium | Medium | Strict out-of-scope on `buildRecapHighlights`; UI-only contract. |
| R3 | **Warmup boost insufficient to reach 8.0** | Low | Medium | Current gap is only 0.9 points; shared infra + archetype visibility should close it. |
| R4 | **Auction 3.2→8.0 is too large for single sprint** | High | High | Split D into D1 (mechanics/server) and D2 (UI/polish) if mid-sprint assessment shows risk. |
| R5 | **Shared infra components incompatible with Taro** | Low | High | All 6 components already proven in 7+ games; regression test before use. |
| R6 | **DB schema change needed mid-sprint B/C/D before A is done** | Medium | High | Use `--custom` workaround for urgent schema changes; do not block B/C/D on A. |
| R7 | **Design audit subjectivity causes score dispute** | Medium | Low | Use rubric weights explicitly; get second opinion if score is borderline (7.8–8.2). |
| R8 | **Auction timer sync adds server complexity** | Medium | Medium | Use `phaseStartedAt` + fixed duration; client computes remaining time from server timestamp. |

### Proposed Timeline

| Week | Sprint | Deliverable | Review Gate |
|------|--------|-------------|-------------|
| W1 | **A** | DB tooling fixed; `db:generate` works without `--custom` | A1–A6 |
| W2 | **B + C** (parallel) | Recap redesign PR; Warmup boost PR | B1–B8, C1–C8 |
| W3 | **B + C** (finish) | Design audit sign-off; merge both PRs | Composite ≥8.0 on both |
| W4 | **D** (start) | Auction mechanics overhaul (timer sync, bid history, outbid) | D3–D8 |
| W5 | **D** (finish) | Auction UI polish; design audit; merge | D1–D11 |

### Rollback Criteria

Any sprint may be rolled back or re-scoped if:
1. **Mid-sprint assessment** shows >50% risk of missing acceptance criteria.
2. **Regression** in server tests that cannot be resolved within 1 day.
3. **Dependency failure:** A sprint's hard dependency (e.g., A for D schema changes) fails its gate.

---

## Appendix A: Scoring Rubric Reference

For all design audits in Sprints B, C, D:

| Dimension | Weight | What we measure |
|-----------|--------|-----------------|
| **Visual** | 25% | Brand alignment, hierarchy, spacing rhythm, color usage, typography, motion quality |
| **Interaction** | 25% | Gesture richness, feedback immediacy, state clarity, error handling, accessibility |
| **Engagement** | 30% | Emotional resonance, narrative arc, replay value, social shareability |
| **Technical** | 20% | Performance (≤16ms frame budget), correctness, reuse of shared infra, test coverage |

**Target:** Composite ≥ 8.0 with no single dimension below 7.5.

---

## Appendix B: Shared Infra Inventory

| Component | Proven In | Best For | File |
|-----------|-----------|----------|------|
| `CardFlip` | lie_detective, personality_dice, undercover_word | Reveal animations, state transitions | `apps/mini-program/src/components/reveal/` |
| `IdentityReveal` | group_mirror, quip_battle | User identity unveiling | `apps/mini-program/src/components/reveal/` |
| `ParticleBurst` | micro_challenge, lie_detective | Celebration, achievement moments | `apps/mini-program/src/components/reveal/` |
| `SwipeCard` | personality_dice, quip_battle | Card dismissal, choice gestures | `apps/mini-program/src/components/gesture/` |
| `TapReaction` | micro_challenge | Quick feedback on tap | `apps/mini-program/src/components/gesture/` |
| `TapRhythm` | quip_battle | Rhythmic interaction | `apps/mini-program/src/components/gesture/` |

---

## Appendix C: File References

| Sprint | Primary Files | Secondary Files |
|--------|--------------|-----------------|
| **A** | `apps/server/migrations/meta/_journal.json`, `apps/server/migrations/meta/0000_snapshot.json`, `drizzle.config.ts` | `docs/migrations/DB_TOOLING_ROLLBACK.md` (to create) |
| **B** | `apps/mini-program/src/pages/icebreaker-session/phases/RecapPhaseView.tsx` | `apps/server/src/routes/socialIcebreakerExtended.ts` (read-only), `apps/mini-program/src/pages/icebreaker-session/overlays/MomentCardView.tsx` |
| **C** | `apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx` | `apps/server/src/socialIcebreakerAIService.ts` (read-only for context injection), `apps/server/src/ai/socialIcebreakerPrompts.ts` (read-only) |
| **D** | `apps/mini-program/src/pages/icebreaker-session/phases/AuctionPhaseView.tsx`, `apps/server/src/routes/socialIcebreakerExtended.ts` (auction routes) | `apps/server/src/socialIcebreakerAIService.ts` (`generateAuctionLots`), `apps/server/src/ai/socialIcebreakerPrompts.ts` (`buildAuctionLotsPrompt`) |

---

## Appendix D: Deterministic Gate Checks

### Sprint A Gate
```bash
# Check A1: Generate test migration
npm run db:generate && \
grep -q "ADD COLUMN" apps/server/migrations/*/migration.sql && \
echo "A1: PASS" || echo "A1: FAIL"

# Check A2: Monotonic timestamps
node -e "const j=require('./apps/server/migrations/meta/_journal.json'); const ws=j.entries.map(e=>e.when); console.log('A2:', ws.every((v,i,a)=>!i||v>=a[i-1])?'PASS':'FAIL')"

# Check A3: Snapshot table count
node -e "const s=require('./apps/server/migrations/meta/0000_snapshot.json'); const c=Object.keys(s.tables).length; console.log('A3:', c>=85?'PASS ('+c+')':'FAIL ('+c+')')"

# Check A4: Verify against live DB
npm run db:verify && echo "A4: PASS" || echo "A4: FAIL"

# Check A5+A7: Regression
npm run test -w @joyjoin/server && echo "A5: PASS" || echo "A5: FAIL"
npm run guardrails && echo "A7: PASS" || echo "A7: FAIL"
```

### Sprint B Gate
```bash
# Check B7+B8: Regression
npm run test -w @joyjoin/server && echo "B7: PASS" || echo "B7: FAIL"
npm run guardrails && echo "B8: PASS" || echo "B8: FAIL"

# Check B3: V2 data coverage
grep -E "lieDetective|personalityDice|undercoverWord|microChallenge|groupMirror" \
  apps/mini-program/src/pages/icebreaker-session/phases/RecapPhaseView.tsx && \
  echo "B3: PASS" || echo "B3: FAIL"

# Check B2: Shared infra usage
grep -E "IdentityReveal|ParticleBurst|CardFlip|SwipeCard" \
  apps/mini-program/src/pages/icebreaker-session/phases/RecapPhaseView.tsx && \
  echo "B2: PASS" || echo "B2: FAIL"
```

### Sprint C Gate
```bash
# Check C7+C8: Regression
npm run test -w @joyjoin/server && echo "C7: PASS" || echo "C7: FAIL"
npm run guardrails && echo "C8: PASS" || echo "C8: FAIL"

# Check C2: Shared infra usage
grep -E "ParticleBurst|TapReaction|TapRhythm|CardFlip" \
  apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx && \
  echo "C2: PASS" || echo "C2: FAIL"

# Check C3: Archetype mix visible
grep -E "mixText|archetype.*×|气氛组|情绪稳定" \
  apps/mini-program/src/pages/icebreaker-session/phases/WarmupPhaseView.tsx && \
  echo "C3: PASS" || echo "C3: FAIL"
```

### Sprint D Gate
```bash
# Check D10+D11: Regression
npm run test -w @joyjoin/server && echo "D10: PASS" || echo "D10: FAIL"
npm run guardrails && echo "D11: PASS" || echo "D11: FAIL"

# Check D2: Shared infra usage
grep -E "CardFlip|IdentityReveal|ParticleBurst|TapReaction|SwipeCard" \
  apps/mini-program/src/pages/icebreaker-session/phases/AuctionPhaseView.tsx && \
  echo "D2: PASS" || echo "D2: FAIL"

# Check D7: Advance guard preserved
grep -A2 "auctionAllLotsClosed" \
  apps/server/src/routes/socialIcebreakerExtended.ts && \
  echo "D7: PASS" || echo "D7: FAIL"

# Check D8: No negative balances (server validation)
grep -E "balance.*<.*0|insufficient|负数" \
  apps/server/src/routes/socialIcebreakerExtended.ts && \
  echo "D8: PASS" || echo "D8: FAIL"
```

---

*End of document. This plan is a living document — update the Negotiation Log and Risk Register as sprints progress.*
