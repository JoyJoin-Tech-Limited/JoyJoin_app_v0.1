---
name: server-domain-architecture
description: >
  routes.ts as composition root, routes/domains/* ownership, repositories/* for new persistence
  logic, and storage.ts as a compatibility facade. Use when adding server routes, services, or data
  access code. Trigger phrases: "add a new API route", "where does this service go?", "migrate
  logic from storage.ts", "add a repository", "routes.ts is getting too large".
---

# Server Domain Architecture

**Core rule:** `routes.ts` is the composition root. Domain logic lives in
`routes/domains/`. New persistence logic lives in `repositories/`. Do not expand
`storage.ts` with new logic — it is a compatibility facade.

## When to use this skill

- Adding a new API endpoint or route group
- Adding or modifying server-side data access
- Deciding where a new service or helper should live
- Reviewing a PR that changes `routes.ts` or `storage.ts`

## Layered structure

```
apps/server/src/
├── routes.ts              ← Composition root
├── routes/domains/        ← Domain routers
├── repositories/          ← New persistence logic
├── storage.ts             ← Compatibility facade
├── lib/                   ← Cross-cutting helpers
└── middleware/            ← Express middleware
```

- **routes.ts** — mounts domain routers; avoid inline handlers
- **routes/domains/** — each domain owns its handlers, validation, and service calls
- **repositories/** — new queries live here; prefer plain TS functions with `db`/`tx`
- **storage.ts** — compatibility facade; do not add new logic

For the domain ownership table, `storage.ts` deprecation notes, new-domain
onboarding checklist, and MCP integration guidance, see
[`references/domain-guide.md`](./references/domain-guide.md).

## Quick examples

**"Add `POST /api/payments/create`"**
→ Create/extend `routes/domains/payments.ts`, add query to
  `repositories/paymentsRepo.ts`, mount the router in `routes.ts`, keep
  `storage.ts` unchanged.

**"Modify a legacy helper in `storage.ts`"**
→ Move logic into `repositories/paymentsRepo.ts`, update `storage.ts` to
  delegate, and make the change there. Do not add new code to `storage.ts`.

## Troubleshooting

**Business logic accumulating in `routes.ts`**
→ Extract to `routes/domains/<domain>.ts` and mount via `router` in `routes.ts`.

**Repository and `storage.ts` confusion**
→ Move the new query to the appropriate `repositories/` file and have
   `storage.ts` delegate.

**Cross-domain repository import**
→ Move shared data access to `lib/` or expose it via a well-defined interface.

**New middleware is inside a domain file**
→ Express middleware belongs in `middleware/`, not `routes/domains/`.

## Review checklist

- [ ] New route handlers live in `routes/domains/<domain>.ts`, not inline in `routes.ts`
- [ ] New persistence logic is in `repositories/`, not added directly to `storage.ts`
- [ ] `routes.ts` mounts the new domain router — it does not inline handler logic
- [ ] Cross-cutting helpers go in `lib/`, not domain files
- [ ] Express middleware is placed in `middleware/`, not route handlers
- [ ] `storage.ts` public surface is not expanded with new methods

## Related files

- `apps/server/src/routes.ts`
- `apps/server/src/storage.ts`
- `apps/server/src/routes/domains/`
- `apps/server/src/repositories/`
- `apps/server/src/lib/`
- `apps/server/src/middleware/`
- [`references/domain-guide.md`](./references/domain-guide.md)
