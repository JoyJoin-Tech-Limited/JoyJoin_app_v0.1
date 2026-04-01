---
name: server-domain-architecture
description: >
  routes.ts as composition root, routes/domains/* ownership, repositories/* for new persistence
  logic, and storage.ts as a compatibility facade. Use when adding server routes, services, or data
  access code. Trigger phrases: "add a new API route", "where does this service go?", "migrate
  logic from storage.ts", "add a repository", "routes.ts is getting too large".
---

# Server Domain Architecture

**Core rule:** `routes.ts` is the composition root. Domain logic lives in `routes/domains/`. New persistence logic lives in `repositories/`. Do not expand `storage.ts` with new logic — it is a compatibility facade.

## When to use this skill

- Adding a new API endpoint or route group
- Adding or modifying server-side data access
- Deciding where a new service or helper should live
- Reviewing a pull request that changes `routes.ts` or `storage.ts`

## Layered structure

```
apps/server/src/
├── routes.ts                   ← Composition root: mounts domain routers and still contains some legacy inline handlers
├── routes/
│   └── domains/                ← Domain routers (auth, onboarding, assessment,
│       ├── auth.ts               analytics, admin, payments, icebreaker, …)
│       ├── onboarding.ts
│       └── …
├── repositories/               ← Domain data access (new persistence logic goes here)
├── storage.ts                  ← Compatibility facade — composed from repositories/*
├── lib/                        ← Cross-cutting helpers (logger, adminAuditLogger, …)
└── middleware/                 ← Express middleware (auth, requestId, metrics, …)
```

## routes.ts — composition root

- `routes.ts` is the composition root: it mounts domain routers and global middleware, but still contains some legacy inline handlers
- When adding a new API domain, create `routes/domains/<domain>.ts` and mount it in `routes.ts`
- Avoid growing inline handler blocks inside `routes.ts` — extract new work into a domain module and migrate old inline handlers incrementally

## routes/domains/* — domain ownership

- Each domain module owns its route handlers, validation, and service calls for that domain
- Auth gating, validation middleware, and response shaping belong here, not in `routes.ts`
- Imports from `repositories/` or existing service files — not from `storage.ts` for new logic

## repositories/* — new persistence logic

- New persistence logic (queries, inserts, updates) lives in the nearest domain repository
- Existing repositories often import the singleton `db` directly; for new code, prefer plain TypeScript functions that can also accept a `db`/`tx` dependency when transactional composition matters
- Do not add new database query logic directly to `storage.ts`
- When migrating logic from `storage.ts`, extract to a repository first, then update `storage.ts` to delegate

## storage.ts — compatibility facade

- `storage.ts` is composed from `repositories/*` and exists for backward compatibility
- Existing callsites that already use `storage.*` can remain — do not break them without a migration plan
- Do not add new public methods to `storage.ts` — add to the appropriate repository instead
- `storage.ts` is a seam for incremental extraction, not the intended long-term home for persistence logic

## Operational entry points

Standalone auth and CLI modules remain at the `apps/server/src/` root:

- `wechatAuth.ts` — WeChat OAuth2 flow
- `phoneAuth.ts` — SMS phone auth (legacy fallback)
- `adminAuth.ts` — admin authentication
- `auth/policy.ts` — env/debug auth policy helpers

## lib/ — cross-cutting helpers

- `lib/logger.ts` — structured JSON logger
- `lib/adminAuditLogger.ts` — audit event logger
- `lib/aiTraceLogger.ts` — AI trace logger
- `lib/socialIcebreakerStore.ts` — PostgreSQL-backed persistence for icebreaker sessions, participants, and lie-truths (all icebreaker session reads/writes go through this module)
- New cross-cutting utilities belong in `lib/`, not inlined in routes

## middleware/

- `middleware/requestId.ts` — request correlation IDs
- `middleware/metrics.ts` — Prometheus metrics middleware
- Express middleware belongs here — not in `routes.ts` or domain files

## Common mistakes to avoid

- Adding inline handler logic to `routes.ts` instead of creating a domain module
- Adding new database queries directly to `storage.ts`
- Bypassing domain repositories by importing `db` directly in route handlers
- Creating a new service that imports from another domain's repository (use shared `lib/` instead)
- Placing cross-cutting middleware logic inside a domain file

## Related files

- `apps/server/src/routes.ts`
- `apps/server/src/storage.ts`
- `apps/server/src/routes/domains/`
- `apps/server/src/repositories/`
- `apps/server/src/lib/`
- `apps/server/src/middleware/`
- `apps/server/src/README.md`
- `docs/architecture/current-state.md`

## Quick examples

**User says:** "Add a `POST /api/payments/create` endpoint."
**Apply this skill by:** Creating (or extending) `routes/domains/payments.ts` for the handler, adding the persistence query to `repositories/paymentsRepo.ts`, mounting the domain router in `routes.ts`, and keeping `storage.ts` unchanged.
**Result:** New handler is in the correct domain module; `routes.ts` stays lean and `storage.ts` is not expanded.

---

**User says:** "There is a legacy payment helper in `storage.ts` — I need to modify it."
**Apply this skill by:** Moving the logic into `repositories/paymentsRepo.ts`, updating `storage.ts` to delegate to the repository, and making the change there. Do not add new code to `storage.ts` directly.
**Result:** Logic lives in a maintainable repository; `storage.ts` becomes a thinner facade.

## Troubleshooting

- **Business logic accumulating in `routes.ts`** — inline handler blocks are growing instead of being extracted to a domain module. Create `routes/domains/<domain>.ts`, move the handlers there, and mount via `router` in `routes.ts`.
- **Repository and `storage.ts` confusion** — a developer added a new query to `storage.ts` instead of a repository. Move the query to the appropriate `repositories/` file and have `storage.ts` delegate.
- **Cross-domain repository import** — one domain module is importing directly from another domain's repository. Move shared data access to a shared service in `lib/` or expose it via a well-defined interface.
- **New middleware is inside a domain file** — Express middleware belongs in `middleware/`, not `routes/domains/`. Move it and register it in `routes.ts`.

## Review checklist

- [ ] New route handlers live in `routes/domains/<domain>.ts`, not inline in `routes.ts`
- [ ] New persistence logic is in `repositories/`, not added directly to `storage.ts`
- [ ] `routes.ts` mounts the new domain router — it does not inline the handler logic
- [ ] Cross-cutting helpers go in `lib/`, not domain files
- [ ] Express middleware is placed in `middleware/`, not route handlers
- [ ] `storage.ts` public surface is not expanded with new methods
