---
name: miniscript-story-framework
description: >-
  迷你剧本杀（Social phase `mini_script`）故事框架 JSON、POST /api/miniscript/generate、风格/题材枚举、
  与 Social Icebreaker 会话挂载。触发：迷你剧本杀、MiniScriptAgent、mini_script、
  sinHook、act_flow。配合 llm-runtime-safety-and-integration、social-icebreaker-domain、
  game-design-icebreaker-compilation。
---

# miniscript-story-framework

## Hard constraints

- **4–6 players** roster gate on server; **host-only** `POST /api/miniscript/generate`.
- **No violence / death**; low-stakes mishap tone only; worker output **JSON only** for machine parse.
- **mini-program first:** Taro `phaseViews` + session page own the primary UX; web parity follows.

## References (progressive disclosure)

| File | Purpose |
|------|---------|
| [references/skill-modules.md](references/skill-modules.md) | Callable units: deterministic vs LLM-backed ordering. |
| [references/json-schema.md](references/json-schema.md) | Canonical `MiniScriptStoryFramework` fields + `schemaVersion`. |
| [references/ui-binding.md](references/ui-binding.md) | API + modal enums + UI component map. |

## When to use this skill

- Implementing or modifying the `mini_script` social icebreaker phase
- Designing JSON story frameworks for the 4–6 player mini-script game
- Adding or changing `POST /api/miniscript/generate` behavior
- Curating genre/style enums or updating Taro `phaseViews` for mini-script
- Reviewing a PR that touches `socialIcebreakerStore` mini-script state or AI trace logging

## Quick examples

- **Add a new genre branch** → Update the genre enum in the schema, extend the `MiniScriptStoryFramework` JSON shape, and verify the Taro `phaseViews` modal mapping still covers all act flows.
- **Fix a host-advance bug** → Check the completion guard in the mini-script advance handler; ensure all roster players have reached the final act before allowing phase transition.

## Troubleshooting

- **400 on generate with roster size error** → Verify roster length is between 4 and 6 players; gate is enforced server-side.
- **AI-generated story JSON fails schema validation** → Check `schemaVersion` matches the expected framework version; validate against `references/json-schema.md`.
- **Taro phase view crashes on story load** → Ensure `phaseViews.tsx` `MiniScriptPhaseView` handles every `act_flow` enum value and provides a fallback for unknown acts.
- **Mini-script state disappears after app backgrounding** → Session TTL may have expired; check `social_icebreaker_sessions` TTL and rejoin semantics per `social-icebreaker-domain`.
- **Story contains violent or high-stakes content** → Reject and regenerate; hard constraint mandates low-stakes mishap tone only, no violence or death.

## Review checklist

- [ ] Roster size gate (4–6 players) enforced server-side
- [ ] Sensitive truth data remains server-only; no secrets in client payloads
- [ ] AI output validates against canonical `MiniScriptStoryFramework` JSON schema
- [ ] Taro `phaseViews` covers every act flow and modal enum
- [ ] Genre/style enums are documented in `references/ui-binding.md`
- [ ] No violence or death in generated story content
- [ ] `logAITrace` uses correct feature name and `promptVersion`
- [ ] Mini-program first: web parity reviewed only after Taro UX is complete

## Cross-links

- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md)
- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md)
- [`game-design-icebreaker-compilation`](../game-design-icebreaker-compilation/SKILL.md)
