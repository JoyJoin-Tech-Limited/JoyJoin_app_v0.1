# Extended Examples

Real-world subagent delegation patterns from the JoyJoin codebase.

---

## Example 1: Onboarding flow audit (parallel explore)

**Parent mission:** Audit why users are dropping off during onboarding.

**Parallel swarm launched:**

1. **Agent A** — `explore` — "Find onboarding route handlers"
   ```
   Context: users drop off during onboarding. We suspect the step transition logic.
   Task: Find all route handlers under /api/onboarding/* and the nextStep logic.
   Return: file paths, route definitions, and any conditional branching.
   ```

2. **Agent B** — `explore` — "Find onboarding client screens"
   ```
   Context: users drop off during onboarding.
   Task: Find all onboarding screens in apps/mini-program/src/pages/onboarding/.
   Return: screen list, navigation flow, and any guards that redirect users.
   ```

3. **Agent C** — `explore` — "Find onboarding analytics events"
   ```
   Context: users drop off during onboarding.
   Task: Find where onboarding step events are tracked and whether there's a funnel query.
   Return: tracking calls, event names, and any dashboard/report query.
   ```

**Parent receives three summaries, then launches a single `coder` agent with a consolidated capsule to implement fixes.**

---

## Example 2: Resume after schema discovery (resume pattern)

**Step 1:** Discover existing tables.
```
Agent({ subagent_type: "explore", description: "Schema discovery",
  prompt: "Find all tables related to event pools, registrations, and matching in the Drizzle schema." })
// Returns agent_id "schema-disc-01"
```

**Step 2:** Deep dive on pool registration table.
```
Agent({ resume: "schema-disc-01", description: "Registration table deep dive",
  prompt: "From your previous search, focus on the pool_registrations table.\n" +
          "Find: all columns, indexes, foreign keys, and any triggers.\n" +
          "Also check if there's a status enum and what values it permits." })
```

**Step 3:** Fresh agent for implementation (not a resume — topic changed).
```
Agent({ subagent_type: "coder", description: "Add registration status",
  prompt: "Context capsule:\n" +
          "- We need to add a 'waitlisted' status to pool registrations.\n" +
          "- Table: pool_registrations (found in previous exploration).\n" +
          "- Current statuses: pending, confirmed, cancelled.\n" +
          "- Must not break existing queries that filter by status.\n" +
          "- Add migration-safe change only.\n\n" +
          "Task: Update the enum/schema and any affected queries." })
```

---

## Example 3: Keeping parent lean (parent hygiene)

**Anti-pattern (don't do this):**
```
// Parent reads 15 files manually
ReadFile({ path: "apps/server/src/routes/auth.ts" })
ReadFile({ path: "apps/server/src/middleware/auth.ts" })
// ... 13 more files
// Now parent context is huge
// Only then delegates
Agent({ prompt: "Fix the auth bug..." })
```

**Correct pattern:**
```
// Parent delegates discovery immediately
Agent({ subagent_type: "explore", description: "Auth bug discovery",
  prompt: "Users report intermittent 403 on /api/events. Find auth middleware, route guards, and any recent changes to session handling." })

// Parent receives compact summary (3–5 lines)
// Parent then delegates fix with focused capsule
Agent({ subagent_type: "coder", description: "Auth bug fix",
  prompt: "Context: intermittent 403 on /api/events.\n" +
          "Root cause found: session expiry check missing in requireAuth middleware.\n" +
          "File: apps/server/src/middleware/auth.ts.\n" +
          "Task: Add session expiry validation. Do not change other middleware." })
```

---

## Example 4: Plan subagent for migration

```
Agent({ subagent_type: "plan", description: "Migration plan",
  prompt: "Context capsule:\n" +
          "- We need to migrate from 12 to 16 archetypes in the personality system.\n" +
          "- Current: packages/shared/src/personality/archetypes.ts, 12 entries.\n" +
          "- DB table user_profiles has archetype_id (integer, 1–12).\n" +
          "- Constraints: existing users must keep valid archetypes; no downtime.\n" +
          "- Out of scope: UI changes, new mascot illustrations.\n\n" +
          "Task: Propose a safe migration plan. Consider: schema change, data backfill, rollback strategy." })
```
