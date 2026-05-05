# Shared Package — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-05-04

---

## 0. Before You Code — Mandatory Context Checklist

### Step 1: Load the domain skill

Every task touching `packages/shared` must load these skills based on what you're modifying:

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| DB schema (`schema.ts`) | `backend-models-standards` + `database-migration-safety` |
| Personality engine (`personality/`) | `personality-system` |
| API types / DTOs (`api.ts`) | `api-contract-versioning` |
| Social Icebreaker types | `social-icebreaker-domain` |
| Matching weights | `matching-domain` |
| UI primitives (`ui/`) | `frontend-component-architecture` + `design-system-governance` |
| Feature flags / config | `feature-flags-launch-config` |
| Any LLM-related types | `llm-runtime-safety-and-integration` |

### Step 2: Read the canonical doc

The skill's body links to authoritative docs for that domain. Follow those links.

### Step 3: Pre-implementation checklist

- ☐ Relevant skill loaded
- ☐ Change only touches what belongs in shared (§2 below)
- ☐ No legacy identifiers (§1 below)
- ☐ Export from `index.ts` barrel AND/OR add subpath in `package.json`
- ☐ Cross-platform impact assessed (web + mini-program both consume this package)
- ☐ No app-specific code leaked into shared

---

## 1. Active vs. Legacy (Do Not Reintroduce)

**Active — always use:**
- 12-archetype V4 personality engine (`personality/`)
- ACOEXP 6-trait model
- MatcherV2 (`personality/matcherV2.ts`)
- Social Icebreaker phases via `phaseRegistry.ts` 
- Tier manifest: `breeze`/`glow`/`blaze` (machine IDs)
- Tier display: `破冰局`/`畅聊局`/`狂欢局`
- `@joyjoin/shared` or `@shared/*` imports

**Legacy — never use:**
- 14-archetype V1/V2 system
- `standard`/`premium`/`bar` tier IDs → use `breeze`/`glow`/`blaze`
- `ArchetypeName` type → use `ArchetypeId`
- Import from root `shared/` directory (the git-tracked legacy duplicate)
- `archetypeRegistry.ts.bak` (stale backup — do not reference)

---

## 2. What Belongs Here vs. Doesn't

### DOES belong in shared:
- Database schema definitions (Drizzle tables)
- Cross-app TypeScript types and interfaces
- Personality engine (archetypes, traits, matchers, questions)
- Social Icebreaker types and phase registry
- API DTOs and shared validators (Zod schemas)
- UI primitives used by 2+ apps (Button, ResponsiveSpacer, color tokens)
- Constants and vocabularies (occupations, interests, districts, etc.)
- Matching weight defaults and contracts
- Feature flag definitions
- WebSocket event contracts
- Legal copy (terms, privacy policy)
- Achievement/gamification definitions

### Does NOT belong in shared:
- App-specific business logic (put in the app)
- Server secrets, env config (belongs in `.env`)
- Route handlers (belongs in `apps/server/`)
- Page components (belongs in the respective app)
- Admin-specific UI (unless used by 2+ surfaces)
- One-off utility functions used by a single workspace

---

## 3. Export Discipline (CRITICAL)

Shared code must be exported through TWO surfaces:

### A. Barrel export (`src/index.ts`)
- Add `export { ... } from "./yourModule.js"` to the barrel
- Use `.js` extension for ESM compatibility
- **Exception**: `socialIcebreaker.ts` is intentionally excluded from the barrel (it's massive, 687 lines of types; consumers use subpath exports)

### B. Subpath export (`package.json`)
- Add a named entry in `"exports"` field
- Format: `"./yourModule": "./src/yourModule.ts"` for source, `"./yourModule": "./dist/yourModule.js"` if pre-built
- This enables tree-shakeable imports: `import { thing } from "@joyjoin/shared/yourModule"`

**Both surfaces must stay in sync.** A change exported in one but not the other creates confusion.

---

## 4. Schema Files

Schema is split by domain under `packages/shared/src/schema/`:
- `_definitions.ts` — canonical Drizzle table definitions (50+ tables)
- `index.ts` — barrel export re-exporting all domain files
- Domain barrels: `users.ts`, `events.ts`, `payments.ts`, `personality.ts`, `socialIcebreaker.ts`, `venues.ts`, `matching.ts`, `admin.ts`, `analytics.ts`, `chat.ts`, `misc.ts`

`schema.ts` at package root is a 1-line barrel: `export * from './schema/index.js'`

**Rules:**
- New tables go in `_definitions.ts`, then re-export from the appropriate domain barrel
- Use Drizzle's `pgTable` with explicit column types
- Include relations via `relations()` helper
- **Before any schema change**: load `backend-models-standards` + `database-migration-safety`
- **Migration workflow**: `db:push` for local dev → `db:generate` for migration SQL → `db:rebuild-journal` to register

---

## 5. Personality Engine (`personality/` — 22 files)

The best-organized sub-module. Has its own `index.ts` barrel.

| File | Purpose |
|------|---------|
| `types.ts` | ACOEXP 6-trait keys, assessment session types |
| `questionsV4.ts` — `questionsV4Advanced.ts` | 6 question banks (entry, mid, advanced) |
| `prototypes.ts` | 12 archetype definitions |
| `matcherV2.ts` | MatcherV2 assignment algorithm |
| `matcherV2Gates.ts` | Guardrails / validation gates |
| `adaptiveEngine.ts` | Question selection logic |
| `archetypeRegistry.ts` | Canonical archetype registry |
| `archetypeCompatibility.ts` | Chemistry matrix |
| `archetypeNames.ts` | Display name mapping |
| `archetypeSkills.ts` | Skill definitions per archetype |
| `traitDisplayConfig.ts` | UI rendering config for traits |
| `resultViewModel.ts` | Result presentation helpers |
| `feedback.ts` | Milestone/feedback messages |
| `traitCorrection.ts` | Trait calibration logic |
| `trainingDataCollector.ts` | Training data collection |

**Tests**: 5 test files in `__tests__/` — the best-tested sub-module.

---

## 6. API Contracts (`api.ts` — 1,281 lines)

Typed API helpers and DTOs. Contains:
- `ApiTransport` base wrapper
- `AuthUserResponse` (mirrors `GET /api/auth/user`)
- Pricing plans, payment intent, coupon models
- Gamification DTOs
- Assessment V4 request/response types
- Event pool registration and group detail types
- **Normalizers**: Functions that clean raw DB/API responses into typed DTOs

**Rules:**
- When changing a server response shape, update the corresponding DTO here
- Normalizers should handle missing fields gracefully (use defaults, not crashes)
- Zod schemas for validation go alongside their types

---

## 7. Social Icebreaker (7 files)

| File | Purpose |
|------|---------|
| `socialIcebreaker.ts` (687 lines) | Core types, phase enums, state definitions, DTOs |
| `socialIcebreakerTierManifest.ts` | breeze/glow/blaze tier display config |
| `socialIcebreakerRunPlans.ts` | Run plan schemas |
| `socialIcebreakerYuezaiCopy.ts` | Mascot copy for icebreaker flows |
| `phaseModule.ts` | PhaseModule interface |
| `phaseRegistry.ts` | All 10 phases registered with metadata + default flows |
| `icebreakerRunPlan.ts` | Run plan serialization |

**Key constraint**: Phase registry is the authority for which phases exist. When adding a new phase, register it in `phaseRegistry.ts` first, then implement.

---

## 8. UI Primitives (`ui/` — 5 files)

| File | Purpose |
|------|---------|
| `Button.tsx` | shadcn-style button with CVA variants, Radix Slot, loading state |
| `buttonVariants.ts` | CVA variant definitions |
| `categoryColors.ts` | Interest category color tokens |
| `ResponsiveSpacer.tsx` | Viewport sentinel component |
| `connectionPointCompat.ts` | Match quality calculator (rarity tiers) |

**Rules:**
- Put UI here only if used by 2+ apps
- Follow shadcn/ui patterns + CVA for variants
- App-specific wrappers stay in the app (use `@/components/ui/` for local overrides)

---

## 9. Tests (Sparse — 6 files total)

**Existing**: 1 file in root `__tests__/`, 5 files in `personality/__tests__/`

**When to add tests:**
- Any new algorithm or scoring logic → test first
- Schema changes → add validation test
- API normalizer changes → add transformation test
- Personality engine changes → add/update personality tests

Run: `npm run test -w @joyjoin/shared`

---

## 10. Known Issues (Do Not Make Worse)

1. ~~`schema.ts` is 3,664 lines~~ — **RESOLVED 2026-05-05**: Split into 13 domain files under `schema/`.
2. **`archetypeRegistry.ts.bak`** — stale backup. Do not reference. Remove when safe.
3. **`socialIcebreaker.ts` not in barrel** — intentional (too large), but document this in any PR touching it.
4. **Large flat files** — `occupations.ts` (1,064 lines), `interests.ts` (509 lines), `topicCards.ts` (917 lines). Prefer adding new data to new files, not expanding these.
5. **0 tests for API normalizers** — highest-priority test gap.

---

## 11. Related Docs

- [`README.md`](./README.md) — boundary rules, what belongs
- [`../../AGENTS.md`](../../AGENTS.md) — root agent guide with full skill table
- [`../../apps/server/src/README.md`](../../apps/server/src/README.md) — server domain ownership
- [`../../.github/skills/backend-models-standards/SKILL.md`](../../.github/skills/backend-models-standards/SKILL.md)
- [`../../.github/skills/personality-system/SKILL.md`](../../.github/skills/personality-system/SKILL.md)
- [`../../.github/skills/api-contract-versioning/SKILL.md`](../../.github/skills/api-contract-versioning/SKILL.md)
