# Mini-program AI — smoke checklist

Use after server or MP changes that touch AI routes. **Embeddings** require `DEEPSEEK_API_KEY` (OpenAI-compatible API); **chat** uses MiniMax and/or DeepSeek per [`docs/ai-feature-flags.md`](../ai-feature-flags.md).

## Preconditions

- Server running with AI keys configured for the environment under test.
- `GET /api/metrics` returns `joyjoin_ai_calls_total` and `joyjoin_ai_call_latency_ms` after at least one AI call.

## Checks

1. **Onboarding profile tagline** — Complete flow to profile review; confirm AI line appears (or generic fallback) and no onboarding loop.
2. **Matched theme** — On matching status, after match + optional theme reveal, theme fields populate; logs show `[AITrace]` for theme generation when applicable.
3. **Group analysis** — Open matching-status, squad-unboxing, or pool-group-detail for a matched group; analysis copy loads; metrics increment for domain `match_explanation` (feature names vary).
4. **Social Icebreaker** — Host: warmup topics → advance phases; confirm curated fallback if AI disabled (no crash).

### WP4 — Manual QA matrix (mini-program)

Sign off each row after a release candidate or AI-affecting change.

| Area | What to verify | Pass criteria |
|------|----------------|---------------|
| Profile tagline | Onboarding → profile review | One AI-generated or fallback line; no routing loop |
| Pool group detail AI card | Open `pool-group-detail` for a matched group | “AI · 这桌氛围” + dynamics and/or icebreaker line loads without blank error |
| Theme after WebSocket | Matching status: match + optional `EVENT_THEME_TITLE_REVEALED` | Theme title/tagline/highlights match server; no stale tab state |
| Group analysis surfaces | Matching status (chemistry card), squad-unboxing, pool-group-detail | `GET /api/pool-groups/:groupId/analysis` succeeds; pair copy + icebreakers consistent with server |
| Icebreaker session | Host path: warmup → advance | Phases advance; if AI off, curated fallback and no crash |

### WP4 — Debug: fresh vs cached (dev / beta only)

- **Local dev:** a one-line **调试 · 桌友分析 实时生成 | 缓存 · …** hint appears under group analysis UI (matching-status chemistry card, squad-unboxing “整体氛围” card, pool-group-detail AI card). It must **not** appear in normal production WeChat builds.
- **Beta / preview build:** set `TARO_APP_SHOW_GROUP_ANALYSIS_DEBUG=1` when building the mini-program so QA can see the same line without shipping it to all users. See [`apps/mini-program/README.md`](../../apps/mini-program/README.md).

## Log queries

- `grep '\[AITrace\]'` on server logs — confirm JSON lines, no prompt/user text.
- Prometheus: `joyjoin_ai_calls_total{outcome="fallback"}` vs `outcome="live"` vs `outcome="cache"` for health.

## Failure triage

- High `fallback` rate: check provider keys, `SOCIAL_AI_PROVIDER`, timeouts.
- Embeddings degraded: check `DEEPSEEK_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_TIMEOUT_MS` for your environment.
