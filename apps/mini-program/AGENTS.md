# Mini-Program — Agent Onboarding Guide

> Compact instructions for AI coding agents working on `apps/mini-program` (the WeChat Mini Program). Last updated: 2026-06-04

---

## 0. Before You Code — Mandatory Context Checklist

### Step 1: Load the domain skill

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Taro page, component, WXSS, hooks, state design | `mini-program-frontend-excellence` |
| Any user-facing UI in the mini-program | `joyjoin-brand-guidelines` |
| API client, transport layer, auth session, query keys | `platform-coordination-protocol` + `wechat-ecosystem-integration` |
| Mini-program screenshot / preview capture | `mini-program-screenshot-workflow` |
| Onboarding flow, `nextStep` logic, welcome-back | `onboarding-state-architecture` |
| Personality test, archetype display, results | `personality-system` |
| Social Icebreaker (post-match), Mini-Script | `social-icebreaker-domain` + `miniscript-story-framework` |
| Persistent query cache, offline behaviour | (read `apps/mini-program/src/lib/api/persistentCache.ts` directly) |
| Performance, smoothness, device adaptation | `performance-audit` |
| Pre-ship / PR review of UI | `completeness-audit` (pipeline: `ui-layout-audit` → `frontend-design-audit` → `completeness-audit`) |

### Step 2: Pre-implementation checklist

- ☐ Relevant skill loaded
- ☐ No legacy identifiers (§1 below)
- ☐ No imports from legacy top-level `shared/` directory (enforced by `npm run guardrails`)
- ☐ No cross-app imports — only `@joyjoin/shared` or `@shared/*`
- ☐ Brand rules respected (no raw emoji on primary copy, solid `$color-primary` CTAs)
- ☐ Pixel-precision when specs exist; strict 8rpx spacing rhythm otherwise
- ☐ All interactive surfaces have haptics + `hoverClass`
- ☐ `@media (prefers-reduced-motion: reduce)` honoured for any new motion
- ☐ Loading/empty/error states use full-screen centering (`min-height: 100dvh` + flex)

### Step 3: After implementation

- ☐ Run `npm run typecheck -w mini-program`
- ☐ Run `npm run guardrails`
- ☐ For UI changes: run `completeness-audit` (full pipeline)
- ☐ For performance-sensitive changes: run `performance-audit`
- ☐ For docs/AGENTS.md updates: run `docs-sync`

---

## 1. Active vs. Legacy (Do Not Reintroduce)

**Active — use these:**
- App root: `apps/mini-program/src/app.ts` with `AuthProvider`
- Routing helpers: `lib/onboarding/onboardingRoutes.ts` (`MINI_PROGRAM_ROUTES`, `nextStepToMiniProgramRoute`)
- Auth: `hooks/useAuth.ts` + `providers/AuthProvider.tsx` (fail-closed revalidation)
- API client: `lib/api/api.ts` + `lib/api/authSession.ts` (single source of truth)
- Brand logo: `components/ui/BrandLogo.tsx` (NOT raw `<Image src="/assets/joyjoin-logo.webp" />`)
- Icon renderer: `components/ui/JoyJoinIcon.tsx` (NOT raw emoji on primary UI)
- Tag/pill: `components/ui/Chip.tsx` (L1/L2/L3 levels)
- Mascot: `components/mascot/XiaoyueChatBubble.tsx` (chat-based onboarding removed 2026-05)

**Legacy — never use:**
- Chat-based onboarding (Xiaoyue chat UI, registration inline handlers) — only mascot visuals remain
- `/guide` step (removed 2026-05-07)
- Local PNG archetype bundling — use `cdnAsset()` for canvas, local for `<Image>`
- Empty `iconPath` on `tabBarConfig.ts` centerHub — `miniprogram-ci` rejects with `800059`
- Importing from legacy top-level `shared/` (enforced by `npm run guardrails`)

---

## 2. Cold-start auth routing (HARD-WON LESSON — 2026-06-04)

> **The bug:** Registered user opens mini-program → cached auth hydrates instantly → `useDidShow` invalidates and refetches → `pages/index/index.tsx` shows the LandingPage → user taps a CTA before refetch resolves → `Taro.reLaunch` from the still-pending `navigateToMiniProgramNextStep` overrides the CTA's destination → user lands on the wrong screen with a stale 500 toast from a login attempt that was overridden.

### The fix (in two parts)

1. **No re-entrancy guard in `AuthProvider.tsx`.** Do NOT add a `isFirstShowRef` / "skip first fire" guard. The bridge must refetch on **every** `useDidShow` (cold start + foreground). The earlier `isFirstShowRef` was the bug — it prevented fail-closed revalidation.

2. **Gate the landing page in `pages/index/index.tsx` via `useAuthGate(auth)`.** The gate logic lives in `src/hooks/useAuthGate.ts` (`useAuthGate`). While `auth.isLoading` is true, render a `LoadingScreen` instead of `MiniProgramLandingPage`. The user cannot race the in-flight revalidation by tapping a CTA.

### Hard cap on the gate (do not remove)

- `INDEX_GATE_TIMEOUT_MS = 4_000` (4 seconds)
- Below `useAuth`'s `AUTH_REQUEST_TIMEOUT_MS` (8s) so the gate releases before the query itself
- On timeout, render an inline `<View className='index-gate__timeout'>` with:
  - **重试** (primary, calls `queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })`)
  - **跳过** (secondary, calls `queryClient.cancelQueries(...)` to force-resolve with cached state)
- Both CTAs emit `haptics('light')` and `logInfo('[IndexGate] ...')`
- Worst case: user sees the CTA within 4s and can manually recover

### Why this is in `pages/index/index.tsx`, not `AuthProvider`

A global overlay from `AuthProvider` would interfere with all pages (including those with their own loading/empty states). The current location is bounded to the cold-start landing surface only. If you need a global overlay, see `discover` / `matching-status` patterns first and design carefully.

### Observability (T1.2, T1.3, T3.6)

`AuthProvider.AuthRefreshBridge` logs revalidation start, success, and failure with `durationMs`. Each also fires an analytics event to `POST /api/analytics/auth` via `authAnalytics.track(...)` for structured querying — logs remain as fallback.

The index gate (`src/hooks/useAuthGate.ts`, consumed by `pages/index/index.tsx`) also logs and tracks:
- `authAnalytics.track('gate_timeout')` when the 4s ceiling trips
- `authAnalytics.track('gate_retry')` on retry CTA
- `authAnalytics.track('gate_dismiss')` on dismiss CTA

Events land in `discover_analytics_events` with `poolId = null`. Client module: `src/lib/analytics/authAnalytics.ts`. Server route: `/api/analytics/auth` in `apps/server/src/routes/domains/analytics.ts`.

---

## 3. Common Taro / WeChat pitfalls (with file:line)

- **`<ScrollView>` inside a flex parent** will not scroll unless the parent has `min-height: 0` or explicit height. `LocationFilterDrawer` is the canonical fix.
- **`Taro.pageScrollTo` does NOT work inside `<ScrollView>`** — use `scrollIntoView` prop with the target element's `id` (no `#` prefix).
- **WeChat keeps pages in the navigation stack alive** (hidden, not unmounted). Transient flags like `isExiting`/`isSubmitting` survive swipe-back. Always reset in `useDidShow` via `useResetOnShow` from `src/hooks/useResetOnShow.ts`.
- **Canvas `drawImage` requires a network-resolvable URL** — local bundled paths (e.g., `/pages/onboarding/assets/...`) work for `<Image>` but NOT for canvas. Pass `visual.asset` (CDN URL) to canvas.
- **`miniprogram-ci` rejects empty `iconPath`** on `tabBarConfig.ts` centerHub with `800059`. Use a placeholder; the custom tab bar component renders the center button independently.
- **Tab bar geometry**: `$tab-bar-height: 128rpx`; root footprint: `$tab-bar-root-height: 182rpx`; center CTA is a **root sibling** of `.joy-custom-tab-bar__surface`, not nested inside.
- **`<ChallengeCardBgImage>`** (WeChat-safe `<Image>` component) must be used for challenge-card backgrounds — CSS `background-image` with CDN URLs is flaky in WeChat runtime.
- **Page-level loading/empty/error state blocks** must use `min-height: 100dvh` + flex centering. `@include scroll-view-centered-state` from `_mixins.scss` is the canonical helper for states inside `<ScrollView>`.

---

## 4. Asset loading strategy (HARD rules)

- **Two-tier brand font**: minimal Alimama subset (66KB) bundled; full font (621KB) loads from CDN with 500ms defer.
- **Quicksand English font** (256KB) bundled and loaded on app launch.
- **Slot machine archetype spritesheet** (`archetype-spritesheet.webp`) — bundled at `/pages/onboarding/assets/archetypes/` (subpackage, preloaded at landing).
- **Full-size archetype images** — served from CDN as WebP. Preload during idle time.
- **Canvas poster** — WebP primary with **CDN PNG fallback**. Local PNGs are NOT bundled.
- **Promo banner**: full-bleed Lovart illustration + WebP→PNG fallback. Kill switch: `PROMO_BANNER_ENABLED` (default `true`).
- **Tab bar logo**: dedicated 128×128 `joyjoin-logo-tab.png` (19KB) — NOT the full `joyjoin-logo.png` (596KB).
- **Never** bundle local PNG archetype art. If canvas needs PNG, use `cdnAsset('/assets/personality/archetypes')`.
- **Archetype images must not have text overlays** — no archetype-name initials or watermarks on hero art.
- **Batch C + D ceremony/badges (2026-06-04, Path B)**: 8 ceremony WebP in `src/assets/ceremony/` + 9 badge WebP in `src/assets/badges/` (q=55, 600px) are bundled locally via Taro `copy.patterns`. Registries use `localAsset()` (NOT `cdnAsset()`). PNG masters live in `assets-source/lovart/batch-{c,d}/` and are NOT bundled. Total raw: 570KB; main package zip stays at 1.98MB.

---

## 5. Brand & copy governance

- **CTAs use solid `$color-primary` (`#8B5CF6`) — no gradient.** Gradient was purged from all mini-program CTAs.
- **Bottom action bar pattern**: solid white (`$color-surface`) + subtle top shadow (`rgba($color-text-primary, 0.04)`).
- **Zero-emoji on primary copy**. Use `JoyJoinIcon` for reactions, categories, intents, achievements, chemistry badges, status icons, phase emblems, info labels.
- **Xiaoyue copy**: subject to `xiaoyue-writing-craft` 9 axioms. Use `getErrorMessage`, `getEmptyStateMessage`, etc. from `packages/shared/src/copy/`.
- **Error-state ARIA**: `role='alert'` + `aria-live='polite'` for inline error states; `role='status'` + `aria-live='polite'` + `aria-busy='true'` for loading screens (e.g., `JoyJoinLoadingScreen`).
- **Haptics are mandatory** on non-onboarding interactive surfaces. Intensity: `light` (secondary), `medium` (primary CTA), `success` (emotional peaks).
- **hoverClass on View-based interactive elements** — `transition: background 0.12s ease` + `rgba($color-primary, 0.06–0.08)` tint.

---

## 6. Persistent Query Cache (Tier 2 offline)

- **Whitelisted keys only**: `['mini-program', 'event-pools']` (`POOLS_QUERY_KEY`) and `['mini-program', 'joined-events']` (`JOINED_EVENTS_QUERY_KEY`).
- **Schema version**: `CACHE_SCHEMA_VERSION = 1` — bump on response shape change.
- **TTL**: 4 hours (`MAX_CACHE_AGE_MS`).
- **Size cap**: 75KB total (UTF-8 byte count).
- **False-freshness guard**: hydration passes `{ updatedAt: entry.timestamp }` to `queryClient.setQueryData` so TanStack Query knows the true data age.
- **Mutation-triggered eviction**: call `evictPersistedQuery(key)` after any mutation that changes persisted data.
- **Multi-user safety**: `clearPersistentCache()` inside `clearMiniProgramAuthSession({ mode: 'hard' })` (logout).
- **Never** inline `Taro.setStorageSync` calls in page components — go through `persistentCache.ts`.

---

## 7. Database schema drift guard

- Server startup calls `validateDbSchema()` before accepting traffic.
- Always run `npm run db:push` (local) or apply migrations (production) before deploying code that adds new columns.

---

## 8. Commands

```bash
npm run typecheck -w mini-program       # tsc --noEmit
npm run guardrails                      # env, secrets, legacy, import checks
npm run dev:weapp --workspace=mini-program   # Taro watch build
npm run check:package-size -w mini-program   # zip-compressed size vs 2MB WeChat limit
```

**WeChat Mini-Program upload (开发版)**: CI auto-uploads on push to main. Manual upload requires `--appid` flag (`miniprogram-ci` will not auto-read from `project.config.json`):

```bash
npx miniprogram-ci upload \
  --appid wx5a038ee6dee12032 \
  --pp apps/mini-program \
  --pkp <private-key-file> \
  --uv "1.0.$(date +%Y%m%d).$(date +%H%M)" \
  --ud "dev build" \
  --rp 1
```

---

## 9. Where to put new code

- **New page**: `apps/mini-program/src/pages/<feature>/index.tsx` (+ `index.scss`).
- **New shared component**: `apps/mini-program/src/components/<group>/<Name>.tsx` (e.g., `ui/`, `mascot/`, `profile/`, `loading/`, `pool/`).
- **Reusable logic**: `apps/mini-program/src/hooks/` (one folder per feature area).
- **API client / transport**: `apps/mini-program/src/lib/api/`.
- **Cross-app types / Zod schemas / DTOs**: `packages/shared/src/` (not in mini-program).

---

## 10. Cross-references

- Root: `AGENTS.md` — repo-wide onboarding, command reference, harness/guardrails philosophy
- Shared: `packages/shared/AGENTS.md` — `packages/shared` ownership
- Admin: `apps/admin-client/AGENTS.md` — Recharts + shadcn admin portal patterns
- Docs index: `docs/README.md`
