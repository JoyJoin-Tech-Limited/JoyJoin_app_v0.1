---
name: design-system-governance
description: >
  Maintain JoyJoin UI consistency through tokens, variants, accessibility expectations, documented
  exceptions, and migration discipline. Use when standardizing components, adding new variants, or
  reviewing visual exceptions. Trigger phrases: "add a button variant", "use a new colour",
  "migrate to the shared Button", "document a visual exception", "check this for token usage".
---

# Design System Governance

**Core rule:** Visual consistency is enforced through CSS custom properties (tokens)
and CVA variants defined in `packages/shared`. New components extend the token system
— they do not introduce ad-hoc hex values or inline style overrides.

## When to use this skill

- Adding a new UI variant (colour, size, shape)
- Reviewing a component for token usage vs ad-hoc styling
- Documenting a visual exception
- Migrating a locally-styled component to use a shared primitive
- Checking accessibility of a new interactive component

## Source of truth

| Concern | Location |
|---------|----------|
| Button variant logic (web) | `packages/shared/src/ui/buttonVariants.ts` |
| Button design rationale (web) | `docs/design/button-design.md` |
| Button primitive (mini-program) | `apps/mini-program/src/components/ui/Button.tsx` + `Button.scss` — separate from shared CVA; uses `variant` ('primary' \| 'secondary' \| 'brand' \| 'wechat') and `size` ('default' \| 'sm') |
| CSS tokens (light + dark) | `apps/*/src/index.css` — `:root` and `.dark` |
| Brand colour system | `joyjoin-brand-guidelines` skill |
| Tailwind config | `apps/*/tailwind.config.ts` |

## Token overview

CSS custom properties bridge the design system and component code:

- `--btn-primary-gradient` and `--btn-shadow-primary` are button-specific tokens
- `--ring`, `--border`, `--background`, `--foreground` follow shadcn/ui convention
- Tokens must be defined in the app's `index.css` (light + dark blocks), not inline
- When adding a new token, add it to **both** apps' `index.css` files

## Variant overview

- All button variants are defined in `packages/shared/src/ui/buttonVariants.ts` using CVA
- Valid variants: `default`, `secondary`, `outline`, `ghost`, `destructive`
- Do not create one-off styled buttons by applying Tailwind directly on `<button>`
- If a new visual treatment is needed more than once, define it as a named variant

For the full token table, CVA examples, accessibility checklist, exception
documentation format, and platform-specific notes, see
[`references/token-guide.md`](./references/token-guide.md).

## Quick examples

**"Add a `warning` variant to the Button."**
→ Add to `packages/shared/src/ui/buttonVariants.ts` using CVA, define tokens in
  both `apps/*/src/index.css` `:root` and `.dark`, and run both app builds.

**"This component uses a hard-coded purple hex — can I leave it?"**
→ No. Replace with `--btn-primary-gradient` or nearest brand token. If a genuine
  exception exists, add a `{/* Exception: … */}` comment with rationale.

## Troubleshooting

**Dark-mode token is missing — component looks broken in `.dark`**
→ A token was added to `:root` but not `.dark`. Add the dark value in both apps.

**Focus ring is invisible after a style change**
→ `outline` was suppressed without replacement. Restore `--ring` token-based focus
   ring or add an equivalent indicator.

**App-local variant drifted from shared CVA**
→ Move the variant to `buttonVariants.ts`, delete the local override, rebuild.

**Component failing accessibility contrast check**
→ Verify against WCAG AA 4.5 : 1 ratio documented in `docs/button-design.md`.

## Review checklist

- [ ] No hard-coded hex values — all colours reference CSS tokens
- [ ] New tokens are in both `:root` and `.dark` in both app `index.css` files
- [ ] New variants are in `packages/shared/src/ui/buttonVariants.ts`
- [ ] Focus ring is visible and uses `--ring`
- [ ] Touch target for primary CTAs is at least 44 px
- [ ] Visual exceptions are documented with a comment and rationale
- [ ] Font family uses semantic Tailwind class for normal product UI
- [ ] Custom display font is applied only to the specific element

## Related files

- `packages/shared/src/ui/Button.tsx`
- `packages/shared/src/ui/buttonVariants.ts`
- `apps/user-client/src/index.css`
- `apps/admin-client/src/index.css`
- [`references/token-guide.md`](./references/token-guide.md)
