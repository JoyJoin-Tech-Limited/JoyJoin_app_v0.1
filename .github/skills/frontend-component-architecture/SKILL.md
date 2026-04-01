---
name: Frontend Component Architecture
description: Structure frontend components correctly across packages/shared, apps/user-client, and apps/admin-client — shared primitives, thin app wrappers, semantic correctness, and composition patterns.
---

# Frontend Component Architecture

**Core rule:** Shared UI primitives live in `packages/shared/src/ui/`. App-specific composition and styling wrappers live in `apps/*/src/components/ui/`. Application features live in the appropriate app workspace only.

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
| Active onboarding pages | `apps/user-client/src/features/onboarding/active/` |
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

## App wrapper pattern

App wrapper files re-export the shared primitive and add a local styling entry point:

```tsx
// apps/user-client/src/components/ui/button.tsx
export { Button, buttonVariants } from '@joyjoin/shared';
```

Do not duplicate component logic in the wrapper. The shared package owns the runtime.

## Semantic correctness

- Interactive elements must use semantically correct HTML (`<button>` for actions, `<a>` for navigation)
- Use the shared `Button` component — it always renders a native `<button>` (or delegated slot via `asChild`) and handles `disabled` and `loading` correctly
- Avoid `<div onClick>` for interactive controls
- Icon-only buttons require `aria-label`

## Interaction state

- Use `loading` prop on `Button` to show a spinner and disable click — do not manage a separate disabled overlay
- Pass `disabled` to form elements directly — do not use CSS-only opacity tricks that leave the element interactive
- `loading` and `disabled` are distinct states: `loading` implies an in-flight operation; `disabled` implies unavailable

## Composition patterns

- Prefer wrapping/composing shared primitives over forking them
- Use `asChild` (Radix Slot) when a shared primitive should render as a different element for routing purposes
- Use `React.lazy()` for non-critical page-level components in `App.tsx` — never static imports for pages

## Common mistakes to avoid

- Duplicating a Button or Input component in an app workspace instead of wrapping the shared primitive
- Importing a shared primitive but then overriding its core behaviour with local state that diverges from the design system
- Adding business logic (API calls, auth checks) directly inside `packages/shared/src/ui/`
- Using `pointer-events-none` + `opacity-50` instead of the semantic `disabled` attribute
- Creating a full-page component inside `packages/shared`

## Related files

- `packages/shared/src/ui/Button.tsx` — shared Button runtime
- `packages/shared/src/ui/buttonVariants.ts` — CVA variant definitions
- `apps/user-client/src/components/ui/button.tsx` — user-client re-export
- `apps/admin-client/src/components/ui/button.tsx` — admin-client re-export
- `docs/button-design.md` — design rationale and usage examples
- `docs/architecture/current-state.md` — workspace placement rules
