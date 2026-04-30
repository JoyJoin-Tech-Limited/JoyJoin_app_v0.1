# Admin Client Patterns Reference

## Routing with wouter

Admin routes are mounted under `/admin` in `AdminLayout.tsx`. All admin pages are lazy-loaded.

```tsx
// apps/admin-client/src/pages/admin/AdminLayout.tsx
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));

<Switch>
  <Route path="/admin" component={AdminDashboard} />
  <Route path="/admin/dashboard" component={AdminDashboard} />
  <Route path="/admin/users" component={AdminUsersPage} />
  <Route path="/admin/event-pools" component={AdminEventPoolsPage} />
</Switch>
```

- New admin pages → add a lazy import and a `<Route>` in `AdminLayout.tsx`
- The `AdminGuard` component wraps the layout and redirects unauthenticated/non-admin users to `/admin/login`

## RBAC UI Gating Details

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

### Gating patterns

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

## Data Fetching Patterns

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

## Recharts Dashboard Patterns

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

## Pool Admin Surfaces

Event pool admin (`AdminEventPoolsPage`) is the canonical example of a complex admin surface:

- **List view:** Cards with filter chips (city, waiting status, event status)
- **Create/Edit:** Dialog with `react-hook-form` + zod schema, `Select` for city/district
- **Details:** Dialog showing registrations table and matched groups
- **Mutations:** Create, update, add-member with `queryClient` invalidation
- **Business status badges:** Derive from `status` + `pendingCount` + `matchedCount`

Follow this pattern for other resource admin pages (venues, events, users).

## shadcn/ui Table and Form Patterns

- Import UI primitives from `@/components/ui/*` (local shadcn wrappers), not directly from Radix
- Use `Card`, `CardHeader`, `CardTitle`, `CardContent` for page sections
- Use `Dialog` + `DialogContent` for create/edit/detail modals
- Use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` for data grids
- Use `Badge` for status labels with variant mapping (`default`, `secondary`, `destructive`, `outline`)
- Use `data-testid` attributes on primary interactive elements for testability
- Forms use `react-hook-form` + zod + `@hookform/resolvers`
