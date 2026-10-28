# Offline Icebreaker Content-Quality Gate (DQS v1)

`icebreakerContentQuality.ts` is a pure, deterministic evaluator for **supplied offline deck evidence**. It does not call a generator/model, read a database, observe live tables, or establish live user-perceived quality.

The checked-in JSON under `src/__tests__/fixtures/icebreakerContentQuality/` is explicitly `synthetic_unit_test` data. A synthetic `PASS` verifies gate logic only; it is not a real-world quality result.

## Run

From the repository root:

```bash
node --import tsx/esm \
  apps/server/src/scripts/evaluate-icebreaker-content-quality.ts \
  apps/server/src/__tests__/fixtures/icebreakerContentQuality/synthetic-pass.json
```

The CLI writes exactly one JSON document to stdout. Its CI-friendly exit policy is:

| Result | Exit |
|---|---:|
| `PASS` | 0 |
| `FAIL` | 1 |
| `INCONCLUSIVE` | 2 |
| Invalid JSON, unreadable file, or structurally invalid evidence | 1 |

No `package.json` change is needed. Programmatic callers use `evaluateIcebreakerContentQuality(unknown)` and `icebreakerContentQualityInputSchema`; structurally invalid input throws `IcebreakerContentQualityInputError`. An absent preregistration is valid input but makes the evaluation `INCONCLUSIVE`.

## Evidence contract

The versioned input (`icebreaker-content-quality-v1`) contains:

- exactly one `current` and one `candidate` variant, including `promptVersion`;
- bounded, aggregate-only table contexts (vibe, rotation reason, roster composition, shared interests, tier);
- one deck per context/variant, raw output, traceability, fallback/dedupe/latency/cost observations, hard gates, and engineering gates;
- independent per-rater 1–5 scores for answerability, context fit, specificity, arc, and freshness;
- optional fourth-rater adjudications and left/right-randomized pairwise preferences;
- calibrated rater records and the preregistration;
- optional live exposure/feedback counts, which are reported but **never** used by the offline conclusion.

Deck/rater/context references and uniqueness are validated. Missing required readings can be represented and produce `INCONCLUSIVE`; malformed scores or ambiguous references are invalid input.

## Scoring and reliability

Deck-level DQS uses immutable weights:

```text
0.30 answerability + 0.25 contextFit + 0.20 specificity + 0.15 arc + 0.10 freshness
```

For each deck/dimension, the independent ratings are averaged. If max-min is at least 2, a distinct fourth-rater adjudication is required and its score is the final deck/dimension score. Missing or non-independent adjudication makes the evidence incomplete. Adjudicated values never enter reliability estimation.

Reliability is an ordinal Krippendorff-style alpha: pooled midranks, squared rank distances, and pair-weighted observed within-unit disagreement over expected global disagreement. Units with fewer than two independent ratings do not count as agreement. Overall alpha must be at least 0.60; per-dimension values are also reported. Undefined or low reliability is `INCONCLUSIVE`, not evidence of no effect.

## Preregistration and power

DQS v1 requires preregistration locked before evidence start, alpha 0.05, 80% power, an MDE and assumed paired-delta SD, context/rater design effects, fixed context IDs, required raters/readings, bootstrap settings, and stopping rules.

The base paired-DQS context requirement is checked against:

```text
ceil(((z(0.975) + z(0.80)) * assumedPairedDeltaSd / MDE)^2)
```

Both the preregistered context count and pairwise comparison requirement must cover their base counts multiplied by `contextDesignEffect * raterDesignEffect`. At least three raters per deck, 20 calibration decks, 1,000 bootstrap resamples, and a 95% interval are required. Observed context/reading thresholds come only from this preregistration; the evaluator does not invent a minimum after seeing results.

## Intervals and preference

- DQS delta is the mean of context-paired deck deltas. Its CI is a percentile **paired-context cluster bootstrap** using the preregistered seed and resample count.
- Preference is exactly `(wins + 0.5 * ties) / comparisons`.
- Preference CI is a context-cluster percentile bootstrap with a deterministically derived seed, preserving all comparisons within a sampled context.
- Invalid-deck comparisons are excluded from quality calculations but reported as `invalidatedComparisons`; they cannot satisfy power. Invalid decks remain in deck/operations reports and force `FAIL`. Valid fallback decks remain in scoring and fallback-rate analysis.

The report also retains every dimension delta, Cohen's dz when defined, tie rate, randomization counts, rater reliability, per-deck traceability, invalid/fallback/dedupeRelaxed rates, P95 latency, cost coverage, and supplied live exposure/feedback coverage.

## Conclusion rule

1. Any explicit invalid row or failed hard gate => `FAIL`; it cannot be averaged away or hidden behind missing evidence.
2. Otherwise, missing/incomplete preregistration or evidence, insufficient preregistered contexts/readings, or reliability below 0.60 => `INCONCLUSIVE`.
3. Only adequately powered, complete, reliable evidence can receive a quality `PASS` or `FAIL`.

`PASS` requires **all** of:

- hard gates and engineering/non-regression checks pass;
- candidate DQS minus current DQS >= 0.40;
- paired 95% CI lower bound > 0.20;
- preference >= 0.60 and its 95% CI lower bound > 0.50;
- no dimension delta < -0.20;
- preregistration, required evidence, calibration, and reliability requirements pass.

A threshold miss under complete, adequately powered, reliable evidence is `FAIL`. Missing data is never interpreted as “no difference.” Live exposure/feedback is report-only, and every report carries `liveQualityClaim: not_evaluated_offline_only`.

## Verify

```bash
npm run test -w @joyjoin/server -- src/__tests__/icebreakerContentQuality.test.ts
npm run typecheck -w @joyjoin/server
```
