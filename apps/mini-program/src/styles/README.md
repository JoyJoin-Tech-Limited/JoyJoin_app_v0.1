# Mini-Program Styles — Typography Hierarchy

> One source of truth for font sizing across the JoyJoin mini-program.
> Every piece of text should map to a semantic tier. If it doesn't fit, add a token — don't hardcode.

---

## The 10-Tier Scale

| Tier | Mixin | Token | Size | Weight | Font | Line-Height | Color | Use For |
|------|-------|-------|------|--------|------|-------------|-------|---------|
| **Hero** | `type-hero` | `$font-size-4xl` | 64rpx | Black (900) | Alimama | 1.14 | Primary | Max-impact moments: landing headline, archetype reveal title, celebration hero |
| **Headline** | `type-headline` | `$font-size-3xl` | 56rpx | Black (900) | Alimama | 1.14 | Primary | Major page headlines, accent titles |
| **Title** | `type-title` | `$font-size-2xl` | 48rpx | Bold (700) | Alimama | 1.18 | Primary | Greetings, major section titles, hero statements |
| **Heading** | `type-heading` | `$font-size-xl` | 40rpx | Bold (700) | Alimama | 1.20 | Primary | Page titles, user names, primary CTAs |
| **Subheading** | `type-subheading` | `$font-size-lg` | 36rpx | Semibold (600) | UI | 1.30 | Primary | Card titles, stat values, list headers |
| **Body-Emphasis** | `type-body-emphasis` | `$font-size-md` | 32rpx | Semibold (600) | UI | 1.50 | Primary | Section labels, button text, emphasized body |
| **Body** | `type-body` | `$font-size-base` | 28rpx | Normal (400) | UI | 1.60 | Primary | Descriptions, form inputs, standard copy |
| **Label** | `type-label` | `$font-size-sm` | 24rpx | Medium (500) | UI | 1.50 | Secondary | Chips, badges, action labels, compact controls |
| **Caption** | `type-caption` | `$font-size-xs` | 22rpx | Normal (400) | UI | 1.40 | Secondary | Meta info, helper text, secondary details |
| **Micro** | `type-micro` | `$font-size-2xs` | 20rpx | Normal (400) | UI | 1.30 | Muted | Legal, timestamps, palette counts, tiniest meta |

### Quick Decision Tree

```
Is this the most important thing on the screen?     → Hero / Headline / Title
Is this a page title, name, or primary CTA?         → Heading
Is this a card title, stat, or section header?      → Subheading
Is this a button label or emphasized section title? → Body-Emphasis
Is this normal reading copy, a description, or form input? → Body
Is this a chip, badge, or compact action label?     → Label
Is this meta, helper text, or secondary detail?     → Caption
Is this legal, a timestamp, or the tiniest meta?    → Micro
```

---

## Tokens vs. Mixins

### Prefer mixins for UI text

Mixins bind **size + weight + font-family + line-height + color** in one declaration:

```scss
.my-component__title {
  @include type-subheading;
}
```

This guarantees consistency. Only override when necessary:

```scss
.my-component__title {
  @include type-subheading;
  color: $color-primary; // Override only the color
}
```

### Use tokens directly when weight/color differ

If the default mixin weight or color doesn't fit, use the token with custom weight:

```scss
.my-component__stat {
  font-size: $font-size-lg;
  font-weight: $font-weight-bold; // Custom weight
  color: $color-text-primary;
}
```

### Never hardcode pixel values

```scss
// ❌ Bad
font-size: 28rpx;

// ✅ Good
font-size: $font-size-base;

// ✅ Better
@include type-body;
```

---

## Decorative / Emoji Sizes

Some elements (emoji heroes, celebration icons, game pieces) intentionally use sizes outside the scale. These **must** include a comment:

```scss
&__celebration-emoji {
  font-size: 96rpx; // Decorative — not part of hierarchy
}
```

Common decorative sizes that don't need tokens:
- `48rpx`–`120rpx` for emoji, icons, and game elements
- One-off animation sizes for cinematic reveals

---

## Legacy Mixins

The following mixins are kept for backward compatibility but should not be used in new code:

| Legacy Mixin | Replacement |
|-------------|-------------|
| `type-display-hero` | `type-hero` |
| `type-display-page-title` | `type-title` |
| `type-display-section-title` | `type-heading` |
| `type-display-accent-line` | `type-headline` |

`type-brand-cta-label` remains valid for primary CTA button text (it adds CTA-specific letter-spacing).

---

## Migration Status

The following screens have been migrated to use the semantic hierarchy:

- [x] Discover (`pages/discover/index.scss`)
- [x] Landing (`pages/index/index.scss`)
- [x] Profile (`pages/profile/index.scss`)
- [x] Pool Registration (`pages/pool-registration/index.scss`)
- [x] Onboarding — Essential Data (`pages/onboarding/essential-data/index.scss`)
- [x] Onboarding — Personality Test (`pages/onboarding/personality-test/index.scss`)

Remaining screens should be migrated opportunistically — update them when you touch them.

---

## Adding a New Size

If you genuinely need a size not in the scale:

1. Ask yourself: can an existing tier work with a small weight/color adjustment?
2. If no, add a new token to `_variables.scss` with a clear semantic name.
3. Add a corresponding mixin to `_mixins.scss` if the pattern repeats.
4. Update this README.

---

## Guardrail

The CI guardrail (`scripts/check-guardrails.mjs`) flags new ad-hoc `font-size: XXrpx` literals in modified mini-program SCSS files. Use tokens or mixins instead.
