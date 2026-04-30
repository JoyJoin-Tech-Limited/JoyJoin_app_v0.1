---
name: personality-dice-icebreaker
description: >-
  Social phase `personality_dice`: roster-sized `generatePersonalityDiceChallenges`, REST generate/complete,
  `social-personality-dice-v1`, playful non-clinical framing. Triggers: personality_dice, 人格骰子,
  personality dice challenges, /personality-dice/generate.
---

# personality-dice-icebreaker

## Hard constraints

- **Output cardinality** must match roster passed into `POST .../personality-dice/generate` (server validates shape).
- **Non-clinical copy**: challenges are social dares, not psychological assessment products.
- **Host-only generate**; players complete their own challenge row.

## When to use this skill

- Implementing the `personality_dice` social icebreaker phase
- Adding or modifying `generatePersonalityDiceChallenges` output or REST routes
- Ensuring challenge copy stays playful and non-clinical
- Reviewing a PR that touches `DICE_CURATED` fallbacks or Taro `PersonalityDicePhaseView`
- Debugging array length mismatches or host-only generate permissions

## References

| File | Purpose |
| --- | --- |
| [references/api-and-ai.md](references/api-and-ai.md) | Routes + promptVersion + trace metadata. |

## Cross-links

- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md)
- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md)
- [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md)

## Quick examples

- **Add a new trait branch** → update `DICE_CURATED` fallbacks + generator prompt in `socialIcebreakerAIService.ts`, keep zod/array shape tests green.
- **Taro parity** → mirror host generate + player complete UX in `phaseViews.tsx` `PersonalityDicePhaseView`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 403 on generate | Caller must be `hostUserId`. |
| Array length mismatch | `generatePersonalityDiceChallenges` requires `parsed.length === participants.length`. |

## Review checklist

- [ ] Fallback curated table still covers every `dominantTrait` enum.
- [ ] `logAITrace` uses feature `generatePersonalityDiceChallenges`.
- [ ] No medical/disability claims in challenge strings.
