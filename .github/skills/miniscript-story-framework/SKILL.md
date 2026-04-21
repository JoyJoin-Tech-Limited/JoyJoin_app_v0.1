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

## Cross-links

- [`llm-runtime-safety-and-integration`](../llm-runtime-safety-and-integration/SKILL.md)
- [`social-icebreaker-domain`](../social-icebreaker-domain/SKILL.md)
- [`game-design-icebreaker-compilation`](../game-design-icebreaker-compilation/SKILL.md)
