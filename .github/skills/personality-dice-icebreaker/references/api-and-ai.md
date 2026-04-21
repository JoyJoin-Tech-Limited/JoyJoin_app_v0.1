# Personality dice — API and AI

## Routes

| Method | Path | Who |
| --- | --- | --- |
| POST | `/:socialSessionId/personality-dice/generate` | Host |
| POST | `/:socialSessionId/personality-dice/complete` | Player |

## AI

- `generatePersonalityDiceChallenges(participants[])`
- `promptVersion`: `social-personality-dice-v1`
- Trace feature: `generatePersonalityDiceChallenges`, domain `icebreaker`
