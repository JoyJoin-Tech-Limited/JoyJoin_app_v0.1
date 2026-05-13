# Mini-program data fetching — query keys & invalidation

**Audience:** Engineers working on the WeChat mini-program (`apps/mini-program`).  
**Phase 0 baseline** per [`docs/proposals/mini-program-cleanup-and-upgrade-plan.md`](./proposals/mini-program-cleanup-and-upgrade-plan.md).

## Convention

React Query keys for MP-specific fetches use a **`mini-program` prefix** as the first segment so they never collide with web or other clients in shared debugging:

```text
['mini-program', <domain>, ...params]
```

## Common keys

| Domain | Example key | Typical invalidation |
|--------|-------------|----------------------|
| Single pool registration | `['mini-program', 'pool-registration', registrationId]` | After WS `POOL_MATCHED`, `EVENT_THEME_TITLE_REVEALED`; manual refresh |
| Pool fill (waiting) | `['mini-program', 'pool-group-fill', poolId]` | After WS `POOL_REGISTRATION_ADDED`; refresh waiting |
| Group details | `['mini-program', 'pool-group', groupId]` | After match + theme events targeting that group |
| Group analysis (AI) | `['mini-program', 'pool-group-analysis', groupId]` | After WS `EVENT_THEME_TITLE_REVEALED` (with `groupId`); also when group details invalidation must pull fresh explanations |
| My registrations list | `['mini-program', 'my-pool-registrations']` | After theme reveal / registration changes |
| Similar pools (no-match) | `['mini-program', 'similar-pools', poolCity, poolEventType]` | Rare |

## Verification

- `npm run typecheck -w mini-program`
- For AI-touched flows: [`docs/runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md)

## Related

- [`apps/mini-program/README.md`](../apps/mini-program/README.md) — workspace entry
- [`docs/reference/reference/PLATFORM_COORDINATION.md`](./reference/PLATFORM_COORDINATION.md) — shared API contracts with web
