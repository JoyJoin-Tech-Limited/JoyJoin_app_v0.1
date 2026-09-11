# Remote-Validation Harness

> Engineering counterpart to `docs/strategy/scientific-foundation.md` §Pre-launch
> validation program. That doc defines *what* must be measured to enable the V4
> dark flags; this doc defines *how* the measurements are computed, gated, and
> verified. Harness code: `scripts/simulate/analyze-remote-validation.ts` +
> `scripts/simulate/lib/remote-validation/`.

## Why this exists

The V4 measurement program (`docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md`)
is internally validated by simulation but **not externally validated**. Simulation
cannot substitute for the remote panel: simulated respondents are generated from
the same persona model the engine is being tested against, so measured correlations
are circular. The remote panel breaks the circularity with real humans answering
both JoyJoin's V4 assessment and a benchmark instrument.

This harness is the analysis layer: it ingests real panel data and produces the
verdict that decides whether the dark flags may be enabled. It ships with a
synthetic self-test so the pipeline is provably correct *before* any panel runs.

## The four analyses

| # | Analysis | Outcome | Threshold | Locked? |
|---|----------|---------|-----------|---------|
| 1 | Convergent validity | Pearson r between each gated ACOEXP trait and its mapped IPIP Big Five domain (sign-corrected) | **mean r ≥ 0.6, every factor ≥ 0.5** (`mean-floor` gate) | **LOCKED** (`scientific-foundation.md`) |
| 2 | Test-retest stability | Pearson r between V4 and 4-week re-administration, per trait | mean r ≥ 0.7 | proposed |
| 3 | Vibe-simulation | OLS: standardized trait-composition predictors → post-session 同频 | R² ≥ 0.05 and ≥1 core predictor positive at α=0.05 | proposed |
| 4 | Narrative A/B | Welch t-test on perceived-accuracy ratings between narrative arms | hypothesized arm higher, p < 0.05 | proposed |

"Locked" thresholds may block rollout. Proposed thresholds require plan-owner
ratification before they gate anything.

### Convergent gate rule + panel size (P1)

Two candidate rules over the five gated traits:
- **`all`** — every factor r ≥ 0.6 (strict conjunction).
- **`mean-floor`** — mean r ≥ 0.6 **and** every factor r ≥ 0.5. *(default)*

Power analysis (`simulate:remote-validation:power`, Fisher-z sampling, 20k reps)
shows the strict conjunction is badly underpowered near the target: with a true
per-factor r of 0.65, `all` PASSes only 66% (N=300) / 77% (N=400) / 84% (N=500)
of the time, and needs **N ≥ 625** for 90% power — because requiring the
*minimum* of five correlations to clear 0.6 rejects a genuinely valid
instrument whenever any one factor dips. `mean-floor` reaches ~100% power at
N=400 and needs **N ≥ 100**. At a true r of exactly 0.60 both rules sit near a
coin-flip, which is the correct behavior at the threshold.

**Decision:** adopt `mean-floor`; panel target **N = 400** (1000 would be needed
for the strict rule, which is out of scope). The `all` rule remains available
via `--gate-mode=all` for sensitivity reporting. Evidence:
`docs/reports/2026-09-11-remote-validation-power-analysis.md`.

### ACOEXP ↔ IPIP Big Five mapping

Source: `scientific-foundation.md:34` (ACOEXP = Affinity, Conscientiousness,
Emotional Stability, Openness, Extraversion, Positivity). Implemented in
`scripts/simulate/lib/remote-validation/mapping.ts`.

| ACOEXP | Big Five domain | sign | gated |
|--------|-----------------|------|-------|
| A Affinity | Agreeableness | + | yes |
| C Conscientiousness | Conscientiousness | + | yes |
| E Emotional Stability | Emotional Stability (IPIP Factor IV) | + | yes |
| O Openness | Openness (IPIP Factor V: Intellect/Imagination) | + | yes |
| X Extraversion | Extraversion (IPIP Factor I) | + | yes |
| P Positivity | *(no conjugate — Extraversion facet)* | + | **no** |

**P is deliberately excluded from the gate.** It is a JoyJoin-specific
positive-affect remix with no Big Five conjugate; gating it against a
self-chosen proxy would inflate the validity claim. It is reported as an
exploratory correlation only.

### Vibe-composition predictors

Derived per session from member V4 traits (`analyses.ts:buildVibePredictors`):

| Predictor | Definition | Expected sign | Basis |
|-----------|------------|---------------|-------|
| `meanA` | group mean Affinity | + | Bell 2007 team agreeableness |
| `meanC` | group mean Conscientiousness | + | Bell 2007 |
| `minE` | group **minimum** Emotional Stability | + | Barrick 1998 floor effect |
| `spark` | group max of max(X, P) | + | one energy source per table |
| `xVariance` | group variance in Extraversion | report-only | variance shaping |

## Data contract

The panel dataset is a single JSON file matching `PanelDataset`
(`scripts/simulate/lib/remote-validation/types.ts`). Minimum required fields:

```jsonc
{
  "meta":    { "panelId", "collectedAt", "instrument", "notes?" },
  "respondents": [{
    "participantId": "R0001",
    "v4":     { "traitScores": { "A", "C", "E", "O", "X", "P" }, "archetype", "confidence", "completedAt" },
    "ipip":   { "responses": { "ipip_01": 4, "...": 2 } },      // optional
    "retest": { "traitScores": { ... }, "completedAt" },        // optional
    "narrativeArm": "answer_citing", "narrativeRating": 5       // optional
  }],
  "vibeSessions": [{ "sessionId", "completedAt", "memberIds", "sameFrequency", "wouldMeetAgain?" }],
  "narrative":  { "arms", "metric", "hypothesizedBetterArm?" }
}
```

An analysis returns `INSUFFICIENT` (not FAIL) when its minimum N is unmet, so a
partial panel is never misread as a negative result.

### IPIP keying

The harness consumes a keying file (`IpIpKeying`): item ID → Big Five domain +
reverse flag, plus optional public-domain item wording for auditability. The
scorer never depends on wording.

**Pinned key:** `scripts/simulate/data/ipip-bigfive-keying.json` is the official
**IPIP Big-Five Factor Markers** key — 50 items, 10 per factor, with exact
wording and keyed direction sourced from `ipip.ori.org` (Goldberg, 1992; public
domain). The file carries `source` / `sourceUrl` / `retrievedAt` / `license`
provenance. Factor IV is Emotional Stability (higher = stable); Factor V
(Intellect/Imagination) maps to ACOEXP Openness.

Any instrument with the same shape may be substituted (e.g. a facet-level
NEO-120 key). A keying file may set `placeholder: true`, which makes the
analyzer refuse to treat it as a live study key and warn loudly.

## How to run

```bash
# Full self-test: generate planted fixture + assert recovery (CI-able)
npm run simulate:remote-validation:fixture

# Validates the validator: sweep planted validity strong→weak, assert the
# harness PASSes a valid instrument and FAILs an invalid one (CI-able)
npm run simulate:remote-validation:sweep

# Real panel analysis
npm run simulate:remote-validation -- --panel=<panel.json>

# With a markdown report and custom keying
npm run simulate:remote-validation -- \
  --panel=<panel.json> \
  --keying=<official-keying.json> \
  --report=docs/reports/<date>-remote-validation-panel.md
```

Artifacts: `scripts/simulate/data/remote-validation-latest.json` (machine) and
the optional markdown report. Exit code is non-zero only when a **locked**
analysis fails, or when `--self-test` assertions fail.

## Self-test (harness verification)

`simulate:remote-validation:fixture` generates a deterministic panel with a
**known planted structure** — latent Big Five rendered as attenuated ACOEXP +
IPIP measures, a planted 4-week retest, planted composition→同频 coefficients,
and a planted narrative-arm effect — then asserts the analyses recover it.

The 9 assertions (see `runSelfTest` in the orchestrator): all four analyses
reach PASS; convergent min-r and retest mean-r land within ±0.08 of the
analytically-expected attenuation; the two planted vibe coefficients recover
their sign; the narrative effect is significant. Passing proves the pipeline is
correct before real human data exists.

Evidence: `docs/reports/2026-09-11-remote-validation-harness-self-test.md`.

## Validating the validator (discrimination sweep)

Simulated users cannot validate the engine — the convergent r recovers whatever
the generator planted. What they *can* do is prove the harness has discriminating
power: `simulate:remote-validation:sweep` generates panels across a range of
planted validity (expected r from ~0.93 down to ~0.33) and asserts the harness
PASSes genuinely valid instruments (expected r ≥ 0.7) and FAILs invalid ones
(expected r ≤ 0.5), recovers magnitudes, is monotone with noise, and that retest
tracks its own expectation. Result: **5/5 checks pass**; the verdict flips around
the locked r = 0.6 threshold. Evidence:
`docs/reports/2026-09-11-remote-validation-discrimination-sweep.md`.

This is a necessary condition for trusting the harness, not a substitute for the
real panel.

## What this harness does NOT do

- **Recruit participants.** The 300–500-person panel and the 4–6-person video
  mini-tables are an operations task, not an engineering one.
- **Replace the 4-week retest** — it analyses retest data once collected.
- **Enable flags.** It produces evidence. Enablement is a separate, plan-owner
  decision (`docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` §Open
  decisions 4).
