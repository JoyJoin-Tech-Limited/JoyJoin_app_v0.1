# Button Design System

> **Source of truth:** `packages/shared/src/ui/buttonVariants.ts`  
> **App wrappers:** `apps/user-client/src/components/ui/button.tsx` · `apps/admin-client/src/components/ui/button.tsx`

---

## Design Rationale

JoyJoin's button design embodies the product's **warm purple brand identity** and a *clean · big · sleek · premium* feel:

| Principle | Implementation |
|-----------|----------------|
| **Clean** | No noisy borders on the primary action; gradient replaces flat fill; restrained shadow |
| **Big** | `lg` size targets 44 px height (WCAG touch-target); `default` gives comfortable 36 px |
| **Sleek** | `rounded-xl` (12 px) radius; 150 ms `ease-out` transitions; refined `ring-2` focus ring |
| **Premium** | Warm purple gradient (`270 → 290 hsl`) for `default`/primary; depth shadow token |

---

## Design Tokens

Button-specific CSS custom properties are defined in both apps' `src/index.css` (inside `:root` and `.dark`):

```css
/* Light mode */
:root {
  /* Premium warm-purple gradient for default/primary buttons */
  --btn-primary-gradient: linear-gradient(145deg, hsl(270 55% 62%) 0%, hsl(290 52% 56%) 100%);
  /* Subtle depth shadow aligned to brand hue */
  --btn-shadow-primary: 0px 2px 8px -1px hsl(280 45% 55% / 0.22),
                        0px 1px 2px hsl(280 45% 55% / 0.14);
}

/* Dark mode */
.dark {
  --btn-primary-gradient: linear-gradient(145deg, hsl(270 55% 67%) 0%, hsl(290 52% 61%) 100%);
  --btn-shadow-primary: 0px 2px 8px -1px hsl(280 50% 65% / 0.28),
                        0px 1px 2px hsl(280 50% 65% / 0.18);
}
```

---

## Variants

| `variant` | Usage | Visual |
|-----------|-------|--------|
| `default` | Main CTAs, primary actions | Warm-purple gradient + depth shadow |
| `secondary` | Supporting actions | Muted surface, secondary foreground |
| `outline` | Contextual/inline actions | Transparent bg, border inherits context |
| `ghost` | Low-emphasis actions, icon toolbars | No border, no background |
| `destructive` | Destructive / danger actions | Red fill |

---

## Sizes

| `size` | Min height | Use case |
|--------|------------|----------|
| `sm` | 32 px | Compact inline actions, badges |
| `default` | 36 px | General form actions, mid-importance CTAs |
| `lg` | 44 px | Primary page CTAs — meets WCAG 44 px touch target |
| `icon` | 36 × 36 px visual (use padding/container layout when a 44 px touch target is required) | Icon-only toolbar buttons (`aria-label` required) |

---

## Props API

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariantProps {
  /** Render as child element (Radix UI Slot composition) */
  asChild?: boolean
  /** Show Loader2 spinner and disable interaction */
  loading?: boolean
  /** Stretch to container width (`w-full`) */
  fullWidth?: boolean
}
```

All standard HTML `<button>` attributes (`disabled`, `type`, `onClick`, `aria-label`, etc.) are forwarded.

---

## Accessibility

- Uses a native `<button>` element (or delegated slot) — correct semantics out of the box.
- `disabled || loading` sets `disabled` on the element; `pointer-events-none` prevents ghost clicks.
- `loading` renders a `Loader2` spinner with `aria-hidden="true"` — the button label remains visible to screen readers.
- Icon-only buttons **must** include `aria-label="…"` since there is no visible text.
- Focus ring: `ring-2 ring-ring ring-offset-2` — uses the `--ring` token (same warm purple as brand) for consistent, highly-visible focus treatment (WCAG 2.1 §2.4.7).
- `lg` meets the 44 × 44 px touch target. `icon` is visually 36 × 36 px, so use surrounding padding/layout when a full 44 px touch target is required.
- Gradient colours are tested against white foreground at WCAG AA (4.5 : 1 contrast ratio).

---

## Usage Examples

### User client

```tsx
import { Button } from "@/components/ui/button";

// Primary CTA — large, full width
<Button size="lg" fullWidth onClick={handleSubmit}>
  看看我会遇见谁
</Button>

// Loading state
<Button loading={mutation.isPending}>
  保存
</Button>

// Secondary action
<Button variant="secondary" onClick={onCancel}>
  取消
</Button>

// Ghost icon button — always include aria-label
<Button variant="ghost" size="icon" aria-label="返回">
  <ChevronLeft />
</Button>

// Composition via asChild (Link)
<Button asChild variant="outline">
  <a href="/events">浏览活动</a>
</Button>
```

### Admin client

```tsx
import { Button } from "@/components/ui/button";

// Save with loading indicator
<Button
  type="submit"
  fullWidth
  loading={updateMutation.isPending}
>
  {updateMutation.isPending ? "保存中…" : "保存"}
</Button>
```

### Selection chip / option button pattern

For selectable option lists that are **not** standard CTA buttons, use these CSS custom properties directly to stay visually aligned:

```tsx
<button
  className={cn(
    "w-full px-5 py-4 text-left rounded-xl border-2 transition-all duration-150",
    selected
      ? "border-primary [background:var(--btn-primary-gradient)] text-primary-foreground font-semibold shadow-[var(--btn-shadow-primary)]"
      : "border-border hover-elevate active-elevate-2"
  )}
>
  Option label
</button>
```

---

## Migration Guide

### 1 — Standard `<Button>` usage

Existing `import { Button } from "@/components/ui/button"` imports are **unchanged** — the app-local wrapper now re-exports from `packages/shared/src/ui/buttonVariants.ts`. No import path changes needed.

### 2 — Ad-hoc hard-coded gradients on `<Button>`

Replace hard-coded gradient `className` overrides with the `default` variant (or `size="lg"` for larger CTAs). The shared primary gradient (`var(--btn-primary-gradient)`) is brand-aligned and accessible.

**Before:**
```tsx
<Button className="bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold">
  立即报名
</Button>
```
**After:**
```tsx
<Button size="lg">
  立即报名
</Button>
```

### 3 — Raw `<button>` selectable chips

Update `rounded-lg border` → `rounded-xl border-2` and replace selected state from `bg-primary/5 text-primary` → `[background:var(--btn-primary-gradient)] text-primary-foreground shadow-[var(--btn-shadow-primary)]`.

### 4 — Adding `loading` state

Replace manual spinner + `disabled` pattern:
```tsx
// Before
{isLoading && <Loader2 className="animate-spin" />}
<Button disabled={isLoading}>保存</Button>

// After
<Button loading={isLoading}>保存</Button>
```

---

## Audit Summary

### Inconsistencies found (April 2026)

| Location | Issue |
|----------|-------|
| `apps/user-client/src/pages/LandingPage.tsx` | Hard-coded gradient + `h-16` override on primary CTA |
| `apps/user-client/src/components/drawer-sections/CTAButton.tsx` | Hard-coded `from-violet-600 to-purple-600` gradient |
| `apps/user-client/src/components/ui/multi-select-button.tsx` | `rounded-lg` radius inconsistent with brand; flat selected state |
| `apps/admin-client/src/pages/EditIntentPage.tsx` | Raw `<button>` with `bg-primary/5` selected state; `rounded-lg` |
| `apps/admin-client/src/pages/EditWorkPage.tsx` | Same pattern |
| `apps/admin-client/src/pages/EditPersonalPage.tsx` | Same pattern |
| Both app `button.tsx` | Identical implementations — no shared source of truth; `font-medium`, `rounded-md`, no loading prop |

### Fixed in this PR

- Shared source of truth: `packages/shared/src/ui/buttonVariants.ts`
- Premium gradient + shadow tokens in both apps' `index.css`
- App wrappers re-export from shared; `loading` and `fullWidth` props added
- CTAButton, MultiSelectButton, EditIntentPage, EditWorkPage, EditPersonalPage aligned to new tokens
