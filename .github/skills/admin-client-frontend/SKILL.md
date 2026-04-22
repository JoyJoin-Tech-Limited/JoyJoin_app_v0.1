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

- Task is about backend admin API routes or audit logging (use `server-domain-architecture` or `admin-audit-and-rbac-governance`)
- Task is purely about shared UI primitives that belong in `packages/shared` (use `frontend-component-architecture`)
- Task is about the user-facing web app or mini-program (use `frontend-component-architecture` or `mini-program-frontend-excellence`)
- Task is about generic CSS tokens or design-system variants (use `design-system-governance`)

## Tech stack and conventions

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

## Routing structure

Admin routes are mounted under `/admin` in `AdminLayout.tsx`. All admin pages are lazy-loaded.

```tsx
// apps/admin-client/src/pages/admin/AdminLayout.tsx
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
// ... other lazy imports

<Switch>
  <Route path="/admin" component={AdminDashboard} />
  <Route path="/admin/dashboard" component={AdminDashboard} />
  <Route path="/admin/users" component={AdminUsersPage} />
  <Route path="/admin/event-pools" component={AdminEventPoolsPage} />
  {/* ... */}
</Switch>
```

- New admin pages → add a lazy import and a `<Route>` in `AdminLayout.tsx`
- The `AdminGuard` component wraps the layout and redirects unauthenticated/non-admin users to `/admin/login`

## Auth and RBAC UI patterns

### useAuth hook

```ts
// apps/admin-client/src/hooks/useAuth.ts
export interface AdminAuthUser {
  id: string;
  displayName?: string | null;
  isAdmin: boolean;
  adminRole?: string; // 'super_admin' | 'operator' | 'viewer'
}
```

- Always use `useAuth()` to get the current admin user. Do not create a separate auth context.
- `isAdmin` is required for any `/admin` route access.
- `adminRole` controls feature visibility:
  - `super_admin`: full access including admin account management
  - `operator`: can manage pools, events, users, content
  - `viewer`: read-only dashboards and tables

### RBAC gating patterns

**Sidebar navigation gating:**
```tsx
const isSuperAdmin = user?.adminRole === 'super_admin';
// Conditionally render "系统管理" group in AdminSidebar
```

**Page-level gating:**
```tsx
if (user?.adminRole !== 'super_admin') {
  return <div>仅超级管理员可访问此页面</div>;
}
```

**Action-level gating:**
```tsx
<Button disabled={user?.adminRole === 'viewer'}>
  保存修改
</Button>
```

## Data fetching patterns

Use `apiRequest` from `@/lib/queryClient` for mutations; use `useQuery` for reads.

```tsx
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from "@tanstack/react-query";

const { data, isLoading } = useQuery({
  queryKey: ["/api/admin/stats"],
});

const mutation = useMutation({
  mutationFn: (data) => apiRequest("POST", "/api/admin/event-pools", data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
  },
});
```

- Always include `credentials: "include"` (handled by `apiRequest`)
- Invalidate related queries after mutations
- Use `useToast()` for success/error feedback

## Recharts dashboard patterns

Wrap charts in `<ResponsiveContainer width="100%" height={300}>`.

```tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={300}>
  <BarChart data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="name" />
    <YAxis />
    <Tooltip />
    <Bar dataKey="value" fill="hsl(200, 80%, 50%)" />
  </BarChart>
</ResponsiveContainer>
```

- Prefer HSL colors aligned with Tailwind theme values
- Use `Skeleton` from `@/components/ui/skeleton` for loading states
- Provide empty-state fallback when data arrays are empty

## Pool admin surfaces

Event pool admin (`AdminEventPoolsPage`) is the canonical example of a complex admin surface:

- **List view:** Cards with filter chips (city, waiting status, event status)
- **Create/Edit:** Dialog with `react-hook-form` + zod schema, `Select` for city/district
- **Details:** Dialog showing registrations table and matched groups
- **Mutations:** Create, update, add-member with `queryClient` invalidation
- **Business status badges:** Derive from `status` + `pendingCount` + `matchedCount`

Follow this pattern for other resource admin pages (venues, events, users).

## UI component conventions

- Import UI primitives from `@/components/ui/*` (local shadcn wrappers), not directly from Radix
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent` for page sections
- Use `Dialog` + `DialogContent` for create/edit/detail modals
- Use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` for data grids
- Use `Badge` for status labels with variant mapping (`default`, `secondary`, `destructive`, `outline`)
- Use `data-testid` attributes on primary interactive elements for testability

## Quick Examples

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
- **Chart renders at 0 height** — Recharts requires an explicit parent height. Wrap in `ResponsiveContainer` and ensure the parent has a defined height (e.g., `height={300}` or a flex container with height).
- **Mutation does not update the list** — Verify `queryClient.invalidateQueries` uses the exact `queryKey` from the list query, including all segments.
- **Admin sidebar item missing for some users** — Check `AdminSidebar.tsx`: items in `systemItems` are gated by `isSuperAdmin`. Non-super-admin items belong in other groups.
- **Login loop after successful auth** — Ensure `useAuth` query key is `['/api/auth/user']` and the login mutation invalidates it with `queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] })`.

## Review checklist

- [ ] New admin page is lazy-loaded and registered in `AdminLayout.tsx`
- [ ] Sidebar navigation item added in `AdminSidebar.tsx` under the correct group
- [ ] RBAC gates use `user?.adminRole` (not hard-coded checks against unrelated fields)
- [ ] Data mutations invalidate the correct TanStack Query keys
- [ ] Recharts charts use `ResponsiveContainer` and have a defined height
- [ ] Loading states use `Skeleton` (not inline spinners) for charts and tables
- [ ] Empty states show a friendly fallback instead of crashing or rendering nothing
- [ ] `data-testid` attributes added to primary interactive elements

## Related skills

| Skill | When to hand off |
|-------|------------------|
| `server-domain-architecture` | Adding or changing admin API routes |
| `admin-audit-and-rbac-governance` | Changing admin permissions, audit logging, or sensitive admin actions |
| `frontend-component-architecture` | Deciding whether a component belongs in `packages/shared` vs admin-client |
| `design-system-governance` | Adding new CSS tokens, CVA variants, or accessibility changes |
| `event-pool-and-matching-operations` | Understanding pool lifecycle, match runs, or group semantics |
| `auth-session-and-safety-boundaries` | Gating routes at the API layer or adding auth checks |
| `platform-observability-and-ops` | Adding metrics, logging, or health checks to admin surfaces |

## Canonical References

- `apps/admin-client/src/App.tsx` — Root router (user + admin routes)
- `apps/admin-client/src/AdminApp.tsx` — Standalone admin router
- `apps/admin-client/src/pages/admin/AdminLayout.tsx` — Admin layout with lazy routes
- `apps/admin-client/src/components/admin/AdminSidebar.tsx` — Sidebar navigation + RBAC groups
- `apps/admin-client/src/components/admin/AdminGuard.tsx` — Auth guard redirect
- `apps/admin-client/src/hooks/useAuth.ts` — Admin auth hook (`AdminAuthUser`, `adminRole`)
- `apps/admin-client/src/pages/admin/AdminLoginPage.tsx` — Admin login form
- `apps/admin-client/src/pages/admin/AdminDashboard.tsx` — Dashboard with stat cards
- `apps/admin-client/src/pages/admin/AdminEventPoolsPage.tsx` — Pool CRUD + details
- `apps/admin-client/src/pages/admin/AdminAccountsPage.tsx` — RBAC account management
- `apps/admin-client/src/components/admin/RegistrationFunnelDashboard.tsx` — Recharts example
- `apps/admin-client/src/lib/queryClient.ts` — `apiRequest`, `resolveApiUrl`, `queryClient`
- `apps/admin-client/package.json` — Dependencies (Recharts, wouter, TanStack Query, etc.)
