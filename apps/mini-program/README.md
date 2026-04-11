# Mini-Program Workspace

This workspace contains JoyJoin's Taro 4 + React 18 WeChat Mini Program client.

The mini-program is the **beta production client** for JoyJoin, targeting WeChat users in Hong Kong and Shenzhen. It mirrors the user-facing feature set of `apps/user-client` and shares business rules via `packages/shared`.

## Source-of-truth entry points

- `apps/mini-program/src/app.ts` — app lifecycle entry; wraps all pages in `AuthProvider → DynamicAccentProvider → AchievementProvider` with `AchievementPopup` at root level
- `apps/mini-program/src/app.config.ts` — route and page registration; sources page list from `lib/onboardingRoutes.ts` via `MINI_PROGRAM_PAGES`
- `apps/mini-program/src/lib/api.ts` — mini-program API transport (supports GET/POST/PATCH/PUT/DELETE; conforms to the shared `ApiTransport` interface)
- `docs/PLATFORM_COORDINATION.md` — canonical coordination playbook for auth, API, and payment flows shared with the web client

## Tab navigation (canonical)

The mini-program has a **4-tab `tabBar`** defined in `app.config.ts`. Tab pages **must** use `Taro.switchTab()` to navigate; `Taro.navigateTo()` / `Taro.redirectTo()` will fail for tab destinations.

| Tab | Label | Page path |
|-----|-------|-----------|
| 1 | 发现 | `pages/discover/index` |
| 2 | 活动 | `pages/events/index` |
| 3 | 连接 | `pages/connections/index` |
| 4 | 我的 | `pages/profile/index` |

## Pages

All pages are registered in `lib/onboardingRoutes.ts` via `MINI_PROGRAM_PAGES` and sourced into `app.config.ts`.

### Onboarding
| Page path | Description |
|-----------|-------------|
| `pages/onboarding/onboarding/index` | Onboarding entry / splash |
| `pages/onboarding/personality-test/index` | V4 adaptive personality test |
| `pages/onboarding/essential-data/index` | Essential profile data collection |
| `pages/onboarding/extended-data/index` | Interest carousel |
| `pages/onboarding/profile-review/index` | Final profile review before Discover |
| `pages/login/index` | Login page |
| `pages/terms/index` | Terms of service |

### Main app (tab pages)
| Page path | Description |
|-----------|-------------|
| `pages/discover/index` | Event pool discovery (tab 1) |
| `pages/events/index` | My events — pending/matched/completed (tab 2) |
| `pages/connections/index` | Post-event connections hub (tab 3) |
| `pages/profile/index` | Profile and settings (tab 4) |

### Events and matching
| Page path | Description |
|-----------|-------------|
| `pages/event-detail/index` | Event details |
| `pages/pool-registration/index` | Event pool registration |
| `pages/matching-status/index` | Matching waiting and reveal |
| `pages/squad-unboxing/index` | Squad unboxing / group reveal |
| `pages/event-feedback/index` | Post-event feedback |
| `pages/event-coordination/index` | Event coordination space |
| `pages/my-events/index` | My events list (sub-page, non-tab) |
| `pages/journey/index` | Personal social journey & event history |

### Social and in-event
| Page path | Description |
|-----------|-------------|
| `pages/icebreaker-session/index` | Social Icebreaker session (primary in-event flow) |
| `pages/chats/index` | Chat / conversations |
| `pages/invite/index` | Invite friends (referral) |

### Payments
| Page path | Description |
|-----------|-------------|
| `pages/blind-box-payment/index` | Blind box payment (WeChat Pay) |
| `pages/payment-verification/index` | Payment result verification |

### Profile editing
| Page path | Description |
|-----------|-------------|
| `pages/edit-profile/index` | Profile edit hub |
| `pages/rewards/index` | XP, levels, rewards |

## Hooks

| Hook | File | Description |
|------|------|-------------|
| `useAuth` | `hooks/useAuth.ts` | Auth state via React Query (`GET /api/auth/user`); exposes `user`, `isAuthenticated`, `nextStep`, etc. |
| `useAuthGuard` | `hooks/useAuthGuard.ts` | Page-level session gating with onboarding-step validation; redirects unauthenticated users to login |
| `useOnboardingOrchestrator` | `hooks/useOnboardingOrchestrator.ts` | Drives onboarding step navigation using server-returned `nextStep` |
| `useWeChatLogin` | `hooks/useWeChatLogin.ts` | Triggers WeChat OAuth login flow |
| `useWebSocket` | `hooks/useWebSocket.ts` | WebSocket connection management |

## Providers

| Provider | File | Description |
|----------|------|-------------|
| `AuthProvider` | `providers/AuthProvider.tsx` | Manages auth state and session |
| `DynamicAccentProvider` | `providers/DynamicAccentProvider.tsx` | Applies archetype-based accent color (HSL tokens from `@shared/archetypeColors`) |
| `AchievementProvider` | `providers/AchievementProvider.tsx` | Manages achievement unlock state and triggers `AchievementPopup` |

Provider wrap order in `app.ts`: `AuthProvider → DynamicAccentProvider → AchievementProvider`

## Shared components

| Component | File | Description |
|-----------|------|-------------|
| `AchievementPopup` | `components/AchievementPopup.tsx` | Achievement unlock popup (rendered at root level) |
| `BottomNav` | `components/BottomNav.tsx` | Compatibility nav component for sub-pages (not used on tab pages; native `tabBar` is authoritative) |
| `Button` | `components/Button.tsx` | Shared button primitive |
| `Card` | `components/Card.tsx` | Shared card container |
| `LoadingScreen` | `components/LoadingScreen.tsx` | Full-page loading state |
| `ModalOverlay` | `components/ModalOverlay.tsx` | Modal overlay container |
| `PageLayout` | `components/PageLayout.tsx` | Standard page layout wrapper |

## Shared packages used

The mini-program imports from `@joyjoin/shared` (aliased as `@shared/*`) for all cross-platform contracts:

| Module | Import path | Description |
|--------|-------------|-------------|
| Schema | `@shared/schema` | Drizzle database types |
| Personality | `@shared/personality/*` | Archetype registry, adaptive engine, compatibility |
| Onboarding helpers | `@shared/onboarding` | `nextStepToOnboardingStep`, `buildOnboardingProgress` |
| API helpers | `@shared/api` | Typed API functions (assessment, interests, profile review) |
| Archetype colors | `@shared/archetypeColors` | HSL color tokens per archetype |
| Achievements | `@shared/achievements` | Achievement definitions, rarity types, haptic patterns |
| Social Icebreaker | `@shared/socialIcebreaker` | Icebreaker session contracts and phase config |
| Gamification | `@shared/gamification` | XP/level system constants |
| Constants | `@shared/constants` | Intent options, work modes, and other shared vocabularies |
| Industry taxonomy | `@shared/industryTaxonomy` | 3-tier industry/occupation classification |

## Onboarding routing

Onboarding routes and `nextStep` → mini-program page path mapping are defined in `lib/onboardingRoutes.ts`:

- `MINI_PROGRAM_PAGE_PATHS` — canonical page path strings
- `MINI_PROGRAM_ROUTES` — full-path versions (prefixed with `/`)
- `MINI_PROGRAM_PAGES` — ordered array for `app.config.ts` pages list
- `nextStepToMiniProgramRoute(step)` — converts a server `nextStep` value to the correct page path

## Payment resume behaviour

On `app.ts → useDidShow`, if a `pending_order` exists in `wx.getStorageSync` and the current page is not a payment flow page, the app automatically navigates to `pages/payment-verification/index` to resume an interrupted payment.

## Coordination rules

- Treat the mini-program as the strongest current reference for payment mechanics.
- Before changing auth/session, API wrapper behavior, or payment flow here, review the matching web surface in `apps/user-client` and the guidance in [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md).
- Keep mini-program runtime wiring here, but move genuinely shared contracts toward `packages/shared/src/`.
- Business rules (personality scoring, onboarding steps, matching weights) must not fork between web and mini-program.

## Where new files go

- **New mini-program page:** `apps/mini-program/src/pages/<page-dir>/index.tsx` + register in `lib/onboardingRoutes.ts`
- **Mini-program runtime helpers:** `apps/mini-program/src/lib/`
- **App-level registration/config:** `apps/mini-program/src/app.ts` and `apps/mini-program/src/app.config.ts`
- **Shared contracts/constants:** `packages/shared/src/`

## Common commands

```bash
# Build the WeChat Mini Program (from repo root)
npm run build:weapp -w mini-program

# Dev watch mode (outputs to apps/mini-program/dist/weapp/)
npm run dev:weapp -w mini-program

# Full validation (from repo root)
npm run guardrails && npm run build -w @joyjoin/shared && npm run build:weapp -w mini-program
```

## Related docs

- [`../../docs/PLATFORM_COORDINATION.md`](../../docs/PLATFORM_COORDINATION.md)
- [`../../docs/wechat-mini-program-reference.md`](../../docs/wechat-mini-program-reference.md)
- [`../../docs/architecture/current-state.md`](../../docs/architecture/current-state.md)
- [`../../.github/skills/platform-coordination-protocol/SKILL.md`](../../.github/skills/platform-coordination-protocol/SKILL.md)
- [`../../.github/skills/taro-migration-specialist/SKILL.md`](../../.github/skills/taro-migration-specialist/SKILL.md)
