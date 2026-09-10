# Ipsative Items A/B — Plan Item 1 (P1d) — 2026-09-09

> Contract: `.git/.orchestration/sprints/sprint-contract.item1-ipsative-items.md`.
> Harness: `npm run simulate:recovery` (flag off) vs `--ipsative=on` (flag on).
> Both runs: N=2000, seed=20260909, fully deterministic, identical population.

## Verdict: M4 FAIL — flag stays DARK

**M4 target:** r(X) and r(P) each improve ≥ +0.03 vs the post-Item-11
flag-off baseline, no trait regressing > 0.03. Result: **X −0.010, P −0.007
(clean @16q)** — M4 fails. Per the contract, the mechanic ships dark behind
`enableIpsativeItems` (default OFF); the no-op/enable decision is deferred,
not fudged. Flag-off behavior is byte-identical to the pre-Item-1 engine
(proof below).

## What shipped (all dark)

- `packages/shared/src/personality/types.ts` — `QuestionOption.socialDesirabilityIndex`
  (0–100, audit-only, never read at runtime), `questionType: 'ipsative'` union
  member, `AssessmentConfig.enableIpsativeItems` (default `false` in both
  DEFAULT and V2 configs).
- `packages/shared/src/personality/questionsV4Ipsative.ts` — 12 items
  Q154–Q165, aggregated in `questionsV4.ts`.
- `adaptiveEngine.ts` — selector gate: ipsative items are filtered out of the
  utility pool unless `config.enableIpsativeItems === true` (both
  `selectNextQuestion` and the skip path `selectAlternativeQuestion`).
  **No scoring branch**: the zero-sum rival debit is baked into option
  `traitScores` as data.
- `scripts/simulate/audit-ipsative-sdi.ts` (+ `npm run simulate:audit-ipsative`) —
  enforces the SDI pairing invariant (|ΔSDI| ≤ 10), zero-sum geometry, −3..+3
  range, ≥12 items, ≥2 per rivalry, WeChat copy posture. Exit 1 on violation.
- `run-recovery-harness.ts` — opt-in `--ipsative=on` flag (default off; flag-off
  report byte-identical with or without the argument).
- Mini-program: `questionType: 'ipsative'` maps to the existing choice surface
  (`getQuestionType` in `PersonalityTestQuestion.tsx`); two options render in
  the standard card list. No layout/CSS change, no test-length change.
- 14 invariant tests in `packages/shared/src/personality/__tests__/ipsativeItems.test.ts`.

## Design decisions

**Item shape.** 12 items, 3 rivalries × 4: X↔A (Q154–Q157, energizer
initiative vs caretaking attunement), P↔C (Q158–Q161, optimistic reframing vs
steady discipline), O↔C (Q162–Q165, novelty vs structure). All L3,
discriminationIndex 0.92, no cohortTag, `isForcedChoice: true`.

**Scoring rule (zero-sum rival debit, data not code).** Pole option credits
its trait **+3** and debits the rival **−1**; rival option mirrors
(**pole +1 / rival −3**). Pair sums to exactly 0 on every trait (random
answerer drifts by 0; bank geometry preserved). The two options deliberately
differ in diagnostic strength (unequal-information forced choice). One answer
= one sample on EACH rivalry trait.

**SDI assignment.** Author-assigned face-validity estimates on a shared
66–78 band; both options written as equally respectable self-descriptions;
within-pair gap kept at Δ=0–4 (invariant ≤ 10 enforced by audit). These are
priors, not measurements — recalibrate against live desirability ratings
post-launch.

## A/B results (clean arm, forced stop @16q, N=2000)

| Trait | flag OFF (baseline) | flag ON | Δ | within ±0.03? |
|---|---|---|---|---|
| A | 0.809 | 0.825 | +0.016 | ✅ |
| C | 0.706 | 0.714 | +0.008 | ✅ |
| E | 0.763 | 0.750 | −0.013 | ✅ |
| O | 0.767 | 0.772 | +0.005 | ✅ |
| **X** | **0.865** | **0.855** | **−0.010** | ✅ (but M4 needs +0.03) |
| **P** | **0.730** | **0.723** | **−0.007** | ✅ (but M4 needs +0.03) |

Serving: 56.1% of forced-16 sessions answered ≥1 ipsative item (mean 1.02);
natural arm 9.7% (mean 0.11). Top-1 agreement @16q: 47.9% → 47.4% (−0.5pp).
Natural mean length unchanged (12.4q → 12.4q clean). Session-length
distribution, hardMax hit rate, and termination logic untouched.

Moderate arm @16q (context, not gated): A 0.699 (−0.009), C 0.633 (−0.001),
E 0.684 (−0.017), O 0.656 (+0.009), X 0.814 (−0.009), P 0.664 (−0.023) — all
within the 0.03 regression band; P is the closest to the floor (−0.023),
consistent with binary items being more noise-sensitive (a suboptimal pick on
a 2-option item is always the wrong pole).

## Iteration log (why M4 is structurally hard in this instrument)

Four honest iterations, clean arm @16q flag-on Δ vs baseline:

| # | Design | Serving | ΔX | ΔP | ΔC | ΔA |
|---|---|---|---|---|---|---|
| 1 | ±2 symmetric, dI 0.88, mixed L2/L3 | 44% / 0.72 per session | −0.007 | −0.009 | +0.018 | +0.008 |
| 2 | ±3 symmetric, dI 0.92, all L3 | 56% / 1.03 | −0.021 | −0.019 | +0.016 | −0.018 |
| 3 | +3/−1 asymmetric (shipped) | 56% / 1.02 | −0.010 | −0.007 | +0.008 | +0.016 |
| 4 | ±2 symmetric, dI 0.95 (max serving) | 60% / 1.19 | −0.016 | −0.020 | +0.023 | +0.004 |

Dose-response is unambiguous: **more ipsative serving → X/P worse; higher
amplitude → worse; the rival (debit-receiving) traits consistently improve.**

Root cause: the harness's clean-arm answer model is a deterministic argmax
over true traits — it contains **no self-presentation bias**, which is the
exact distortion equal-SDI pairing exists to remove. What ipsative items add
in this instrument is within-person trait-ordering signal at flat amplitude;
what they displace (fixed 16q budget: 9 anchors + ~2 calibration + ~5 utility
picks) is magnitude-graded samples ({+3,+1,−1,−3} items carry degree
information). For already-well-measured X (r=0.865), flat ±k samples compress
inter-respondent variance → r drops monotonically with dose. For
under-measured rivals (C r=0.706, A samples 6.0), the extra samples are net
positive. The mechanic's benefit is invisible to the measuring instrument;
its cost is not.

## Recommendations (for the roadmap, not this item)

1. **Keep the flag dark.** Infrastructure is safe to ship (flag-off
   byte-identical; flag-on stays within all no-regression bands).
2. **Re-scope M4 measurement**: evaluate ipsative items in a harness arm with
   a *desirability-biased* answer model (e.g., option-selection probability
   tilted by declared SDI) — the bias the mechanic removes must exist in the
   instrument for its removal to be measurable. This is a follow-up harness
   item, not an engine change.
3. **Do not iterate further on loadings/amplitude under the current harness** —
   the dose-response table shows that direction only trades X/P for A/C.
4. Item 2 (consistency pairs) and Item 4 (meta-consistency) are unaffected;
   they do not depend on ipsative M4 passing.

## Verification evidence

- **AC-1.5 flag-off byte-identical**: `npm run simulate:recovery` flag-off
  report is byte-identical (`diff` clean) to the post-Item-11
  `docs/reports/2026-09-09-latent-trait-recovery.md`; clean @16q:
  A=0.809, C=0.706, E=0.763, O=0.767, X=0.865, P=0.730 (exact baseline match).
- **AC-1.1/AC-1.3 SDI audit**: `npm run simulate:audit-ipsative` → 0
  violations (12 items; ΔSDI 0–4 per pair; rivalries A↔X/C↔O/C↔P 4 each).
- **Bias audit**: `npx tsx scripts/simulate/audit-question-bank-bias.ts` →
  174 questions audited; no ipsative item in the top-18 inflation list;
  zero-sum items add no net trait bias.
- **Persona suite**: `npm run simulate:personas:run:ci` → 12/12 (100.0%),
  flag off. (The CI suite is matcher-isolation-only and does not exercise the
  engine; engine-level flag on/off coverage lives in
  `__tests__/ipsativeItems.test.ts` — flag-off forced-16 sessions serve zero
  ipsative items, flag-on sessions serve ≥1 across the 12 centroids.)
- **Tests/typecheck**: shared 383/383 (incl. 14 new ipsative tests);
  mini-program 2254 passed/1 skipped; mini-program typecheck clean;
  shared typecheck clean.
- **Guardrails**: `npm run guardrails` → 0 errors (5 pre-existing warnings in
  untouched results-page files).
