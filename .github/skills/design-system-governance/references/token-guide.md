# Token Guide

## Full Token Table

### Core shadcn/ui tokens

| Token | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| `--background` | `#FFFFFF` | `#0F0F0F` | Page background |
| `--foreground` | `#171717` | `#FAFAFA` | Primary text |
| `--card` | `#FFFFFF` | `#0F0F0F` | Card surfaces |
| `--card-foreground` | `#171717` | `#FAFAFA` | Card text |
| `--popover` | `#FFFFFF` | `#0F0F0F` | Popover background |
| `--popover-foreground` | `#171717` | `#FAFAFA` | Popover text |
| `--primary` | `#8B5CF6` | `#8B5CF6` | Primary action |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | Text on primary |
| `--secondary` | `#F5F1E8` | `#1F1F1F` | Secondary surface |
| `--secondary-foreground` | `#171717` | `#FAFAFA` | Text on secondary |
| `--muted` | `#F5F5F5` | `#262626` | Muted background |
| `--muted-foreground` | `#737373` | `#A3A3A3` | Muted text |
| `--accent` | `#F5F1E8` | `#262626` | Accent surface |
| `--accent-foreground` | `#171717` | `#FAFAFA` | Text on accent |
| `--destructive` | `#EF4444` | `#EF4444` | Error / destructive |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | Text on destructive |
| `--border` | `#E5E5E5` | `#262626` | Borders |
| `--input` | `#E5E5E5` | `#262626` | Input borders |
| `--ring` | `#8B5CF6` | `#8B5CF6` | Focus ring |
| `--radius` | `0.75rem` | `0.75rem` | Border radius |

### Button-specific tokens

| Token | Light mode | Dark mode | Usage |
|-------|-----------|-----------|-------|
| `--btn-primary-gradient` | `linear-gradient(135deg, #8B5CF6, #7C3AED)` | `linear-gradient(135deg, #8B5CF6, #7C3AED)` | Primary button fill |
| `--btn-shadow-primary` | `0 4px 14px rgba(139, 92, 246, 0.25)` | `0 4px 14px rgba(139, 92, 246, 0.25)` | Primary button shadow |

**Rule:** Add new tokens to **both** apps' `index.css` files (`:root` and `.dark` blocks) and document the design intent.

## CVA Variant Examples

All button variants are defined in `packages/shared/src/ui/buttonVariants.ts` using CVA.

```ts
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-btn-primary-gradient text-white shadow-btn-shadow-primary",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-input bg-background hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

Valid variants: `default`, `secondary`, `outline`, `ghost`, `destructive`.

If a new visual treatment is needed more than once, define it as a named variant — not an inline override.

## Accessibility Checklist

- `lg` size (44 px height) is the minimum for primary page CTAs — meets WCAG 2.5.5 touch target
- `icon` size buttons must include `aria-label`
- Focus ring uses `--ring` token (warm purple) — do not suppress `outline` without an equivalent visible focus indicator
- Gradient fill on `default` buttons is tested to WCAG AA contrast (4.5 : 1) against white foreground
- `loading` state sets `aria-busy="true"` and `disabled`
- Maintain WCAG 2.1 AA expectations for contrast, visible focus, target size, disabled semantics, and meaningful status messaging

## Exception Documentation Format

Approved deviations must be noted in a code comment with a rationale:

```tsx
{/* Exception: uses --btn-shadow-primary instead of shadow-md to maintain brand hue alignment. */}
```

Do not allow undocumented exceptions to accumulate — they become invisible tech debt.

## Migration Discipline

When standardising an existing component:

1. Verify the shared primitive covers the existing visual behaviour
2. Add a documented exception if a small deviation is intentional
3. Remove the locally-styled version entirely — do not leave both in place
4. Run lint and both app builds to confirm no regressions

## Typography Token Ownership

JoyJoin uses a three-role semantic typography system:

| Role | CSS variable | Tailwind class | Use for |
|------|-------------|----------------|---------|
| System UI | `--font-ui` | `font-ui` | Dense functional UI — forms, body, labels, legal, settings |
| Chinese display | `--font-cn-display` | `font-cn-display` | Short high-impact Chinese moments — hero headlines, tab labels, premium CTAs |
| English brand | `--font-en-brand` | `font-en-brand` | JoyJoin English wordmark / brand accent only |

**Rules:**
- Do not apply custom display fonts globally or at the container level
- Do not mix `font-cn-display` and `font-en-brand` on the same Chinese-language surface
- Body copy always uses `font-ui`
- See `.github/skills/joyjoin-brand-guidelines/references/typography.md` for full details

## Platform-Specific Notes

### Web
- Hover and `:focus-visible` treatments must be intentional and token-driven
- Validate responsive behavior at narrow mobile widths first
- Use the shared frontend thresholds reference for virtualization triggers

### Taro Mini-program
- Pixel and spacing discipline: spec-exact layout, 8rpx rhythm when unspecced
- Mandatory WeChat DevTools verification for UI PRs
- Use `hover-class` and pressed-state styling instead of CSS `:hover`
- Prefer native components: `View`, `Text`, `Button`, `Input`, `ScrollView`
- Full rules: `mini-program-frontend-excellence/references/pixel-precision.md`
