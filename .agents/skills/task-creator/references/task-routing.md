# Task Routing Reference

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
