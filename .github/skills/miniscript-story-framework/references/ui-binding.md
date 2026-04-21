# UI + API binding

## POST `/api/miniscript/generate`

- **Body:** `{ socialSessionId, playerCount, style, genres[] }` — see `miniScriptGenerateRequestSchema`.
- **Response:** `MiniScriptStoryFramework` JSON; also persisted on `SocialSessionState.miniScriptFramework`.

## Components

| Surface | Entry | Config | Gameplay |
|---------|-------|--------|----------|
| Mini-program | `IcebreakerToolSelector` | `MiniScriptConfigModal` | `MiniScriptPhaseView` |
| Web | `miniscript/IcebreakerToolSelector` | `miniscript/MiniScriptConfigModal` | `miniscript/MiniScriptPhasePanel` |

## Modal copy (zh → API enum)

- Styles: 西欧宫廷 / 中世纪 / 古风 / 仙侠 / 未来科技 / 现代都市 / 民国 → style keys above.
- Genres default-on: 轻推理 / 惊悚悬疑 / 浪漫爱情 / 荒诞喜剧 → genre keys above.

## Timer

- Use `PHASE_CONFIG.mini_script.timeoutMinutes` (**45**) with `phaseStartedAt` for countdown UX.
