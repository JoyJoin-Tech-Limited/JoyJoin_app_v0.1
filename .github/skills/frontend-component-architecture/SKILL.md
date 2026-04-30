---
name: frontend-component-architecture
description: >
  Structure frontend components correctly across packages/shared, apps/user-client, and
  apps/admin-client — shared primitives, thin app wrappers, semantic correctness, and composition
  patterns. Use when creating, moving, or reviewing UI components. Trigger phrases: "where does
  this component go?", "should this be shared?", "wrap the shared Button", "is this semantically
  correct?", "add a loading state".
---

# Frontend Component Architecture

**Core rule:** Shared UI primitives live in `packages/shared/src/ui/`. App-specific
composition and styling wrappers live in `apps/*/src/components/ui/`. Application
features live in the appropriate app workspace only.

## When to use this skill

- Creating or moving a UI component
- Deciding whether a component belongs in `packages/shared` or an app workspace
- Reviewing a component for semantic correctness or accessibility
- Adding interactive state (loading, disabled, error) to a component

## Source of truth

| Layer | Location |
|-------|----------|
| Shared UI primitives | `packages/shared/src/ui/` |
| User client components | `apps/user-client/src/components/` |
| Admin client components | `apps/admin-client/src/components/` |
| Onboarding pages | `apps/user-client/src/features/onboarding/active/` |
| General app pages | `apps/user-client/src/pages/` |

## Component placement rules

**Put in `packages/shared/src/ui/` when:**
- Used (or likely to be used) by both `user-client` and `admin-client`
- Represents a design-system primitive (Button, Input, Card, Badge, etc.)
- Has no dependency on app-specific routing, auth context, or API hooks

**Put in `apps/*/src/components/` when:**
- Wraps a shared primitive with app-local styling or context
- Assembles multiple shared primitives into an app-specific composition
- Has a dependency on an app-specific hook, query, or route

**Never:**
- Import from `apps/*` into `packages/shared`
- Import from `apps/user-client` into `apps/admin-client` or vice versa
- Place app-specific page components inside `packages/shared`

For the full decision tree, wrapper examples, loading-state patterns, and export
patterns, see [`references/placement-guide.md`](./references/placement-guide.md).

## Quick examples

**"Where should `TagChip` go?"**
→ Check whether `admin-client` would ever need it. If yes →
  `packages/shared/src/ui/TagChip.tsx`. If only user-client →
  `apps/user-client/src/components/`.

**"Render the shared `Button` as a `<Link>`"**
→ Use the `asChild` prop with Radix Slot so the `Button` renders as the router
  `Link` element without forking behaviour.

## Troubleshooting

**`packages/shared` is importing from `apps/user-client`**
→ Hard violation. Move the dependency into shared or accept duplication in the
   app workspace.

**Duplicate component exists in both user-client and shared**
→ Remove the app-local copy and import from shared. If a small difference exists,
   check whether `asChild` or a prop extension is sufficient.

**Button renders as non-interactive `<div>` in screen reader**
→ A `<div onClick>` was used. Replace with the shared `Button` or native `<button>`.

**`disabled` prop has no visual or functional effect**
→ The element is using `pointer-events-none` CSS. Use the semantic `disabled`
   attribute directly.

## Review checklist

- [ ] Component is placed in the correct layer (shared vs app workspace)
- [ ] `packages/shared` has no imports from `apps/*`
- [ ] Interactive elements use `<button>` or `<a>`, not `<div onClick>`
- [ ] Icon-only buttons have `aria-label`
- [ ] `loading` and `disabled` states are handled by the shared `Button` prop
- [ ] App wrapper does not fork or override core shared behaviour

## Related files

- `packages/shared/src/ui/Button.tsx`
- `packages/shared/src/ui/buttonVariants.ts`
- `apps/user-client/src/components/ui/button.tsx`
- `apps/admin-client/src/components/ui/button.tsx`
- [`references/placement-guide.md`](./references/placement-guide.md)
