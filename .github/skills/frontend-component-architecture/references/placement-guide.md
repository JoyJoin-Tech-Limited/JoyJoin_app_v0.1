# Component Placement Guide

## Detailed Placement Decision Tree

```
Is it used by both user-client and admin-client?
├─ Yes → packages/shared/src/ui/
│   └─ Does it depend on app-specific routing/auth/API hooks?
│       ├─ Yes → Split: primitive in shared, wrapper in app
│       └─ No → Keep in shared
└─ No → apps/<client>/src/components/
    └─ Is it a design-system primitive (Button, Input, Card)?
        ├─ Yes → Consider promoting to shared
        └─ No → App workspace only
```

**Never:**
- Import from `apps/*` into `packages/shared`
- Import from `apps/user-client` into `apps/admin-client` or vice versa
- Place app-specific page components inside `packages/shared`

## Shared Package Export Patterns

New shared primitives must be exported from `packages/shared/src/index.ts` or added as a subpath export in `packages/shared/package.json`.

```ts
// packages/shared/src/ui/TagChip.tsx
export function TagChip({ label, variant }: TagChipProps) { /* … */ }

// packages/shared/src/index.ts
export { TagChip } from "./ui/TagChip";
```

Consumers import via `@shared/ui/TagChip` or `@joyjoin/shared`.

## Thin Wrapper Examples

### Web wrapper (user-client)
```tsx
// apps/user-client/src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { buttonVariants } from "@shared/ui/buttonVariants";

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(/* … */);
export { Button, buttonVariants };
```

### Taro wrapper (mini-program)
```tsx
// apps/mini-program/src/components/ui/button.tsx
import { Button as SharedButton } from "@shared/ui";
// Renderer-specific shim if needed
```

Do not fork behaviour casually. Keep local wrappers aligned with the shared primitive and reuse shared variant definitions.

## Loading State Patterns

- Use the `loading` prop on `Button` to show a spinner and disable click
- Pass `disabled` to form elements directly — do not use CSS-only opacity tricks
- `loading` and `disabled` are distinct: `loading` = in-flight; `disabled` = unavailable

### Skeleton and empty states
- Use skeletons for initial data loads where layout should not shift
- Use explicit empty-state illustrations with mascot + short copy for zero-data screens
- Never leave a component in an unstyled default state during async work

## Semantic Correctness Checklist

- Interactive elements must use `<button>` for actions, `<a>` for navigation
- Icon-only buttons require `aria-label`
- Avoid `<div onClick>` for interactive controls
- Use `asChild` (Radix Slot) when a shared primitive should render as a different element

## Filesystem MCP for Cross-Workspace Scaffolding

When adding a shared primitive across multiple workspaces, use the **Filesystem MCP server** (`filesystem`) to create files, verify directory structure, and ensure consistent naming.
