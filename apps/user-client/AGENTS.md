# User Client — Agent Onboarding

> Compact instructions for AI coding agents. Last updated: 2026-05-01

---

## 0. Before You Code — Mandatory Context Checklist

### Step 1: Load the domain skill

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Any UI change (layout, styling, animation) | `joyjoin-brand-guidelines` |
| Creating or moving components | `frontend-component-architecture` |
| Viewport, layout, scroll behavior | `viewport-zero-scroll` |
| Onboarding pages / `nextStep` routing | `onboarding-state-architecture` |
| Payment pages (BlindBox, event pack) | `payment-entitlement-authority` + `platform-coordination-protocol` (mini-program sibling) |
| Micro-interactions, polish, delight | `wow-elements` |
| Performance: lazy loading, Suspense, bundle | `frontend-performance-and-loading` |
| Icebreaker or Social session UI | `social-icebreaker-domain` |
| Design audit / "does this feel sloppy?" | `frontend-design-audit` |

### Step 2: Read the canonical doc

Each skill's body or `Related docs` section links to the authoritative documentation. Follow those links. For cross-platform concerns, read `docs/PLATFORM_COORDINATION.md`.

### Step 3: Pre-implementation checklist

- ☐ Relevant skill loaded and read
- ☐ No legacy imports or patterns (re-check §2 below)
- ☐ Cross-platform impact assessed (mini-program sibling exists for onboarding, auth, and payment)
- ☐ Zero-scroll viewport rules respected (100dvh shell, ScrollView containers, max 4 inputs per FormStepper)

---

## 1. Active vs. Legacy (Do Not Reintroduce)

Always base implementation on the **current active codebase**, not legacy flows.

**Legacy — never use:**
- `/guide` as core onboarding → active steps: `setup` → `extended` → `review` → `/discover`
- `useOnboardingProgress()` → use `useOnboardingOrchestrator()` (from `features/onboarding/active/`)
- `useOnboardingRoute()` → use `useOnboardingOrchestrator()`
- `useGuideFlow.shouldShowGuide` / `resetGuideState` → server-driven `nextStep` determines routing
- `getIntentIcon()` → use `getIntentEmoji()`
- `SparkPredictionContext` → use `UserContext`
- `AnimationLoadingScreen` (match reveal use) → standard loading components
- `MatchingWaitingScreen.onMatch` callback → use `onInvite`
- Archetype avatars via `archetypeAvatars.ts` → use new image-based `AnimationProfile` system
- Any import from root `shared/` directory → use `@joyjoin/shared` or `@shared/*`

**Canonical references:** `DEVELOPER_QUICK_REFERENCE.md` and `PRODUCT_REQUIREMENTS.md`

---

## 2. Entry Points & Architecture

| Role | File | Notes |
|------|------|-------|
| **Vite bootstrap** | `src/main.tsx` | `createRoot(...).render(<App />)` |
| **App root** | `src/App.tsx` | wouter router, providers, onboarding orchestrator, lazy routes |
| **Routes definition** | `src/routes.ts` | Critical-path pages eager; secondary pages lazy-loaded |
| **Auth hook** | `src/hooks/useAuth.ts` | Web auth/session reader — coordinates with mini-program sibling |
| **Vite config** | `vite.config.ts` | Port 5001 (strict), API proxy to `:5000`, `@shared` alias |

**Routing:** Uses `wouter` (not React Router). Server-driven routing via `GET /api/auth/user` returning `nextStep`.

**Onboarding:** Server-driven state machine. Client never computes its own position. Entry: `src/features/onboarding/active/`. Active steps: `/onboarding/setup` → `/onboarding/extended` → `/onboarding/review` → `/discover`.

**Platform coordination:** Auth, onboarding, and payment pages have mini-program siblings. When modifying these, review `docs/PLATFORM_COORDINATION.md` and check the sibling in `apps/mini-program/src/`.

---

## 3. Where to Put New Code

- **New page/route** → `src/pages/` (create subfolder for multi-file pages)
- **Reusable UI component** → `src/components/` (use shared primitives from `@joyjoin/shared/ui` when available)
- **Active onboarding code** → `src/features/onboarding/active/`
- **Hooks** → `src/hooks/` (prefixed: `use<Feature>.ts`)
- **Utilities/helpers** → `src/lib/`
- **Context providers** → `src/contexts/`
- **Feature config, copy, data** → `src/data/`, `src/config/`, `src/copy/`
- **Cross-app shared UI** → `packages/shared/src/ui/` (NOT duplicated here)

---

## 4. Key Architectural Rules

### Viewport & Layout
- **Zero-scroll policy**: 100dvh shell, no document/page scroll. All scrollable content inside `ScrollView`/`ResponsiveSpacer`.
- **FormStepper**: Max 4 inputs per step. No long forms.

### State Design (Every screen must cover)
1. **Loading** — skeleton/spinner
2. **Empty** — branded empty state (悦仔 mascot, gentle CTA, not generic "no data")
3. **Error** — specific message, retry action, not generic "something went wrong"
4. **Success** — confirmation, next action clear
5. **Edge cases**: network loss, session expiry (→ login redirect), partial data, first-visit

### Component Patterns
- Prefer shared primitives from `@joyjoin/shared/ui/*` (Button, ResponsiveSpacer) over local re-implementation
- App-local wrappers are thin — compose shared primitives, don't reinvent them
- Loading states: skeleton components preferred over spinners for content areas

### Performance
- Critical-path pages: eager import. Secondary pages: `React.lazy()`
- Manual chunks: `react-vendor`, `query`, `ui-radix`, `motion`, `charts`, `lottie`
- Image loading: use `usePreloadImages()` for above-fold assets

---

## 5. Common Commands

```bash
npm run dev -w @joyjoin/user-client          # dev server, port 5001
npm run typecheck -w @joyjoin/user-client     # tsc --noEmit
npm run test -w @joyjoin/user-client          # vitest (limited coverage)
npm run build -w @joyjoin/user-client         # vite build
```

---

## 6. Guardrails (CI-Enforced)

- No imports from legacy root `shared/`
- No cross-app imports (can't import from `admin-client` or `mini-program`)
- No legacy onboarding identifiers (`hasCompletedRegistration`, `needsRegistration`, `registration_sessions`)
- Run `npm run guardrails` from root before committing

---

## 7. Related Docs

- `../../AGENTS.md` — root agent guide (skill mapping, legacy list, monorepo rules)
- `../../docs/PLATFORM_COORDINATION.md` — mini-program ↔ web coordination
- `../../docs/MOBILE_UI_IMPLEMENTATION_SUMMARY.md` — mobile UI decisions
- `../../DEVELOPER_QUICK_REFERENCE.md` — canonical engineering reference
- `./README.md` — human-readable workspace overview
- `./src/features/onboarding/README.md` — active onboarding ownership map
