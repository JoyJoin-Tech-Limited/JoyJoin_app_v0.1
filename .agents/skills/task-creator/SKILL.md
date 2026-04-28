---
name: task-creator
description: Automatically structure and route every new task or feature request in the JoyJoin project. Use whenever the user asks to build, fix, add, change, refactor, investigate, implement, optimize, audit, or explore anything — no matter how vague or specific. Parses the goal into a one-sentence mission brief (dumb-CEO readable), maps affected areas, flags cross-platform concerns, surfaces blockers, and recommends the correct orchestration lane (Direct, Kickoff, Deliberation, Harness, or Operational).
---

# Task Polish & Route

Take the user's raw request and turn it into a crystal-clear mission brief with a lane recommendation. Write like you're explaining to a busy CEO who codes by vibe — no jargon, no fluff.

## Output Format

Always produce exactly this structure:

```
**Task:** [one-sentence mission]

**What you really want (fundamental intent):**
[Look past the surface request. What underlying need, pain, or outcome is driving this? If the user said "fix the button color," maybe what they really want is "users aren't noticing the primary action." If they said "add a loading spinner," maybe what they really want is "users think the app is broken while waiting." State the deeper need in plain English.]

**Context:**
- Affected area: [icebreaker / pools / onboarding / payments / auth / matching / personality / admin / notifications / venues / semantic-matching / other / not sure yet]
- I expect to touch: [workspaces/files, or "not sure yet"]
- Sibling platform review needed? [yes / no / not sure]
  - (If yes: flag which surfaces — mini-program, admin, or both. Web is reference-only, not a launch target.)
- Upstream plan: [link or "none"]
- **Harness tier:** [1 / 2 / 3 / not sure yet]
  - Tier 1 = small, bounded, ≤50 lines, 1 workspace
  - Tier 2 = new route, multi-file, auth, stateful op, migration, UI flow
  - Tier 3 = core engine, payment, >5 core files, architectural boundary
- **Sprint Contract required?** [yes / no]
  - Yes for Tier 2+ tasks. No for Tier 1.

**Ripple effect (举一反三):**
[Look one step beyond the immediate fix. What adjacent areas, similar patterns, or related flows should we also polish while we're here? Examples: "The same broken pattern exists on 3 other screens," "This API change should also update the admin dashboard," "We should apply this same interaction pattern to the onboarding flow." If nothing obvious, say "No obvious ripples — fix is localized."]

**Blocker / question:**
[State the biggest unknown, risk, or dependency — or "need lane selection and routing"]
```

Then append:

```
**Recommended lane:** [lane name]
**Why:** [one-line reason in plain English]
```

## Lane Selection Rules

Pick ONE lane based on these simple tests:

| Lane | When to pick it | Plain-English test |
|------|----------------|-------------------|
| **Direct** | You know exactly what file to edit, the change is small, and nothing else breaks. | "Can I do this in one sitting without asking anyone?" |
| **Kickoff** | The request is vague, touches multiple apps/packages, or needs a plan before code. | "Do I need to figure out WHAT to build before I build it?" |
| **Deliberation** | The change crosses multiple domains (e.g., DB + matching + UI), has high blast radius, or needs multiple perspectives. | "Could this blow up three different systems?" |
| **Harness** | Core engine changes (personality, matching, scoring), needs pre-validated quality, or user explicitly asked for Harness. | "Is this the brain of the product?" |
| **Operational** | Validating, smoke-testing, release-checking, or reviewing a dirty worktree. | "Are we checking if it's safe to ship?" |

### Completion Gate (all lanes)

Every implementation task — regardless of lane — must run the **Harness Completion Gate** before claiming "done":

```bash
npm run harness:gate
```

This checks the 5 Harness pillars (Reliability, Scalability, Security, Observability, Maintainability) against changed code. **Do not declare a task complete until the gate passes.** Load the [`harness-completion-gate`](../harness-completion-gate/SKILL.md) skill for the full checklist.

## How to Parse the User's Goal

1. **Find the verb** — build, fix, add, change, refactor, investigate, implement, optimize, audit, explore, remove, migrate, etc.
2. **Find the noun** — what thing is being acted on (a screen, an API, a table, a flow, a bug).
3. **Find the "so that"** — if the user didn't say it, infer the business outcome (e.g., "so users can pay faster", "so matching stops breaking").
4. **Condense into one sentence** using this formula:  
   `[Verb] [the noun] so that [the outcome].`

## Mapping Affected Areas

Use this quick cheat sheet:

- User sees it → `mini-program` (launch-primary). `user-client` is reference-only, not shipping.
- Admin sees it → `admin-client`
- API / DB / business logic → `server`
- Shared types / schemas → `packages/shared`
- Registration flow → `onboarding`
- Personality quiz / archetypes → `personality`
- Group formation / scoring → `matching`
- Event creation / pools → `pools`
- In-event social flow → `icebreaker`
- Paying / refunds / credits → `payments`
- Login / sessions / permissions → `auth`
- Venues / maps / locations → `venues`
- AI / LLM features → `semantic-matching` or `llm-runtime`
- Notifications / broadcasts → `notifications`

If unsure, say "not sure yet" — never guess wildly.

## Cross-Platform (Sibling Review)

JoyJoin is **mini-program-first and mini-program-only** for launch. The web app (`user-client`) exists only as a reference / development sandbox — it is NOT a shipping product.

Flag `yes` for sibling review if the change:
- Adds or changes an API contract consumed by both **mini-program** and **admin**
- Touches shared packages that both surfaces depend on
- Touches auth, payments, or onboarding flows that have admin counterparts

Flag `no` if it's purely server-internal, mini-program-only, or admin-only.

**Important:** Never treat `user-client` (web) as a sibling platform that needs parity review. If the user mentions web, note it as "reference basis only — not shipping."

## Examples

### Example 1 — Vague request

User: "the matching feels off lately"

Output:
```
**Task:** Investigate why matching quality feels degraded so we can fix the root cause.

**What you really want (fundamental intent):**
Users aren't getting groups they vibe with, which kills retention and word-of-mouth. The surface complaint is "matching is off" but the real pain is users leaving disappointed after signing up.

**Context:**
- Affected area: matching
- I expect to touch: apps/server (matching logic), possibly packages/shared (scoring constants)
- Sibling platform review needed? no
  - (This is server-side scoring only)
- Upstream plan: none

**Ripple effect (举一反三):**
- Check if the same scoring weights affect the "compatibility preview" users see before registering
- Review whether venue assignment logic is compounding the mismatch (wrong venue type for the group chemistry)
- Look at post-event feedback data — are users actually complaining about matching, or is it actually about the host/venue/atmosphere?

**Blocker / question:**
Need to define what "feels off" means — lower chemistry scores? More unmatched users? Specific pool or global?

**Recommended lane:** Kickoff
**Why:** We need to research and define the problem before writing any fix.
```

### Example 2 — Specific request

User: "add a refund button to the admin payment page"

Output:
```
**Task:** Add a refund button to the admin payment page so operators can process refunds without backend access.

**What you really want (fundamental intent):**
The user wants to reduce support overhead and refund turnaround time. Right now someone probably has to DM an engineer or run a SQL query to issue a refund. The real win is empowering non-technical staff to handle payment issues in under 60 seconds.

**Context:**
- Affected area: payments / admin
- I expect to touch: apps/admin-client (payment page UI), apps/server (refund API route)
- Sibling platform review needed? no
  - (Admin-only feature)
- Upstream plan: none

**Ripple effect (举一反三):**
- Should we also add a "refund reason" dropdown so we can track WHY refunds happen (bug, no-show, user request, etc.)?
- The same permission pattern (who can touch money) probably needs auditing across all admin payment surfaces
- Consider whether users should get an in-app notification when their refund is processed

**Blocker / question:**
Need to confirm refund permissions — is this super_admin only or any operator?

**Recommended lane:** Direct
**Why:** Bounded UI + API change with clear scope.
```

### Example 3 — Ambitious request

User: "redo the whole personality system to use 16 types instead of 12"

Output:
```
**Task:** Migrate the personality engine from 12 archetypes to 16 types so the assessment feels more nuanced.

**What you really want (fundamental intent):**
The user believes the current 12-archetype result feels too generic and doesn't create enough "that's so me" moments. The deeper need is stronger user delight during onboarding and more shareable personality results that users want to post or talk about.

**Context:**
- Affected area: personality / onboarding / matching
- I expect to touch: packages/shared (personality engine, archetype colors, schema), apps/server (assessment API), apps/mini-program (result screens), apps/admin-client (analytics)
- Sibling platform review needed? yes
  - (Mini-program + admin both display archetype data; web is reference-only, not shipping)
- Upstream plan: none

**Ripple effect (举一反三):**
- If we add 4 new archetypes, do we need 4 new mascot illustrations / color tokens / share cards? That's a design pipeline blocker
- The chemistry matrix (who matches well with whom) grows from 12×12 to 16×16 — that's 256 compatibility scores to define, not 144
- Consider whether this is actually the right lever: would adaptive question depth or richer result storytelling create more delight with less engineering cost?
- Existing users already have 12-type results — what's the migration story? Do we re-assess everyone or grandfather them?

**Blocker / question:**
This changes the product's core identity — needs product sign-off and a migration plan for existing user profiles.

**Recommended lane:** Deliberation
**Why:** Cross-domain blast radius; changes core engine + all client surfaces + existing user data.
```

## Tone Rules

- Use plain English. No acronyms unless they're unavoidable (and even then, spell them out once).
- The "dumb CEO" should nod and say "got it" after reading the Task line.
- If the user's request is already crystal clear, still run it through this format — it takes 5 seconds and prevents misalignment.
- Never skip the lane recommendation. If truly uncertain between two lanes, say so and explain the tie-breaker.
