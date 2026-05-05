# Admin Client — Agent Onboarding Guide

> Compact instructions for AI coding agents. Last updated: 2026-05-04

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
- `AdminApp.tsx` as app root (NOT `App.tsx` — `App.tsx` exists but is a legacy stub)
- `wouter` for routing (NOT React Router)
- `useAuth()` from `@/hooks/useAuth` — checks `user.isAdmin`
- `@/components/ui/*` for shadcn primitives (Button, Dialog, Table, etc.)
- `@/components/admin/*` for admin-specific components
- `@/pages/admin/*` for admin route pages
- `Recharts` for charts/dashboards
- `react-hook-form` + `zod` for form validation
- `@tanstack/react-query` for server state
- `framer-motion` for animations

**Legacy — never use:**
- `App.tsx` (stub file, exists but `AdminApp.tsx` is the real entry)
- Direct router imports from non-wouter libraries
- Hardcoded role strings — use the RBAC helper from shared
- Admin pages placed outside `pages/admin/`

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
                    ├── /dashboard
                    ├── /pools
                    ├── /users
                    ├── /venues
                    ├── /payments
                    ├── /analytics
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
    ui/                  # shadcn/ui primitives (Button, Dialog, Table, Card, etc.)
    admin/               # Admin-specific reusable components (sidebars, data tables, filters)
    *.tsx                # Admin-local non-shared components
  pages/
    admin/               # Route-level page components
      AdminLayout.tsx    # Shell: sidebar + header + <Switch> routes
      AdminDashboardPage.tsx
      AdminPoolsPage.tsx
      ...
  hooks/                 # Admin-specific hooks (useAuth, useAdminQuery, etc.)
  lib/                   # Utilities (queryClient, api helpers, formatters)
  data/                  # Static data / lookup tables
```

**Rules:**
- Pages go in `pages/admin/` — NOT top-level `pages/`
- Admin-local UI goes in `components/` — shared primitives go to `packages/shared/src/ui/`
- Every page must handle: loading, empty, error, unauthorized states
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

**Role hierarchy** (from `docs/admin-rbac-matrix.md`):
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
- [`../../docs/admin-rbac-matrix.md`](../../docs/admin-rbac-matrix.md) — role/permission matrix
- [`../../apps/server/src/README.md`](../../apps/server/src/README.md) — server domain ownership
- [`../../.github/skills/admin-client-frontend/SKILL.md`](../../.github/skills/admin-client-frontend/SKILL.md)
- [`../../.github/skills/admin-audit-and-rbac-governance/SKILL.md`](../../.github/skills/admin-audit-and-rbac-governance/SKILL.md)
