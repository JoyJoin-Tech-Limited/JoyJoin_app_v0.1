# V4 Personality Engine Scientific Upgrade Plan

> Date: 2026-09-09. Author: PM agent (formulated from strategy discussion).
> External-validation counterpart: `docs/strategy/scientific-foundation.md`
> §"Pre-launch validation program". This plan is the internal-validation half.

**Mission:** Raise the V4 assessment's measurement integrity and the pool
matcher's group-composition rigor to the standard claimed in
`docs/strategy/scientific-foundation.md`, proven entirely through simulation
before launch (zero live analytics data available).

## Invariant constraints (hard)

1. Adaptive budget stays 8–16 questions (`DEFAULT_ASSESSMENT_CONFIG` min=10 /
   hardMax=16 + 2 universal closing items). New item types fit inside this budget.
2. No 7th trait. ACOEXP stays six-dimensional until factor analysis on live data.
3. No gamification of correctness.
4. Canonical 12-archetype roster order is load-bearing — centroid redraws must
   never reorder the roster.
5. WeChat review posture: no 匹配/社交/灵魂/AI in visible copy; new item copy
   passes `docs/copy/brand-copy-strategy.md` 🔴 rules.
6. Engine changes in `packages/shared/src/personality/` (consumed via
   `@shared/personality`); matcher changes in `apps/server/src/poolMatchingService.ts`.
7. No runtime LLM anywhere in this plan — ai-engineer is not assigned.

## (a) Phased roadmap

```
P0  Baseline lock (existing simulate suite)     — prerequisite, run-only, no contract
P1a Item 6: Latent-trait recovery harness       — built FIRST; it is the measuring
                                                  instrument that validates P1b–P1f
P1b Item 11: E/P question-bank strengthening    — highest-ROI fix exposed by the
                                                  P1a baseline (E r=0.612, P r=0.665;
                                                  E/P also most sample-starved)
P1c Item 12: Confidence calibration             — prerequisite for Item 3: map engine
                                                  confidence → observed accuracy on
                                                  harness data (confidence is ~0.91 vs
                                                  ~49% real agreement today)
P1d Item 1: Ipsative item type                  ─┐
P1e Item 2: Consistency pairs (depends on 1)     ├─ Phase 1 mechanics (flags dark)
P1f Item 4: Meta-consistency check (dep. on 2)   │
P1g Item 3: Confidence-weighted shrinkage        │
           (depends on 2+4+12)                  ─┘
P1h Item 5: Literature-prior composition rules (depends on 3)
P2a Item 7: Adversarial persona suite  ─────────┐ parallel after P1d–P1g
P2b Item 8: Boundary stability sweep   ─────────┘ (8 may trigger centroid redraw → Tier 3 follow-up)
P2c Item 9: Monte Carlo group formation (depends on P1h)
P2d Item 10: Mechanically derived chemistry matrix (last — needs stable trait geometry)
P3  CI gate wiring: extend simulate:gate to cover 6/7/8/9/11/12 thresholds
```

Ordering rationale (amended after P1a audit): the recovery harness (6) is the
ruler — without it Phase 1 claims are unverifiable. The P1a baseline showed E/P
are the weakest and most sample-starved traits, so bank strengthening (11)
comes before mechanics. The baseline also showed engine confidence is
uncalibrated (≈0.91 vs ≈49% agreement), and Item 3 consumes confidence — so
calibration (12) is a hard prerequisite for shrinkage. Ipsative items (1)
precede consistency pairs (2); shrinkage (3) consumes the richer confidence
signal from (2)+(4)+(12); composition rules (5) consume shrunken traits;
chemistry derivation (10) is last because it derives from trait geometry that
survived the boundary sweep (8).

**Feature-flag posture:** every Phase 1 behavior ships dark behind an
`AssessmentConfig` flag (`enableIpsativeItems`, `enableConsistencyFolding`,
`enableTraitShrinkage`, `enableMetaConsistency`). Composition rules follow the
existing R-gate pattern with env/flag gates. Rollout = flags dark → harness PASS
→ staging persona suite → production config.

## (b) User stories & acceptance criteria

### Item 1 — Ipsative (forced-choice) item format
> As the assessment engine, I want a two-option item type where both options are
> equally socially desirable but load on different traits, so self-presentation
> bias is removed by design.

- AC-1.1: `AdaptiveQuestion` gains `questionType: 'ipsative'`; each option declares
  `socialDesirabilityIndex` (0–100); paired options within ±10 SDI. Bank audit
  script asserts the pairing invariant for every ipsative item.
- AC-1.2: Choosing option A increments A's traits and applies a small zero-sum
  debit to the rival trait, preserving total-score geometry (existing persona
  suite stays green under flag-on).
- AC-1.3: ≥12 ipsative items in the bank (2 per high-value trait rivalry), all copy
  passing WeChat-posture lint and `scripts/simulate/audit-question-bank-bias.ts`.
- AC-1.4: Mini-program renders the pair-choice surface (reuse existing
  forced-choice UI if present) with no test-length change, zero-scroll intact.
- AC-1.5: Flag off = byte-identical behavior (`simulate:gate` passes on both states).

### Item 2 — Built-in consistency pairs
> As the engine, I want 2–3 near-paraphrase item pairs whose agreement folds into
> `traitConfidences`, so confidence reflects internal consistency.

- AC-2.1: Pair registry (`CONSISTENCY_PAIRS`) reusing the `ValidityCheckPair` type
  shape; pairs scheduled ≥4 questions apart by the selector.
- AC-2.2: Agreement score feeds `calculateTraitConfidence` as a bounded adjustment
  (±0.15); disagreement lowers confidence, never the trait score.
- AC-2.3: Pairs occupy existing adaptive slots — hardMax stays 16 (session-length
  distribution unchanged in harness).
- AC-2.4: Clean personas show higher mean confidence than noisy personas
  (provisional: ≥0.10 mean-confidence gap on random-clicker persona; lock after P0).

### Item 3 — Confidence-weighted trait shrinkage
> As the matcher, I want reported traits shrunk toward 50 in proportion to
> (1 − confidence), so low-confidence users stop swinging group composition.

- AC-3.1: `reported = w·estimated + (1−w)·50`, `w = f(confidence)` monotone,
  w=1 at confidence ≥0.8, documented curve; applied at the matcher/reporting
  boundary — raw engine scores untouched for question selection.
- AC-3.2: Monte Carlo evidence (Item 9): 20% low-confidence injection changes
  formed-group composition measurably less with shrinkage on (provisional ≥50%
  reduction in mean per-trait group-mean delta; lock after baseline).
- AC-3.3: `simulate:personas:run:ci` remains 100% — shrinkage is near-identity for
  clean high-confidence personas.

### Item 4 — End-of-test meta-consistency check
> As the engine, I want one final item whose answer is compared against my
> Extraversion estimate, flagging large discrepancies as session confidence loss.

- AC-4.1: One meta item reusing the universal closing-question mechanism
  (alongside `Q_PLAYFUL_SLIDER`/`Q_PLAYFUL_EMOJI`), never consuming an adaptive slot.
- AC-4.2: Discrepancy |self-report X − estimated X| ≥ 30 applies a bounded
  session-confidence multiplier (e.g. ×0.8) propagating into shrinkage — never
  into trait scores.
- AC-4.3: Harness proof: inflated self-image personas flagged ≥80%; honest ≤10%.
- AC-4.4: No user-facing inconsistency messaging (no correctness gamification).

### Item 5 — Literature-prior group composition rules
> As pool matching, I want composition gates derived from Bell (2007) and
> Barrick et al. (1998), extending the R1–R3 commit-gate family.

- AC-5.1: New gates alongside R1 无孤立者 / R2 能量编排 / R3 话题锚点:
  (i) group minimum-E floor; (ii) group mean-A floor; (iii) R2 upgraded from
  "≥1 energizer" to "exactly one high-X/P spark" (pool-level exemption preserved);
  (iv) X-variance cap extending harmonyScore variance logic (hard-reject beyond
  a locked cap).
- AC-5.2: Commit-gates (reject before commit) + ranking-time soft scoring
  mirroring R4; thresholds as named constants with citations in comments.
- AC-5.3: Monte Carlo proves ≥95% of committed groups satisfy all four rules;
  unmatched-rate delta ≤ +2pp vs gate-off baseline.
- AC-5.4: Duo atomic-unit invariants ([DUO] guards) and gender-floor interaction
  tests stay green.

### Item 6 — Latent-trait recovery harness
> As the team, I want a synthetic population with known ground-truth trait
> vectors run through the adaptive engine, measuring true-vs-estimated
> correlation at 8/12/16 questions.

- AC-6.1: N≥2,000 synthetic respondents, documented multivariate trait
  distribution (seeded, reproducible); answer model = trait-proportional option
  selection extending `scripts/simulate/lib/persona-utils.ts`.
- AC-6.2: Forced stop at exactly 8 / 12 / 16; per-trait Pearson r(true, estimated)
  + archetype top-1 agreement reported.
- AC-6.3: Empirical verdict on hardMax=16, confidenceGapThreshold, per-trait
  recovery → dated report under `docs/reports/`.
- AC-6.4: Runs <5 min in CI; permanent gate once thresholds locked.

### Item 7 — Adversarial persona suite
> As the team, I want pathological bots (straight-liners, acquiescence-biased,
> midpoint-huggers, self-image-inflated, random clickers) proving graceful
> degradation.

- AC-7.1: Five adversarial generators, seeded, ≥200 sessions each.
- AC-7.2: Zero matcher crashes / NaN trait scores (hard assert).
- AC-7.3: `traitConfidences`/`validityScore` DROP vs clean controls (provisional:
  random clicker mean validity < 0.6; acquiescence triggers the existing 0.7
  check ≥70% of runs; midpoint-hugger triggers low-differentiation check).
- AC-7.4: Flagged sessions shrink toward 50 (Item 3); never a high-confidence
  extreme archetype claim.

### Item 8 — Boundary stability sweep
> As the team, I want trait vectors perturbed ±5/±10 around each archetype
> centroid, measuring flip rate.

- AC-8.1: Per centroid: ≥500 perturbed samples per size; flip = matched to a
  different archetype (matcher isolation mode, extends `run-persona-suite.ts`).
- AC-8.2: Thresholds (lock after baseline): flip ≤5% at ±5, ≤20% at ±10.
- AC-8.3: Pairs exceeding threshold get written dispositions: redraw centroids
  (WITHOUT roster reorder — order-invariant test asserts `getAllArchetypeIds()`
  sequence unchanged) or add a confusion-pair gate to
  `CONFUSABLE_ARCHETYPE_PAIRS`/`PERSISTENT_CONFUSION_PAIRS`.
- AC-8.4: `simulate:personas:run:ci` 100% centroid exact-match stays green after
  any redraw.

### Item 9 — Monte Carlo group formation
> As the team, I want full synthetic pools through `poolMatchingService`,
> verifying composition shapes before any real pool exists.

- AC-9.1: Synthetic pool generator (size 12–60, configurable trait distributions,
  duo-bound pairs) against in-memory/test-DB pool; ≥500 runs.
- AC-9.2: Assertions: stability floor respected, exactly-one-spark distribution,
  no clone groups (max intra-group trait distance above locked minimum),
  unmatched-rate and unmatched-profile report.
- AC-9.3: Deterministic seeds; failures print the seed for replay.
- AC-9.4: Gate-on vs gate-off composition quality report (feeds AC-3.2 / AC-5.3).

### Item 10 — Mechanically derived chemistry matrix
> As the team, I want pair chemistry computed from trait-vector geometry
> (similarity on A/E/C + complementarity on X/P), so the hand-authored matrix
> becomes a validated narrative layer.

- AC-10.1: `deriveChemistry(protoA, protoB)` implementing the Montoya (2008)
  similarity + complementarity formula; same 0–100 scale as `compatibilityMatrix`.
- AC-10.2: Validation gate: Spearman ρ ≥ 0.7 derived vs hand-authored BEFORE any
  switch; discrepant pairs get written dispositions.
- AC-10.3: After validation, hand-authored layer re-scoped to narrative deltas
  only (`ARCHETYPE_COMPATIBILITY_DESCRIPTIONS` tone unchanged); derived scores
  become mechanical authority behind a flag.
- AC-10.4: Roster-order invariant test passes; share-card/slot-machine consumers
  see no type-shape change.

### Item 11 — E/P question-bank strengthening
> As the assessment, I want higher-discrimination E and P items in the bank, so
> the two weakest traits (baseline: E r=0.612, P r=0.665 clean @16q) reach the
> M1 bar without lengthening the test. Exposed by the P1a recovery baseline.

- AC-11.1: Add/replace ≥8 items (≥4 E-loaded, ≥4 P-loaded) using the same
  score format and -3..+3 range; copy passes WeChat-posture lint and
  `scripts/simulate/audit-question-bank-bias.ts`.
- AC-11.2: Harness re-run (Item 6): r(E) ≥ 0.70 and r(P) ≥ 0.70 clean @16q
  (M14); E mean samples @16q ≥ 9 (selector no longer starves E/P).
- AC-11.3: No trait regresses below baseline minus 0.03; M3b (top-2 agreement)
  does not drop.
- AC-11.4: `simulate:personas:run:ci` remains 12/12; session-length
  distribution unchanged (mean within ±0.5q of baseline).

### Item 12 — Confidence calibration
> As the matcher, I want engine confidence mapped to observed accuracy before
> any consumer (Item 3 shrinkage) trusts it — baseline confidence ≈0.91 vs
> ≈49% real top-1 agreement means the signal is inflated.

- AC-12.1: Calibration table/fit computed from recovery-harness data
  (binned confidence → observed top-1 agreement and per-trait |error|), stored
  as a versioned artifact or deterministic fitted curve in a new shared module
  (`packages/shared/src/personality/confidenceCalibration.ts` — new file,
  no edits to existing engine files).
- AC-12.2: Post-calibration, binned observed agreement is within ±0.10 of the
  calibrated confidence in every bin with n≥50 (M15).
- AC-12.3: Calibration is NOT wired into the engine in this item — Item 3
  (Tier 3) is the sole shipping consumer; harness can read the artifact.
- AC-12.4: Calibration artifact regenerates reproducibly from a fixed seed run;
  a dated calibration report lands in `docs/reports/`.

## (c) Success metrics (zero live data required)

> Amended after P1a baseline audit: M2 and M3 as originally drafted were
> noise-chasing / structurally unreachable (see execution log 2026-09-09 audit).

| # | Metric | Target (lock after P0) | Source |
|---|--------|------------------------|--------|
| M1 | Per-trait recovery r(true, est) at 16q (clean arm; moderate reported as context) | ≥ 0.70 (all six traits) | Item 6 |
| M2 | Recovery r at 12q / 8q (clean arm) | ≥ 0.60 / ≥ 0.50; monotonicity only flags degradations > 0.03 (≈2.5 SE at N=2000) | Item 6 |
| M3 | Archetype top-1 agreement at 16q (clean arm) | **Stratified:** ≥ 85% centroid-mixture respondents; diffuse (general-pop) respondents reported separately with a no-regression bar (item 11 must not lower it) | Item 6 |
| M3b | Top-2 agreement at 16q | ≥ 85% overall — **provisional pending top-2 baseline** (harness snapshots only top-1; extend snapshot, measure, then lock; if baseline <70% revisit the bar) | Item 6 |
| M4 | Ipsative uplift | r(X), r(P) improve ≥ +0.03 vs baseline | Item 6 A/B |
| M5 | Consistency-pair validity gap | mean confidence gap ≥ 0.10 (clean vs random) | Item 7 |
| M6 | Adversarial crash rate | 0 across ≥ 1,000 sessions | Item 7 |
| M7 | Meta-consistency flag precision | ≥80% recall inflated, ≤10% false-flag honest | Items 4+7 |
| M8 | Boundary flip rate | ≤5% @ ±5, ≤20% @ ±10 | Item 8 |
| M9 | Composition-rule satisfaction | ≥95% committed groups pass all gates | Item 9 |
| M10 | Unmatched-rate regression | ≤ +2pp vs gate-off | Item 9 |
| M11 | Shrinkage stabilization (REFORMULATED 2026-09-10 per plan-owner decision — the original "≥50% relative reduction" conflicted with Item 3's no-harm K and was mechanically capped at ~12%) | **Smoke alarm (CI):** 20% low-confidence injection moves group means ≤ 5 points absolute (baseline Δoff = 4.92 → passes). **Durable contract (calibration-anchored):** (a) per-session expected trait error after shrinkage ≤ population-prior error at every confidence level — shrinkage never makes a session worse than knowing nothing; (b) group-level stabilization ≥ 80% of the calibration-implied achievable ceiling (no-information baseline), not of an arbitrary constant. Both parts are computed from the Item 12 curve, so they auto-update when the curve/bank/population change and never require manual target re-derivation. | Items 9+12 |
| M12 | Chemistry matrix validity | Spearman ρ ≥ 0.7 derived vs hand-authored | Item 10 |
| M13 | Regression invariants | `run:ci` = 100%; roster order unchanged; length ≤ 16 + closing | existing + new tests |
| M14 | E/P bank uplift | r(E), r(P) @16q clean ≥ 0.70; E mean samples @16q ≥ 9 | Item 11 |
| M15 | Confidence calibration | Post-calibration reliability check: binned observed agreement within ±0.10 of calibrated confidence in all bins, per bin n ≥ 50 | Item 12 |

## (d) Harness tier classification

| Item | Files | Tier |
|------|-------|------|
| P0 baseline | none (run-only) | 1 |
| 1 Ipsative items | `personality/types.ts`, `questionsV4*.ts`, `adaptiveEngine.ts`, mini-program UI | **3** |
| 2 Consistency pairs | `adaptiveEngine.ts`, `types.ts`, question banks | **3** |
| 3 Trait shrinkage | `adaptiveEngine.ts` / `matcherV2.ts` | **3** |
| 4 Meta-consistency | `adaptiveEngine.ts`, question bank, `types.ts` | **3** |
| 5 Composition rules | `apps/server/src/poolMatchingService.ts` | **3** |
| 6 Recovery harness | `scripts/simulate/*` (new) | **2** (separate PR from engine retunes) |
| 7 Adversarial suite | `scripts/simulate/*` | **2** |
| 8 Boundary sweep | `scripts/simulate/*` | **2** (centroid redraw follow-up = 3) |
| 9 Monte Carlo groups | `scripts/simulate/*` + fixtures | **2** |
| 10 Chemistry derivation | `archetypeCompatibility.ts`, `prototypes.ts` | **3** |
| 11 E/P bank strengthening | `questionsV4*.ts` (item bank content + scores) | **3** (question bank is core engine input) |
| 12 Confidence calibration | new shared lib (e.g. `personality/confidenceCalibration.ts`) + harness wiring | **2** (new additive module, no existing-engine edits; shipping-consumption path is Item 3's Tier 3) |
| P3 CI wiring | `package.json`, CI workflow | **2** |

Tier 3 items route through Harness Runtime Controller (PGE → Council →
Consensus) with a locked Sprint Contract before file edits; Tier 2 require
Sprint Contracts per standard protocol.

## (e) Specialist assignment

| Item | Primary | Supporting |
|------|---------|-----------|
| P0 | qa-agent | verifier |
| 1 | backend-engineer | taro-engineer (UI), qa-agent (bank audit) |
| 2 | backend-engineer | qa-agent |
| 3 | backend-engineer | verifier (boundary placement) |
| 4 | backend-engineer | taro-engineer (rendering parity), qa-agent |
| 5 | backend-engineer | verifier (R-gate consistency, duo/gender floors), qa-agent |
| 6 | backend-engineer | qa-agent (threshold locking) |
| 7 | qa-agent | backend-engineer (generator plumbing) |
| 8 | qa-agent | backend-engineer (redraw if triggered — Tier 3 follow-up) |
| 9 | backend-engineer | qa-agent, verifier |
| 10 | backend-engineer | verifier (ρ-gate + dispositions) |
| 11 | backend-engineer | qa-agent (bank bias audit + M14 measurement) |
| 12 | backend-engineer | qa-agent (calibration table validation); verifier (calibration not shipped into engine — Item 3 is the consumer) |
| P3 | qa-agent | verifier |
| All Tier 3 | — | Harness Runtime Controller + Sprint Contract |

## (f) Locked thresholds (qa-agent, 2026-09-09)

| Metric | Locked value | Evidence / gate command | Gate status |
|---|---|---|---|
| M1 | All six traits r ≥ 0.70 @16q, clean arm | `npm run simulate:recovery` → clean-arm per-trait r@16q (baseline FAIL expected: E .612, P .665) | LOCKED |
| M2 | r ≥ 0.50 @8q ∧ ≥ 0.60 @12q clean; drops count only if > 0.03 | same run, checkpoints 8/12/16 | LOCKED |
| M3 | Centroid-mixture top-1 @16q ≥ 85% clean; general-pop no-regression (≥40.0% clean / ≥20.7% moderate) | report `top1AgreementBySource.centroid_mixture` @16q (baseline 53.0% clean) | LOCKED |
| M3b | Top-2 ≥ 85% overall | harness top-2 snapshot must be added first | PROVISIONAL |
| M4 | r(X), r(P) uplift ≥ +0.03 vs clean baseline | Item 1 A/B harness run | PROVISIONAL |
| M5 | Clean-vs-random confidence gap ≥ 0.10 | Items 2+7 adversarial runs (noise-robustness unproven — audit finding 4) | PROVISIONAL |
| M6 | 0 crashes / 0 NaN across ≥1,000 adversarial sessions | Item 7 hard assert | LOCKED (absolute invariant) |
| M7 | ≥80% recall inflated, ≤10% false-flag honest | Items 4+7 | PROVISIONAL |
| M8 | Flip ≤5% @±5, ≤20% @±10 | Item 8 sweep (own baseline) | PROVISIONAL |
| M9 | ≥95% committed groups pass all gates | Item 9 Monte Carlo | PROVISIONAL |
| M10 | Unmatched-rate delta ≤ +2pp vs gate-off | Item 9 | PROVISIONAL |
| M11 | ≥50% reduction in group-mean delta @20% low-conf injection | Items 3+9 | PROVISIONAL |
| M12 | Spearman ρ ≥ 0.7 derived vs hand-authored | Item 10 | PROVISIONAL |
| M13 | `run:ci` = 12/12; roster order unchanged; ≤16 adaptive + 2 closing | measured at P0 ✅; dedicated roster-order test does not exist — add in P3 | LOCKED (test gap noted) |
| M14 | r(E) ≥ 0.70 ∧ r(P) ≥ 0.70 clean @16q; E mean samples ≥ 9; every trait ≥ baseline − 0.03; natural mean length 12.6 ± 0.5q | `npm run simulate:recovery` re-run + parse (deterministic) | LOCKED |
| M15 | per-bin |observed agreement − calibrated confidence| ≤ 0.10, n ≥ 50/bin | Item 12 module's own verify fn on fixed-seed session export | LOCKED |

P3 wiring notes (qa-agent): gate scripts must parse report fields, NOT the
markdown verdict lines (`buildVerdicts` M2/M3 logic predates the amended
definitions); add a `--json` output flag to `run-recovery-harness.ts` over
markdown parsing. Item 12 must add a per-session export path for calibration
rows (harness currently emits aggregates only). `simulate:recovery` exits 0
unconditionally today — nothing gates until P3 adds parse+assert wrappers.

## Execution log

- 2026-09-09: Plan approved by user; P0 baseline lock completed.
  - `simulate:personas:run:ci` (centroid isolation): **12/12 = 100.0%** ✅ (locked invariant)
  - `simulate:personas:run:all` (boundary personas): matcher isolation 28/45 (62.2%), end-to-end 32/45 (71.1%) — boundary fuzziness expected at 40/60 splits; observed fragile pairs: owl↔fox (2 misses at 50/50 and 40/60), owl↔octopus, turtle↔cat, elephant↔koala. Feeds Item 8 boundary sweep priorities.
  - Mean session length ~14–15 adaptive questions; confidence range 0.44–1.00 at centroid (koala 0.44 lowest — candidate for confusion-pair gate review).
- 2026-09-09: **P1a (Item 6) DONE.** Sprint contract ACK'd by verifier (with minor amendments applied); backend-engineer delivered `scripts/simulate/run-recovery-harness.ts` + `npm run simulate:recovery` + `docs/reports/2026-09-09-latent-trait-recovery.md`. Byte-identical reproducibility verified; `run:ci` stays 12/12.
  - **Baseline recovery (clean, 16q):** A=0.828, C=0.720, E=0.612, O=0.742, X=0.867, P=0.665; top-1 agreement 47.7%.
  - **⚠️ Engine as-shipped FAILS provisional M1/M3 targets** (E and P below r≥0.70; agreement 47.7% vs 85%). E weakness is a question-bank discrimination problem, not sample starvation. Non-monotone recovery on A/C from 12→16q (adaptive picks can degrade estimates). hardMax=16 validated as well-set (only 6.5% of natural sessions hit cap).
  - These baselines are the numbers Phase 1 mechanics (Items 1–4) must move.
- 2026-09-09: **Post-P1a audit (orchestrator).** Harness methodology verified
  (seeded reproducibility, correct stats, forced-stop trick validated against
  engine confidence capping, engine source untouched). Findings that amend the
  plan: (1) clean answer model is deterministic argmax — clean-arm numbers are
  the model ceiling, moderate arm (E r=0.479 @ natural stop) is the realistic
  bar; (2) M3=85% overall is structurally unreachable — 40% diffuse respondents
  have unstable true labels by construction → M3 stratified + M3b added; (3)
  engine confidence is uncalibrated (≈0.91 vs ≈49% agreement) → **Item 12 added
  as prerequisite for Item 3 shrinkage**; (4) gap-threshold signal vanishes
  under noise (clean 30.9%/49.8% vs moderate 31.3%/29.3%) — no future features
  may depend on top1-top2 gap; (5) non-monotonicity: A drop =1.3 SE (noise), C
  drop =5 SE (real) → M2 relaxed to >0.03 degradations only; (6) E/P
  sample-starvation (7.9/7.2 vs X=11.0) → **Item 11 added** as highest-ROI fix.
- 2026-09-09: **Threshold lock (qa-agent).** 7 metrics locked (M1, M2, M3,
  M6, M13, M14, M15), 8 provisional; corrections applied (M3b provisional
  pending top-2 snapshot, M15 reliability-check wording + n≥50, clean-arm
  qualifiers on M1–M3). P3 must parse report fields, not verdict lines, and
  add `--json` output; M13 roster-order test does not exist yet. Risks:
  Item 11 must lift E +0.09 from bank content alone; moderate arm (realistic
  bar, E=0.537) is gated nowhere — clean-arm pass may overstate reality.
- 2026-09-09: **P1b (Item 11) DONE — M14 PASS.** Contract ACK'd by verifier
  (2 doc amendments logged: AC-11.3 measures top-1 centroid-mixture floor
  instead of unmeasurable M3b; legacy bank range is −4..+6, new items held to
  −3..+3). backend-engineer delivered 18 new items (Q136–Q153: 8 pure-E, 6
  pure-P precision items incl. **Q150 filling the vacant 9th anchor slot**, 3
  E/A bridges) + micro-fixes converting zero-E options on guaranteed items into
  signal (e.g. Q127-D E+2→−1, 厌烦 = reactive). Results (clean @16q): **E
  0.612→0.763, P 0.665→0.730, E samples 7.9→9.6**; all other traits within
  baseline−0.03; centroid-mixture top-1 53.0%→54.3%; moderate arm E
  0.537→0.701. Key structural findings: (a) anchor E loadings were one-sided —
  no face-valid way to express LOW E; (b) no low-E archetype exists (centroids
  55–88) so r(E) is intrinsically harder; (c) confidence saturates at ~4
  consistent samples so utility picks cap ~0.8/session — pure-utility items
  could never fix starvation; anchor placement was the lever. Thin margins to
  watch: r(C) +0.016, r(A) +0.011 above floors.
- 2026-09-09: **P1c (Item 12) DONE — M15 PASS.** Contract ACK'd by verifier (3
  amendments logged; fit-input scope deviation: pooled clean+moderate natural
  arm, n=4000, deliberate — realistic production prior). Deliverables:
  `packages/shared/src/personality/confidenceCalibration.ts` (PAVA isotonic,
  verify fn), versioned artifact `v1-20260909`, `npm run simulate:calibration`
  (+`--check`), opt-in `--export-sessions` harness flag (default output
  byte-unchanged), 10 invariant tests (shared 369/369). M15: 4 bins, all
  |observed − calibrated| ≤ 0.025. **Headline: raw confidence 0.90 → calibrated
  P(correct) ≈ 0.34; ECE 0.605→0.457.** Structural caveat for Item 3: raw
  confidence is blind to answer noise — calibrated confidence is a
  noise-averaged probability (conservative for noisy answerers, mildly lax for
  clean ones). NOT wired into runtime; Item 3 is the sole consumer.
- 2026-09-09: **P1d (Item 1) DONE — M4 FAIL (structural), infrastructure ships
  dark.** Verifier ACK cycle 1 (3 blocking amendments, all verified satisfied:
  `isForcedChoice` reuse, byte-identical flag-off via deterministic diff,
  committed flag-on engine tests). 12 ipsative items Q154–Q165 (X↔A, P↔C, O↔C;
  zero-sum scoring as data — pole +3/rival −1, no processAnswer branch), SDI
  audit `simulate:audit-ipsative` (0 violations), flag default OFF, mini-program
  maps to existing choice surface (no new CSS). **M4 result: X −0.010, P −0.007
  vs +0.03 target.** Root cause is instrumental, not mechanical: the clean-arm
  answer model is deterministic argmax over true traits and contains no
  self-presentation bias — the distortion ipsative pairing exists to remove —
  so the harness cannot see the benefit; flat binary samples merely displaced
  magnitude-graded ones. No trait regressed >0.03; no-op enable NOT shipped per
  contract. Follow-up item created: **desirability-biased harness arm** (option
  selection tilted by SDI) to make M4 measurable — harness-only change. Items
  2/4 unaffected. Evidence: `docs/reports/2026-09-09-ipsative-items-ab.md`.
- 2026-09-09: **M4 desirability-bias arm built — M4 FAILS even under verified
  bias; ipsative mechanic declared a true no-op → MOTHBALLED.** The bias arm
  (`--noise=desirability`, β=2, declared-SDI precedence for ipsative options,
  Edwards-style proxy for the rest) verifiably models bias: flag-off mean r@16q
  0.773→0.658, agreement 47.9%→20.2%, monotone across β=0→12. But ipsative
  flag-on recovers none of it: ΔP ≤ +0.003 at every β; ΔX ≥ +0.03 only at β=12
  where the instrument is annihilated (mean r=0.398, implausible respondents).
  Conclusion: with zero-sum scoring, ipsative items cannot add information the
  graded bank doesn't already carry better. `enableIpsativeItems` stays dark
  permanently pending a fundamentally different scoring design; no further
  iteration justified. **Sequencing lesson recorded: measurement instruments
  (adversarial personas, Item 7) must precede the mechanics they measure
  (Items 2/4)** — P2a Item 7 is promoted ahead of P1e/P1f. Evidence:
  `docs/reports/2026-09-09-m4-desirability-bias-arm.md`.

- 2026-09-09: **P2a (Item 7) DONE — suite green; engine blind spots quantified.**
  Verifier ACK (3 amendments satisfied; predicted the random-clicker <0.6
  threshold was unattainable — re-locked upward as predicted). 1,440 sessions,
  0 crashes/NaN (M6 ✅). **Critical finding: the raw engine FAILS graceful
  degradation** — straight-liner/acquiescence/midpoint-hugger each earn
  high-confidence extreme assignments in 100% of sessions (straight-liner
  top-1 confidence 1.000 > clean 0.862); random-clicker HC-extreme 32%.
  Midpoint-hugger has NO detector (validity 1.000; low-differentiation never
  fires — neutral options carry systematically-signed loadings that accumulate
  to stdev ≥ 8). Two AC-7.3 provisional thresholds failed against the raw
  engine and now stand as the Items 2/4 targets: random-clicker validity must
  drop below 0.6 and midpoint-hugger must trip a neutral-responding detector —
  neither is possible today. Item 3 shrinkage now has quantified targets
  (100%/32% HC-extreme rates must → ~0). Evidence:
  `docs/reports/2026-09-09-adversarial-persona-suite.md`.
- 2026-09-09: **P1d (Item 1) DELIVERED DARK — M4 FAIL (documented).** Contract
  executed by backend-engineer. 12 ipsative items (Q154–Q165: X↔A, P↔C, O↔C
  ×4 each; equal-SDI pairs, ΔSDI ≤ 4; zero-sum +3/−1 rival debit baked into
  option traitScores — no engine scoring branch), selector gate
  `enableIpsativeItems` (default OFF in both configs), SDI audit script
  (`simulate:audit-ipsative`, 0 violations), `--ipsative=on` harness opt-in,
  mini-program renders ipsative through the existing choice surface, 14
  invariant tests. **Flag-off byte-identical** (diff-clean vs the Item-11
  recovery report). A/B (clean @16q): X 0.865→0.855, P 0.730→0.723 — M4
  (+0.03 each) FAILS; no trait regresses >0.03 in either arm, so the
  no-regression clause holds with flag on. Four-iteration dose-response shows
  the cause is structural: the clean-arm answer model has no
  self-presentation bias for equal-SDI pairing to remove, so binary samples
  only displace magnitude-graded ones (rivals A/C improve; poles X/P degrade
  monotonically with serving rate/amplitude). Recommendation: keep flag dark;
  re-scope M4 to a desirability-biased harness arm before any enable
  decision. Full evidence: `docs/reports/2026-09-09-ipsative-items-ab.md`.
  Items 2/4 are unaffected (no dependency on M4 passing).
- 2026-09-09: **P1e (Item 2) DONE — all AC-2.4 targets PASS (amended contract,
  2 design iterations).** Contract executed against the verifier-amended
  version (AC-2.2b composition step, explicit signal-routing matrix, pair
  completion geometry). Deliverables: `personality/consistencyPairs.ts`
  (net-new registry — `ValidityCheckPair` left dead as documented),
  flag-gated wiring in `adaptiveEngine.ts` (`enableConsistencyFolding`,
  default OFF), 10 invariant tests (shared 393/393), `--consistency=on`
  plumbing in both harnesses mirroring the `--ipsative=on` precedent, dated
  flag-on evidence reports. **Pairs:** CP1 Q150↔Q147 (E 急性应激), CP2
  Q53_PureC↔Q166 (C 承诺推进), CP3 Q52_PureO↔Q167 (O 好奇驱动) — Q166/Q167
  authored (no existing C/O near-paraphrase candidates), excluded from all
  flag-off selector paths. **Key design decisions (v2 after first iteration
  failed the no-regression bar):** (a) CP1's first is the ANCHOR Q150 — zero
  slot cost; (b) CP2/CP3 firsts are the pure-C/pure-O CALIBRATION items
  injected at positions 10–11, superseding the calibration phase 1:1, so the
  displaced C/O signal is restored by the firsts themselves (v1's E/P/EA
  firsts regressed C/O by up to −0.097 natural — over the 0.03 bar); (c)
  seconds serve ONLY in the closing phase (spacing ≥4 by construction;
  completion 100% under natural termination; adaptive utility pool never
  displaced); (d) termination reads raw matcher output (`lastRawMatches`) so
  the AC-2.2b composition step never inflates session length (v1 hit 13.7q
  mean / 25% hardMax — out of the 12.6±0.5 band); (e) the +0.15 agreement
  boost is void when a legacy response-set check fires (mechanically
  consistent straight-liners must not earn a consistency reward — keeps the
  locked AC-7.3d directional invariant green flag-on). **AC-2.4 (flag on,
  N=240/arm, seed 20260909):** random-clicker mean validity 0.947→**0.5517**
  (<0.6 ✅); midpoint-hugger HC-extreme 100%→**0.0%** (<50% ✅);
  straight-liner/acquiescence HC-extreme 100%→**0.0%/0.0%** (≤60% ✅); clean
  validity 0.9488 (≥0.9 ✅); M5 clean-vs-random traitConfidence gap
  0.0306→**0.1063** (≥0.10 ✅); pair completion 100%. **AC-2.3/AC-2.5:**
  flag-off byte-identical (adversarial JSON + both reports diff-clean);
  flag-on recovery: zero per-trait regressions >0.03 in either arm (C/O
  improved +0.04–0.10), natural mean length 12.5/12.4q (in band), natural
  top-1 agreement UP (clean 44.5%→49.4%). `run:ci` 12/12; guardrails pass.
  Evidence: `docs/reports/2026-09-09-adversarial-persona-suite-consistency-on.md`,
  `docs/reports/2026-09-09-latent-trait-recovery-consistency-on.md`,
  `scripts/simulate/data/adversarial-results-consistency-on.json`.
  Flag stays dark; Item 3 shrinkage is the shipping consumer of these signals.
- 2026-09-09: **P1f (Item 4) DONE — M7 FAIL (structural ceiling, definitive
  after 2 measurement cycles); ships dark as precision-safe signal.** Verifier
  cycle-1 REJECT predicted M7 unreachable by construction (uniform inflation →
  MAE-scale discrepancy); engineer's cycle-1 implementation confirmed it
  empirically (recall 7.5%); cycle-2 with the psychometrically realistic
  DIFFERENTIAL-inflation persona (+15 scenario / +30 self-view) made it
  definitive: recall 2.5%, below the clean false-flag rate (4.6%), because the
  engine estimate absorbs scenario inflation (est ≈ true+20 on A) before any
  meta comparison — **self-image inflation is undetectable from internal
  evidence; requires external/behavioral data.** Delivered anyway (dark):
  Q168 zero-loading A self-view slider (no contamination by construction),
  ×0.8 session-confidence multiplier composed `raw × validity × meta`, a real
  bug fix (zero-loading answers diluted the validity denominator — locked
  AC-7.3b broke flag-on), 4-state flag matrix, precision hard-asserted
  (4.6% ≤10%). Still catches straight-liner (100% flag) and random-clicker
  (42.9%). **Item 3 scoping constraint recorded: do not count on
  self-inflation detection from internal signals.**
- 2026-09-10: **P1g (Item 3) DONE — mechanics land safely; promise honestly
  narrowed.** Verifier cycle-1 REJECT predicted the structural collision:
  folded confidence of midpoint-hugger (0.953) EXCEEDS clean (0.942), so no
  monotone w=f(confidence) can shrink consistent-biased arms without shrinking
  honest users. Engineer's implementation confirmed it empirically and resolved
  per verifier option (a): w-curve is excess-over-floor (`ERR_FLOOR`=8.49
  derived from the Item 12 artifact — even conf=1.0 carries ~8.5pts of
  irreducible quantization error), K=75 chosen by centroid probing (worst-case
  shrink 1.557pts, <2 bound with 22% margin). Bite lands where calibration says
  error lives: random-clicker extreme-session 60.4%→54.2% (with consistency
  composed 52.5%→43.8%); consistent-biased arms stay ~100% extreme via
  shrinkage alone — handled by Item 2's match-confidence composition instead
  (their HC-extreme already 0% flag-on). Clean-arm r deltas ≤0.003; natural
  arm slightly IMPROVES (mean-pull denoises). Composition order locked: Item 2
  fold → shrink → match → ×validity → ×meta (8-state matrix, 21/21). run:ci
  12/12; shared 414/414. Landmine documented: spider centroid is an exact
  matcher tie (15=15 vs dolphin_calm) on confidence tie-break — tie-detection
  carve-out locked in tests. M11 remains gated on Item 9.
- 2026-09-10: **P2c (Item 9) DONE — group-level instrument live; baseline
  measured; M11 FAIL exposes target conflict.** `runGreedyPoolMatchingCore`
  driven directly (no DB, no mocks, real chemistry matrix) from
  `scripts/simulate/run-group-monte-carlo.ts`; engine flags reach matching via
  the documented pre-compute path (flags never reach poolMatchingService —
  matcher reads stored archetype labels). Gate-off baseline (500 pools/2,967
  groups): min-E <25 = 0.8% ✅, mean-A <45 = 2.0% ✅, **sparks/group 0/1/2+ =
  6.1%/14.6%/79.3%** (exactly-one-spark is today's biggest literature-prior
  violator — Item 5's primary target), X-variance >400 = 45.9%, clones 0.0%,
  unmatched 11.1% (skew −6.5 A/−2.1 P). **M11: 3.3% vs ≥50% — mechanical
  ceiling: K=75 clamps w ≥ 0.879 (max ~12.1% stabilization).** The 50%
  relative target conflicts with the no-harm K; and Δoff=4.92 points is itself
  modest — M11 likely needs re-derivation as an absolute-delta cap (OPEN
  DECISION for plan owners). Evidence:
  `docs/reports/2026-09-10-monte-carlo-group-formation.md`. Housekeeping:
  committed adversarial-results-latest.json is stale (Item 4 arm) — regenerate
  in P3.
- 2026-09-10: **P1h (Item 5) DONE — M9/M10 LOCKED + PASS.** Verifier cycle-1
  REJECT caught the decisive structural gap: the matcher carried NO trait
  vectors (archetype labels only) — trait gates were infeasible until AC-5.1b
  added the input path (optional `traitScores` on `UserWithProfile` +
  `preloadLatestTraitVectors` batch preload behind feature flag
  `compositionGatesEnabled`, dark). Four gates live: min-E floor 25, mean-A
  floor 45, spark X≥70∨P≥70 (admission-time steering + commit backstop,
  bidirectional exemption), X-var cap 750 (knee of the M10 frontier).
  **M9: 100.0% of 2,908 committed groups pass all gates; M10: +1.51pp
  (11.1%→12.6%); second seed confirms (100%/+1.03pp).** Honest note: with
  79.3% of baseline groups spark-surplus, exactly-one is arithmetically
  impossible pool-wide — steering still lifted exactly-one share 14.6%→18.6%
  and eliminated sparkless groups (6.1%→0.0%). Non-monotonic re-evaluation
  verified in `magnetismRulesSatisfiedFor`; duo invariants green (81 matching
  tests + 25 new gate tests). Flag dark; enablement is a separate decision.
  Evidence: `docs/reports/2026-09-10-monte-carlo-group-formation-gates-on.md`.
- 2026-09-10: **DECISION (plan owner) — M11 reformulated, calibration-anchored.**
  The original "≥50% relative reduction" target is retired: it conflicted with
  Item 3's no-harm K (Item 9 measured the mechanical cap at ~12%) and, worse,
  was a magic number requiring re-derivation whenever the population mix, bank,
  or curve changed. Replacement: (1) CI smoke alarm = absolute group-mean
  movement ≤5 points at 20% injection (already passes at 4.92); (2) durable
  contract = the per-session bounded-error invariant (expected error after
  shrinkage ≤ population-prior error at every confidence level — the property
  Bayesian shrinkage exists to guarantee) plus group stabilization normalized
  to the calibration-implied ceiling. Rationale: anchor to the calibration, not
  to the number — the only formulation that survives refitting the curve (e.g.
  after live-data collection or a 7th trait) without manual re-tuning. Rejected
  alternatives: steepening the shrinkage tail (trades honest-user accuracy,
  unbounded maintenance) and dropping M11 (loses the only group-level
  guardrail). M11 implementation/proof moves to P3's gate wiring (needs a
  ceiling-computation helper over the Item 12 curve).
- 2026-09-10: **P2b (Item 8) DONE — boundary baseline locked; M8 gate is RED
  (3/24 cells).** 600 seeds/centroid/radius through real MatcherV2 isolation.
  Breaches: hamster_praise ±5 = 10.2% (→rooster), dolphin_calm ±5 = 6.0% and
  ±10 = 28.5% (→rooster/spider/corgi). All other 21 cells within tolerance.
  **Methodological finding: the P0 fragile pairs (owl↔fox, owl↔octopus,
  turtle↔cat) do NOT reproduce under local perturbation — P0 interpolated
  50/50 BETWEEN centroids (owl X=40 vs fox X=78 → midpoint 59, 19pts from
  either), a different regime from ±5/±10.** Flip rate is non-monotone in
  radius due to hard signature/veto/confusion gates (geometry, not regression).
  Dispositions (Tier 3 follow-up): hamster_praise→rooster centroid redraw;
  dolphin_calm→rooster/spider existing persistent-pair gates; dolphin_calm→corgi
  new. Verifier amendments A1 (secondary Normal arm), A2 (hard/confusable flip
  split), A3 (roster-order test) carried to P3. M8 gate flips to GREEN only
  after the disposition work. Evidence:
  `docs/reports/2026-09-10-boundary-stability-sweep.md`.
- 2026-09-10: **P2d (Item 10) DONE — M12 FAIL (ρ=0.57 vs ≥0.70); derived
  chemistry ships dark.** Verifier ACK's A1 caught a false premise the plan
  carried: the "canonical/runtime two-copy" hazard doesn't exist (runtime
  re-exports canonical; the existing sync test was tautological). Formula:
  `0.5·similarity(A/E/C) + 0.5·complementarity(X/P)`, affinity-calibrated.
  **Weight sensitivity proves the ≥0.70 gate is unreachable within the
  contract-faithful family (ceiling ≈0.69; pure A/E/C similarity ρ = −0.08) —
  the curated matrix encodes X/P complementarity but NO A/E/C similarity
  signal.** Engineer correctly did not tune to fit; 2 pairs dispositioned
  accept-derived (fox×cat, octopus×cat — curated self-inconsistency), 7
  authored-justified. **AC-10.5 impact is material: 88.4% pairwise
  co-membership agreement / 93.4% of pools re-partition despite near-identical
  group-average chemistry** — enablement must never ride on average-metric
  similarity. Roster-order + re-export tests green; flag-off byte-identical;
  shared 425 / server 3252 pass. Evidence:
  `docs/reports/2026-09-10-derived-chemistry-validation.md`.
- 2026-09-10: **P3 DONE — assessment CI gate live. PROGRAM COMPLETE (all 12
  plan items + M4 follow-up + P3 executed).** `npm run gate:assessment` →
  **PASS 9 / KNOWN-FAIL 3 / REGRESSION 0**; wired into
  `.github/workflows/quality-gates.yml` as the `assessment-gate` job. KNOWN-FAIL:
  M3 (centroid top-1 54.3% vs 85% — structurally unreachable at σ=10; likely
  needs re-derivation like M11), M8 (3/24 boundary cells), M12 (ρ=0.57; ceiling
  0.69). REGRESSION = exit 1 (demonstrated). New: `--json` recovery output,
  `assessment-gate-baseline.json`, M11 durable-contract helper (bounded-error
  0.887≤1, ceiling-normalized 83.4%≥80%, smoke alarm 4.75≤5, 5/10/20/40% sweep),
  Item 8 secondary Normal arm + flip split, stale-artifact regen, real
  re-export identity test. **All engine/feature flags remain DARK; no
  production enablement.**

### Program outcome summary (for plan owners)

| Item | Verdict | Flag state |
|------|---------|-----------|
| 11 E/P bank strengthening | M14 PASS (E 0.612→0.763, P 0.665→0.730) | live (bank content) |
| 12 confidence calibration | M15 PASS (raw 0.90 → true P 0.34) | dark |
| 6 recovery harness | delivered; gate-wired | N/A |
| 7 adversarial suite | delivered; quantified blind spots | N/A |
| 2 consistency pairs + neutral detector | ACs PASS (HC-extreme 100%→0%) | dark |
| 4 meta-consistency | M7 structural celling (self-inflation undetectable internally) | dark |
| 3 trait shrinkage | safe; honestly narrowed | dark |
| 9 Monte Carlo groups | baseline + M11 conflict surfaced | N/A |
| 5 composition gates | M9/M10 PASS (100% / +1.51pp) | dark |
| 8 boundary sweep | baseline locked; M8 RED 3/24 | N/A |
| 10 derived chemistry | M12 FAIL (finding: curated matrix lacks A/E/C similarity) | dark |
| 1 ipsative | M4 FAIL ×2 (true no-op) | dark, mothballed |
| P3 CI gate | PASS 9 / KNOWN-FAIL 3 / REGRESSION 0 | N/A |

**Open decisions for plan owners:** (1) M3 re-derivation (85% vs reachable
bar/top-2); (2) M8 Tier 3 dispositions (hamster_praise centroid, dolphin_calm
gates); (3) Item 13 confidence-floor + adaptive-extension (root-cause fix);
(4) dark-flag enablement sequence (composition gates + consistency + shrinkage
+ calibration are the near-term enabling candidates); (5) the whole program is
uncommitted in the working tree — stage/commit decision.
- 2026-09-10: **PROPOSED FUTURE ITEM (root-cause fix, plan owner to schedule) —
  confidence floor + adaptive extension at registration (Item 13).** The M11
  reformulation fixes the *metric* but not the *root cause*: shrinkage-to-mean
  still injects a wrong-but-neutral profile into composition. The scalable
  long-term design is to stop under-measured sessions entering matching at full
  weight: (a) at pool-registration, if calibrated confidence < floor, serve a
  short adaptive extension (the engine already has tiered-extension machinery —
  see `enableTieredThreshold`, currently disabled); (b) those who clear the
  floor enter with full weight; (c) those who decline fall back to shrinkage —
  which then handles only a small tail, making M11 non-load-bearing and ending
  the K-retuning treadmill. Compounds with engagement (better data over time)
  rather than hiding uncertainty. Not scheduled; belongs after remote-panel
  validation confirms real confidence distributions. Also refining M11's smoke
  alarm to an injection-rate SWEEP (5/10/20/40%) asserting the bounded envelope
  at each rate, rather than a single 20% point.
