# UI + API binding

## Canonical route surface (2026-08-06)

All mini-script routes are mounted at **top-level `/api/miniscript/*`** (`routes/domains/icebreaker.ts` → `routes/domains/miniscript.ts`); `socialSessionId` is read from the request **body**, never the URL path. The client must never use the session-scoped `/api/social-icebreaker/:id/miniscript/*` or `/api/social-icebreaker/:id/bonus/*` aliases — they do not exist (404; blocked the bonus gate and every post-generate action until 2026-08-06). Enforced by `miniscriptClientPathContract.test.ts`.

| Method | Path | Auth | Body |
|--------|------|------|------|
| `POST` | `/api/miniscript/generate` | host | `{ socialSessionId, playerCount, style, genres[], lite? }` — persisted on `SocialSessionState.miniScriptFramework`; idempotent (returns cached framework) |
| `POST` | `/api/miniscript/assign-roles` | host | `{ socialSessionId }` — round-robin by join order; idempotent |
| `POST` | `/api/miniscript/reveal-act` | host | `{ socialSessionId, targetAct }` — sequential only (`INVALID_ACT_SEQUENCE` otherwise); idempotent |
| `POST` | `/api/miniscript/vote` | any | `{ socialSessionId, vote: { who, what, why } }` — content-filtered; replaceable |
| `POST` | `/api/miniscript/reveal-solution` | host | `{ socialSessionId }` — requires all acts revealed + all assigned players voted |
| `POST` | `/api/miniscript/ready` | any | `{ socialSessionId, ready }` |
| `POST` | `/api/miniscript/bonus/respond` | host | `{ socialSessionId, accept }` — resolves the gate via `transitionPhase(skipBonusGate)` |
| `POST` | `/api/miniscript/bonus/sentiment` | any | `{ socialSessionId, sentiment: 'want' \| 'pass' }` |

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
