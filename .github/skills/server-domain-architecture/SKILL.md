---
name: Server Domain Architecture
description: routes.ts as composition root, routes/domains/* ownership, repositories/* for new persistence logic, and storage.ts as a compatibility facade. Use when adding server routes, services, or data access code.
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
