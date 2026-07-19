# User Satisfaction Audit — Slot Machine Reveal: Existing vs Proposed

**Date:** 2026-07-19 · **Skill:** `user-satisfaction-audit` (+ `pm-sin-mapper` for PM lens)
**Surfaces:** `pages/onboarding/personality-test/results` slot flow
**Variants audited:** (E) Existing as-shipped · (P) Proposed Phase 1 (storyboard-complete) + Phase 2b (archetype reveal strips) · (P+) P plus the **blend-archetype near-miss reframe** (finding F1 below)

## Evidence basis (honesty declaration)

- **No fresh render.** The results page has no H5 screenshot generator, and static frames cannot capture choreography — the subject of this audit. Per skill rules, this is declared, not papered over.
- **(E)** is audited from a full code-level walk (`results/index.tsx`, `SlotStage.tsx`, `resultHelpers.ts`, `index.scss` timings/copy/haptics/ARIA) + the 2026-06-03/05 rendered audits as Class-A-defect baseline (completeness 44/44, design 20/20, performance 60/60 — no Class A defects on record).
- **(P)/(P+)** are **design-intent walks** of approved-but-unbuilt specs (storyboard + strategy doc). Scores are marked assumption-heavy where the rubric demands taking the lower score.
- Persona: **A — 首见用户** (first-time user via friend share). The slot flow only runs on first completion (replay fast-path skips it), so A is the only persona who ever sees it. They grade Angle 1 and 6 hardest.

---

## 1. Persona walk — (E) Existing

**Context:** Just answered the last of ~12 questions. Investment: ~4 minutes. Skepticism: moderate.

```text
BEATS
1. Last answer submitted → ghost echo of my answer + "悦仔收到了，正在分析…". I feel noticed. ✦
2. Celebration shell: "悦仔在整理你的命格卡" + sparkles. I wait ~1-2s. Fine — I just did work, a pause feels earned.
3. Redirect → a framed reel of animal cards sits idle 0.9s. I think: "命格卡… animal cards? Which one is mine?" Curious, not confused.
4. Reel spins fast for 2.5s. I can't read the cards — motion blur of animals. I feel anticipation, but a thought creeps in: ⚡ "is this… random? Did my answers matter?"
5. Reel slows, ticks, haptic taps. ✦ (the deceleration + vibration is the best-crafted beat so far)
6. (30% of sessions) it slides PAST a card and settles on the neighbor. ⚡ "Wait — I was almost a different animal??"
7. Land: pop + gold ring + 3 expanding rings + haptic thud. Satisfying — but modest. I expected a bigger payoff after 4s of buildup. ⚡ (peak under-delivered)
8. Silhouette → color fill → sparkle orb. "Oh, I'm a 开心柯基." ✦ (the fill is the smile moment)
9. Name + "典型" badge in my accent color + "隐约有[x]的影子". I feel pegged — in a good way. ✦
10. Trait bars, pull-quote, AI analysis (悦仔's voice), poster + share. I read the analysis line twice — it sounds like me. ✦
11. WeChat login handoff inline. Slight friction but contextually justified.

FRICTION LOG
- ⚡ Beat 4: "is this random?" — the slot metaphor frames my personality as chance, not analysis.
- ⚡ Beat 6: near-miss says "you were almost someone else" — trust drag on a *personality* result.
- ⚡ Beat 7: celebration = 3 CSS rings; storyboard promised a 40-particle burst. The peak is a fizzle.

DELIGHT LOG
- ✦ Beat 1 (answer echo), Beat 5 (haptic deceleration), Beat 8 (silhouette fill), Beat 10 (AI analysis that sounds like me).

EXIT RISK: none (skip button appears at 1.5s but total is ~6.9s and motion holds attention).
```

## 2. Persona walk — (P) Proposed (design intent)

Deltas only: drum curvature on the reel, anticipation micro-motion, overshoot near-miss, white flash + growth-bounce landing, accent-colored particle burst (≤40, tier-gated), **animated archetype strip at land (my animal moves)**, letter-by-letter name reveal.

```text
4'. The reel has depth now — cards curve away at edges. It reads more "machine", less "feed". Same ⚡ "is this random?" — slightly stronger, it looks more like a slot.
6'. Overshoot: it lands PAST my card, hangs a beat, settles back. ⚡ amplified: "I REALLY was almost that other animal."
7'. FLASH → my card bounces big → particles explode in *my* color. ✦✦ This is the payoff beat 7 owed me.
8'. And my corgi MOVES — a little celebration loop. ✦✦ I did not expect that. I want to show someone.
9'. "开… 开心… 开心柯基" letters bounce in one by one. ✦ crafted feeling, like it's being named, not printed.

NEW FRICTION
- ⚡ Beat 7' risk: flash + bounce + particles + strip simultaneously — if particle count or timing slips, the peak becomes visual noise. (Conditional on the ≤40/tier-gated discipline in ParticleBurst.)
- ⚡ Beat 6' worse than E unless reframed (see F1).
```

## 3. Finding F1 — the reframe that changes the audit (route: `wow-elements` + PM)

**The near-miss is currently a casino mechanic sitting on a personality result.** In (E) it's capped at 30% precisely because the team already smelled the manipulation risk; in (P) the overshoot choreography makes it *stronger*. But the system already knows my **secondary archetype** — it's rendered two beats later as "隐约有[x]的影子".

**Reframe:** the near-miss overshoot card is *always my blend archetype*. The reel slides onto [secondary], hangs, then settles on [primary]. The casino "you almost won" becomes "you're almost X — but really Y, with a shadow of X". Manipulation → 被理解感. Cost: trivial (target selection in the existing deterministic near-miss path; secondary already resolved server-side). This is the single highest wow-per-hour item in the entire strategy.

## 4. Scores (persona A, adversarial default)

| Angle | E | P | P+ | Evidence |
|---|---|---|---|---|
| 1 · 3s clarity | 3 | 3 | 3 | 命格卡 framing + celebration shell explain purpose; mid-spin is motion without narration in all variants |
| 2 · Cognitive smoothness | 3 | 3 | 3 | Single path, no reading load; ⚡ beat 4 "is it random?" persists in all — only copy can fix it |
| 3 · Holistic cleanliness | 4 | 3→4* | 4 | E: single focal point per stage (design 20/20 baseline). P: *torn 3/4 → took lower; earns 4 with ≤40-particle + accent-palette discipline. P+: same discipline, and reframe *removes* a jarring beat |
| 4 · Emotional resonance | 3 | 3 | **4** | 情绪价值 composite below — **P alone does not move this angle**; P+ tips it |
| 5 · Return hooks | 3 | 3 | 3 | Archetype identity invested + blend intrigue + discover pending; animation itself adds no new hook in any variant |
| 6 · Share-worthiness | 3 | 3 | 3→4* | E: poster is crafted/flattering. P/P+: the land moment (flash+particles+moving archetype) is screen-recordable gacha-style — torn 3/4 → took lower until the strip ships and proves record-worthy |
| **Total** | **19/24** | **18/24** | **19–20/24** | Band: 愿意回来 (all); P+ touches 爱不释手 threshold |

\* conditional scores — rubric: "when torn, take the lower and note what earns the higher."

### Angle 4 detail — 情绪价值 composite (÷6 → 0–4)

| Sub-dimension | E | P | P+ | Note |
|---|---|---|---|---|
| 归属感 | 2 | 2 | 2 | Community not present at this surface in any variant |
| 成就感 | 3 | 4 | 4 | Flash+bounce+particles make completion feel like a gift, not a checkbox |
| 身份认同 | 3 | 4 | 4 | A *moving* archetype is a living badge vs a printed label |
| 惊喜感 | 2 | 3 | 3 | E: 3 rings after 4s buildup = fizzle. P: real payoff (unbuilt → capped at 3) |
| 被理解感 | 2 | 2 | **3** | E/P: near-miss says "almost someone else". P+: overshoot IS my blend — "the system knows my shadow side" |
| 仪式感 | 3 | 4 | 4 | Storyboard-complete arc: build-up → reveal → celebration |
| **Composite → Angle 4** | **15 → 3** | **19 → 3** | **20 → 4** | Mapping: 20–24 → 4 |

**Grill-me on P+ angle-4 = 4:** "Where exactly does the user smile?" — Beat 7' (flash + accent particle burst: the owed payoff) and Beat 8' (the archetype *moves* — unexpected, personal, brand-specific). Both survive.
**Grill-me on 被理解感 ≤2 in E/P:** exact beat — Beat 6/6', the near-miss landing on a neighbor card with no relationship to me.

## 5. Verdicts (persona A, four questions)

| Question | E | P | P+ |
|---|---|---|---|
| Would I share it? | Yes — the poster, not the moment | Yes — and maybe a screen recording | Yes — the moment itself, "看它差点把我判成[x]" |
| Return tomorrow? | Yes, if discover uses my archetype | Same | Same + I want to see my moving animal again (profile) |
| Recommend it? | "测出来还挺准" | "动画挺炫" | "它差点把我判成猫，结果是柯基带猫影子——挺懂我" ← the sentence money can't buy |
| Pay because of it? | No (too early in funnel — correct) | No | No — but it sets the ceremony bar that later payment must match |

**Ship/no-ship:** E is shippable today (19/24). **P as specced is not worth its engineering cost** — it spends 2–3 weeks to hold the band flat (18–19) and risks cleanliness. **P+ is the version worth building**: same cost, tips Angle 4 to 4, and produces the recommend-sentence. The delta between P and P+ is one target-selection change in the near-miss path.

---

## 6. PM opinion — `pm-sin-mapper`

**Mode:** Execute (comparative decision + scoped slice). Brainstorm already happened (strategy doc).

### Sin mapping

| Sin | Severity | Evidence | Product impact | Correction |
|---|---|---|---|---|
| Vanity | **High** (original framing) | Request originated from "heard nice things about K3" — model novelty leading the problem (assumption: user-reported) | Build animation to justify a model, not to fix a felt gap | Lead with audit scores; K3 enters only as production tool for 2b where it's genuinely strong |
| Blindness | Med | No skip-rate/dwell instrumentation; storyboard's analytics section never built | Iterating on an unwatched animation is indistinguishable from success | Keep Phase 0 (instrumentation) even without A/B — baseline + post-ship delta |
| Disrespect | Med | Near-miss on a *personality* result = engineered false hope; code's own 30% cap comment concedes "casino-feel manipulation" | Trust erosion at the exact moment 被理解感 should peak | Adopt F1 reframe — converts the mechanic into personalization |
| Misfit | Low | 3D ambitions vs WeChat runtime constraints (documented) | Rework if WebGL/video paths attempted | Contain to fake-3D transforms + pre-rendered strips (already in strategy) |
| Myopia | Low | One-off animation vs lifecycle | Strips reusable in profile/matching/recap → amortize cost, raise 身份认同 everywhere | Plan strip assets as shared archetype-motion library from day 1 |
| Clutter | Low | Storyboard-complete adds flash/bounce/particles/strip simultaneously | Peak could become noise | Tier-gate + ≤40 particles + single focal rule |
| Isolation | Low→resolved | PM not consulted until now | — | This review + PM decision questions below |

### Recommendation

Build **P+**: Phase 0 (instrument) → Phase 1 (storyboard completion **including the F1 blend near-miss reframe**) → Phase 2b (K3-generated archetype motion strips as a shared asset library). Defer 2c (fake-3D drum) — it's the highest Vanity-risk item with the lowest audit delta. Replace A/B testing with: this comparative audit → instrumentation baseline → post-ship metrics delta (skip rate, dwell) → quarterly re-audit against the 爱不释手 (20+) bar.

### Deliverables

1. Updated strategy doc §6 (A/B → audit-based decision mechanism) ✅ done alongside this report
2. Phase 1 implementation slice incl. `NEAR_MISS_MODE: 'blend'`
3. Strip asset brief for K3 generation (12 archetypes × ≤9 frames × WebP, manifest format = existing mascot manifest)
4. Post-ship metrics checklist (skip rate, stage dwell, share conversion — delta vs baseline, no randomization)

### Code params

```typescript
// resultHelpers.ts
NEAR_MISS_MODE: 'off' | 'random' | 'blend'   // default 'blend'; 'random' kept for rollback
NEAR_MISS_PROBABILITY_CAP: 0.30               // unchanged — ethics cap is orthogonal to target selection
PARTICLE_COUNT_BY_TIER: { full: 40, reduced: 24, minimal: 0, emergency: 0 }
STRIP_MANIFEST: 'archetype-motion-manifest.json'  // mirrors xiaoyue-spritesheet-manifest.json schema
STRIP_LOAD_TRIGGER: 'post-target-resolution'      // lazy: only the landed archetype's strip
```

### Pseudocode

```
onDecelerationStart(target, secondary, mode):
  if shouldNearMiss(sessionId) and mode == 'blend' and secondary != null:
    overshootTarget = secondary          # the "almost you" card = your shadow archetype
    copy.tease = "隐约有{secondary}的影子"   # reused from existing blend indicator
  else if shouldNearMiss(sessionId):
    overshootTarget = neighborOf(target)  # legacy path
  land(target) → flash → bounce → particles(accentOf(target)) → strip(target).play()
```

---

> **PM directive (2026-07-19):** the open questions in §6 are superseded — PM greenlit maximum scope targeting 24/24 at the strictest measure. The gap-to-4 plan, technical barrier analysis (WebGL/threejs-miniprogram, K3 strip pipeline, server-side animated share clip), and revised sequencing now live in `docs/slot-machine/slot-machine-iteration-strategy-k3.md` §6.5.

## 7. What would make each variant 24/24 (north star, not scope)

- Fix Angle 2's "is this random?" with spin copy: rotating whispers of *actual answer echoes* ("你选了'周末更喜欢独处'…") during the 2.5s spin — proof of analysis, zero new systems (answer echoes already exist).
- 归属感 stays 2 until the archetype meets community — out of scope for onboarding, noted for matching-status surface.
