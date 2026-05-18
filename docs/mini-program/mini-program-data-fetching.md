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

## Predictive Shell prefetch pattern (2026-05-17)

The mini-program uses **composite shell endpoints** to reduce tab-switch latency. Instead of fetching tab data on first mount, the landing page prefetches composite responses and injects them into the target query keys.

| Shell endpoint | Injected query keys | Staged delay |
|----------------|---------------------|--------------|
| `GET /api/shell/discover` | `AUTH_QUERY_KEY`, discover data | 1.5s after landing entry |
| `GET /api/shell/profile` | `AUTH_QUERY_KEY`, `COUPONS_QUERY_KEY`, profile stats | 4s after landing entry |
| `GET /api/shell/events` | `AUTH_QUERY_KEY` (gated), `['mini-program', 'joined-events']`, notification counts | 3s after landing entry |
| `GET /api/shell/connections` | `AUTH_QUERY_KEY` (gated), `['mini-program', 'connections']`, notification counts | 5s after landing entry |

**Client-side fetchers:** `apps/mini-program/src/lib/api/api.ts` — `fetchDiscoverShell()`, `fetchProfileShell()`, `fetchEventsShell()`, `fetchConnectionsShell()`

**Prefetch engine:** `apps/mini-program/src/lib/prefetchEngine.ts` — stages named prefetches with configurable delays, gates on auth/network/device tier, and injects composite responses into existing TanStack Query keys.

**Cache invalidation:** Server-side `shellCache.invalidateUser(userId)` is called on mutations (payment fulfillment, pool registration, connection creation, assessment completion). This clears all cached shells for the user.

**Fallback behavior:** Events and Connections pages fall back to legacy endpoints (`/api/events/joined`, `/api/my-connections`) if the composite endpoint returns 500.

## Verification

- `npm run typecheck -w mini-program`
- For AI-touched flows: [`docs/runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md)

## Related

- [`apps/mini-program/README.md`](../apps/mini-program/README.md) — workspace entry
- [`docs/reference/reference/PLATFORM_COORDINATION.md`](./reference/PLATFORM_COORDINATION.md) — shared API contracts with web
