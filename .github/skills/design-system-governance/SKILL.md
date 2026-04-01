---
name: Design System Governance
description: Maintain JoyJoin UI consistency through tokens, variants, accessibility expectations, documented exceptions, and migration discipline. Use when standardizing components, adding new variants, or reviewing visual exceptions.
---

# Design System Governance

**Core rule:** Visual consistency is enforced through CSS custom properties (tokens) and CVA variants defined in `packages/shared`. New components extend the token system — they do not introduce ad-hoc hex values or inline style overrides.

## When to use this skill

- Adding a new UI variant (colour, size, shape)
- Reviewing a component for token usage vs ad-hoc styling
- Documenting a visual exception
- Migrating a locally-styled component to use a shared primitive
- Checking accessibility of a new interactive component

## Source of truth

| Concern | Location |
|---------|----------|
| Button variant logic | `packages/shared/src/ui/buttonVariants.ts` |
| Button design rationale | `docs/button-design.md` |
| CSS tokens (light + dark) | `apps/*/src/index.css` — `:root` and `.dark` blocks |
| Brand colour system | `.github/skills/joyjoin-brand-guidelines/SKILL.md` |
| Tailwind config | `apps/*/tailwind.config.ts` |

## Token ownership

CSS custom properties are the bridge between the design system and component code.

- `--btn-primary-gradient` and `--btn-shadow-primary` are button-specific tokens defined in both app `index.css` files
- `--ring`, `--border`, `--background`, `--foreground`, etc. follow the shadcn/ui convention
- Tokens must be defined in the app's `index.css` (light + dark blocks), not inline in components
- When adding a new token, add it to **both** apps' `index.css` files and document the design intent

## Variant discipline

- All button variants are defined in `packages/shared/src/ui/buttonVariants.ts` using CVA
- Valid variants: `default`, `secondary`, `outline`, `ghost`, `destructive`
- Do not create one-off styled buttons by applying Tailwind classes directly on `<button>` elements
- If a new visual treatment is needed more than once, define it as a named variant, not an inline override

## Accessibility expectations

- `lg` size (44 px height) is the minimum for primary page CTAs — meets WCAG 2.5.5 touch target
- `icon` size buttons must include `aria-label`
- Focus ring uses `--ring` token (warm purple) — do not suppress `outline` without an equivalent visible focus indicator
- Gradient fill on `default` buttons is tested to WCAG AA contrast (4.5 : 1) against white foreground
- `loading` state sets `aria-busy="true"` and `disabled`

## Documented visual exceptions

Approved deviations from standard tokens must be noted in a code comment with a rationale. Example:

```tsx
{/* Exception: uses --btn-shadow-primary instead of shadow-md to maintain brand hue alignment. */}
```

Do not allow undocumented exceptions to accumulate — they become invisible tech debt.

## Migration discipline

When standardising an existing component to use the shared primitive:

1. Verify the shared primitive covers the existing visual behaviour before switching
2. Add a documented exception if a small deviation is intentional
3. Remove the locally-styled version entirely once migrated — do not leave both in place
4. Run lint and both app builds to confirm no regressions

## Common mistakes to avoid

- Using a raw `<button>` or `<div onClick>` with Tailwind instead of the shared `Button`
- Defining a new colour as a hard-coded hex value in a component file
- Suppressing the focus ring without providing an equivalent visible alternative
- Treating dark-mode token omission as acceptable — every new token needs both `:root` and `.dark` definitions
- Creating app-local variants that diverge from the shared CVA definitions

## Related files

- `packages/shared/src/ui/Button.tsx`
- `packages/shared/src/ui/buttonVariants.ts`
- `apps/user-client/src/index.css`
- `apps/admin-client/src/index.css`
- `docs/button-design.md`
- `.github/skills/joyjoin-brand-guidelines/SKILL.md`
- `.github/skills/frontend-component-architecture/SKILL.md`
