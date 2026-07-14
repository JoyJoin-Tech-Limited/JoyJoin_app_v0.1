# Angle Rubric — Six Critical Satisfaction Angles

Score each angle **0–4** from the persona's seat, with evidence from the render and the narration walk. Half-points are not allowed; when torn between two scores, take the lower one and note what would earn the higher.

---

## Angle 1 — 3-Second Clarity （秒懂）

*Question: Do I instantly know what this screen is for and what to do next?*

| Score | Criteria |
|-------|----------|
| 4 | Purpose, primary action, and expected outcome are obvious within 3 seconds to a first-time user. One dominant CTA; supporting actions are visibly secondary. |
| 3 | Purpose is clear; the next action takes a moment to locate but is unambiguous once found. |
| 2 | Purpose is guessable but the next action competes with 2+ equal-weight elements. User must scan to decide. |
| 1 | User can state what the screen shows but not what they should do. CTA buried, ambiguous, or missing. |
| 0 | User cannot say what this screen is for after 3 seconds. |

**Evidence to cite:** the first element the eye lands on, the CTA's visual weight relative to everything else, whether the headline answers "what is this / what do I do / what happens next".

**Anti-patterns:** dual primary CTAs, hero art that doesn't relate to the action, headline copy that describes the feature instead of the user's situation.

---

## Angle 2 — Cognitive Smoothness （顺滑）

*Question: Can I read and comprehend without effort, backtracking, or decoding?*

| Score | Criteria |
|-------|----------|
| 4 | Reading order is a single smooth path. Every line parses on first read — no re-reads, no mental math, no jargon, no decoding of status enums or internal vocabulary. |
| 3 | One or two spots require a second glance but never a re-read. Information hierarchy does the work. |
| 2 | User re-reads at least one block, or must hold two pieces of information in working memory to understand a third. |
| 1 | User decodes raw statuses (`matched`, `venue_unlocked`), timestamps without relative form, or unexplained abbreviations. |
| 0 | User gives up understanding part of the screen and proceeds on faith. |

**Evidence to cite:** exact narration beats where the persona hesitated or re-read; count of concepts introduced per screen (target: ≤3 new ideas per screen).

**Anti-patterns:** server-vocabulary leaking into copy, `2026-07-14 19:00` instead of `明天 19:00`, compound sentences mixing status + instruction + upsell, 孤字 line breaks mid-phrase.

---

## Angle 3 — Holistic Cleanliness （干净）

*Question: Does the screen as a whole feel calm, coherent, and intentionally composed?*

| Score | Criteria |
|-------|----------|
| 4 | One-screen coherence: a single visual story, clear focal point, generous breathing room, nothing competes for attention. Signal-to-noise is high; every element earns its place. |
| 3 | Coherent with minor noise — one decorative element or secondary block could be removed without loss. |
| 2 | Two or more visual stories on one screen; the eye bounces. Spacing is even but not hierarchical. |
| 1 | Crowded: cards inside cards, competing borders, chip soup, or >5 font sizes/weights visible at once. |
| 0 | Visual panic — user flinches or scrolls immediately to escape the density. |

**Evidence to cite:** squint test result (what survives the squint?), element count in viewport, number of distinct background colors/borders/shadows.

**Anti-patterns:** nested cards (card-in-card-in-card), every section shouting with the same weight, decorative illustration competing with the CTA, emoji/icons on every line.

> **Overlap with `ui-layout-audit`:** that skill owns the pixel mechanics (8rpx rhythm, alignment, typography scale). This angle owns the *felt* result: does the composition calm the user or crowd them? Cite layout-audit findings as evidence; do not re-derive token violations here.

---

## Angle 4 — Emotional Resonance （心动）

*Question: Are there wow moments with real sentimental value?*

**Scoring source:** `docs/reference/emotional-value-rubric.md` — score the 6 sub-dimensions (归属感, 成就感, 身份认同, 惊喜感, 被理解感, 仪式感, 0–4 each) and map composite ÷ 6 → 0–4.

| Composite | Angle 4 score |
|-----------|---------------|
| 20–24 | 4 |
| 15–19 | 3 |
| 10–14 | 2 |
| 5–9 | 1 |
| 0–4 | 0 |

**Evidence to cite:** the exact moment the persona smiled, paused, or felt nothing where a peak was promised. Emotional peaks (match reveal, squad unboxing, onboarding completion, first payment) are held to a higher bar: a peak with zero ceremony is an automatic ≤2 regardless of composite.

**Anti-patterns:** a promised reveal delivered as a data table, celebration copy that could belong to any app, mascot present but emotionally silent, silent redirects at moment-of-truth.

---

## Angle 5 — Return Hooks （想念）

*Question: Does this give me a reason to come back — identity, progress, people, streaks?*

| Score | Criteria |
|-------|----------|
| 4 | The screen plants at least one concrete reason to return: visible progress at stake, people expecting me, a reveal scheduled, identity invested (archetype, group, streak). Leaving feels like abandoning something. |
| 3 | A return reason exists but is stated, not felt ("记得回来看看" vs. "你的同桌在等你"). |
| 2 | Return depends entirely on external motivation (the event itself); the screen adds no pull of its own. |
| 1 | Screen actively closes the relationship: terminal copy, no next horizon, nothing pending. |
| 0 | Screen makes the user feel done with the product, not done with the task. |

**Evidence to cite:** what, precisely, would bring this persona back within 7 days — and whether the screen makes that reason vivid.

**Anti-patterns:** "完成" as the final emotion, no pending thread (未揭晓, 待确认, 进行中), identity assets (archetype, match group) never resurfacing after onboarding.

**Lifecycle link:** return hooks are the mechanism behind longer customer lifecycle — a screen that invests identity or progress raises the emotional switching cost (see 归属感 / 成就感 in the 情绪价值 rubric).

---

## Angle 6 — Share-Worthiness （炫耀）

*Question: Would I screenshot this and send it to a friend without embarrassment?*

| Score | Criteria |
|-------|----------|
| 4 | The screen is a screenshot-worthy artifact: it says something flattering or fun about the user, looks crafted at thumbnail size, and carries attribution naturally. User imagines the exact friend they'd send it to. |
| 3 | Shareable with minor self-editing ("I'd crop the bottom part"). |
| 2 | Neutral — not embarrassing, not compelling. User would share only if asked. |
| 1 | User would hesitate: something on screen feels cheap, exposing, or try-hard. |
| 0 | User would actively avoid anyone seeing this screen. |

**Evidence to cite:** the imagined caption the user would write; what the screen says about the user as a person; whether the composition survives thumbnail scale.

**Anti-patterns:** share moments framed as product marketing ("快来用 JoyJoin"), personal data shown without flattery, posters that look like ads.

---

## Scoring discipline

- **Evidence or it didn't happen:** every score cites a narration beat or a rendered element. "Feels clean" without a squint-test observation is not evidence.
- **Adversarial default:** start at 2 and let evidence move the score up or down. Do not start at 4 and defend it.
- **Peak surfaces are graded harder:** an emotional peak (reveal, completion, first payment) scoring ≤2 on angle 4 or 6 caps the total band at 用完即走 regardless of other angles.
