---
name: admin-client-frontend
description: >
  Build and maintain the JoyJoin admin portal UI in apps/admin-client. Covers the console truth
  contract (single metric source, KPI baselines, honest action queue), Recharts dashboards, shadcn/ui
  tables and forms, RBAC UI gating (super_admin / operator / viewer), pool admin surfaces,
  auth/session patterns, and wouter routing. Use when adding admin pages, console KPIs, dashboards,
  charts, admin-specific components, or modifying the admin sidebar/login/nav. Trigger phrases:
  "admin dashboard", "admin console", "add an admin page", "KPI card", "action queue", "console
  truth", "nav badge", "Recharts chart", "admin sidebar", "pool management UI", "admin login",
  "RBAC admin", "super_admin only UI", "feature flags page", "event pool admin", "admin table",
  "admin guard".
---

# admin-client-frontend

**Core rule:** The admin client (`apps/admin-client`) is a React 18 SPA built with Vite, Tailwind CSS, shadcn/ui (Radix primitives), wouter, TanStack Query, and Recharts. It is distinct from the user client and must never import user-client source files.

## When to use this skill

- Adding or modifying an admin portal page, component, or route
- Adding or changing a console KPI, action-queue row, or nav badge
- Building dashboards with Recharts (BarChart, LineChart, PieChart, etc.)
- Working with admin tables, forms, dialogs, or filtering UIs
- Gating UI by admin RBAC role (`super_admin`, `operator`, `viewer`)
- Modifying `AdminSidebar`, `AdminGuard`, `AdminLoginPage`, or `AdminLayout`
- Creating or editing event-pool admin surfaces (create/edit/details/matching)
- Admin auth/session handling (login, logout, `useAuth` bootstrap)

## When NOT to use this skill

- Backend admin API routes, metric SQL, or audit logging → use `server-domain-architecture` or `admin-audit-and-rbac-governance`
- Shared UI primitives that belong in `packages/shared` → use `frontend-component-architecture`
- User-facing web app or mini-program → use `frontend-component-architecture` or `mini-program-frontend-excellence`
- Generic CSS tokens or design-system variants → use `design-system-governance`

## Tech stack overview

| Layer | Technology |
|-------|------------|
| Bundler | Vite (port 5002) |
| Routing | wouter (`Switch`, `Route`, `useLocation`) |
| State / data | TanStack Query (`useQuery`, `useMutation`, `queryClient`) |
| UI primitives | shadcn/ui built on Radix UI (`@radix-ui/react-*`) |
| Charts | Recharts (`BarChart`, `LineChart`, `PieChart`, `ResponsiveContainer`, etc.) |
| Forms | react-hook-form + zod + `@hookform/resolvers` |
| Styling | Tailwind CSS 3 + `lucide-react` icons |
| Auth | Cookie-based session; `useAuth` fetches `/api/auth/user` |

## Auth and session patterns overview

- Always use `useAuth()` to get the current admin user. Do not create a separate auth context.
- `isAdmin` is required for any `/admin` route access.
- `adminRole` controls feature visibility: `super_admin` (full access), `operator` (manage pools/events/users), `viewer` (read-only).
- New admin pages are lazy-loaded and registered in `AdminLayout.tsx`.
- `AdminGuard` wraps the layout and redirects unauthenticated/non-admin users to `/admin/login`.

## Console truth contract (2026-10-22 → 2026-10-23)

The console is a decision surface, not a chart gallery. A number may only be displayed once it is
structurally correct — these rules are load-bearing and were each written after a real defect.

- **One metric source.** Cross-page counters come from `apps/server/src/lib/adminMetrics.ts` (SQL),
  funnel/coverage from `lib/adminAnalytics.ts`, both exposed read-only by
  `routes/domains/adminConsole.ts` (`/api/admin/{kpi,action-queue,nav-badges,analytics/funnel,analytics/events}`).
  `GET /api/admin/stats` and `/api/admin/ops-dashboard` delegate there. Never add a second
  aggregation path or re-derive a shared number in a page-specific route.
- **Every KPI names its own baseline.** A card shows the comparison window, the delta, and a
  drill-down link. With no baseline it renders 基线不足, never a percentage against zero. Sampled
  data must surface `isSampled` / `sampleSize` / `totalUsers` so a bounded sample is never read as
  the population.
- **The action queue is fixed and honest.** Seven rows always render, cleared rows included (they
  show 0 rather than disappearing), and each row navigates to a view that can actually resolve it —
  a row that leads nowhere is a bug, not a placeholder.
- **Revenue is two lines and they are never summed.** 单场票实收/场 is a rate
  (`payment_type='event'` cash ÷ formed events); 预付递延 · 已收未交付 is a liability with no trend
  line. Adding bundle/subscription payments into per-event cash inflated the figure 5.1× before
  2026-10-23.
- **Charts ship only after the series is correct.** `AdminDashboardV2` deliberately has none.
- **Rollback is a URL, not a flag:** `/admin/dashboard?v=1` via `AdminDashboardSwitch`. A flag would
  strand operator/viewer because `GET /api/admin/feature-flags` is `requireSuperAdmin`.
- **IA:** 16 nav entries across ten tabbed workspaces, with `AdminWorkspaceTabs` mounted once in the
  layout. Pinned-dock items may carry a `featureFlag`, but hide only when it is explicitly `false`,
  never while auth is still loading.
- **Exactly one `h1` per page, and its text equals the nav label verbatim.** Sticky `thead` only
  works when the table wrapper applies overflow-x alone (CSS Overflow 3 makes `overflow-x: auto` +
  `overflow-y: visible` impossible), so the wrapper must skip the scrollport when the head is sticky.
- **Role denial renders `AdminForbidden`** (role, attempted path, "re-login will not change the
  outcome"), never toast + redirect.
- **Nav badges are invalidated on every relevant mutation** (approve/reject/batch-approve/refund/
  moderation) and poll every 30s; a failed fetch yields `{}` and must never block navigation.
- **Exports name their scope** (全部N人 / 前N人-共M人) and use `fmtCsvDate` timestamps.
- **The flags page is 86 switches in 14 sections** with Chinese names, plain-language descriptions,
  and search — `featureFlagCopyContract` locks that copy.

Full contract: `DEVELOPER_QUICK_REFERENCE.md` §Console Truth Contract. PRD:
`docs/design/admin-console-redesign-20261022.md`.

## Quick examples

**User says:** "I need to add a new admin page for coupon management."
**Apply this skill by:**
1. Create `apps/admin-client/src/pages/admin/AdminCouponsPage.tsx` (lazy-loaded page)
2. Add lazy import + `<Route path="/admin/coupons">` in `AdminLayout.tsx`
3. Add sidebar item in `AdminSidebar.tsx` under the appropriate group
4. Use `useQuery` for listing, `useMutation` + `apiRequest` for CRUD
5. Wrap mutations with toast feedback and query invalidation

**User says:** "The admin dashboard needs a new KPI / chart for revenue."
**Apply this skill by:**
1. Decide what decision the number supports. If it cannot change an operator action, do not add it.
2. Add or reuse the metric in `apps/server/src/lib/adminMetrics.ts` (single SQL source) and expose it through `routes/domains/adminConsole.ts` — do not aggregate inside a page route or extend `/api/admin/stats` with a second query path.
3. Render it with `KpiCard`: named baseline window, delta, and a drill-down link; a missing baseline renders 基线不足 instead of a percentage.
4. Only if the series is structurally correct, add a Recharts chart on a dedicated analysis page — never on the decision dashboard, which is intentionally chart-free.
5. Cover loading (`Skeleton`), empty, and sampled-data states (`isSampled` / `sampleSize` / `totalUsers`).

## Troubleshooting

- **Admin page shows 404 or blank screen** — Check that the route was added to `AdminLayout.tsx` and the lazy import path is correct.
- **Chart renders at 0 height** — Recharts requires an explicit parent height. Wrap in `ResponsiveContainer` and ensure the parent has a defined height.
- **Mutation does not update the list** — Verify `queryClient.invalidateQueries` uses the exact `queryKey` from the list query.
- **Admin sidebar item missing for some users** — Check `AdminSidebar.tsx`: items in `systemItems` are gated by `isSuperAdmin`, and pinned-dock items with a `featureFlag` hide only when the flag is explicitly `false` (never while auth is loading).
- **Sticky table header does not stick** — The table wrapper is applying its own scrollport. Apply horizontal overflow only when the table has no sticky `thead`; `overflow-x: auto` + `overflow-y: visible` cannot coexist.
- **Two page titles / duplicate heading** — Exactly one `h1` per page, and its text must equal the nav label verbatim; nested sections use `h2`.
- **A funnel or KPI renders 0%** — `AdminFunnelPage` must refuse to render a percentage when the data source is not connected (show 数据源接入中), and a KPI with no baseline shows 基线不足.
- **Nav badge count is stale after an action** — Invalidate the nav-badges query on the mutation (approve/reject/batch-approve/refund/moderation); badges also poll every 30s and a failed fetch yields `{}` rather than blocking nav.
- **Operator gets a toast and lands on login** — Role denial must render `AdminForbidden` with the role and attempted path; a redirect hides the real cause.
- **Login loop after successful auth** — Ensure `useAuth` query key is `['/api/auth/user']` and the login mutation invalidates it.

## Review checklist

- [ ] New admin page is lazy-loaded and registered in `AdminLayout.tsx`
- [ ] Sidebar navigation item added in `AdminSidebar.tsx` under the correct group
- [ ] Exactly one `h1` on the page and it matches the nav label verbatim
- [ ] Any new number comes from `adminMetrics.ts` / `adminConsole.ts` — no second aggregation path
- [ ] KPIs name a baseline window, show a delta, and link a drill-down; zero baseline renders 基线不足
- [ ] Action-queue rows keep a stable count and every row resolves to a working view
- [ ] Revenue lines stay separate — a rate is never summed with a liability
- [ ] Role denial renders `AdminForbidden` (no toast + redirect)
- [ ] Nav-badges query invalidated on mutations and failure degrades to `{}`
- [ ] Tables with sticky `thead` do not sit inside an overflow-all wrapper
- [ ] Export filenames carry scope and `fmtCsvDate`
- [ ] RBAC gates use `user?.adminRole` (not hard-coded checks against unrelated fields)
- [ ] Data mutations invalidate the correct TanStack Query keys
- [ ] Recharts charts use `ResponsiveContainer` and have a defined height, and live on analysis pages (not the decision dashboard)
- [ ] Loading states use `Skeleton` (not inline spinners) for charts and tables
- [ ] Empty states show a friendly fallback instead of crashing or rendering nothing
- [ ] `data-testid` attributes added to primary interactive elements

## References

- [`references/patterns.md`](references/patterns.md) — Console truth contract details (metric source, KPI card, action queue, nav badges, `AdminForbidden`, sticky thead), Recharts patterns, shadcn/ui table/form patterns, RBAC gating details, pool admin surfaces, wouter routing details
