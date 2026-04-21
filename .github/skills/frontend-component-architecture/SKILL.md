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

**Core rule:** Shared UI primitives live in `packages/shared/src/ui/`. App-specific composition and styling wrappers live in `apps/*/src/components/ui/`. Application features live in the appropriate app workspace only.

## When to use this skill

- Creating or moving a UI component
- Deciding whether a component belongs in `packages/shared` or an app workspace
- Reviewing a component for semantic correctness or accessibility
- Adding interactive state (loading, disabled, error) to a component

## Viewport / zero-scroll defaults

- Full-viewport web flows should follow [viewport-zero-scroll](../viewport-zero-scroll/SKILL.md): use **`apps/user-client/src/styles/viewport-lockdown.css`** (already pulled in by `apps/user-client/src/index.css`), prefer **`.no-scroll-container`**, use **`ResponsiveSpacer`** (`@shared/ui/ResponsiveSpacer`) for collapsible vertical rhythm, and keep **`ScrollSentinel`** mounted in **`App.tsx`** during development.
- **Mini-program (prioritised launch):** follow the same skill for Taro — **`ScrollView`** as the explicit scroll port, **`apps/mini-program/src/components/ResponsiveSpacer.tsx`**, and SCSS mixins **`viewport-min-height`** / **`no-scroll-page-shell`** in **`apps/mini-program/src/styles/_mixins.scss`**. Do not put DOM-only viewport utilities into `packages/shared` unless they are style-agnostic tokens; keep WeChat-specific layout in `apps/mini-program`.
- Do not introduce document-level vertical scroll for “hero + form” surfaces; use flex columns and explicit inner scroll only where the product exception applies (feeds, long lists) with a code comment at the scroll root.

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

Current app wrappers are thin local shims: they keep the runtime in the app workspace, but pull shared variant definitions from `packages/shared`.

```tsx
// apps/user-client/src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { buttonVariants } from "@shared/ui/buttonVariants";

// Local wrapper mirrors the shared Button API while reusing shared variants
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(/* ... */);
export { Button, buttonVariants };
```

Do not fork behaviour casually. Keep local wrappers behaviourally aligned with the shared primitive and reuse shared variant definitions instead of inventing app-only logic.

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
- `apps/user-client/src/components/ui/button.tsx` — user-client thin wrapper
- `apps/admin-client/src/components/ui/button.tsx` — admin-client thin wrapper
- `docs/button-design.md` — design rationale and usage examples
- `docs/architecture/current-state.md` — workspace placement rules

## Quick examples

**User says:** "I need a `TagChip` component. Should it go in shared or user-client?"
**Apply this skill by:** Checking whether admin-client would ever need it. If yes → `packages/shared/src/ui/TagChip.tsx` with no app-specific deps. If only user-client → `apps/user-client/src/components/`.
**Result:** Correct placement from the start; no circular imports, no duplication.

---

**User says:** "I want to render the shared `Button` as a `<Link>` for navigation."
**Apply this skill by:** Using the `asChild` prop with a Radix Slot so the `Button` renders as the router `Link` element without forking behaviour.
**Result:** Navigation uses semantic `<a>` markup while inheriting all shared button styles and states.

## Frontend Excellence Notes

### Platform Applicability

- Applies directly to Web component implementation in `apps/user-client`, `apps/admin-client`, and `packages/shared`.
- Applies indirectly to Taro mini-program work when behavior, state contracts, and design intent should be shared but renderer-specific code must stay separate.
- For shared interaction baselines such as state completeness, touch targets, and list-size heuristics, use [`design-system-governance`](../design-system-governance/SKILL.md); this skill focuses on component placement, semantics, and renderer boundaries.

### UI/UX & Aesthetic Guidance

- Keep business behavior and state contracts shareable where that improves parity, but keep renderer-specific markup and interaction wiring local to each renderer.
- Web components must use semantic elements such as `button`, `a`, `label`, `fieldset`, `main`, and `nav`; when future Taro parity is expected, keep DOM-specific markup from leaking into shared logic.

### Web-Specific Considerations

- Prefer shared primitives, thin app wrappers, and composition patterns such as `asChild` that preserve semantics without forking behavior.

### Taro-Specific Considerations

- If a component pattern needs a mini-program equivalent, implement a renderer-specific wrapper that uses `View`, `Text`, `Button`, `Input`, and `ScrollView` instead of assuming DOM portability.
- Prefer renderer-specific wrappers and list strategies over assuming DOM scrolling or DOM event patterns will carry over unchanged.

### Accessibility & Performance Notes

- Do not let composition patterns erase native semantics, keyboard affordances, or renderer-specific performance characteristics.
- On cross-platform component families, prefer sharing state logic and tokens while letting each renderer optimize for its own input and scroll model.

## Troubleshooting

- **`packages/shared` is importing from `apps/user-client`** — this is a hard violation. Move the dependency into shared or accept the duplication in the app workspace. Shared must never depend on an app.
- **Duplicate component exists in both `user-client` and the shared package** — remove the app-local copy and import from shared. If a small difference exists, check whether `asChild` or a prop extension in the shared primitive is sufficient.
- **Button renders as non-interactive `<div>` in screen reader** — a `<div onClick>` was used instead of `<button>`. Replace with the shared `Button` or a native `<button>`.
- **`disabled` prop has no visual or functional effect** — the element is using `pointer-events-none` CSS instead of the semantic `disabled` attribute. Use `disabled` directly so assistive tech reports the state correctly.

## Review checklist

- [ ] Component is placed in the correct layer (shared vs app workspace)
- [ ] `packages/shared` has no imports from `apps/*`
- [ ] Interactive elements use `<button>` or `<a>`, not `<div onClick>`
- [ ] Icon-only buttons have `aria-label`
- [ ] `loading` and `disabled` states are handled by the shared `Button` prop, not CSS overrides
- [ ] App wrapper does not fork or override core shared behaviour
