# AI feature flags and environment (server)

**Policy:** Production **chat/completion** routes use **MiniMax** and/or **DeepSeek** via [`socialModelRouter`](../apps/server/src/ai/socialModelRouter.ts) and [`creativeModelRouter`](../apps/server/src/ai/creativeModelRouter.ts). **Embeddings** use the OpenAI SDK against **DeepSeek’s** OpenAI-compatible embeddings endpoint only ([`embeddingClient.ts`](../apps/server/src/embeddingClient.ts)); there is **no MiniMax embedding path** in this client yet—add one explicitly if product requires it.

## Semantic embeddings (`embeddingClient.ts`)

| Variable | Values | Effect |
|----------|--------|--------|
| `DEEPSEEK_API_KEY` | string | Required for DeepSeek-backed embedding calls (OpenAI-compatible API). |
| `EMBEDDING_MODEL` | string | Model id passed to the embeddings API (default `text-embedding-3-small` if unset). Set explicitly if your provider uses a different id. |
| `EMBEDDING_TIMEOUT_MS` | ms | Default `10000`. |
| `EMBEDDING_MAX_RETRIES` | count | Default `2`. |

## Social / match LLM routing

| Variable | Typical values | Effect |
|----------|----------------|--------|
| `SOCIAL_AI_PROVIDER` | `hybrid`, `minimax`, `deepseek` | Social icebreaker + match-intelligence style routing in `socialModelRouter`. |
| `MINIMAX_API_KEY`, `MINIMAX_MODEL`, `MINIMAX_BASE_URL` | — | MiniMax client (`minimaxClient.ts`). |
| `DEEPSEEK_API_KEY` | — | DeepSeek chat fallback / primary per function. |

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
| `SOCIAL_ICEBREAKER_ENABLE_AUCTION` | Insert auction phase. |
| `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT_BETA` | Beta phase. |

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
