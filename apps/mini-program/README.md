# Mini-Program Workspace

This workspace contains JoyJoin's Taro + React WeChat Mini Program client.

## Source-of-truth entry points

- `apps/mini-program/src/app.ts` — app lifecycle entry
- `apps/mini-program/src/app.config.ts` — route and page registration
- `apps/mini-program/src/lib/api.ts` — mini-program auth/API bootstrap surface
- `docs/PLATFORM_COORDINATION.md` — canonical coordination playbook for duplicated auth, API, and payment flows

## Coordination rules

- Treat the mini-program as the strongest current reference for payment mechanics.
- Before changing auth/session, API wrapper behavior, or payment flow here, review the matching web surface in `apps/user-client` and the guidance in [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md).
- Keep mini-program runtime wiring here, but move genuinely shared contracts toward `packages/shared/src/`.

## Where new files go

- **New mini-program page:** `apps/mini-program/src/pages/`
- **Mini-program runtime helpers:** `apps/mini-program/src/lib/`
- **App-level registration/config:** `apps/mini-program/src/app.ts` and `apps/mini-program/src/app.config.ts`
- **Shared contracts/constants:** `packages/shared/src/`

## Common commands

```bash
npm run build:weapp --workspace=mini-program
npm run dev:weapp --workspace=mini-program
```

## Related docs

- [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md)
- [`../../docs/wechat-mini-program-reference.md`](../../docs/wechat-mini-program-reference.md)
- [`../../.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md)
