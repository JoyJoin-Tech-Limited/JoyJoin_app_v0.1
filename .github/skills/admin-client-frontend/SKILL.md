---
name: admin-client-frontend
description: >
  Build and maintain the JoyJoin admin portal UI in apps/admin-client. Covers Recharts dashboards,
  shadcn/ui tables and forms, RBAC UI gating (super_admin / operator / viewer), pool admin surfaces,
  auth/session patterns, and wouter routing. Use when adding admin pages, charts, admin-specific
  components, or modifying the admin sidebar/login. Trigger phrases: "admin dashboard", "add an admin
  page", "Recharts chart", "admin sidebar", "pool management UI", "admin login", "RBAC admin",
  "super_admin only UI", "event pool admin", "admin table", "admin guard".
---

# admin-client-frontend

**Core rule:** The admin client (`apps/admin-client`) is a React 18 SPA built with Vite, Tailwind CSS, shadcn/ui (Radix primitives), wouter, TanStack Query, and Recharts. It is distinct from the user client and must never import user-client source files.

## When to use this skill

- Adding or modifying an admin portal page, component, or route
- Building dashboards with Recharts (BarChart, LineChart, PieChart, etc.)
- Working with admin tables, forms, dialogs, or filtering UIs
- Gating UI by admin RBAC role (`super_admin`, `operator`, `viewer`)
- Modifying `AdminSidebar`, `AdminGuard`, `AdminLoginPage`, or `AdminLayout`
- Creating or editing event-pool admin surfaces (create/edit/details/matching)
- Admin auth/session handling (login, logout, `useAuth` bootstrap)

## When NOT to use this skill

- Backend admin API routes or audit logging → use `server-domain-architecture` or `admin-audit-and-rbac-governance`
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

## Quick examples

**User says:** "I need to add a new admin page for coupon management."
**Apply this skill by:**
1. Create `apps/admin-client/src/pages/admin/AdminCouponsPage.tsx` (lazy-loaded page)
2. Add lazy import + `<Route path="/admin/coupons">` in `AdminLayout.tsx`
3. Add sidebar item in `AdminSidebar.tsx` under the appropriate group
4. Use `useQuery` for listing, `useMutation` + `apiRequest` for CRUD
5. Wrap mutations with toast feedback and query invalidation

**User says:** "The admin dashboard needs a new line chart for weekly revenue."
**Apply this skill by:**
1. Add the data field to the `AdminStats` interface in `AdminDashboard.tsx`
2. Fetch via `useQuery` or extend the existing `/api/admin/stats` response
3. Render with `<ResponsiveContainer><LineChart>...</LineChart></ResponsiveContainer>`
4. Use HSL stroke colors and add a loading skeleton
5. Include an empty-state fallback

## Troubleshooting

- **Admin page shows 404 or blank screen** — Check that the route was added to `AdminLayout.tsx` and the lazy import path is correct.
- **Chart renders at 0 height** — Recharts requires an explicit parent height. Wrap in `ResponsiveContainer` and ensure the parent has a defined height.
- **Mutation does not update the list** — Verify `queryClient.invalidateQueries` uses the exact `queryKey` from the list query.
- **Admin sidebar item missing for some users** — Check `AdminSidebar.tsx`: items in `systemItems` are gated by `isSuperAdmin`.
- **Login loop after successful auth** — Ensure `useAuth` query key is `['/api/auth/user']` and the login mutation invalidates it.

## Review checklist

- [ ] New admin page is lazy-loaded and registered in `AdminLayout.tsx`
- [ ] Sidebar navigation item added in `AdminSidebar.tsx` under the correct group
- [ ] RBAC gates use `user?.adminRole` (not hard-coded checks against unrelated fields)
- [ ] Data mutations invalidate the correct TanStack Query keys
- [ ] Recharts charts use `ResponsiveContainer` and have a defined height
- [ ] Loading states use `Skeleton` (not inline spinners) for charts and tables
- [ ] Empty states show a friendly fallback instead of crashing or rendering nothing
- [ ] `data-testid` attributes added to primary interactive elements

## References

- [`references/patterns.md`](references/patterns.md) — Recharts patterns, shadcn/ui table/form patterns, RBAC gating details, pool admin surfaces, wouter routing details
