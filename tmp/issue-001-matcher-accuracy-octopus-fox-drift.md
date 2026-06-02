# Issue: Personality Matcher V2 — Octopus/Fox Boundary Misclassification Due to Trait Measurement Drift

**Status:** `🔍 Root Cause Identified | 🧪 Multiple Fixes Tested | 🚫 No Valid Fix Found Yet`  
**Severity:** High (affects 6/33 boundary cases = 18% of boundaries)  
**Files Touched:** `packages/shared/src/personality/*`, `scripts/simulate/*`

---

## 1. Current Metrics (Baseline)

| Metric | Value | Target |
|--------|-------|--------|
| Exact match (45 personas) | **30/45 = 66.7%** | ≥75% |
| Similar match (top-3 contains expected) | **44/45 = 97.8%** | 100% |
| Hard misses | **1/45** | 0 |
| Avg questions | **14.8** | ≤15 |
| Boundary exact | **~19/33 = 57.6%** | ≥70% |

**The single hard miss:** `koala → dolphin_calm` (koala-dolphin boundary).

---

## 2. Problem: Fox ↔ Octopus Confusion (Highest-ROI Fix)

### 2.1 Failing Cases

| Persona | Expected | Actual | True X | True O | Measured X | Measured O | Score Gap (fox-octopus) |
|---------|----------|--------|--------|--------|------------|------------|------------------------|
| 脑洞章鱼↔寻宝狐 (50/50) | octopus | **fox** 🟡 | 66.3 | 95.0 | 69 | 92 | **25** (fox wins) |
| 脑洞章鱼↔寻宝狐 (40/60) | octopus | **fox** 🟡 | 63.0 | 94.7 | **89** | 90 | **39** (fox wins) |
| 脑洞章鱼↔好奇猫头鹰 (60/40) | octopus | **fox** 🟡 | 47 | 89 | 62 | 86 | **43** (fox wins) |

**Total: 3 similar mismatches + 0 hard misses for this pair.**

### 2.2 Prototype Profiles (Key Traits)

```
Fox:      A=40  C=50  E=60  O=92  X=78  P=58
Octopus:  A=50  C=28  E=55  O=95  X=52  P=70

Gap on X: 26 points (primary differentiator)
Gap on O:  3 points (both high-O, nearly identical)
Gap on C: 22 points (secondary differentiator)
```

**The core discrimination should be X:** fox is significantly more social (X=78) than octopus (X=52). But the engine **over-measures X for octopus-leaning personas**, collapsing the 26-point gap.

---

## 3. Root Cause Analysis

### 3.1 Measurement Drift Is the Problem, Not the Matcher

For the 50/50 octopus↔fox boundary:
- **True X = 66.3** (midpoint between 52 and 78)
- **Measured X = 69** (slight inflation)
- With measured X=69, fox (X=78, distance=9) is genuinely closer than octopus (X=52, distance=17)
- The matcher is **correct** given the noisy input; the input is wrong

For the 40/60 octopus↔fox boundary:
- **True X = 63.0**
- **Measured X = 89** (massive +26 inflation!)
- With X=89, the persona is squarely in fox/corgi territory

### 3.2 Why X Gets Inflated for Octopus

**Anchor option conflation analysis** (see `scripts/simulate/analyze-conflation.ts`):

| Anchor | Option | Dominant | Secondary | Problem |
|--------|--------|----------|-----------|---------|
| Q1 | A | X=3 (50%) | O=2, P=1 | Octopus picks A for O=2, gets +3 X bonus |
| Q4 | A | O=2 (50%) | X=1, P=1 | Octopus picks A for O=2, gets +1 X bonus |
| Q9 | A | O=3 (50%) | X=-1 | Actually OK for X |

**76% of anchor options are heavily conflated** (<60% single-trait dominance). Only 3% are pure (≥75%).

The octopus persona (high O=95) naturally selects high-O options. Many high-O options **also load positively on X**, inflating the measured X toward fox territory.

### 3.3 The Engine Compounds the Problem

The adaptive engine uses **arithmetic averaging** of option trait scores. Every anchor question contributes equally to the final trait estimate, regardless of how conflated its options are. There's no mechanism to downweight questions where the selected option has high cross-trait contamination.

---

## 4. Fixes Already Attempted (With Results)

### 4.1 ✅ Fox/Octopus Matcher Classifier (IN PLACE, LIMITED IMPACT)

**Location:** `packages/shared/src/personality/matcherV2.ts`  
**Method:** `classifyFoxVsOctopus()` added to `applyConfusionAwareClassifier()` switch.

```typescript
// Fires when top-2 gap < 10 points
// Primary: X (fox=78, octopus=52, maxBonus=6)
// Secondary: C (fox=50, octopus=28, maxBonus=4)
// Tertiary: P (fox=58, octopus=70, maxBonus=3)
```

**Result:** Does NOT fire for the 3 failing cases because score gaps are 25-39 points. The classifier catches edge cases where measurement is accurate but scores are close; it cannot fix massive measurement drift.

**Verdict:** Keep it — harmless, catches edge cases. But not the main fix.

### 4.2 ❌ Prototype Trait Adjustment (REVERTED)

**Attempt:** Shifted 6 prototype trait values by ±3-5 points to increase pairwise separation.

**Result:** Exact match dropped 30→29, plus a new hard miss. Prototype adjustment changes the adaptive question-selection path (because engine uses prototypes for information-gain calculation), causing unpredictable side effects.

**Verdict:** Abandoned. ±5 envelope too weak to overcome noise, strong enough to destabilize anchors.

### 4.3 ❌ Trait-Pure Anchor Refactoring (REVERTED)

**Attempt:** Rewrote Q1-Q4 to have single-trait-pure options (e.g., Q1 pure-X, Q2 pure-O).

**Result:** Catastrophic regression 30→23 exact. Lost cross-trait narrowing ability; every archetype with X>70 mapped to corgi because anchors no longer measured P/O/C simultaneously.

**Verdict:** Abandoned. Pure anchors break the engine's early-archetype-narrowing logic.

### 4.4 ✅ Baseline/Normalization (IN PLACE, ESSENTIAL)

**Location:** `scripts/simulate/test-all-v2.ts` patches `DEFAULT_ASSESSMENT_CONFIG`

```typescript
traitScoreBaselines: { A: 0.515, C: 0.531, E: 0.709, O: 0.429, X: 0.074, P: 0.327 }
traitScoreMultiplier: 15
```

**Result:** Without these, accuracy drops to ~20/45. Required for any accuracy at all.

### 4.5 ✅ Deterministic Testing (IN PLACE)

`Math.random` in option sorting replaced with `() => 0` (3 places in `adaptiveEngine.ts`). Eliminates result variance between runs.

### 4.6 ✅ Existing Confusion Classifiers (IN PLACE)

5 pair-specific classifiers exist: rooster/dolphin, owl/turtle, koala/dolphin, elephant/turtle, dolphin/spider. These all work correctly.

---

## 5. Remaining Similar Mismatches (Full List)

| Pair | Count | Type | Notes |
|------|-------|------|-------|
| fox ↔ octopus | **3** | Boundary | **Highest ROI** — X drift |
| rooster ↔ corgi | 4 | Centroid+Boundary | X/P conflation |
| koala ↔ elephant | 3 | Boundary | A/C conflation |
| owl ↔ turtle | 2 | Boundary | O/C conflation |
| spider ↔ koala | 2 | Boundary | A/C/E conflation |
| dolphin ↔ hamster | 1 | Boundary | A overlap |
| cat ↔ turtle | 1 | Boundary | X/E overlap |
| **koala → dolphin** | **1** | **Hard miss** | koala-dolphin 50/50 boundary |

---

## 6. Hypotheses for Fix (Untested)

### Hypothesis A: Question-Level Weighting by Purity

Weight each question's contribution to trait scores by its "option purity" (dominant-trait ratio). Pure questions get weight 1.0, conflated questions get weight 0.5-0.7.

**Pros:** Reduces impact of conflated anchors without changing questions.  
**Cons:** Requires engine scoring changes; may slow convergence.

### Hypothesis B: Reduce Worst Conflation Surgically

Instead of full rewrite, edit ONLY the most damaging option trait scores:

| Question | Option | Current | Proposed | Reason |
|----------|--------|---------|----------|--------|
| Q1 | A | `{O:2, X:3, P:1}` | `{O:3, X:1, P:0}` | Octopus picks A for O; +3 X is fox territory |
| Q4 | A | `{O:2, X:1, P:1}` | `{O:3, X:0, P:0}` | Octopus picks A for O; +1 X inflates |
| Q3 | A | `{X:4, P:2, C:-1}` | `{X:3, P:1, C:0}` | X/P conflation hurts rooster↔corgi |

**Pros:** Minimal change, preserves cross-trait narrowing.  
**Cons:** Requires careful validation per persona; risk of breaking other pairs.

### Hypothesis C: Add Octopus-Fox L3 Disambiguation Question

Create a forced-choice question specifically targeting the X/C gap between fox and octopus, with high `discriminationIndex` (0.80+).

**Pros:** Proven pattern (Q90 corgi/rooster, Q91 fox/octopus already exist but are L2).  
**Cons:** Increases question count; only helps if selected by engine.

### Hypothesis D: Trait-Drift Detection + Correction

After anchors complete, if top-2 is fox/octopus AND measured X > true midpoint + 10, apply a "X correction penalty" proportional to O-score (high O + high X is physically unlikely for octopus).

**Pros:** Fixes drift at scoring time, not measurement time.  
**Cons:** Ad-hoc; feels like a band-aid.

### Hypothesis E: Weighted Scoring by Trait Variance

In `processAnswer`, weight each option's trait contribution by `1 / (number_of_nonzero_traits_in_option)`. This automatically downweights conflated options.

**Pros:** Global fix, no per-question editing.  
**Cons:** Changes scoring for ALL archetypes; needs full regression test.

---

## 7. Reproduction Steps

```bash
# Run full benchmark
npx tsx scripts/simulate/test-all-v2.ts

# Debug specific fox-octopus boundary
cat << 'PY' | python3
import json
with open('scripts/simulate/data/all-personas.json') as f:
    d = json.load(f)
for p in d:
    if '脑洞章鱼' in p['label'] and '寻宝狐' in p['label']:
        print(p['label'], '-> expected:', p['expectedArchetype'])
PY

# Run matcher in isolation for a specific trait profile
cat << 'TS' > /tmp/test-matcher.ts
import { prototypeMatcher } from './packages/shared/src/personality/matcherV2';
const result = prototypeMatcher.findBestMatches(
  { A: 42, C: 41, E: 55, O: 95, X: 66, P: 63 }, // 50/50 octopus-fox
  undefined, 3
);
console.log(result.map(r => `${r.archetype}=${r.score}`).join(', '));
TS
npx tsx /tmp/test-matcher.ts
```

---

## 8. Key Files and Line Numbers

| File | Relevant Section |
|------|-----------------|
| `packages/shared/src/personality/matcherV2.ts` | `classifyFoxVsOctopus()` (line ~882), `applyConfusionAwareClassifier()` switch |
| `packages/shared/src/personality/adaptiveEngine.ts` | `processAnswer()` (line ~200), `calculateQuestionUtility()` (line ~544) |
| `packages/shared/src/personality/questionsV4L1.ts` | Q1-Q8 anchors (lines 7-487) |
| `packages/shared/src/personality/archetypeRegistry.ts` | Prototype trait profiles (lines 89-773) |
| `scripts/simulate/test-all-v2.ts` | Benchmark runner |
| `scripts/simulate/lib/persona-utils.ts` | `selectAnswerByTraits()` — persona simulation |
| `scripts/simulate/data/all-personas.json` | 45 test personas (12 centroids + 33 boundaries) |

---

## 9. Acceptance Criteria for "Done"

- [ ] fox ↔ octopus boundaries: **3/3 exact** (currently 0/3 exact, 3/3 similar)
- [ ] Overall exact match: **≥33/45** (currently 30/45)
- [ ] Overall similar match: **45/45** (currently 44/45)
- [ ] No hard misses (currently 1: koala→dolphin)
- [ ] Avg questions ≤ 15 (currently 14.8)
- [ ] No regression on previously exact centroids

---

## 10. Context for Next Agent

**CRITICAL:** Do NOT run `npm run db:generate` or `db:push` — this is a pure algorithm/code change, no schema changes.

**CRITICAL:** The `DEFAULT_ASSESSMENT_CONFIG` is patched at runtime in `scripts/simulate/test-all-v2.ts` with baselines and multiplier. Any config changes must also be reflected there for testing.

**CRITICAL:** The `PERSISTENT_CONFUSION_PAIRS` early-injection and multipliers in `adaptiveEngine.ts` are **commented out** (lines ~320-360). Do NOT re-enable — they were proven to worsen accuracy by over-selecting disambiguation questions.

**CRITICAL:** Option randomization is deterministic (`sort(() => 0)`). This is intentional for reproducible testing.

**The user's explicit instruction:** They want to explore **trait-pure anchor refactoring** as the fundamental fix. We've proven that naive trait-pure anchors (Q1-Q4 rewrite) cause catastrophic regression. A smarter approach is needed — see Hypotheses A-E above.

---

*Last updated: 2026-05-27*  
*Engineer: Kimi Code CLI*  
*Related PRs/commits: N/A (local exploration)*
