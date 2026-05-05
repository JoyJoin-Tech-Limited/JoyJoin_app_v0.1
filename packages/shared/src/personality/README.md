# Personality Engine

12-archetype personality system for JoyJoin. This is the canonical implementation shared across server, web, and mini-program.

## Architecture

- 12 archetypes using ACOEXP 6-trait model
- V4 adaptive assessment (8–16 questions, adaptive branching)
- MatcherV2 assignment algorithm
- Archetype chemistry matrix for pair compatibility

## Key files

| File | Purpose |
|------|---------|
| `types.ts` | ACOEXP trait keys, assessment session types |
| `prototypes.ts` | 12 archetype definitions with trait weights |
| `matcherV2.ts` | Assignment algorithm with validation gates |
| `adaptiveEngine.ts` | Question selection and branching logic |
| `archetypeRegistry.ts` | Canonical archetype registry |
| `archetypeCompatibility.ts` | Chemistry matrix between archetypes |
| `archetypeNames.ts` | Display name mapping |
| `archetypeSkills.ts` | Skill definitions per archetype |
| `traitDisplayConfig.ts` | UI rendering config |
| `resultViewModel.ts` | Result presentation helpers |
| `feedback.ts` | Milestone/feedback messages |

## Tests

- `__tests__/` — 5 test files covering matcher, registry, skills, names, and trait display
