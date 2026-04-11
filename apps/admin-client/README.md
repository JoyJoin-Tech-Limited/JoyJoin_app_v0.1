# Admin Client Workspace

This workspace contains JoyJoin's separate admin portal, built with React + Vite and deployed independently from the user client.

## Source-of-truth entry points

- `apps/admin-client/src/main.tsx` — Vite bootstrap
- `apps/admin-client/src/AdminApp.tsx` — admin route composition and providers
- `apps/server/src/routes/domains/admin.ts` — server-side admin API ownership
- `docs/admin-rbac-matrix.md` — role/permission matrix

## Where new files go

- **New admin route/page:** `apps/admin-client/src/pages/admin/`
- **Admin-local reusable UI:** `apps/admin-client/src/components/`
- **Shared contracts or shared UI primitives:** `packages/shared/src/`
- **Server-side admin logic:** `apps/server/src/routes/domains/admin.ts` or the nearest server repository/service layer

## Common commands

```bash
npm run dev -w @joyjoin/admin-client
npm run typecheck -w @joyjoin/admin-client
npm run test -w @joyjoin/admin-client
```

## Related docs

- [`../../docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md)
- [`../../docs/README.md`](../../docs/README.md)
- [`../../apps/server/src/README.md`](../../apps/server/src/README.md)
- [`../../.github/skills/frontend-component-architecture/SKILL.md`](../../.github/skills/frontend-component-architecture/SKILL.md)
