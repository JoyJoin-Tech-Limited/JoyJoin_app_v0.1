# Archetype Boundary Stability Sweep — 2026-09-10

> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 8 (M8).
> Contract: `.git/.orchestration/sprints/sprint-contract.item8-boundary-stability.md`.
> Mode: **baseline** (report-only; exit 0 by design).
> Fully deterministic: identical `--seed` reproduces every number in this report.
> **Read-only instrument:** the matcher, engine, prototypes and confusion registries are used as-is; no source was modified.

## Run parameters

- Seed: `20260910`
- Samples per centroid per arm: **600** (AC-8.1 requires ≥500)
- Gate arms (uniform): ±5, ±10 — clamped to [5, 95]
- Secondary robustness arm (A1): independent Normal(0, σ=10) per trait (Item 6's centroid-mixture σ; uniform ±10 has SD≈5.8 so the uniform arm is the optimistic one)
- Flip classification (A2): **confusable** = (source→absorber) pair registered in `CONFUSABLE_ARCHETYPE_PAIRS`/`PERSISTENT_CONFUSION_PAIRS`; **hard** = unregistered (needs a centroid redraw)
- Matcher: `findBestMatchingArchetypesV2` (MatcherV2, isolation mode — no engine sessions, no mocks)
- Content hash: `477139ac6d2b1f8db62bcbb44e69558e7a3de78db53237eb86d0fcf42ccf0956`
- Runtime: 0.51s

## Method

- For each centroid and each radius, one deterministic stream (`mulberry32(streamSeed(seed, centroidIndex, "radiusR"))`).
- **Flip rate** = fraction of perturbed samples whose MatcherV2 top-1 archetype ≠ the source centroid archetype.
- **Absorbing archetype** = the top-1 archetype of a flipped sample (the archetype that took the vector). The ranked fragile-pair table aggregates `source → absorber` across the full 12×2 grid.
- **Clamping caveat (geometry, not a matcher defect):** centroids near a trait bound (e.g. corgi X=95, octopus O=95) absorb half of their raw draws flat at the bound, so their effective perturbation is asymmetric. `clampEvents` is reported per cell.
- **Non-monotonicity:** flip rate is not guaranteed monotone in radius — hard thresholds (signature/veto/confusion classifiers) mean a wider spread can re-enter a centroid's basin (observed: `hamster_praise` 10.2% @±5 vs 8.3% @±10). Read the grid per cell, not as a monotone curve.
- **Roster order (frozen reference for AC-8.3):** `corgi` → `rooster` → `hamster_praise` → `fox` → `dolphin_calm` → `spider` → `koala` → `octopus` → `owl` → `elephant` → `turtle` → `cat`. A Tier 3 redraw must keep this sequence identical; it is captured in the JSON artifact as `rosterOrder` so a future reorder is diff-detectable.

## 12×3 grid (flip rate — uniform is the locked gate)

| Archetype | uniform ±5 (≤5%) | uniform ±10 (≤20%) | Normal σ=10 (context ≤20%) |
|---|---|---|---|
| `corgi` | 0.0% ✅ | 0.0% ✅ | 23.0% ❌ |
| `rooster` | 0.0% ✅ | 0.0% ✅ | 8.7% ✅ |
| `hamster_praise` | 10.2% ❌ | 8.3% ✅ | 24.5% ❌ |
| `fox` | 0.0% ✅ | 0.0% ✅ | 20.7% ❌ |
| `dolphin_calm` | 6.0% ❌ | 28.5% ❌ | 55.7% ❌ |
| `spider` | 0.0% ✅ | 0.5% ✅ | 26.3% ❌ |
| `koala` | 0.0% ✅ | 16.5% ✅ | 42.3% ❌ |
| `octopus` | 0.0% ✅ | 0.0% ✅ | 8.2% ✅ |
| `owl` | 0.0% ✅ | 0.0% ✅ | 18.2% ✅ |
| `elephant` | 0.0% ✅ | 1.8% ✅ | 26.8% ❌ |
| `turtle` | 0.0% ✅ | 2.0% ✅ | 27.7% ❌ |
| `cat` | 0.0% ✅ | 0.5% ✅ | 18.7% ✅ |

**LOCKED gate breaches (uniform): 3/24.** `hamster_praise` @±5 (10.2% > 5.0%); `dolphin_calm` @±5 (6.0% > 5.0%); `dolphin_calm` @±10 (28.5% > 20.0%)
**Secondary Normal-arm breaches: 8/12** (context only — `corgi` (23.0%); `hamster_praise` (24.5%); `fox` (20.7%); `dolphin_calm` (55.7%); `spider` (26.3%); `koala` (42.3%); `elephant` (26.8%); `turtle` (27.7%)).

**Confusable/hard flip split (A2) per breaching gate cell:**

| Gate cell | Flip rate | Confusable flips | Hard flips |
|---|---|---|---|
| `hamster_praise` @±5 | 10.2% | 0 | 61 |
| `dolphin_calm` @±5 | 6.0% | 36 | 0 |
| `dolphin_calm` @±10 | 28.5% | 152 | 19 |

**Near-threshold watch (passing but ≥75% of the bar):** `koala` @±10 (16.5% / 20.0%). Monitor — a seed or bank change could tip these over.

Absorber class detail (all flipped cells, both arms):
- `corgi` normal σ=10: 138 flips (conf 24 / hard 114)
- `rooster` normal σ=10: 52 flips (conf 32 / hard 20)
- `hamster_praise` uniform @±5: 61 flips (conf 0 / hard 61)
- `hamster_praise` uniform @±10: 50 flips (conf 0 / hard 50)
- `hamster_praise` normal σ=10: 147 flips (conf 2 / hard 145)
- `fox` normal σ=10: 124 flips (conf 94 / hard 30)
- `dolphin_calm` uniform @±5: 36 flips (conf 36 / hard 0)
- `dolphin_calm` uniform @±10: 171 flips (conf 152 / hard 19)
- `dolphin_calm` normal σ=10: 334 flips (conf 267 / hard 67)
- `spider` uniform @±10: 3 flips (conf 2 / hard 1)
- `spider` normal σ=10: 158 flips (conf 42 / hard 116)
- `koala` uniform @±10: 99 flips (conf 58 / hard 41)
- `koala` normal σ=10: 254 flips (conf 133 / hard 121)
- `octopus` normal σ=10: 49 flips (conf 42 / hard 7)
- `owl` normal σ=10: 109 flips (conf 6 / hard 103)
- `elephant` uniform @±10: 11 flips (conf 0 / hard 11)
- `elephant` normal σ=10: 161 flips (conf 44 / hard 117)
- `turtle` uniform @±10: 12 flips (conf 0 / hard 12)
- `turtle` normal σ=10: 166 flips (conf 49 / hard 117)
- `cat` uniform @±10: 3 flips (conf 0 / hard 3)
- `cat` normal σ=10: 112 flips (conf 26 / hard 86)

## Ranked fragile pairs (absorbed flips)

Ranked by total flips absorbed across both radii. `a→b` / `b→a` are directional (source→absorber).

| # | Pair | a→b (±5) | b→a (±5) | a→b (±10) | b→a (±10) | a→b (N) | b→a (N) | Total | Confusable / Hard | Registered |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `dolphin_calm`↔`rooster` | 36 | 0 | 122 | 0 | 122 | 3 | **283** | 283 / 0 | persistent-confusion |
| 2 | `hamster_praise`↔`rooster` | 61 | 0 | 50 | 0 | 109 | 19 | **239** | 0 / 239 | — |
| 3 | `elephant`↔`turtle` | 0 | 0 | 10 | 12 | 44 | 105 | **171** | 0 / 171 | — |
| 4 | `dolphin_calm`↔`spider` | 0 | 0 | 27 | 2 | 76 | 42 | **147** | 147 / 0 | persistent-confusion |
| 5 | `dolphin_calm`↔`koala` | 0 | 0 | 0 | 53 | 31 | 53 | **137** | 137 / 0 | persistent-confusion |
| 6 | `fox`↔`octopus` | 0 | 0 | 0 | 0 | 94 | 39 | **133** | 133 / 0 | persistent-confusion |
| 7 | `elephant`↔`koala` | 0 | 0 | 0 | 5 | 44 | 80 | **129** | 129 / 0 | confusable |
| 8 | `koala`↔`spider` | 0 | 0 | 4 | 1 | 28 | 64 | **97** | 0 / 97 | — |
| 9 | `cat`↔`owl` | 0 | 0 | 3 | 0 | 55 | 26 | **84** | 0 / 84 | — |
| 10 | `koala`↔`rooster` | 0 | 0 | 22 | 0 | 59 | 0 | **81** | 0 / 81 | — |
| 11 | `elephant`↔`spider` | 0 | 0 | 1 | 0 | 47 | 11 | **59** | 0 / 59 | — |
| 12 | `corgi`↔`dolphin_calm` | 0 | 0 | 0 | 19 | 0 | 36 | **55** | 0 / 55 | — |
| 13 | `corgi`↔`hamster_praise` | 0 | 0 | 0 | 0 | 50 | 4 | **54** | 0 / 54 | — |
| 14 | `corgi`↔`rooster` | 0 | 0 | 0 | 0 | 24 | 29 | **53** | 53 / 0 | persistent-confusion |
| 15 | `hamster_praise`↔`koala` | 0 | 0 | 0 | 15 | 1 | 31 | **47** | 0 / 47 | — |
| 16 | `cat`↔`turtle` | 0 | 0 | 0 | 0 | 26 | 20 | **46** | 46 / 0 | persistent-confusion |
| 17 | `dolphin_calm`↔`hamster_praise` | 0 | 0 | 3 | 0 | 38 | 2 | **43** | 43 / 0 | confusable |
| 18 | `dolphin_calm`↔`elephant` | 0 | 0 | 0 | 0 | 30 | 11 | **41** | 0 / 41 | — |
| 19 | `corgi`↔`octopus` | 0 | 0 | 0 | 0 | 39 | 1 | **40** | 0 / 40 | — |
| 20 | `owl`↔`spider` | 0 | 0 | 0 | 0 | 35 | 3 | **38** | 0 / 38 | — |
| 21 | `corgi`↔`fox` | 0 | 0 | 0 | 0 | 25 | 12 | **37** | 0 / 37 | — |
| 22 | `owl`↔`turtle` | 0 | 0 | 0 | 0 | 6 | 29 | **35** | 35 / 0 | persistent-confusion |
| 23 | `rooster`↔`spider` | 0 | 0 | 0 | 0 | 1 | 32 | **33** | 0 / 33 | — |
| 24 | `hamster_praise`↔`octopus` | 0 | 0 | 0 | 0 | 31 | 1 | **32** | 0 / 32 | — |
| 25 | `cat`↔`octopus` | 0 | 0 | 0 | 0 | 25 | 2 | **27** | 0 / 27 | — |
| 26 | `fox`↔`owl` | 0 | 0 | 0 | 0 | 1 | 14 | **15** | 0 / 15 | — |
| 27 | `dolphin_calm`↔`fox` | 0 | 0 | 0 | 0 | 1 | 12 | **13** | 0 / 13 | — |
| 28 | `elephant`↔`owl` | 0 | 0 | 0 | 0 | 3 | 10 | **13** | 0 / 13 | — |
| 29 | `elephant`↔`rooster` | 0 | 0 | 0 | 0 | 12 | 0 | **12** | 0 / 12 | — |
| 30 | `dolphin_calm`↔`owl` | 0 | 0 | 0 | 0 | 0 | 10 | **10** | 0 / 10 | — |
| 31 | `koala`↔`turtle` | 0 | 0 | 0 | 0 | 2 | 7 | **9** | 0 / 9 | — |
| 32 | `koala`↔`owl` | 0 | 0 | 0 | 0 | 0 | 7 | **7** | 0 / 7 | — |
| 33 | `spider`↔`turtle` | 0 | 0 | 0 | 0 | 1 | 5 | **6** | 0 / 6 | — |
| 34 | `fox`↔`spider` | 0 | 0 | 0 | 0 | 5 | 0 | **5** | 0 / 5 | — |
| 35 | `hamster_praise`↔`spider` | 0 | 0 | 0 | 0 | 0 | 4 | **4** | 0 / 4 | — |
| 36 | `cat`↔`fox` | 0 | 0 | 0 | 0 | 3 | 0 | **3** | 0 / 3 | — |
| 37 | `octopus`↔`owl` | 0 | 0 | 0 | 0 | 3 | 0 | **3** | 3 / 0 | persistent-confusion |
| 38 | `cat`↔`koala` | 0 | 0 | 0 | 0 | 2 | 0 | **2** | 0 / 2 | — |
| 39 | `dolphin_calm`↔`octopus` | 0 | 0 | 0 | 0 | 0 | 2 | **2** | 0 / 2 | — |
| 40 | `cat`↔`elephant` | 0 | 0 | 0 | 0 | 1 | 0 | **1** | 0 / 1 | — |
| 41 | `corgi`↔`koala` | 0 | 0 | 0 | 0 | 0 | 1 | **1** | 0 / 1 | — |
| 42 | `corgi`↔`spider` | 0 | 0 | 0 | 0 | 0 | 1 | **1** | 0 / 1 | — |
| 43 | `hamster_praise`↔`owl` | 0 | 0 | 0 | 0 | 0 | 1 | **1** | 0 / 1 | — |
| 44 | `octopus`↔`spider` | 0 | 0 | 0 | 0 | 1 | 0 | **1** | 0 / 1 | — |

## P0 baseline fragile-pair cross-reference

Pairs flagged by the P0 `simulate:personas:run:all` boundary run (owl↔fox, owl↔octopus, turtle↔cat, elephant↔koala):

| P0 pair | a→b (±5) | b→a (±5) | a→b (±10) | b→a (±10) | a→b (N) | b→a (N) | Total | In sweep ranking |
|---|---|---|---|---|---|---|---|---|
| `fox`↔`owl` | 0 | 0 | 0 | 0 | 1 | 14 | **15** | #26 |
| `octopus`↔`owl` | 0 | 0 | 0 | 0 | 3 | 0 | **3** | #37 |
| `cat`↔`turtle` | 0 | 0 | 0 | 0 | 26 | 20 | **46** | #16 |
| `elephant`↔`koala` | 0 | 0 | 0 | 5 | 44 | 80 | **129** | #7 |

## AC-8.3 dispositions

For every breaching cell, each absorbing pair gets a disposition. Recommendation rule: a pair already registered in `PERSISTENT_CONFUSION_PAIRS` / `CONFUSABLE_ARCHETYPE_PAIRS` → **option (b) confusion-gate**; otherwise → **option (a) centroid redraw** (Tier 3 follow-up). **No redraw or registry change is performed by this instrument.**

### `corgi` normal σ=10 (context arm) — 23.0% (138/600) > 20.0%

- `corgi`→`hamster_praise`: 50 flips (36.2% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `corgi`→`octopus`: 39 flips (28.3% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `corgi`→`fox`: 25 flips (18.1% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `corgi`→`rooster`: 24 flips (17.4% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.

### `hamster_praise` uniform @±5 — 10.2% (61/600) > 5.0%

- `hamster_praise`→`rooster`: 61 flips (100.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `hamster_praise` normal σ=10 (context arm) — 24.5% (147/600) > 20.0%

- `hamster_praise`→`rooster`: 109 flips (74.1% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `hamster_praise`→`octopus`: 31 flips (21.1% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `hamster_praise`→`corgi`: 4 flips (2.7% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `hamster_praise`→`dolphin_calm`: 2 flips (1.4% of the cell). Disposition: **option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`**.
- `hamster_praise`→`koala`: 1 flips (0.7% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `fox` normal σ=10 (context arm) — 20.7% (124/600) > 20.0%

- `fox`→`octopus`: 94 flips (75.8% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `fox`→`corgi`: 12 flips (9.7% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `fox`→`dolphin_calm`: 12 flips (9.7% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `fox`→`spider`: 5 flips (4.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `fox`→`owl`: 1 flips (0.8% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `dolphin_calm` uniform @±5 — 6.0% (36/600) > 5.0%

- `dolphin_calm`→`rooster`: 36 flips (100.0% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.

### `dolphin_calm` uniform @±10 — 28.5% (171/600) > 20.0%

- `dolphin_calm`→`rooster`: 122 flips (71.3% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `dolphin_calm`→`spider`: 27 flips (15.8% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `dolphin_calm`→`corgi`: 19 flips (11.1% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `dolphin_calm`→`hamster_praise`: 3 flips (1.8% of the cell). Disposition: **option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`**.

### `dolphin_calm` normal σ=10 (context arm) — 55.7% (334/600) > 20.0%

- `dolphin_calm`→`rooster`: 122 flips (36.5% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `dolphin_calm`→`spider`: 76 flips (22.8% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `dolphin_calm`→`hamster_praise`: 38 flips (11.4% of the cell). Disposition: **option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`**.
- `dolphin_calm`→`corgi`: 36 flips (10.8% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `dolphin_calm`→`koala`: 31 flips (9.3% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `dolphin_calm`→`elephant`: 30 flips (9.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `dolphin_calm`→`fox`: 1 flips (0.3% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `spider` normal σ=10 (context arm) — 26.3% (158/600) > 20.0%

- `spider`→`koala`: 64 flips (40.5% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`dolphin_calm`: 42 flips (26.6% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `spider`→`rooster`: 32 flips (20.3% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`elephant`: 11 flips (7.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`hamster_praise`: 4 flips (2.5% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`owl`: 3 flips (1.9% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`corgi`: 1 flips (0.6% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `spider`→`turtle`: 1 flips (0.6% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `koala` normal σ=10 (context arm) — 42.3% (254/600) > 20.0%

- `koala`→`elephant`: 80 flips (31.5% of the cell). Disposition: **option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`**.
- `koala`→`rooster`: 59 flips (23.2% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `koala`→`dolphin_calm`: 53 flips (20.9% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `koala`→`hamster_praise`: 31 flips (12.2% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `koala`→`spider`: 28 flips (11.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `koala`→`turtle`: 2 flips (0.8% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `koala`→`corgi`: 1 flips (0.4% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `elephant` normal σ=10 (context arm) — 26.8% (161/600) > 20.0%

- `elephant`→`spider`: 47 flips (29.2% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `elephant`→`koala`: 44 flips (27.3% of the cell). Disposition: **option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`**.
- `elephant`→`turtle`: 44 flips (27.3% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `elephant`→`rooster`: 12 flips (7.5% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `elephant`→`dolphin_calm`: 11 flips (6.8% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `elephant`→`owl`: 3 flips (1.9% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.

### `turtle` normal σ=10 (context arm) — 27.7% (166/600) > 20.0%

- `turtle`→`elephant`: 105 flips (63.3% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `turtle`→`owl`: 29 flips (17.5% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `turtle`→`cat`: 20 flips (12.0% of the cell). Disposition: **option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw**.
- `turtle`→`koala`: 7 flips (4.2% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.
- `turtle`→`spider`: 5 flips (3.0% of the cell). Disposition: **option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged**.


## Determinism

Content hash (numeric payload, wall-clock excluded): `477139ac6d2b1f8db62bcbb44e69558e7a3de78db53237eb86d0fcf42ccf0956`. Two same-seed runs must print the identical hash.

## Raw cell detail

| Archetype | Arm | Flips / Samples | Flip rate | Conf / Hard | Top absorbers | Clamp events / (samples×6) |
|---|---|---|---|---|---|---|
| `corgi` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 319/3600 |
| `corgi` | ±10 | 0/600 | 0.0% | 0 / 0 | — | 304/3600 |
| `corgi` | N σ=10 | 138/600 | 23.0% | 24 / 114 | hamster_praise:50*, octopus:39*, fox:25*, rooster:24 | 417/3600 |
| `rooster` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 117/3600 |
| `rooster` | ±10 | 0/600 | 0.0% | 0 / 0 | — | 304/3600 |
| `rooster` | N σ=10 | 52/600 | 8.7% | 32 / 20 | corgi:29, hamster_praise:19*, dolphin_calm:3, spider:1* | 409/3600 |
| `hamster_praise` | ±5 | 61/600 | 10.2% | 0 / 61 | rooster:61* | 319/3600 |
| `hamster_praise` | ±10 | 50/600 | 8.3% | 0 / 50 | rooster:50* | 399/3600 |
| `hamster_praise` | N σ=10 | 147/600 | 24.5% | 2 / 145 | rooster:109*, octopus:31*, corgi:4*, dolphin_calm:2 | 489/3600 |
| `fox` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 119/3600 |
| `fox` | ±10 | 0/600 | 0.0% | 0 / 0 | — | 219/3600 |
| `fox` | N σ=10 | 124/600 | 20.7% | 94 / 30 | octopus:94, corgi:12*, dolphin_calm:12*, spider:5* | 260/3600 |
| `dolphin_calm` | ±5 | 36/600 | 6.0% | 36 / 0 | rooster:36 | 0/3600 |
| `dolphin_calm` | ±10 | 171/600 | 28.5% | 152 / 19 | rooster:122, spider:27, corgi:19*, hamster_praise:3 | 0/3600 |
| `dolphin_calm` | N σ=10 | 334/600 | 55.7% | 267 / 67 | rooster:122, spider:76, hamster_praise:38, corgi:36* | 97/3600 |
| `spider` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `spider` | ±10 | 3/600 | 0.5% | 2 / 1 | dolphin_calm:2, koala:1* | 0/3600 |
| `spider` | N σ=10 | 158/600 | 26.3% | 42 / 116 | koala:64*, dolphin_calm:42, rooster:32*, elephant:11* | 97/3600 |
| `koala` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `koala` | ±10 | 99/600 | 16.5% | 58 / 41 | dolphin_calm:53, rooster:22*, hamster_praise:15*, elephant:5 | 117/3600 |
| `koala` | N σ=10 | 254/600 | 42.3% | 133 / 121 | elephant:80, rooster:59*, dolphin_calm:53, hamster_praise:31* | 251/3600 |
| `octopus` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 306/3600 |
| `octopus` | ±10 | 0/600 | 0.0% | 0 / 0 | — | 332/3600 |
| `octopus` | N σ=10 | 49/600 | 8.2% | 42 / 7 | fox:39, owl:3, cat:2*, dolphin_calm:2* | 325/3600 |
| `owl` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `owl` | ±10 | 0/600 | 0.0% | 0 / 0 | — | 97/3600 |
| `owl` | N σ=10 | 109/600 | 18.2% | 6 / 103 | spider:35*, cat:26*, fox:14*, dolphin_calm:10* | 190/3600 |
| `elephant` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `elephant` | ±10 | 11/600 | 1.8% | 0 / 11 | turtle:10*, spider:1* | 171/3600 |
| `elephant` | N σ=10 | 161/600 | 26.8% | 44 / 117 | spider:47*, koala:44, turtle:44*, rooster:12* | 270/3600 |
| `turtle` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `turtle` | ±10 | 12/600 | 2.0% | 0 / 12 | elephant:12* | 159/3600 |
| `turtle` | N σ=10 | 166/600 | 27.7% | 49 / 117 | elephant:105*, owl:29, cat:20, koala:7* | 252/3600 |
| `cat` | ±5 | 0/600 | 0.0% | 0 / 0 | — | 0/3600 |
| `cat` | ±10 | 3/600 | 0.5% | 0 / 3 | owl:3* | 0/3600 |
| `cat` | N σ=10 | 112/600 | 18.7% | 26 / 86 | owl:55*, turtle:26, octopus:25*, fox:3* | 41/3600 |

`*` = unregistered (hard) absorber, resolved by a centroid redraw rather than a confusion gate.
