# Mini-Program Product Reference

> **Status:** Active launch-primary mini-program reference for `apps/mini-program`.
> **Last verified:** 2026-04-20.
> **Non-replacement note:** This document does **not** replace [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md) or [`../apps/mini-program/README.md`](../apps/mini-program/README.md). It is a compact product-to-code bridge for the live WeChat mini-program surface.
> **Authority chain:** 1. [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md) for product canon and terminology. 2. [`../apps/mini-program/README.md`](../apps/mini-program/README.md), [`./architecture/current-state.md`](./architecture/current-state.md), [`./onboarding-flow.md`](./onboarding-flow.md), and [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) for runtime ownership and flow rules. 3. [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts), [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts), [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts), [`../packages/shared/src/README.md`](../packages/shared/src/README.md), [`../packages/shared/src/schema.ts`](../packages/shared/src/schema.ts), and [`../apps/server/src/README.md`](../apps/server/src/README.md) for active route, contract, and backend truth.

## 1. Purpose and scope

Use this document when you need the current mini-program page map, the active user journeys that matter on WeChat, the shared-contract boundary with server and shared packages, or the admin actions that visibly affect mini-program users.

This document intentionally stays shorter than the full product canon. It summarizes the live mini-program surface and links back to canonical files instead of re-stating full PRD, architecture, onboarding, or schema detail.

Out of scope:

- Full product requirements, terminology rationale, and long-form feature history. Use [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md).
- Low-level Taro and WeChat platform primitives. Use [`../apps/mini-program/README.md`](../apps/mini-program/README.md) and, when needed, [`./wechat-mini-program-reference.md`](./wechat-mini-program-reference.md).
- Full table definitions. Use [`../packages/shared/src/schema.ts`](../packages/shared/src/schema.ts).

## 2. Product canon quick reference

The mini-program is the **launch-primary** client for the current JoyJoin track, but it still follows the shared product canon in [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md).

Current product constraints that directly affect the mini-program:

- Canonical bottom navigation intent is **发现** -> **足迹** -> center action icon -> **连接** -> **我的**. On the mini-program these anchors map to [`../apps/mini-program/src/pages/discover/index.tsx`](../apps/mini-program/src/pages/discover/index.tsx), [`../apps/mini-program/src/pages/events/index.tsx`](../apps/mini-program/src/pages/events/index.tsx), the center action routing logic, [`../apps/mini-program/src/pages/connections/index.tsx`](../apps/mini-program/src/pages/connections/index.tsx), and [`../apps/mini-program/src/pages/profile/index.tsx`](../apps/mini-program/src/pages/profile/index.tsx).
- Use **连接** in current copy and documentation. **圈子** is legacy wording and should not be reintroduced as the active tab name.
- Use **权益** for user-facing entitlement language. Do not reintroduce **会员** as the active user-facing product term.
- Active value-first onboarding remains: personality test -> results -> auth gate -> authenticated onboarding -> discover. The canonical flow reference is [`./onboarding-flow.md`](./onboarding-flow.md).
- After authentication, onboarding progression is server-owned through `nextStep` from `/api/auth/user`, not reconstructed locally on the client. See [`./onboarding-flow.md`](./onboarding-flow.md) and [`./architecture/current-state.md`](./architecture/current-state.md).

## 3. Mini-program application structure

The live mini-program is a Taro 4 plus React 18 app under [`../apps/mini-program`](../apps/mini-program). Its page inventory is registered centrally and split across a main package plus one onboarding subpackage.

| Layer | Source of truth | What it owns |
| --- | --- | --- |
| App shell | [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts) | Main-package page list, onboarding subpackage registration, preload rules, custom tab bar, and window defaults. |
| Page registry | [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) | Canonical route constants, page paths, onboarding subpackage membership, and preload entry points. |
| Main package | [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) | Root entry, tabs, payment, matching, profile, event, and compatibility routes that must stay in the main package. |
| Onboarding subpackage | [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) | `pages/onboarding/*` routes for value-first entry and post-auth onboarding steps. |
| Request and auth bootstrap | [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts) | Taro request transport, WeChat login helpers, `/api/auth/user` bootstrap, and payment verification request plumbing. |
| Runtime workspace rules | [`../apps/mini-program/README.md`](../apps/mini-program/README.md) | Build commands, package-loading rules, native custom tab bar ownership, and launch-primary client guidance. |

Current package split:

- **Main package:** discover, tabs, matching, payment, profile, event-detail, event-coordination, and compatibility entry routes.
- **Onboarding subpackage:** `pages/onboarding` root with personality test, results, auth gate, essential data, extended data, and profile review.
- **Preload rule:** `pages/index/index` and `pages/login/index` preload the onboarding subpackage so first-entry and returning-login handoffs can reach onboarding without a cold page load.

## 4. Page inventory

This inventory is derived from the registered paths in [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts), the app shell in [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts), and the page implementations under [`../apps/mini-program/src/pages/`](../apps/mini-program/src/pages/).

### Entry and auth

| Page path | Role | Purpose | Notes |
| --- | --- | --- | --- |
| `pages/index/index` | Root entry | Shows the mini-program landing page for signed-out users and redirects signed-in users to the server-owned next step. | Root launch route. |
| `pages/login/index` | Returning-user auth | Runs mini-program-native WeChat login and resumes the authenticated journey. | Uses `Taro.login()` via [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts). |

### Onboarding subpackage (`pages/onboarding/*`)

| Page path | Role | Purpose | Notes |
| --- | --- | --- | --- |
| `pages/onboarding/onboarding/index` | Redirect hub | Receives `nextStep=onboarding` and forwards immediately to the actual server-owned onboarding step. | Compatibility shell, not a standalone form step. |
| `pages/onboarding/personality-test/index` | Onboarding step | Runs the adaptive personality assessment with anonymous pre-auth support. | Value-first entry surface. |
| `pages/onboarding/personality-test/results/index` | Onboarding step | Reveals the archetype result, summary, and share/poster experience after the test completes. | Includes replayable reveal and native share hooks. |
| `pages/onboarding/personality-test/auth-gate/index` | Onboarding step | Bridges anonymous test results into authenticated WeChat login and imports pre-auth answers after login. | Uses `/api/auth/wechat/login-with-test`. |
| `pages/onboarding/essential-data/index` | Onboarding step | Collects the essential profile fields required before users can continue deeper into onboarding. | Post-auth step owned by `nextStep`. |
| `pages/onboarding/extended-data/index` | Onboarding step | Collects interest selections and heat/depth signals used by later matching and personalization flows. | Canonical extended-data step. |
| `pages/onboarding/profile-review/index` | Onboarding step | Summarizes the profile, archetype, interests, and AI tagline before onboarding completion. | Presentation-only AI tagline lives here. |

### Tab and account surfaces

| Page path | Role | Purpose | Notes |
| --- | --- | --- | --- |
| `pages/discover/index` | Primary destination | Shows discoverable event pools with filters, fill state, and the main join entry path. | Launch-primary discovery surface. |
| `pages/events/index` | Primary destination | Shows joined events split into upcoming and completed tabs. | User-facing label is `足迹`; page title is `我的足迹`. |
| `pages/connections/index` | Primary destination | Shows post-event connections with peer identity and event context. | Reads `/api/my-connections`. |
| `pages/profile/index` | Primary destination | Serves as the account hub for identity, current state, edit profile, rewards, invite, terms, and payment entry. | Tab anchor for `我的`. |
| `pages/edit-profile/index` | Auxiliary destination | Lets the user edit core profile fields and interest selections after onboarding. | Reuses shared profile and interest contracts. |
| `pages/rewards/index` | Auxiliary destination | Shows coupons, gamification state, recent history, and redeemable items. | Reads shared rewards and coupon APIs. |
| `pages/invite/index` | Auxiliary destination | Shows referral code, invite link, reward tiers, and copy actions for friend invites. | Uses shared referral stats contract. |
| `pages/terms/index` | Auxiliary destination | Renders the current legal terms or privacy content with section focus support. | Backed by shared legal copy. |
| `pages/center-tab-empty/index` | Auxiliary destination | Provides the empty-state path when the center action has no active event context yet. | Offers a direct return to discover. |

### Event, payment, matching, and in-event surfaces

| Page path | Role | Purpose | Notes |
| --- | --- | --- | --- |
| `pages/blind-box-payment/index` | Payment entry | Lets users buy entitlements or packs needed to continue the blind-box registration flow. | Current strongest reference for live mini-program payment mechanics. |
| `pages/payment-verification/index` | Payment recovery | Polls payment status after the WeChat pay sheet returns and routes back to the right post-pay destination. | Uses pending-order context and shared payment status decisions. |
| `pages/event-detail/index` | Primary destination | Shows the detail view for a single event or event pool entry point. | Event-specific read surface. |
| `pages/event-feedback/index` | Primary destination | Collects post-event feedback and optional free-text follow-up. | Post-event feedback path. |
| `pages/pool-registration/index` | Primary destination | Collects pool-specific soft preferences and submits the user into a blind-box event pool. | Main bridge from discover to matching. |
| `pages/event-coordination/index` | Primary destination | Hosts the post-match event coordination chat and report flow. | Runtime communication surface after matching. |
| `pages/matching-status/index` | Primary destination | Shows waiting, matched, no-match, and cancelled states for a pool registration. | Main waiting and reveal-state hub. Now includes **Unified Connection Reveal** — fuses `chemistryPayoff` group narrative with `connectionPoints` pair evidence into a single card. |
| `pages/squad-unboxing/index` | Primary destination | Runs the matched reveal and post-reveal transition into group detail and event follow-up. | Reveal-heavy matched-state surface. |
| `pages/pool-group-detail/index` | Primary destination | Shows the matched group detail, members, event details, and AI group analysis. | Read-only matched group surface. |
| `pages/icebreaker-session/index` | Primary destination | Runs the live Social Icebreaker session for matched groups at event time. | Hosts warmup, challenge, lie-detective, personality-dice, and recap phases. |

### Compatibility and legacy alias routes still present in active code

| Page path | Role | Purpose | Notes |
| --- | --- | --- | --- |
| `pages/journey/index` | Compatibility alias | Legacy journey entry that now redirects into the canonical events tab. | Keep labeled as compatibility only. |
| `pages/my-events/index` | Compatibility alias | Older my-events entry that also redirects into the canonical events tab. | Keep labeled as compatibility only. |

## 5. Mini-program user flows

| Journey | Main mini-program path | Canonical notes |
| --- | --- | --- |
| New user onboarding | `pages/index/index` -> `pages/onboarding/personality-test/index` -> `results` -> `auth-gate` -> `essential-data` -> `extended-data` -> `profile-review` -> `pages/discover/index` | Product and step ownership live in [`./onboarding-flow.md`](./onboarding-flow.md). |
| Returning login | `pages/index/index` or `pages/login/index` -> WeChat login -> `/api/auth/user` -> server-owned `nextStep` | Mini-program-native login only; no browser OAuth redirect. |
| Discovery and pool registration | `pages/discover/index` -> optional `pages/event-detail/index` -> `pages/pool-registration/index` | Pool registration owns soft-preference capture before matching. |
| Payment and verification | `pages/pool-registration/index` -> `pages/blind-box-payment/index` -> `pages/payment-verification/index` -> back to pool registration or onward to profile/events | Cross-platform coordination rules live in [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md). |
| Matching and reveal | `pages/matching-status/index` -> `pages/squad-unboxing/index` -> `pages/pool-group-detail/index` -> `pages/event-coordination/index` or `pages/events/index` | Query keys and invalidation rules live in [`./mini-program-data-fetching.md`](./mini-program-data-fetching.md). Matching-status now runs the **Unified Connection Reveal** — `composeUnifiedReveal()` fuses group chemistry with pair connection points into a single `UnifiedRevealCard`. |
| In-event icebreaker | `pages/icebreaker-session/index` | Active in-event social flow; server-owned session state is described in [`./AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md) and [`./architecture/current-state.md`](./architecture/current-state.md). |
| Ongoing account, rewards, invite, and relationship use | `pages/profile/index`, `pages/events/index`, `pages/connections/index`, `pages/rewards/index`, `pages/invite/index`, `pages/edit-profile/index` | These are the steady-state anchors after onboarding and matching. |

## 6. AI features on the mini-program

Mini-program-reachable AI features are inventoried canonically in [`./AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md). The live mini-program surfaces currently depend on the following feature families:

| Feature family | Mini-program entry surfaces | What matters here |
| --- | --- | --- |
| Onboarding profile tagline | `pages/onboarding/profile-review/index` | Presentation-only AI line fetched during profile review; it does not change onboarding state ownership. |
| Match group analysis | `pages/matching-status/index`, `pages/squad-unboxing/index`, `pages/pool-group-detail/index` | Shared `GroupAnalysisResponse` rendered on matched-state surfaces with cache and fallback behavior. Matching-status now additionally runs `composeUnifiedReveal()` to fuse `chemistryPayoff` with `connectionPointsWithRarity` into a single presentational card. |
| Event theme reveal | Matching-status and group-detail surfaces after matching | Async theme/title generation can enrich the reveal and later group detail state. |
| Social Icebreaker generation | `pages/icebreaker-session/index` | AI-backed warmup topics, micro-challenges, lie-detective content, personality-dice content, and recap summary. |
| Semantic profile embeddings | Onboarding, profile, and interest-update writes | Backend-only enrichment triggered by user changes; not shown as a direct UI widget. |

Practical rule: AI is allowed to enrich copy and in-event facilitation, but the mini-program should still degrade gracefully. Current fallback behavior is documented in [`./AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md) and validated by [`./runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md).

## 7. Shared contracts and server domain boundaries

The mini-program does not own the entire feature stack. It owns the Taro runtime layer and consumes shared contracts plus server-owned business decisions.

| Ownership layer | Primary files | What it should own |
| --- | --- | --- |
| Mini-program runtime | [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts), [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts), [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts), [`../apps/mini-program/src/pages/`](../apps/mini-program/src/pages/) | Taro page structure, route registration, local storage and pending-order recovery, WeChat runtime wiring, mini-program query keys, and custom tab bar behavior. |
| Shared contracts | [`../packages/shared/src/README.md`](../packages/shared/src/README.md), [`../packages/shared/src/api.ts`](../packages/shared/src/api.ts), [`../packages/shared/src/schema.ts`](../packages/shared/src/schema.ts) | DTOs, onboarding mapping helpers, payment and group-analysis response shapes, legal copy, and canonical schema names that multiple runtimes must share. |
| Server domains | [`../apps/server/src/README.md`](../apps/server/src/README.md) | `nextStep` calculation, event-pool registration and matching, group analysis generation, payment creation and verification, notifications, connections, and Social Icebreaker session authority. |

Important boundary rules:

- Treat `/api/auth/user` as the authority for authenticated user state and onboarding progression.
- Treat `packages/shared` as the contract layer when both mini-program and another runtime must agree on payload shape or schema naming.
- Treat auth, API wrapper semantics, payment mechanics, pricing, and entitlement changes as **coordination-sensitive**. Use [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) before deciding a change is mini-program-only.
- The mini-program is the strongest current reference for the live payment flow, but shared payment behavior is still a `BOTH_REQUIRED` review surface when business rules move.

## 8. Data model quick reference

This section names the core entities the mini-program relies on without duplicating full schema definitions. The canonical source remains [`../packages/shared/src/schema.ts`](../packages/shared/src/schema.ts).

| Entity | Canonical table | Why the mini-program cares |
| --- | --- | --- |
| User identity and onboarding state | `users` | Holds profile fields, archetype, onboarding completion flags, `nextStep` inputs, and entitlement-adjacent user state returned by `/api/auth/user`. |
| Interest selections and heat | `user_interests` | Stores the structured interest carousel output used by onboarding, edit profile, and later matching/personalization. |
| Personality test state | `assessment_sessions` | Stores pre-signup and post-signup assessment progress plus final archetype results. |
| Discoverable pools | `event_pools` | Defines the live blind-box pools shown on discover, including timing, location, constraints, and pool-level status. |
| User pool registrations | `event_pool_registrations` | Stores per-user registration preferences, match status, and assigned group linkage. |
| Matched groups | `event_pool_groups` | Stores group-level reveal data, member counts, theme fields, and group-analysis caches used after matching. |
| Post-match event records | `blind_box_events` | Represents the user-facing blind-box event state after matching, including progress and matched attendee data. |
| Pre-event attendance state | `blind_box_pre_attendance` | Stores user attendance responses and admin attendance overrides before the event happens. |
| Entitlements and payment records | `subscriptions`, `payments` | Back the payment, entitlement, verification, and refund state shown in payment and profile flows. |
| Social graph and notifications | `connections`, `notifications` | Power the connections tab and category-based notification counts or reminders. |

## 9. Admin flows affecting the mini-program

Endpoint and role coverage live canonically in [`./admin-rbac-matrix.md`](./admin-rbac-matrix.md). Some sensitive writes are also recorded through [`../apps/server/src/lib/adminAuditLogger.ts`](../apps/server/src/lib/adminAuditLogger.ts) where the route has been instrumented, so verify audit coverage per endpoint instead of assuming every admin mutation already logs through that helper. The table below focuses only on the admin actions that mini-program users can feel directly.

| Admin action | Endpoint or authority | Mini-program effect |
| --- | --- | --- |
| Create or update event pools | [`./admin-rbac-matrix.md`](./admin-rbac-matrix.md) (`/api/admin/event-pools*`) | Changes what appears in discover, what users can register for, and the timing/location/constraint copy shown in event detail and pool registration. |
| Run matching for a pool | [`../apps/server/src/routes.ts`](../apps/server/src/routes.ts) (`POST /api/admin/event-pools/:id/match`) | Creates matched groups and unlocks or changes what registered users see in matching status, reveal, and group-detail flows. |
| Override blind-box attendance | [`../apps/server/src/routes.ts`](../apps/server/src/routes.ts) (`PATCH /api/admin/blind-box-events/:eventId/attendees/:userId/attendance`) | Changes the stored pre-event attendance state that matched-event flows read later. |
| Send or broadcast admin notifications | [`../apps/server/src/routes.ts`](../apps/server/src/routes.ts) (`POST /api/admin/notifications/broadcast`, `POST /api/admin/notifications/send`) | Changes the notification counts and user-facing reminder or announcement traffic that mini-program tabs mark as read. |
| Ban or unban a user | [`../apps/server/src/routes.ts`](../apps/server/src/routes.ts) (`PATCH /api/admin/users/:id/ban`, `PATCH /api/admin/users/:id/unban`) | Banned users lose normal authenticated access until restored; unban restores that path. |
| Initiate a refund | [`../apps/server/src/routes/domains/payments.ts`](../apps/server/src/routes/domains/payments.ts) (`POST /api/admin/payments/:paymentId/refund`) | Can reverse a payment-backed entitlement or pack outcome that later appears in profile and payment recovery flows. |

## 10. Platform coordination boundary

Use [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) whenever the mini-program change might alter shared business behavior rather than only Taro runtime behavior.

| Scope | Typical examples | Review expectation |
| --- | --- | --- |
| `MINI_PROGRAM_ONLY` | Route registration, Taro page composition, WXSS-safe presentation, custom tab bar state, local pending-order storage, mini-program query keys | Mini-program implementation review only. |
| `BOTH_REQUIRED` | Auth/session bootstrap, `/api/auth/user` semantics, payment flow behavior, pricing or entitlement rules, request wrapper semantics, shared DTO changes | Review the matching web or shared surface before finalizing the change. |
| Shared-contract-first | Schema names, API DTOs, onboarding helpers, legal copy | Update `packages/shared` first and then confirm both consuming clients still align. |

Default rule: if a mini-program task touches auth, payment, pricing, or another shared contract and the ownership is unclear, treat it as `BOTH_REQUIRED` until [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) says otherwise.

## 11. Environment and build configuration

| Concern | Source of truth | Current note |
| --- | --- | --- |
| Workspace commands | [`../apps/mini-program/README.md`](../apps/mini-program/README.md) | Use `npm run dev:weapp --workspace=mini-program` and `npm run build:weapp --workspace=mini-program` for the live mini-program workspace. |
| Page loading and package split | [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts), [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) | The app uses `lazyCodeLoading: 'requiredComponents'`, a main package, and a preloaded onboarding subpackage. |
| Runtime API base URL | [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts) | `TARO_APP_API_BASE_URL` controls the runtime API origin; local default is `http://localhost:5001`. |
| Launch-critical server env | [`./LAUNCH_CONFIG.md`](./LAUNCH_CONFIG.md) | `DATABASE_URL`, `SESSION_SECRET`, `WECHAT_APPID`, and `WECHAT_SECRET` are required; `PAYMENTS_ENABLED` gates live payment availability. |
| WeChat Pay enablement | [`./LAUNCH_CONFIG.md`](./LAUNCH_CONFIG.md) | When payments are enabled, the WeChat Pay variables must also be configured and stay consistent with the mini-program app identity. |
| Tab bar and shell runtime | [`../apps/mini-program/README.md`](../apps/mini-program/README.md), [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts) | The active runtime uses a native custom tab bar with `tabBar.custom: true`. |

## 12. QA and maintenance

- Run `npm run typecheck -w mini-program` and `npm run build:weapp -w mini-program` before treating a mini-program change as code-complete.
- Use [`./runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) when a change touches profile tagline, group analysis, event-theme reveal, or Social Icebreaker AI.
- Use [`./runbooks/mini-program-events-tab-smoke.md`](./runbooks/mini-program-events-tab-smoke.md) when tab-shell or compatibility-route behavior changes.
- Keep query keys and invalidation notes aligned with [`./mini-program-data-fetching.md`](./mini-program-data-fetching.md), especially for waiting, reveal, and group-detail flows.
- For visual or interaction changes, follow the mini-program quality bar in [`../apps/mini-program/README.md`](../apps/mini-program/README.md) and the linked frontend excellence guidance; this document is not a substitute for WeChat DevTools verification.

## 13. Docs-sync maintenance rules

Update only the sections affected by the source change. Do not rewrite the whole document when one source row changes.

| If this source changes | Re-check sections in this doc | What to confirm |
| --- | --- | --- |
| [`../PRODUCT_REQUIREMENTS.md`](../PRODUCT_REQUIREMENTS.md) | Header, 2, 5, 10 | Launch-primary status, nav terminology, entitlement wording, and journey language still match product canon. |
| [`../apps/mini-program/README.md`](../apps/mini-program/README.md) | Header, 3, 11, 12 | Workspace commands, package strategy, custom tab bar ownership, and launch-primary guidance still match runtime docs. |
| [`./onboarding-flow.md`](./onboarding-flow.md) | 2, 4, 5 | Onboarding routes, step order, and server-owned `nextStep` descriptions still match the active flow. |
| [`./PLATFORM_COORDINATION.md`](./PLATFORM_COORDINATION.md) | 5, 7, 10, 11 | Auth, API, payment, and sibling-platform review rules are still described accurately. |
| [`./mini-program-data-fetching.md`](./mini-program-data-fetching.md) | 5, 7, 12 | Query-key, invalidation, and waiting/reveal references still match live mini-program data flow. |
| [`./architecture/current-state.md`](./architecture/current-state.md) | Header, 3, 7 | Ownership chain and launch-primary architecture notes still align with the current codebase. |
| [`./AI_FEATURE_INVENTORY.md`](./AI_FEATURE_INVENTORY.md) | 6, 12 | The AI surface list, fallback claims, and smoke references are still current. |
| [`./admin-rbac-matrix.md`](./admin-rbac-matrix.md) | 9 | The admin-impact table still maps to the right endpoints and role assumptions. |
| [`../apps/server/src/README.md`](../apps/server/src/README.md) | 7, 9 | Server domain ownership and admin or payment boundaries are still accurate. |
| [`../packages/shared/src/README.md`](../packages/shared/src/README.md) and [`../packages/shared/src/schema.ts`](../packages/shared/src/schema.ts) | 7, 8 | Shared contract ownership and the named data entities still match the canonical schema. |
| [`../apps/mini-program/src/lib/onboardingRoutes.ts`](../apps/mini-program/src/lib/onboardingRoutes.ts) and [`../apps/mini-program/src/app.config.ts`](../apps/mini-program/src/app.config.ts) | 3, 4, 11 | Page inventory, main-package vs onboarding-subpackage split, preload rules, and tab anchors still match the live registry. |
| [`../apps/mini-program/src/lib/api.ts`](../apps/mini-program/src/lib/api.ts) | 5, 7, 10, 11 | Auth bootstrap, API base URL, payment verification behavior, and coordination-sensitive notes still match implementation. |
| [`./runbooks/mini-program-ai-smoke.md`](./runbooks/mini-program-ai-smoke.md) and [`./runbooks/mini-program-events-tab-smoke.md`](./runbooks/mini-program-events-tab-smoke.md) | 12 | The referenced QA commands and smoke expectations still cover the current routes. |
| [`./LAUNCH_CONFIG.md`](./LAUNCH_CONFIG.md) | 11, 12 | Environment variable requirements and payment enablement notes are still accurate. |