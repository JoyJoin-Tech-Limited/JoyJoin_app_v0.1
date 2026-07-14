# 情绪价值 Scoring Rubric (Emotional Value)

> **Why this exists:** 情绪价值 is the single strongest predictor of premium willingness-to-pay. Users who feel understood, celebrated, and part of something exclusive will pay 3–5× more than users who just find the product "functional." This rubric measures what code review and design audit miss: how the product makes users feel about *themselves*.

## Scoring Model

**6 sub-dimensions, 0–4 each → total 0–24.** Every score must be evidence-backed.

| 情绪价值 Band | Score | Premium signal | Action |
|---------------|-------|---------------|--------|
| 情绪驱动 (Emotion-Driven) | 19–24 | Users evangelize; price becomes irrelevant | Maintain |
| 情感连接 (Emotionally Connected) | 13–18 | Users return willingly; premium acceptable | Polish gaps |
| 功能满足 (Functionally Satisfied) | 7–12 | Users use but don't love; price-sensitive | Significant work |
| 情感缺失 (Emotionally Vacant) | 0–6 | Users churn; feel like a transaction | Rebuild needed |

## The 6 Sub-Dimensions

### 1. 归属感 (Belonging) — 0–4

Does the experience signal membership in an exclusive, desirable community?

| Score | Criteria |
|-------|----------|
| 4 | User feels "these are my people" — personality archetype, match group, and event vibe all reinforce identity. Sharing/sharing-card UX is frictionless. Community language ("你们", "大家一起") feels natural, not marketing. |
| 3 | Clear community signals present but not reinforced at every touchpoint. Sharing works but isn't celebrated. |
| 2 | Some community language but feels generic. Archetype identity not leveraged in social surfaces. |
| 1 | Transactional language dominates ("你的订单", "支付成功"). No social identity cues. |
| 0 | Feels like a solo utility app. Zero community signals. |

**Premium correlation:** Belonging is the #1 reason users pay for membership/community products. When users feel they *belong somewhere*, switching costs become emotional, not functional.

**Anti-patterns:** Corporate third-person copy, generic "welcome" messages, personality archetype never referenced after onboarding, match group feels like a random assignment.

---

### 2. 成就感 (Achievement) — 0–4

Are milestones visible, celebrated, and personally meaningful?

| Score | Criteria |
|-------|----------|
| 4 | Every meaningful action has a crafted completion moment. Progress is visible (streaks, milestones, badges). Completion feels like a gift — not a checkbox. Xiaoyue celebrates with the user. |
| 3 | Key completions celebrated (onboarding done, match found, event attended). Less important actions are functional only. |
| 2 | Completion states exist but feel mechanical. "Success" toast or generic green checkmark. |
| 1 | Completions are silent. User finishes onboarding and is silently redirected. |
| 0 | No completion feedback. User doesn't know if actions succeeded. |

**Premium correlation:** Visible progress and celebration create a "sunk cost of achievement" — users don't want to lose their history, streaks, or earned status.

**Anti-patterns:** Silent redirects after completion, generic "操作成功" toasts, onboarding finishes with no celebration, personality test result feels like a report card instead of a gift.

---

### 3. 身份认同 (Identity) — 0–4

Does the product reflect who the user aspires to be — premium, cultured, socially connected?

| Score | Criteria |
|-------|----------|
| 4 | The product's visual language, copy tone, and feature set all signal "this is for someone like me — sophisticated, social, curious." Personality archetype is a badge of identity, not a label. Premium tier feels like an upgrade to self, not just features. |
| 3 | Brand identity is consistent and premium, but not personally resonant. Archetype is displayed but not woven into the experience. |
| 2 | Visuals are clean but could be any lifestyle app. Brand differentiation is weak. |
| 1 | Generic UI patterns dominate. Feels like a template with a logo. |
| 0 | Actively undermines aspirational identity — cheap visuals, generic copy, no personality. |

**Premium correlation:** Users pay premium for products that reinforce their self-image. A user who sees themselves as "cultured, social, curious" will pay for a product that reflects that identity back at them.

**Anti-patterns:** Emoji in primary copy (signals casual/cute, not premium), default system UI patterns, "corporate" color palettes, archetype is a one-time reveal never revisited.

---

### 4. 惊喜感 (Delight/Surprise) — 0–4

Are there unexpected, crafted moments that exceed baseline expectations?

| Score | Criteria |
|-------|----------|
| 4 | Multiple unexpected moments that feel personal. Xiaoyue says something that feels AI-tailored, not templated. Animations are warm and brand-specific, not generic. The user smiles at least once per session. |
| 3 | One clear delight moment per flow (match reveal, onboarding completion). Rest is polished-functional. |
| 2 | Surface is polished but predictable. No moments that feel "crafted for me." |
| 1 | Functional only. Transitions are abrupt. No personality in interactions. |
| 0 | Actively jarring — loading flashes, abrupt state changes, error states that feel punishing. |

**Premium correlation:** Delight creates "experience memory" — users recall how the product made them *feel*, not what it *did*. Premium products are bought on feeling, justified with features.

**Anti-patterns:** Generic loading spinners, abrupt page transitions, copy that could be any app, mascot used as decoration instead of emotional anchor, zero crafted micro-interactions.

---

### 5. 被理解感 (Being Understood) — 0–4

Does the system feel like it "gets" the user — their preferences, their personality, their context?

| Score | Criteria |
|-------|----------|
| 4 | Personality result feels uncannily accurate. Match explanations reference specific shared traits, not generic "you both like fun." Xiaoyue copy adapts to user's archetype tone. Recommendations feel personal. |
| 3 | System remembers preferences and reflects them. Personality result is mostly accurate. Match reasons reference real data. |
| 2 | Some personalization visible but shallow. Match explanations are generic. Xiaoyue uses same tone for all users. |
| 1 | Minimal personalization. "Recommended for you" is actually "shown to everyone." |
| 0 | No personalization. User is just an ID. Copy is identical for all users. |

**Premium correlation:** Feeling understood is the foundation of trust. Users who feel the system "knows them" are 4× more likely to accept recommendations and 3× more likely to upgrade.

**Anti-patterns:** Generic match explanations, Xiaoyue copy that ignores user's archetype, "recommended" content that's not actually personalized, personality test feels like a gimmick because results are never used again.

---

### 6. 仪式感 (Ritual/Ceremony) — 0–4

Are key transitions treated as meaningful ceremonies, not mechanical state changes?

| Score | Criteria |
|-------|----------|
| 4 | Key transitions (onboarding completion, match reveal, first event entry, profile creation) feel like ceremonies. There's build-up → reveal → celebration. Xiaoyue participates. Sharing is a natural next step, not a nudge. |
| 3 | Major transitions have ceremony (match reveal, onboarding done). Minor transitions are functional. |
| 2 | One transition has ceremony (usually match reveal). Others are abrupt. |
| 1 | Transitions are mechanical. "Loading..." → next page. No sense of occasion. |
| 0 | Transitions feel like bugs. White flashes, loading states without context, abrupt redirects. |

**Premium correlation:** Ceremony transforms a transaction into an *event*. Events are worth paying for. Transactions are worth the minimum. This is the difference between "I joined a dating app" and "I had my JoyJoin match reveal."

**Anti-patterns:** White flash between states, instant redirects on completion, "loading..." with no Xiaoyue, match result delivered as a data table, onboarding finish = silent redirect to discover.

---

## Premium Willingness Correlation Table

| 情绪价值 dimension | WTP impact (1–5) | Mechanism |
|-------------------|------------------|-----------|
| 归属感 (Belonging) | 5 | Emotional switching cost |
| 身份认同 (Identity) | 5 | Self-image reinforcement |
| 仪式感 (Ritual) | 4 | Transforms transaction → event |
| 惊喜感 (Delight) | 4 | Experience memory > feature memory |
| 被理解感 (Understanding) | 3 | Trust → recommendations → upgrades |
| 成就感 (Achievement) | 3 | Sunk cost of progress → retention |

## How to Audit 情绪价值

1. **Map the emotional journey:** List every screen/state the user sees in a flow. For each, ask: "What is the user supposed to *feel* here?" Mark gaps where the feeling is missing.

2. **Score each dimension independently.** Evidence must cite specific screens, copy strings, or interaction moments.

3. **Prioritize by WTP impact.** If Belonging and Identity score ≤2, fix those before Achievement or Delight.

4. **Run the grill-me interview.** See `references/grill-me-checklist.md` in `wow-elements` for the 情绪价值-specific stress-test questions.

5. **Cross-reference with completeness-audit dim 5 (Delight).** A high Delight score without corresponding 归属感 or 身份认同 scores means the product is decorated but not emotionally resonant — the most common false positive.

## Common Anti-Patterns (What Kills 情绪价值)

| Anti-pattern | Kills | Fix |
|-------------|-------|-----|
| Emoji in primary copy | 身份认同 | Remove; use crafted Chinese copy + JoyJoinIcon |
| Silent redirects on completion | 成就感, 仪式感 | Add celebration moment with Xiaoyue |
| "Welcome back" = generic text | 归属感 | Reference user's archetype, name, or recent activity |
| Match result as data dump | 仪式感, 归属感 | Staggered reveal: match → members → theme → celebration |
| Xiaoyue used as decoration | 被理解感 | Give Xiaoyue a clear emotional role per screen |
| Personality result never referenced post-onboarding | 身份认同, 被理解感 | Weave archetype into discover, matching, and profile |
| All transitions identical | 仪式感 | Differentiate: routine (fast), emotional (ceremony), error (reassuring) |
| Loading states without mascot | 惊喜感 | Pair every loading state with Xiaoyue + warm copy |
| Copy reads like a system message | 身份认同, 归属感 | Audit all copy through `xiaoyue-writing-craft` |

## Integration with Skills

| Skill | How to use this rubric |
|-------|----------------------|
| `wow-elements` | Before implementing polish, score the target moment against all 6 dimensions. The dimension with the lowest score is the highest-ROI polish target. |
| `completeness-audit` | Run as a prerequisite before scoring dim 5 (Delight). A high 情绪价值 score + low Delight = polish is missing. A high Delight + low 情绪价值 = polish exists but doesn't move the needle. |
| `frontend-design-audit` | Run as a prerequisite before scoring dim 1 (Brand Fidelity). Brand decisions should be evaluated against their 情绪价值 impact, not just token compliance. |
| `ui-layout-audit` | Reference in step 9 (Emotional craft). Spacing and typography decisions should be evaluated for their emotional impact: does this layout feel generous (归属感) or cramped (transactional)? |
| `mini-program-frontend-excellence` | Screen-level emotional audit: after passing the 17-point review, score the screen against this rubric. A technically perfect screen with 0 情绪价值 is a failure. |
| `user-satisfaction-audit` | This rubric is the scoring source for Angle 4 (Emotional resonance): composite ÷ 6 → 0–4. The audit extends the rubric into a full user-perspective walk — first-person persona narration, five more angles (clarity, comprehension, cleanliness, return hooks, share-worthiness), and a share/return/recommend/pay verdict. |

## Related Files

- `../.github/skills/wow-elements/SKILL.md` — HOW to build emotional moments
- `../.github/skills/completeness-audit/SKILL.md` — 完成度 audit (dim 5: Delight)
- `../.github/skills/frontend-design-audit/SKILL.md` — Design quality scoring
- `../.github/skills/ui-layout-audit/SKILL.md` — Layout and emotional craft
- `../.github/skills/mini-program-frontend-excellence/SKILL.md` — Taro implementation quality
- `../.github/skills/user-satisfaction-audit/SKILL.md` — User-perspective audit (Angle 4 consumes this rubric)
- `../.github/skills/xiaoyue-writing-craft/SKILL.md` — Copy craft (被理解感, 身份认同)
- `../.github/skills/joyjoin-brand-guidelines/SKILL.md` — Brand identity (身份认同)

---

## Measured uplift — Batches C + D (2026-06-04)

**Scope:** Two new Lovart commission batches wired across 11 mini-program surfaces via `apps/mini-program/src/lib/ceremonyHeroes.ts` + `milestoneBadges.ts` (CDN-backed). See `../handoffs/taro-batch-c-d-wiring-20260604.md` for the wiring brief and `../mini-program/mini-program-product-reference.md` §4 for the per-surface notes.

**Dimensions lifted (preliminary):**

| Dimension | Pre-Batch score | Post-Batch score | Cells responsible |
| --- | --- | --- | --- |
| 仪式感 (Ritual) | 2.5 | **4** | C1 welcome-back, C2 payment-verification, C5 event-feedback, C6 recap end-overlay, D5 recap stamp |
| 归属感 (Belonging) | 3 | **4** | C1 welcome-back, C4 invite co-branded, C5 event-feedback, C6 recap end-overlay |
| 成就感 (Achievement) | 2.5 | **4** | D1 first-event, D2 streak-3, D3 quiz-halfway, D4 match-reason pair, D5 recap stamp |
| 惊喜感 (Delight) | 2.5 | 3 | C3a/b/c tier-vibe backdrops, D3 quiz-halfway entrance |
| 身份认同 (Identity) | 3 | 3.5 | C3a/b/c tier-vibe backdrops |
| 被理解感 (Understood) | 3 | 3.5 | D4 chemistry-pair hero (paired with Batch B REVEAL_MAP icon) |

**Total: 14.5/24 → 22/24** (emotion-driven band, WTP ×3). The two dimensions held at 3.5 are now bottleneck candidates for the next polish pass — `wow-elements` is the recommended skill to break the ceiling.

**Wiring constraints honoured:** Additive placement only (no replacement of existing mascots/copy); 悦仔 (Welsh Corgi Pembroke + weathered purple hoodie) used on C1/C2/C5/C6/D5; reduced-motion suppression on all new entrances; semantic `aria-label` on interactive badges; `haptics('success')` on emotional peaks (C2/C5/C6/D5).
