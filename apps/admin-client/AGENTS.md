# Admin Client — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-05-08

---

## 0. Before You Code — Mandatory Context Checklist

### Step 1: Load the domain skill

Every task touching admin-client must load these skills:

| Area you're modifying | Skill to load (mandatory) |
|----------------------|--------------------------|
| Any admin UI change | `admin-client-frontend` |
| Admin API routes (server-side) | `admin-audit-and-rbac-governance` |
| RBAC, role checks, permission gating | `admin-audit-and-rbac-governance` |
| Shared components used by admin | `frontend-component-architecture` |
| Brand/visual consistency | `joyjoin-brand-guidelines` |
| Design quality audit | `frontend-design-audit` |

### Step 2: Pre-implementation checklist

- ☐ Relevant skill loaded
- ☐ No legacy identifiers (§1 below)
- ☐ RBAC enforced (admin pages gate on `user.isAdmin`)
- ☐ Server-side admin routes use admin middleware
- ☐ Import from `@/components/ui/` for shadcn primitives
- ☐ Import from `@joyjoin/shared` for cross-app contracts

### Step 3: After implementation

- ☐ Run `harness-completion-gate` skill
- ☐ Verify admin-only routes return 403 for non-admin users
- ☐ Audit log any sensitive mutations (refunds, bans, role changes)

---

## 1. Active vs. Legacy (Do Not Reintroduce)

**Active — use these:**
- `AdminApp.tsx` as app root (only entry — legacy `App.tsx` removed 2026-05-07)
- `wouter` for routing (NOT React Router)
- `useAuth()` from `@/hooks/auth/useAuth` — checks `user.isAdmin`
- `@/components/ui/*` for shadcn primitives (Button, Dialog, Table, etc.)
- `@/components/admin/*` for admin-specific components
- `@/components/discover/`, `@/components/event/`, `@/components/profile/` for feature-grouped components
- `@/components/navigation/` for BottomNav, MobileHeader
- `@/pages/admin/*` for admin route pages
- `Recharts` for charts/dashboards
- `react-hook-form` + `zod` for form validation
- `@tanstack/react-query` for server state
- `framer-motion` for animations
- `@/hooks/auth/useAuth`, `@/hooks/ui/use-toast`, `@/hooks/event/useWebSocket` for domain-organized hooks

**Legacy — never use:**
- Direct router imports from non-wouter libraries
- Hardcoded role strings — use the RBAC helper from shared
- Admin pages placed outside `pages/admin/`
- Flat `@/components/ComponentName` imports — use feature subdir instead

---

## 2. Workspace Boundaries

- **This workspace**: `@joyjoin/admin-client` — admin portal only
- **Import shared code**: `@joyjoin/shared` or `@shared/*`
- **Never** import from `apps/user-client` or `apps/mini-program`
- **Never** import from legacy root `shared/` directory
- ESM only (`"type": "module"`)

---

## 3. Entry Points & Architecture

```
main.tsx                          # Vite bootstrap → renders AdminApp
  └── AdminApp.tsx                # Providers (QueryClient, Tooltip, Toaster) + AdminRouter
        └── AdminRouter           # Auth gate (isAuthenticated + isAdmin) → AdminLayout
              └── AdminLayout     # Sidebar + content area (wouter routes)
                    ├── /dashboard           (数据看板)
                    ├── /event-pools         (活动池管理)
                    ├── /users               (用户管理)
                    ├── /venues              (场地管理)
                    ├── /feedback            (反馈管理)
                    ├── /moderation          (用户举报)
                    ├── /reports             (聊天举报)
                    ├── /matching            (匹配实验室)
                    ├── /matching-config     (匹配配置)
                    ├── /insights            (数据洞察)
                    ├── /templates           (活动模板)
                    ├── /events              (活动管理)
                    ├── /notifications       (通知推送)
                    ├── /content             (内容管理)
                    ├── /subscriptions       (订阅管理)
                    ├── /pricing             (定价管理)
                    ├── /coupons             (优惠券)
                    ├── /finance             (财务管理)
                    ├── /matching-logs       (匹配日志)
                    ├── /evolution           (悦仔进化)
                    ├── /outcome-analytics   (Outcome 分析)
                    ├── /interaction-logs    (连接日志)
                    ├── /icebreaker-ai-feedback (破冰 AI 反馈)
                    ├── /accounts            (管理员账号)
                    ├── /audit-logs          (审计日志)
                    └── ...
```

- **Port**: 5002 (non-strictPort — will use next available if busy)
- **Build**: Vite 5, React 18
- **Router**: wouter (`useLocation`, `Switch`, `Route`)
- **Auth**: Session-based (cookie), `useAuth()` hook populates `user.isAdmin`
- **Auth fail**: Redirect to `/login` with clear state, not stuck spinner

---

## 4. Component Organization

```
src/
  components/
    ui/                  # shadcn/ui primitives (33 active, Button, Dialog, Table, Card, etc.)
    admin/               # Admin-specific reusable components (sidebar, data tables, filters, guards)
    discover/            # Event discovery components (EventCard, BlindBoxEventCard, etc.)
    event/               # Event-related components (CompletedEventCard, PostMatchEventCard, etc.)
    profile/             # Profile & personality components (PersonalityRadarChart, QuizIntro, etc.)
    matching/            # Matching visualization (MatchRevealAnimation, MatchCelebrationOverlay)
    navigation/          # BottomNav, MobileHeader
    animation/           # AnimationLoadingScreen
    icebreaker/          # Icebreaker tools
    feedback/            # Post-event feedback
    event-pool-registration/  # Pool registration flow
    _archive/            # Unused legacy components (preserved for reference)
  pages/
    admin/               # Route-level page components
      AdminLayout.tsx    # Shell: sidebar (tiered nav) + header + breadcrumb + <Switch> routes
      AdminSidebar.tsx   # Tiered sidebar: daily-ops dock + collapsible groups (审核与调优 / 配置与系统 / 实验室)
      AdminDashboardPage.tsx
      AdminPoolsPage.tsx
      ...
  hooks/
    auth/                # useAuth
    notifications/       # useNotificationCounts
    event/               # useEventPoolRegistration, useGroupAnalysis, useRevealStatus, useWebSocket
    ui/                  # use-toast, use-mobile, useSoundEffects, usePreloadImages
    game/                # useLevelUp, useXPNotification
    icebreaker/          # use-icebreaker-messages, use-icebreaker-topics
  lib/                   # Utilities (queryClient, api helpers, formatters, csvExport, dateUtils)
  static-data/           # Static data / lookup tables
```

**Rules:**
- Pages go in `pages/admin/` — NOT top-level `pages/`
- Components go in feature subdirs (discover/, event/, profile/, etc.) — NOT flat at `components/`
- Hooks go in domain subdirs (auth/, event/, ui/, etc.) — NOT flat at `hooks/`
- Admin-local UI goes in `components/` — shared primitives go to `packages/shared/src/ui/`
- Every page must handle: loading, empty, error, unauthorized states
- **Date formatting:** Use `@/lib/dateUtils` (`safeFormat`, `fmtDate`, `fmtDateTime`) instead of raw `format(new Date(...))` to avoid crashes on invalid strings
- **CSV export:** Use `@/lib/csvExport` (`downloadCsv`) — formula-injection safe with UTF-8 BOM for Excel
- Data tables use shadcn/ui Table + TanStack Query (`useQuery`)
- Forms use `react-hook-form` + `zod` schemas

---

## 5. RBAC Pattern

Admin pages MUST gate on `user.isAdmin`. The pattern in `AdminApp.tsx`:

```typescript
if (!user?.isAdmin) {
  return <UnauthorizedPage />; // 403-equivalent UI
}
```

**Role hierarchy** (from `docs/admin/admin-rbac-matrix.md`):
- `super_admin` — all permissions
- `operator` — pool management, user management, venue CRUD
- `viewer` — read-only dashboards

Check specific permissions using the shared RBAC helpers, not hardcoded role checks.

---

## 6. Data Fetching

- **Queries**: `useQuery` / `useMutation` from `@tanstack/react-query`
- **Query client**: Import from `@/lib/queryClient`
- **API calls**: `fetch()` with `credentials: "include"` (cookie-based session)
- **Admin API base**: `/api/admin/*` — all admin routes require admin middleware server-side
- **Cache invalidation**: `queryClient.invalidateQueries()` after mutations
- **Error handling**: Catch and display user-friendly error toasts (via shadcn/ui Toast)

---

## 7. UI Conventions

- **Styling**: Tailwind CSS 3 with custom neon/glass theme
- **Components**: shadcn/ui (Radix primitives)
- **Charts**: Recharts (`BarChart`, `LineChart`, `PieChart`, etc.)
- **Icons**: Lucide React (`lucide-react`)
- **Animation**: framer-motion (subtle, not excessive)
- **Responsive**: Admin is desktop-first but should not break on tablet
- **Dark mode**: `ThemeToggle` component exists — support `dark` class on `<html>`

---

## 8. Guardrails (CI-Enforced)

`npm run guardrails` checks:
- No committed `.env` files
- No legacy identifiers
- No imports from root `shared/`
- No cross-app imports
- Admin routes must enforce admin middleware

---

## 9. Related Docs

- [`README.md`](./README.md) — workspace overview, commands
- [`../../docs/admin/admin-rbac-matrix.md`](../../docs/admin/admin-rbac-matrix.md) — role/permission matrix
- [`../../apps/server/src/README.md`](../../apps/server/src/README.md) — server domain ownership
- [`../../.github/skills/admin-client-frontend/SKILL.md`](../../.github/skills/admin-client-frontend/SKILL.md)
- [`../../.github/skills/admin-audit-and-rbac-governance/SKILL.md`](../../.github/skills/admin-audit-and-rbac-governance/SKILL.md)
