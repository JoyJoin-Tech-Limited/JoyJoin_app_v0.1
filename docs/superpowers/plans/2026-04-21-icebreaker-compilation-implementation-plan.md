# Icebreaker run-plan compilation — implementation plan

> **For agentic workers:** Use **superpowers:subagent-driven-development** (recommended) or **superpowers:executing-plans** to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On **event match completion** (pool matching persist + per-group row created), compile and persist a **versioned `IcebreakerRunPlan`** optimized for **bonding with minimal peer pressure**, expose it on **Social Icebreaker** session reads, and **execute** it server-side by driving **phase order / enabled phases** from the plan—starting with deterministic compilation (no LLM) and template-first UI.

**Architecture:** Add a **small persisted plan** keyed by **stable match scope** (`event_pool_groups.id` for pool groups; `blind_box_events.id` when that path is wired). A **pure compiler module** produces `IcebreakerRunPlan` from pool/group context. **`saveMatchResults`** post-commit queues compilation like existing `themeGenTasks`. **`socialIcebreaker` routes** load the plan by resolving `icebreaker_sessions.groupId` / `blindBoxEventId` and merge a **sanitized `runPlan` snapshot** into `GET`/`POST start` responses. **`getNextEligiblePhase` / advance** consult `state.resolvedPhaseOrder` (copied from plan at session creation) so execution stays **server-authoritative**.

**Tech stack:** TypeScript, Drizzle ORM + PostgreSQL (`packages/shared/src/schema.ts`), Express routes in `apps/server`, shared types in `packages/shared`, Vitest in `apps/server`, React clients `apps/user-client` and `apps/mini-program` for read-only display of plan metadata.

**Canonical product workflow (must remain traceable):**

1. **Compilation** — comprehensive end-to-end flow → delivered as `IcebreakerRunPlan` JSON + hash.
2. **Optimization** — single objective: bonding / minimal pressure; **no coercion**; lightweight / fun / engaging.
3. **Customization** — match context and safe participant signals.
4. **Handoff** — Design output = spec artifact; Dev implements against templates.
5. **Development execution** — novel mechanics only as **new segments** bound to **existing orchestrator shells**.

**Codebase trigger mapping (precision):**

| Product phrase | Primary code hook |
|----------------|-------------------|
| Event match completed (pool) | Post-commit section of [`apps/server/src/poolMatchingService.ts`](../../apps/server/src/poolMatchingService.ts) `saveMatchResults` after the transaction succeeds (alongside `themeGenTasks` / `POOL_MATCHED`). You have `groupRecord.id`, `poolId`, `eventRecord.id`, `memberCount`, scores, `temperatureLevel`. |
| Social session key | [`icebreaker_sessions`](../../packages/shared/src/schema.ts) row `id` is the `sessionId` passed to [`POST /api/social-icebreaker/start`](../../apps/server/src/routes/socialIcebreaker.ts). Pool groups eventually get `icebreaker_sessions.groupId` (lazy create today in [`routes.ts`](../../apps/server/src/routes.ts) `generate-cards` path; Social flow uses whatever session the client obtained from `/api/icebreaker/session/:id`). |
| Session persistence | [`socialIcebreakerSessions.stateJson`](../../packages/shared/src/schema.ts) holds `SocialSessionState`. |

---

## File map (create / modify)

| Path | Responsibility |
|------|----------------|
| `packages/shared/src/icebreakerRunPlan.ts` (new) | Zod schema + types: `IcebreakerRunPlan`, `RunPlanSegment`, `ParticipationMode`, `PlanCompilerMeta`. Export `ICEBREAKER_RUN_PLAN_VERSION`, `parseIcebreakerRunPlan`. |
| `packages/shared/src/socialIcebreaker.ts` | Extend `SocialSessionState` with optional `runPlan?: IcebreakerRunPlan`, `runPlanHash?: string`, `resolvedPhaseOrder?: SocialIcebreakerPhase[]` (or reuse `enabledPhases` shape—pick one in Task 1 and stay consistent). |
| `packages/shared/src/schema.ts` | New table `icebreaker_run_plans` (or approved alternative): scope, version, hash, json, timestamps. |
| `apps/server/migrations/*.sql` | Generated via `npm run db:generate` after schema edit; never hand-invent filenames in CI. |
| `apps/server/src/lib/compileIcebreakerRunPlan.ts` (new) | Deterministic compiler: inputs from group + pool; outputs validated `IcebreakerRunPlan`. |
| `apps/server/src/repositories/icebreakerRunPlanRepo.ts` (new) | `upsertPlan`, `getPlanByGroupId`, `getPlanByBlindBoxEventId`. |
| `apps/server/src/poolMatchingService.ts` | Post-commit: invoke compile + upsert per `groupRecord.id`. |
| `apps/server/src/routes/socialIcebreaker.ts` | On `start` + session `GET`: resolve parent `icebreaker_sessions` → scope → attach plan; hydrate `enabledPhases` / order from plan. |
| `apps/server/src/lib/socialIcebreakerStore.ts` | If needed: helper to patch `stateJson` with plan fields on first session create only. |
| `apps/server/src/__tests__/compileIcebreakerRunPlan.test.ts` (new) | Unit tests: 2-player vs 6-player, temperature tags, skips `lie_detective` when `<3` members. |
| `apps/server/src/__tests__/socialIcebreakerRoutes.test.ts` | Extend: start returns `runPlan` when DB row exists. |
| `apps/user-client/src/hooks/useSocialIcebreaker.ts` | Type-only / field passthrough if response adds `runPlan`. |
| `apps/user-client/src/components/social-icebreaker/SocialIcebreakerOrchestrator.tsx` | Optional: show “Tonight’s flow” chips from `runPlan.segments` (read-only v1). |
| `apps/mini-program/src/pages/icebreaker-session/index.tsx` | Parity: same read-only UI if exposed. |
| `docs/icebreaker-system.md` | Document plan schema, trigger, and admin/debug access. |

---

## Self-review gates (run after each task group)

- **Spec coverage:** Each canonical workflow step has at least one task below.
- **Placeholder scan:** No open “TBD”; unknown blind-box hook is explicitly “Phase 2 optional” with a named search task.
- **Type consistency:** `IcebreakerRunPlan` is the single source; server never invents extra keys without updating Zod.

---

### Task 0: Preconditions and branch setup

**Files:** none (commands only).

- [x] **Step 1:** Create a git branch, for example `feat/icebreaker-run-plan`.

```bash
git checkout -b feat/icebreaker-run-plan
```

- [x] **Step 2:** Confirm server tests baseline passes.

```bash
cd apps/server && npm run test -- --run src/__tests__/socialIcebreakerRoutes.test.ts
```

Expected: all tests in that file pass (if the file is missing or renamed, run `npm run test -- --run src/__tests__/socialIcebreaker`).

---

### Task 1: Shared contract — `IcebreakerRunPlan` v1

**Files:**

- Create: [`packages/shared/src/icebreakerRunPlan.ts`](../../packages/shared/src/icebreakerRunPlan.ts)
- Modify: [`packages/shared/src/index.ts`](../../packages/shared/src/index.ts) (barrel export if the package uses one)

- [x] **Step 1:** Add the following **concrete** v1 contract (adjust imports to match package style: `zod` already used in `packages/shared`).

```typescript
// packages/shared/src/icebreakerRunPlan.ts
import { z } from 'zod';

export const ICEBREAKER_RUN_PLAN_VERSION = 1 as const;

export const socialIcebreakerPhaseSchema = z.enum([
  'warmup',
  'micro_challenge',
  'lie_detective',
  'auction',
  'personality_dice',
  'mini_script',
  'recap',
]);

export const participationModeSchema = z.enum([
  'full',
  'text_only',
  'observe_ok',
  'pass_ok',
]);

export const runPlanSegmentSchema = z.object({
  phase: socialIcebreakerPhaseSchema,
  /** Relative weight for UX “energy” meter; compiler uses 1–3 only in v1 */
  energyWeight: z.number().int().min(1).max(3).default(2),
  participation: participationModeSchema.default('pass_ok'),
  /** Soft hint for copy tone; server AI services may read in later tasks */
  tone: z.enum(['gentle', 'playful', 'neutral']).default('gentle'),
});

export const icebreakerRunPlanSchema = z.object({
  version: z.literal(ICEBREAKER_RUN_PLAN_VERSION),
  /** Ordered phases to attempt; server still enforces min player rules per phase */
  segments: z.array(runPlanSegmentSchema).min(1),
  /** Human + machine audit trail */
  rationale: z.string().max(4000).optional(),
  /** Bounded safe context snapshot — no secrets, no phone numbers */
  context: z
    .object({
      poolId: z.string().optional(),
      groupId: z.string().optional(),
      memberCount: z.number().int().min(1),
      eventType: z.string().optional(),
      temperatureLevel: z.string().optional(),
    })
    .strict(),
});

export type IcebreakerRunPlan = z.infer<typeof icebreakerRunPlanSchema>;
export type RunPlanSegment = z.infer<typeof runPlanSegmentSchema>;

export function parseIcebreakerRunPlan(input: unknown): IcebreakerRunPlan {
  return icebreakerRunPlanSchema.parse(input);
}
```

- [x] **Step 2:** Export from the shared package barrel (pattern in repo).

- [x] **Step 3:** Run shared package typecheck (from repo root).

```bash
cd packages/shared && npm run lint 2>/dev/null || npx tsc -p tsconfig.json --noEmit
```

Expected: no TypeScript errors.

---

### Task 2: Persist plans — Drizzle schema + migration

**Files:**

- Modify: [`packages/shared/src/schema.ts`](../../packages/shared/src/schema.ts)
- New SQL under: `apps/server/migrations/` (via generate)

- [ ] **Step 1:** Add table `icebreaker_run_plans` with columns:

- `id` uuid PK default `gen_random_uuid()`
- `scope_type` varchar not null — `'pool_group' | 'blind_box_event'`
- `scope_id` varchar not null
- `plan_version` int not null default `1`
- `plan_hash` varchar(64) not null — sha256 hex of canonical JSON string
- `plan_json` jsonb not null
- `compiler_id` varchar(64) not null default `'deterministic_v0'`
- `created_at`, `updated_at` timestamps
- **Unique index** on `(scope_type, scope_id)`

- [ ] **Step 2:** Generate migration (server workspace).

```bash
cd apps/server && npm run db:generate
```

Inspect the generated SQL for naming consistency with existing migrations.

- [ ] **Step 3:** Apply locally (developer machine only; production uses your pipeline).

```bash
cd apps/server && npm run db:migrate
```

Follow [`database-migration-safety`](../../.github/skills/database-migration-safety/SKILL.md) for staging ordering and rollback notes.

---

### Task 3: Deterministic compiler `deterministic_v0`

**Files:**

- Create: [`apps/server/src/lib/compileIcebreakerRunPlan.ts`](../../apps/server/src/lib/compileIcebreakerRunPlan.ts)
- Create: [`apps/server/src/__tests__/compileIcebreakerRunPlan.test.ts`](../../apps/server/src/__tests__/compileIcebreakerRunPlan.test.ts)

**Optimization rules encoded (v1, explicit):**

- Always include `warmup` first (gentle, `pass_ok`).
- Include `micro_challenge` second (`pass_ok`, energyWeight 2).
- Include `lie_detective` only if `memberCount >= 3`; else omit.
- Include `personality_dice` when `memberCount >= 2` and server config would allow it (read same env toggles conceptually as `getServerEnabledPhases` — either import helper or pass `personalityDiceEnabled: boolean` into compiler from caller).
- Always end with `recap`.
- **Pressure minimization:** cap at **5 segments** total in v1; never include `auction` or `mini_script` unless a **feature flag** `ICEBREAKER_RUNPLAN_ENABLE_EXPERIMENTAL` is true (default false).

- [ ] **Step 1:** Implement `compileDeterministicRunPlan(input): IcebreakerRunPlan` returning parsed object from `parseIcebreakerRunPlan`.

- [ ] **Step 2:** Implement `hashRunPlan(plan: IcebreakerRunPlan): string` using `crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex')` on **canonical** serialization (stable key order: stringify from Zod `.parse` output only).

- [ ] **Step 3:** Vitest — assert 2-member group omits lie_detective; 4-member includes it; experimental flag gates beta phases.

```bash
cd apps/server && npm run test -- --run src/__tests__/compileIcebreakerRunPlan.test.ts
```

Expected: PASS.

---

### Task 4: Repository + post-commit hook (pool match)

**Files:**

- Create: [`apps/server/src/repositories/icebreakerRunPlanRepo.ts`](../../apps/server/src/repositories/icebreakerRunPlanRepo.ts)
- Modify: [`apps/server/src/poolMatchingService.ts`](../../apps/server/src/poolMatchingService.ts)

- [ ] **Step 1:** Repository functions:

- `upsertIcebreakerRunPlan({ scopeType, scopeId, plan, compilerId })`
- `getIcebreakerRunPlan(scopeType, scopeId)`

Use `onConflictDoUpdate` on `(scope_type, scope_id)` if Drizzle supports it in this repo version; otherwise delete+insert inside a transaction.

- [ ] **Step 2:** In `saveMatchResults`, after successful transaction, extend the post-commit loop:

```typescript
// Pseudocode location: alongside themeGenTasks handling (~L1361)
for (const { groupId, memberCount, poolEventType, temperatureLevel, poolId } of compilePlanTasks) {
  void compileAndPersistPoolGroupPlan({ groupId, memberCount, poolEventType, temperatureLevel, poolId })
    .then(() => console.log(`[Pool Matching] icebreaker run plan compiled for group ${groupId}`))
    .catch((err) => console.error(`[Pool Matching] run plan compile failed for ${groupId}`, err));
}
```

Queue `compilePlanTasks` in the same loop where `themeGenTasks.push({ groupId, ... })` with **all fields the compiler needs**.

- [ ] **Step 3:** Log `plan_hash` at info level with `logger.info` (structured) for ops correlation.

---

### Task 5: Wire Social Icebreaker — load plan on start / poll

**Files:**

- Modify: [`apps/server/src/routes/socialIcebreaker.ts`](../../apps/server/src/routes/socialIcebreaker.ts)
- Modify: [`packages/shared/src/socialIcebreaker.ts`](../../packages/shared/src/socialIcebreaker.ts) (`SocialSessionState` extension)
- Possibly modify: [`apps/server/src/lib/icebreakerAccess.ts`](../../apps/server/src/lib/icebreakerAccess.ts) if a helper is needed to resolve `groupId` from `icebreakerSessionId`

**Behavior:**

1. When creating **new** `SocialSessionState`, after `requireAuthenticatedUserId` and access check, load `icebreaker_sessions` row by `sessionId` body param.
2. If `session.groupId`, fetch `icebreaker_run_plans` for `('pool_group', groupId)`.
3. If found, set on state:

- `state.runPlan = sanitizedPlan` (strip `rationale` if you want it host-only; **v1:** send full plan—it contains no secrets if compiler obeys rules)
- `state.runPlanHash = ...`
- Derive `state.enabledPhases` **or** `state.resolvedPhaseOrder` = `segments.map(s => s.phase)` filtered through existing `getNextEligiblePhase` compatibility (dedupe consecutive duplicates, drop phases below min players).

4. On **existing** session join path, if plan was missing at creation time but exists now, **optional v1.1:** merge on read in `buildClientState` (document choice).

- [ ] **Step 1:** Extend `SocialSessionState` interface with optional fields; ensure `sanitizeStateForClient` does not strip them.

- [ ] **Step 2:** Adjust **advance** route: when computing `effectiveNextPhase`, if `state.resolvedPhaseOrder` is set, use **next index in that array** instead of global `PHASE_ORDER` **only for phases present in the plan** (fallback to current behavior if absent).

Pseudo-logic:

```typescript
function nextPlannedPhase(state, current): SocialIcebreakerPhase | null {
  const order = state.resolvedPhaseOrder;
  if (!order?.length) return null;
  const idx = order.indexOf(current);
  if (idx === -1) return null;
  return order[idx + 1] ?? 'recap';
}
```

Merge with `getNextEligiblePhase` so min-player skips still apply.

- [ ] **Step 3:** Extend `socialIcebreakerRoutes.test.ts` with fixture: insert fake `icebreaker_run_plans` row + `icebreaker_sessions` + start session → response includes `runPlan`.

```bash
cd apps/server && npm run test -- --run src/__tests__/socialIcebreakerRoutes.test.ts
```

---

### Task 6: Client parity (read-only)

**Files:**

- Modify: [`apps/user-client/src/hooks/useSocialIcebreaker.ts`](../../apps/user-client/src/hooks/useSocialIcebreaker.ts)
- Modify: [`apps/user-client/src/components/social-icebreaker/SocialIcebreakerOrchestrator.tsx`](../../apps/user-client/src/components/social-icebreaker/SocialIcebreakerOrchestrator.tsx)
- Modify: [`apps/mini-program/src/pages/icebreaker-session/index.tsx`](../../apps/mini-program/src/pages/icebreaker-session/index.tsx)

- [ ] **Step 1:** Plumb `state.runPlan` through hook typings (infer from API or add explicit type import from `@shared/socialIcebreaker`).

- [ ] **Step 2:** Render a compact **“Flow tonight”** strip (chips with phase labels) using existing design tokens—no new animation library.

- [ ] **Step 3:** Manual smoke: start dev server, open `/icebreaker/:sessionId` with a pool-group session that has a persisted plan.

---

### Task 7: Internal visibility (catalog read-only)

**Files (choose minimal path approved by you):**

- Option A: **SQL / admin script** only in v1 (`docs/icebreaker-system.md` query examples).
- Option B: Admin route `GET /api/admin/icebreaker-run-plans/:scopeType/:scopeId` with `requireAdmin` + audit log per [`admin-audit-and-rbac-governance`](../../.github/skills/admin-audit-and-rbac-governance/SKILL.md).

- [ ] **Step 1:** Implement Option A **or** B; document in `docs/icebreaker-system.md`.

---

### Task 8: Blind box parity (optional Phase 2)

**Trigger discovery task (required before coding):**

- [ ] **Step 1:** Search codebase for where `blind_box_events` transitions to matched and matched attendees are written; mirror the post-commit compile call with `scope_type = 'blind_box_event'`.

```bash
rg "blind_box_events" apps/server/src -n | head -n 40
```

- [ ] **Step 2:** If trigger is clean, call the same `upsertIcebreakerRunPlan` with compiler context from event fields.

---

### Task 9: Handoff doc for Game Design → Game Dev agents

**Files:**

- Create: [`docs/superpowers/specs/2026-04-21-icebreaker-run-plan-handoff.md`](../../docs/superpowers/specs/2026-04-21-icebreaker-run-plan-handoff.md)

Contents checklist:

- JSON Schema / Zod excerpt for `IcebreakerRunPlan`
- **Participation semantics** table (`pass_ok` means server advance rules must not hard-block on one user—link to follow-up tasks for warmup quorum).
- **Test matrix** (2, 3, 4, 8 players; host reconnect; session TTL expiry)
- **Template map:** phase name → React subtree in `SocialIcebreakerOrchestrator`
- **Novel mechanic process:** add `templateId` to segment schema in v2 **only after** Task 5 ships

---

### Task 10: Observability

**Files:**

- Modify: [`apps/server/src/lib/compileIcebreakerRunPlan.ts`](../../apps/server/src/lib/compileIcebreakerRunPlan.ts) (metrics hooks if repo has a pattern)
- Follow: [`platform-observability-and-ops`](../../.github/skills/platform-observability-and-ops/SKILL.md)

- [ ] **Step 1:** Emit structured logs: `icebreaker.run_plan.compiled` with `{ scopeType, scopeId, planHash, segmentCount, compilerId }`.

- [ ] **Step 2:** Emit `icebreaker.run_plan.missing_on_start` at warn level when group expects a plan but DB has none (indicates compile failure).

---

## Execution handoff (per writing-plans skill)

**Plan complete and saved to** `docs/superpowers/plans/2026-04-21-icebreaker-compilation-implementation-plan.md`.

**Two execution options:**

1. **Subagent-driven (recommended)** — fresh subagent per task, review between tasks. **Sub-skill:** superpowers:subagent-driven-development.
2. **Inline execution** — same session, batch tasks with checkpoints. **Sub-skill:** superpowers:executing-plans.

**Which approach do you want?**

---

## Spec coverage matrix (workflow → tasks)

| Workflow | Tasks |
|----------|-------|
| Trigger on match completed | Task 4 |
| Compilation | Tasks 1, 3 |
| Optimization + constraint + quality | Task 3 rules + Task 5 merge rules |
| Customization | Task 3 `context` + Task 4 inputs (extend with profile summaries later) |
| Handoff | Task 9 |
| Dev execution / templates | Tasks 5–6 + Task 9 template map |
