# Lie detective — secrecy and API

## Routes (`apps/server/src/routes/socialIcebreaker.ts`)

| Method | Path | Who |
| --- | --- | --- |
| POST | `/:socialSessionId/lie-detective/generate` | Current player |
| POST | `/:socialSessionId/lie-detective/vote` | Non-target voters |
| POST | `/:socialSessionId/lie-detective/next-player` | Host |

## AI

- Generator: `generateLieDetectiveStatements`
- `promptVersion`: `social-lie-detective-v1`
- `logAITrace` feature: `generateLieDetectiveStatements`, domain `icebreaker`

## Secrecy invariant

`LieDetectivePlayer.statements` entries are `{ index, text }` only. The lie bit is stored via `setLieTruths` / `getAllSessionLieTruths` for server-side recap medals and validation.
