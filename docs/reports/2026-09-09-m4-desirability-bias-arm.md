# M4 Under a Desirability-Biased Answer Arm — 2026-09-09

> Contract: `.git/.orchestration/sprints/sprint-contract.m4-desirability-bias-arm.md` (locked).
> Harness: `npm run simulate:recovery` arms; biased arm via `--noise=desirability`, M4 A/B via `± --ipsative=on`.
> All runs: N=2000, seed=20260909, fully deterministic, identical population.
> Prior evidence: `docs/reports/2026-09-09-ipsative-items-ab.md` (M4 FAIL was instrumental — the clean/moderate answer models contain no self-presentation bias).

## Verdict: M4 FAIL — under a demonstrably biased arm. Mechanic is a true no-op; recommend mothball

**M4 target (contract AC-B3):** r(X) and r(P) each improve ≥ +0.03 flag-on vs
flag-off under the biased arm, no trait regressing > 0.03. Result at the locked
β=2 (biased arm @16q): **ΔX = −0.010, ΔP = −0.018** — M4 fails. A β sweep
from 0 to 12 shows the failure is not a tuning artifact: ΔP never exceeds
+0.003 at any β, and ΔX only crosses +0.03 at β=12, where the flag-off
instrument is annihilated (mean r@16q = 0.398; A=0.228, P=0.254 — no longer a
plausible respondent model). The Item-1 hypothesis is confirmed and closed:
the M4 failure was instrumental, but fixing the instrument does not rescue the
mechanic. Equal-SDI ipsative pairing does not produce measurable r(X)/r(P)
uplift in this engine even when the exact bias it exists to remove is present
and strong. **Recommendation: keep `enableIpsativeItems` dark and mothball the
mechanic; do not invest in further loading/amplitude/SDI iteration.**

## What shipped (scripts-only, opt-in, zero engine changes)

- `scripts/simulate/lib/persona-utils.ts`
  - `NoiseMode` gains `'desirability'` (deterministic argmax, no jitter — the
    distortion is systematic, not random).
  - `DESIRABILITY_BIAS_BETA = 2` (locked, tuned below) and
    `getDesirabilityBiasBeta()` (`SIM_DESIRABILITY_BETA=<n>` env override for
    documented tuning sweeps only).
  - `desirabilityProxy(option)` — see model definition below.
- `scripts/simulate/run-recovery-harness.ts`
  - `--noise=desirability` accepted (explicit opt-in only; deliberately NOT
    added to `--noise=all`).
  - Report gains one conditional line documenting the arm + active β, printed
    only when the arm runs.
- No changes under `packages/shared/**`. No new dependencies. No new npm script
  (the existing `simulate:recovery` entry suffices: `npm run simulate:recovery
  -- --noise=desirability [--ipsative=on]`).

## Bias model (AC-B1)

```
score(option) = trueTraitAlignment(option) + β · desirabilityProxy(option)
```

`trueTraitAlignment` is the existing `scoreOptionForTraits` (Σ_t traitScores[t]
· (true_t − 50)/50). Selection is deterministic argmax over the mixed score.

`desirabilityProxy(option)`:

| Option kind | Proxy | Justification |
|---|---|---|
| Ipsative (declared `socialDesirabilityIndex`) | `(SDI − 72) / 10` | The authored SDI is the best available desirability estimate. Within-pair \|ΔSDI\| ≤ 4 (audit-enforced; actual 0–4, balanced in sign across items) keeps the within-pair tilt ≤ 0.4 at β=2 — the equal-SDI pairing really is near-bias-free in this model, which is exactly the mechanic M4 is meant to measure. |
| All other bank options | `Σ_t max(0, traitScores[t]) / 4` | Edwards-style social-desirability factor: every ACOEXP positive pole reads as a desirable self-description to a peer audience, so desirability grows with positive-pole endorsement strength; reverse-scored (negative-loading) statements read as undesirable and contribute 0. The /4 normalizes by the bank-wide median positive-loading sum (measured across all 488 non-ipsative options: p25=2, p50=4, p75=5, p90=6, max=14). |

Only within-question proxy differences affect the argmax (absolute level is
choice-invariant); centering constants are interpretability aids. The biased
arm consumes the seeded RNG stream exactly like `clean` (one roll per
question, unused), so stream structure and determinism are unchanged.

## AC-B2 sanity: bias measurably degrades flag-off recovery ✅

Locked arm (β=2), flag OFF vs the `clean` arm, forced stop @16q, N=2000:

| Trait | clean flag-off r@16q | desirability flag-off r@16q | Δ |
|---|---|---|---|
| A | 0.809 | 0.648 | −0.161 |
| C | 0.706 | 0.636 | −0.070 |
| E | 0.763 | 0.585 | −0.178 |
| O | 0.767 | 0.694 | −0.073 |
| X | 0.865 | 0.792 | −0.073 |
| P | 0.730 | 0.591 | −0.139 |
| **mean** | **0.773** | **0.658** | **−0.115** |

Top-1 archetype agreement @16q: 47.9% (clean) → 20.2% (biased, −27.7pp).
Mean r degrades monotonically with β across the whole sweep (0.773 at β=0 →
0.398 at β=12), so the arm is modeling bias, not noise — AC-B2 holds at every
β ≥ 0.5.

**β choice:** β=2 is locked as the documented arm: degradation is large and
visible on every trait (mean −0.115) while the instrument remains functional
(all r ∈ [0.59, 0.79]) — a plausible "self-presenting respondent", not a
destroyed instrument. Higher β values were swept for the M4 dose-response
below and are not plausible respondent models beyond β≈4.

## M4 A/B under bias (AC-B3) — locked β=2, seed 20260909

| Trait | flag OFF r@16q | flag ON r@16q | Δ | M4 needs ≥ +0.03 (X, P) |
|---|---|---|---|---|
| A | 0.648 | 0.651 | +0.003 | — |
| C | 0.636 | 0.641 | +0.005 | — |
| E | 0.585 | 0.589 | +0.004 | — |
| O | 0.694 | 0.684 | −0.010 | — |
| **X** | **0.792** | **0.782** | **−0.010** | ❌ FAIL |
| **P** | **0.591** | **0.573** | **−0.018** | ❌ FAIL |

Top-1 agreement @16q: 20.2% → 22.9% (+2.7pp, directionally positive but far
from material). No trait regresses > 0.03 (no-regression check passes).
Ipsative serving under bias: 35.5% of forced-16 sessions (mean 0.60
answers/session), natural 5.0% (mean 0.05) — lower than the clean arm's
56.1%/1.02 because corrupted answers change the state path and ipsative items
win the utility competition less often.

## Dose-response: Δ(flag-on − flag-off) r@16q across β

| β | flag-off mean r | ΔA | ΔC | ΔE | ΔO | ΔX | ΔP |
|---|---|---|---|---|---|---|---|
| 0 (clean) | 0.773 | +0.016 | +0.008 | −0.013 | +0.005 | −0.010 | −0.007 |
| 0.5 | 0.753 | +0.019 | +0.006 | −0.015 | −0.005 | −0.012 | −0.014 |
| 1 | 0.721 | +0.020 | +0.009 | −0.006 | −0.004 | −0.010 | −0.020 |
| 1.5 | 0.706 | +0.007 | +0.003 | −0.004 | −0.012 | −0.008 | −0.017 |
| 2 (locked) | 0.658 | +0.003 | +0.005 | +0.004 | −0.010 | −0.010 | −0.018 |
| 3 | 0.598 | −0.015 | −0.001 | +0.007 | −0.008 | −0.005 | −0.022 |
| 4 | 0.552 | −0.033 | −0.014 | +0.004 | −0.002 | +0.002 | −0.030 |
| 6 | 0.489 | −0.059 | −0.016 | −0.007 | −0.014 | +0.019 | −0.003 |
| 8 | 0.453 | −0.051 | −0.006 | −0.003 | −0.023 | +0.026 | +0.001 |
| 10 | 0.427 | −0.045 | −0.008 | −0.002 | −0.024 | +0.029 | +0.001 |
| 12 | 0.398 | −0.023 | −0.014 | +0.003 | −0.027 | +0.035 | +0.003 |

Reading:

- **ΔP is flat ≈ 0 at every β** (max +0.003 at β=12). Even when bias has
  collapsed flag-off r(P) to 0.25, one near-equal-SDI binary item per session
  adds no recoverable P signal. The P↔C pairs' within-pair SDI gaps (ΔSDI
  ∈ {−2, −2, 0, +2}) are small but non-zero, so at high β the ipsative P
  answers are themselves mildly tilted — the equal-SDI property erodes as
  β·(ΔSDI/10) grows toward the truth-signal differences.
- **ΔX turns positive only for β ≥ 4** and crosses +0.03 only at β=12, where
  the flag-off instrument no longer measures personality (mean r = 0.398).
  That is not evidence the mechanic works; it is evidence that when the rest
  of the bank is ~destroyed, any extra X sample helps a little.
- The rival traits (A, C) gain at low β and lose at high β — the same
  displacement trade documented in the Item-1 dose-response, now with the
  sign flipping as bias swamps everything.

**Conclusion:** there is no β at which the M4 criterion (both ΔX and ΔP
≥ +0.03 on a functioning instrument) is met. Combined with the Item-1 clean-arm
dose-response, the ipsative mechanic's benefit is not merely invisible — it
does not exist at measurable size in this engine under the response distortion
it was designed to counter. Mothball: keep `enableIpsativeItems: false`, retain
the bank/audit/test infrastructure (harmless, flag-off byte-identical), and
spend no further iteration on loadings, amplitude, or SDI assignment.

## Verification evidence

- **AC-B4 default byte-identical:** `npm run simulate:recovery` (post-change)
  → `diff` against the pre-change snapshot of
  `docs/reports/2026-09-09-latent-trait-recovery.md` is empty. (The biased arm
  is unreachable from the default `--noise=clean,moderate` path and excluded
  from `--noise=all`.)
- **Biased-arm tables:** `--noise=desirability` (flag off) and
  `--noise=desirability --ipsative=on` runs above; both N=2000, seed 20260909,
  runtime ≈2.6s per arm (same scale as existing arms).
- **β sweep:** reproduced via `SIM_DESIRABILITY_BETA=<β>` env override
  (tuning-only knob; the locked constant `DESIRABILITY_BIAS_BETA = 2` is the
  default).
- **Persona suite:** `npm run simulate:personas:run:ci` → 12/12 (100.0%).
- **Guardrails:** `npm run guardrails` → 0 errors.

---
Generated per `.git/.orchestration/sprints/sprint-contract.m4-desirability-bias-arm.md`.
