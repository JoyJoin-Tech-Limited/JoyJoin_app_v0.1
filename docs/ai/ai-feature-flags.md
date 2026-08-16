# AI feature flags and environment (server)

## Flash story response enrichment

`FLASH_STORY_AI_RESPONSES_ENABLED` defaults to `false`. When enabled, a story
path with more than one reviewed choice may ask the approved creative model
router for a constrained response plan only after the deterministic episode
completion and fragment transaction commits. Timeout, missing credentials,
schema rejection, or provider failure keeps the reviewed response. The model
never chooses fragments, progress, endings, unlocks, or the next node.

**Policy:** Production **chat/completion** routes use **MiniMax** and/or **DeepSeek** via [`socialModelRouter`](../apps/server/src/ai/socialModelRouter.ts) and [`creativeModelRouter`](../apps/server/src/ai/creativeModelRouter.ts). **Embeddings** are self-hosted only. Set `EMBEDDING_BASE_URL` to point to your OpenAI-compatible endpoint (default model: **Granite** `granite-embedding-97m-multilingual-r2`, overridable via `EMBEDDING_MODEL`). DeepSeek has no embedding API and is never used for embeddings.

## Semantic embeddings (`embeddingClient.ts`)

| Variable | Values | Effect |
|----------|--------|--------|
| `EMBEDDING_BASE_URL` | URL | OpenAI-compatible endpoint for self-hosted embedding (e.g. `http://localhost:8000/v1`). Required for embeddings. |
| `EMBEDDING_API_KEY` | string | API key for the self-hosted endpoint (optional, default empty). |
| `EMBEDDING_MODEL` | string | Model id passed to the embeddings API (default `granite-embedding-97m-multilingual-r2`). Set explicitly if your provider uses a different id. |
| `EMBEDDING_TIMEOUT_MS` | ms | Default `10000`. |
| `EMBEDDING_MAX_RETRIES` | count | Default `2`. |

## Social / match LLM routing

| Variable | Typical values | Effect |
|----------|----------------|--------|
| `SOCIAL_AI_PROVIDER` | `hybrid`, `minimax`, `deepseek` | Social icebreaker + match-intelligence style routing in `socialModelRouter`. |
| `MINIMAX_API_KEY`, `MINIMAX_MODEL`, `MINIMAX_BASE_URL` | — | MiniMax client (`minimaxClient.ts`). |
| `DEEPSEEK_API_KEY` | — | DeepSeek primary for most social/creative functions (flash tier, thinking disabled by default); missing key degrades surfaces to curated fallbacks. |

## Creative (event theme, etc.)

| Variable | Effect |
|----------|--------|
| `CREATIVE_AI_PROVIDER` | Global creative provider override. |
| `CREATIVE_AI_TITLE_PROVIDER` | Override for event theme title generation only. |
| `ENABLE_EVENT_THEME_TITLE_GENERATION` | Hard off switch for async AI theme titles. |

## Social Icebreaker phases

| Variable | Effect |
|----------|--------|
| `SOCIAL_ICEBREAKER_ENABLE_PERSONALITY_DICE` | Disable personality-dice AI phase when false. |
| `PERSONALITY_DICE_CHOOSE_MODE_ENABLED` | Enable Choose-Your-Prompt variant: 3 difficulty-tiered dares per player, player picks one. Generates via `generatePersonalityDiceChallengeGroups` (prompt v4). Falls back to curated `PERSONALITY_DICE_DARES` bank. |
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Insert auction phase. |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` | Enables **迷你剧本杀** (`mini_script`) in social icebreaker. |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` | Legacy alias for `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT`. |

## Matching / semantics

| Variable | Effect |
|----------|--------|
| `ENABLE_SEMANTIC_SIMILARITY` | Optional 7th scoring dimension (see `matchingSemantic.ts`). |
| Predictive rerank pool / threshold fields | See `predictiveRerankingService.ts` and pool overrides — live rerank off by default. |

## Observability

| Variable | Effect |
|----------|--------|
| `AI_USAGE_TRACKING_ENABLED` | Extra logging for event-theme AI usage. |
| `AI_TIMEOUT_MS`, `DEEPSEEK_TIMEOUT_MS`, `MINIMAX_TIMEOUT_MS` | Timeouts for creative / social paths. |

Prometheus: `GET /api/metrics` exposes `joyjoin_ai_calls_total` and `joyjoin_ai_call_latency_ms` (from `logAITrace`).
