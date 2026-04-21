# Design modules (callable sub-routines)

Use these as **ordered checklists** when compiling an `IcebreakerRunPlan`. Each module has **inputs**, **outputs**, and **hard rejects**.

---

## 1. Psychological safety

### PressureGauge

- **Input:** proposed segment list + `participation` mode per segment + pool `eventType`.
- **Action:** assign **pressure score 1–10** per segment (10 = spotlight / body / deep disclosure).
- **Rule:** if any segment > **7** without `participation: full` and explicit cohort consent note in `rationale`, **downgrade** (`energyWeight` 1, move later in arc) or **remove**.
- **Output:** annotated segments with `energyWeight` and optional `rationale` note per high-energy segment.

### OptOutShield

- **Input:** segment list.
- **Action:** for each interactive segment, confirm server/UI already supports **pass / observe / async** where product policy allows (see warmup ready patterns; future: document per-phase).
- **Rule:** if a segment cannot support opt-out, **flag `NoveltyFlag`** for dev to add mechanics or **exclude** segment from v1 compile.
- **Output:** checklist table in handoff appendix.

### IntrovertFriendlyFilter

- **Input:** cohort tags from `CohortAnalyzer` + `PersonaMapper`.
- **Action:** prefer segments with **parallel work**, **written input**, or **small rotations** before full-group spotlight.
- **Output:** reorder keys only (no new mechanics).

---

## 2. Mechanics and compilation

### MechanicsLibrary

- **Input:** JoyJoin catalog: Social phases + optional `IcebreakerToolkit` game titles as *ideas only* (not wired until dev maps them).
- **Action:** pick **atomic labels** (e.g. “two_truths_one_lie”, “timed_tap_challenge”, “mood_topics”) and map each to **`SocialIcebreakerPhase`** where possible.
- **Output:** internal draft list → translated to `segments[].phase`.

### FlowCurator

- **Input:** ordered segments.
- **Action:** enforce arc **warm → moderate peak → reflective end**; default order baseline: `warmup` → `micro_challenge` → optional `lie_detective` → optional `personality_dice` → `recap`.
- **Output:** reordered `segments[]` with short energy justification string.

### TimeBoxOptimizer

- **Input:** `event_pools.dateTime` vs compile time, expected in-event icebreaker minutes (product default), `memberCount`.
- **Action:** assign notional **minute budget** per segment; if sum exceeds budget, drop lowest-priority optional segments first (`auction`, `mini_script_beta` unless experimental flag).
- **Output:** optional `context` notes or future `segment.maxMinutes` when schema extends.

---

## 3. Personalization

### CohortAnalyzer

- **Input:** `pool.eventType`, title keywords, city/district.
- **Action:** classify coarse bucket: `social_hangout` | `professional` | `family_friendly` | `unknown`.
- **Output:** single `cohort` string in compile log (optional future field in `context` when schema allows).

### PersonaMapper

- **Input:** safe aggregates only (e.g. majority archetype from registrations if allowed by privacy review).
- **Action:** produce **non-identifying** tags (`creative_majority`, etc.).
- **Output:** influences `tone` on `runPlanSegmentSchema` only.

### LocaleInjector

- **Input:** city, locale, optional weather API (if product adds it later).
- **Action:** propose **copy hooks** for AI slot fill (warmup topics), not structural changes.
- **Output:** strings for `rationale` or AI service input buffer — **not** extra JSON keys outside schema.

---

## 4. Handoff and dev readiness

### TemplateMatcher

- **Input:** each `segment.phase`.
- **Action:** map to **mini-program phase view** (primary) and **web** component (parity):

| Phase | Mini-program (Taro) — ship first | Web (React parity) |
|-------|----------------------------------|---------------------|
| `warmup` | `WarmupPhaseView` in `phaseViews.tsx` | `WarmupPhase` |
| `micro_challenge` | `MicroChallengePhaseView` | `MicroChallengePhase` |
| `lie_detective` | `LieDetectivePhaseView` | `LieDetectivePhase` |
| `auction` | `FallbackPhaseView` / stub pattern in `index.tsx` | `AuctionPhaseStub` |
| `personality_dice` | `PersonalityDicePhaseView` | `PersonalityDicePhase` |
| `mini_script_beta` | `FallbackPhaseView` / stub pattern | `MiniScriptBetaStub` |
| `recap` | `RecapPhaseView` | `SocialIcebreakerRecap` |

- **Output:** table in handoff doc for Game Development Agent; acceptance tests **run on mini-program** first.

### StateMachineDraft

- **Output shape (handoff appendix, not persisted unless product adds column):**

```json
{
  "entry": "warmup",
  "nodes": [
    { "id": "warmup", "advance": "host", "skip": "ready_queue" },
    { "id": "micro_challenge", "advance": "host", "skip": "timer_or_all_done" }
  ],
  "edges": [
    { "from": "warmup", "to": "micro_challenge", "condition": "host_advance_valid" }
  ]
}
```

Use **names aligned** with server routes in `apps/server/src/routes/socialIcebreaker.ts`.

### NoveltyFlag

- **Input:** `TemplateMatcher` result.
- **Action:** if product requests a mechanic with **no** phase in registry, set `"novelty": true` in handoff JSON and **do not** pretend a template exists.
- **Output:** explicit owner: **Game Development Agent** (PR) + QA + mini-program parity when UI ships.
