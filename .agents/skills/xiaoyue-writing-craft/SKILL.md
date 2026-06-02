---
name: xiaoyue-writing-craft
description: >
  Canonical Chinese writing craft system for all Xiaoyue-generated user-facing text.
  9 verifiable axioms (rhythm, imagery, negative space, concreteness, sentence variety,
  temperature, actionable landing, anti-AI aesthetics, conversational flow) encoded as
  reusable LLM prompt instructions with a deterministic post-generation craft validator
  and shared quality gate utility. Use when Xiaoyue output reads flat or "AI-feeling" —
  this skill elevates copy from functional to "reads like a treat." Covers personality
  test analysis, mini-script narratives, icebreaker coaching, match explanations, recap
  summaries, and all mascot-facing Chinese prose. Trigger phrases: "文字功底",
  "reads like a treat", "AI aesthetics", "AI feel", "AI味",
  "premium copy", "craft quality", "writing quality", "copy not premium enough",
  "text feels flat", "reads like AI", "polish the writing", "make it sound human."
metadata:
  trigger: All Xiaoyue-facing Chinese text generation
  source: Designed from first-principles analysis of common AI-generated Chinese prose failure modes
---

# Xiaoyue Writing Craft

## Hard constraint

Never generate user-facing Chinese text without the 9 craft axioms.
Every LLM prompt that produces Xiaoyue copy must inject `XIAOYUE_CRAFT_PRINCIPLES`
from `apps/server/src/prompts/craft.ts`. Every output must pass context-aware
thresholding: score ≥70 for analysis/narrative, ≥55 for comment/coaching/lite.

New LLM surfaces should use `generateWithCraftQuality()` from `craftQualityGate.ts`
instead of inline retry logic.

## 9 Craft Axioms

1. **节奏** — short (8 chars or fewer) sentences every 3-4 long ones; sentence length stddev at least 5
2. **画面感** — at least one sensory scene per block (something audible, visible, or tangible)
3. **留白** — last sentence never starts with "你会", "你需要", or "你应该"
4. **具体代替抽象** — at least two camera-capturable verbs per block; never use "你是...的人" pattern
5. **句式多样性** — max 2 consecutive sentences starting with "你"; zero parallelism
6. **温度** — at least one acceptance signal per block; never use "你容易", "你倾向于", "你往往"
7. **落点** — ends on a specific doable action, never an abstract summary
8. **AI味儿屏蔽词** — hard ban on 14 words; "你" density at most 8 per 100 characters
9. **对话感** — reads like conversation, not a report; at least one direct reader address per block

Violating axiom 8 means instant fail. Violating 3 or more others means fail.

## Architecture

| Layer | File | Role |
|-------|------|------|
| L1 — Prompt injection | `apps/server/src/prompts/craft.ts` | 9 canonial craft axioms as LLM system instructions |
| L2 — Validator | `apps/server/src/lib/writingCraftValidator.ts` | Deterministic post-generation scoring 0–100, context-aware thresholds |
| L3 — Shared utility | `apps/server/src/lib/craftQualityGate.ts` | `generateWithCraftQuality()` — inject → validate → retry, handles all contexts |
| L4 — Retry loop | Call sites | At most 2 retries with refinement hints before fallback |

## When to use this skill

- Any LLM prompt that generates user-facing Chinese text
- Xiaoyue output reads flat, generic, or AI-feeling
- Copy is structurally correct but not a treat to read
- Adding a new Xiaoyue text generation surface
- Reviewing AI-generated Chinese copy for quality
- Tuning the craft axioms or validation thresholds

## Quick examples

- **Personality result reads generic** → Uses `generateWithCraftQuality()` in `xiaoyueAnalysisService.ts` with full axioms, context `analysis`, threshold 70, max 2 retries.
- **Mini-script story beats feel AI-written** → Inject `XIAOYUE_CRAFT_PRINCIPLES` into `miniscriptPrompts.ts`. Craft diagnostic logged in `miniscriptAgent.ts`.
- **Adding new Xiaoyue text surface** → Use the shared utility: `generateWithCraftQuality({ buildPrompt, callLLM, parseResult, context, extractText, fallback })`. Context auto-selects full or lite principles + correct thresholds.
- **Short coaching comment needs lite craft** → Pass context `'comment'`. Rhythm/imagery/landing checks auto-skipped, threshold 55.

## Troubleshooting

**Validator score is low but output reads fine to me**
Check `fixableIssues` for specific violations. Each maps to a craft axiom. If the validator is too strict, adjust thresholds in `writingCraftValidator.ts` without lowering axiom standards.

**LLM ignores craft axioms**
Increase temperature slightly (0.8) and ensure craft block appears early in the prompt. Verify the axiom text uses imperative language, not suggestions.

**Banned word detection fires on legitimate usage**
Add exception logic to the `BANNED_WORDS` regex in `writingCraftValidator.ts`. Do NOT remove words from the ban list.

**Retry loop consumes too many tokens**
Use `XIAOYUE_CRAFT_LITE` for single-line outputs (comments, coaching hints). Full axioms only for long-form analysis and narratives.

## Review checklist

- [ ] `XIAOYUE_CRAFT_PROMPT_VERSION` bumped if axioms change
- [ ] Craft principles injected into all relevant LLM call sites
- [ ] `validateCraft()` called after every LLM response
- [ ] Retry loop respects max 2 attempts
- [ ] Fallback copy also validated (no regression)
- [ ] New banned words are tested against existing good output
- [ ] `XIAOYUE_CRAFT_LITE` used for token-sensitive calls

## Related skills

- `llm-runtime-safety-and-integration` — provider routing, trace logging, fallback handling
- `joyjoin-brand-guidelines` — brand copy strategy, tone modes, terminology table
- `miniscript-story-framework` — narrative generation where craft axioms apply
- `mini-program-frontend-excellence` — UX polish for text-heavy screens
