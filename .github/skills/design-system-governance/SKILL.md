---
name: design-system-governance
description: >
  Maintain JoyJoin UI consistency through tokens, variants, accessibility expectations, documented
  exceptions, and migration discipline. Use when standardizing components, adding new variants, or
  reviewing visual exceptions. Trigger phrases: "add a button variant", "use a new colour",
  "migrate to the shared Button", "document a visual exception", "check this for token usage".
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

## Typography token ownership

JoyJoin uses a three-role semantic typography system. Product UI surfaces should use these tokens and their corresponding Tailwind utilities instead of ad-hoc `fontFamily` inline styles or raw font-family declarations in component files.

| Role | CSS variable | Tailwind class | Use for |
|------|-------------|----------------|---------|
| System UI | `--font-ui` | `font-ui` | All dense / functional UI — forms, body, labels, legal, settings, transactional |
| Chinese display | `--font-cn-display` | `font-cn-display` | Short high-impact Chinese moments — hero headlines, tab labels, premium CTAs, celebratory text |
| English brand | `--font-en-brand` | `font-en-brand` | JoyJoin English wordmark / brand accent only |

These variables are defined in `apps/user-client/src/assets/fonts/fonts.css` and mapped to Tailwind utilities in `apps/user-client/tailwind.config.ts`.

In `apps/user-client/src/index.css`, `.font-brand` is a backward-compatible alias for `var(--font-cn-display)` (the Chinese display role).

The admin client keeps its own local compatibility mapping in `apps/admin-client/src/index.css`.

When that semantic role is available, new code should prefer `font-cn-display` (or the `--font-cn-display` CSS variable) for Chinese display surfaces.

**Do not** scatter `style={{ fontFamily: '...' }}` inline overrides across normal product UI components. Use the semantic Tailwind classes instead. Current exceptions are limited to rendering contexts where utility classes are not practical or are serialized into generated assets (for example SVG/canvas/share-card renderers), plus older surfaces not yet migrated. When touching those areas, migrate to semantic classes if the runtime supports them; otherwise document the exception clearly.

See `.github/skills/joyjoin-brand-guidelines/SKILL.md` for the full typography decision guide including WeChat Mini Program constraints.

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

## Quick examples

**User says:** "Add a `warning` variant to the Button for destructive-but-reversible actions."
**Apply this skill by:** Adding the new variant to `packages/shared/src/ui/buttonVariants.ts` using CVA, defining the required tokens in both `apps/*/src/index.css` `:root` and `.dark` blocks, and running both app builds.
**Result:** Variant is available consistently in both clients, tokens are theme-aware, and no ad-hoc hex values appear in component files.

---

**User says:** "This component uses a hard-coded purple hex — can I leave it for now?"
**Apply this skill by:** No — replace it with the `--btn-primary-gradient` or nearest brand token. If a genuine exception exists, add a `{/* Exception: … */}` comment with a rationale.
**Result:** Undocumented token drift is eliminated; future reviewers understand any intentional deviation.

## Troubleshooting

- **Dark-mode token is missing — component looks broken in `.dark` class** — a new token was added to `:root` but not the `.dark` block. Open both `apps/user-client/src/index.css` and `apps/admin-client/src/index.css` and add the dark value.
- **Focus ring is invisible after a style change** — `outline` was suppressed without a replacement. Restore the `--ring` token-based focus ring or add an equivalent `box-shadow` focus indicator.
- **App-local variant drifted from the shared CVA definition** — a developer added a variant directly in an app wrapper instead of in `buttonVariants.ts`. Move the variant to shared, delete the local override, and rebuild.
- **Component failing accessibility contrast check** — verify against the WCAG AA 4.5 : 1 ratio documented in `docs/button-design.md` for the affected variant.

## Review checklist

- [ ] No hard-coded hex values in component files — all colours reference CSS tokens
- [ ] New tokens are added to both `:root` and `.dark` in both app `index.css` files
- [ ] New variants are defined in `packages/shared/src/ui/buttonVariants.ts`, not app-local files
- [ ] Focus ring is visible and uses the `--ring` token
- [ ] Touch target for primary CTAs is at least 44 px (meets WCAG 2.5.5)
- [ ] Visual exceptions are documented with a comment and rationale in the component
- [ ] Font family is set via semantic Tailwind class (`font-ui`, `font-cn-display`, `font-en-brand`) for normal product UI; any inline `style={{ fontFamily: ... }}` exception is limited to renderer-style contexts (SVG/canvas/share assets) or documented legacy surfaces
- [ ] Custom display font (`font-cn-display` / `font-en-brand`) is applied only to the specific element — not a parent container — to avoid inheriting onto dense UI children
