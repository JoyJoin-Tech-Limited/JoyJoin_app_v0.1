# JoyJoin Mini-Program 20/20 Design Specification

> Pixel-precise design specs to push every screen from current audit scores to perfect 20/20.  
> Generated: 2026-05-21  
> Target: `apps/mini-program`

---

## Table of Contents

1. [Design System Updates](#1-design-system-updates)
2. [Screen Design Specs (Priority Order)](#2-screen-design-specs)
3. [Shared Component Specs](#3-shared-component-specs)
4. [Asset Inventory](#4-asset-inventory)
5. [Motion Library Specs](#5-motion-library-specs)
6. [Accessibility & Reduced-Motion Specs](#6-accessibility--reduced-motion-specs)

---

## 1. Design System Updates

### 1.1 New Tokens (add to `_variables.scss`)

```scss
// ─── WeChat Brand Green (tokenized, do not hardcode) ─────────────
$color-wechat-green:        #07c160;
$color-wechat-green-hover:  #06ad56;

// ─── Card Gradient Presets ───────────────────────────────────────
$card-gradient-warm:        linear-gradient(135deg, #FFF8F1 0%, #FFF0F5 50%, #F5F0FF 100%);
$card-gradient-cool:        linear-gradient(135deg, #F0F9FF 0%, #EFF6FF 50%, #F5F3FF 100%);
$card-gradient-fire:        linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 50%, #FED7AA 100%);
$card-gradient-premium:     linear-gradient(155deg, rgba($color-surface, 0.98) 0%, rgba($color-primary-light, 0.86) 100%);

// ─── Mascot Sizing Scale ─────────────────────────────────────────
$mascot-size-xs:   80rpx;
$mascot-size-sm:  120rpx;
$mascot-size-md:  160rpx;
$mascot-size-lg:  200rpx;
$mascot-size-xl:  240rpx;

// ─── Icon Slot Sizes (replacing raw emoji in action rows) ────────
$icon-slot-sm:    40rpx;
$icon-slot-md:    48rpx;
$icon-slot-lg:    56rpx;

// ─── Line-height Token Overrides ─────────────────────────────────
// Enforce explicit line-height on ALL text nodes.
$line-height-tight:  1.2;
$line-height-snug:   1.3;
$line-height-normal: 1.5;
$line-height-relaxed: 1.6;
$line-height-loose:  1.75;

// ─── Chemistry Indicator Tokens ──────────────────────────────────
$chemistry-fire-bg:    rgba($color-error, 0.12);
$chemistry-fire-text:  #DC2626;
$chemistry-warm-bg:    rgba($color-secondary, 0.14);
$chemistry-warm-text:  #BE185D;
$chemistry-calm-bg:    rgba($color-success, 0.12);
$chemistry-calm-text:  #059669;
$chemistry-mild-bg:    rgba($color-primary-light, 0.96);
$chemistry-mild-text:  $color-primary-dark;
```

### 1.2 New Mixins (add to `_mixins.scss`)

```scss
// ─── Mascot Container ────────────────────────────────────────────
@mixin mascot-container($size: $mascot-size-md) {
  width: $size;
  height: $size;
  border-radius: 50%;
  background: rgba($color-primary, 0.08);
  @include flex-center;
  overflow: hidden;
  flex-shrink: 0;
}

// ─── Staggered Entrance (list/card shells) ───────────────────────
@mixin staggered-enter($index, $base-delay: 0ms, $stagger: 60ms) {
  opacity: 0;
  transform: translateY(16rpx);
  animation: staggered-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: calc(#{$base-delay} + #{$index} * #{$stagger});
}

// ─── Action Row (touch-safe, icon-driven) ────────────────────────
@mixin action-row {
  display: flex;
  align-items: center;
  gap: $spacing-md;
  padding: $spacing-lg;
  min-height: max(96rpx, $cta-min-tap);
  border-bottom: 1rpx solid $color-divider;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: rgba(0, 0, 0, 0.02);
  }
}

// ─── Ecosystem Bar Container ─────────────────────────────────────
@mixin ecosystem-bar {
  display: flex;
  align-items: center;
  height: 48rpx;
  gap: 8rpx;
}

// ─── Validation Error Text ───────────────────────────────────────
@mixin validation-error {
  display: block;
  font-size: $font-size-xs;
  color: $color-error;
  line-height: $line-height-normal;
  margin-top: $spacing-xs;
}

// ─── Empty State Shell ───────────────────────────────────────────
@mixin empty-state-shell {
  @include flex-center;
  flex-direction: column;
  gap: $spacing-sm;
  padding: $spacing-2xl;
  text-align: center;
}
```

### 1.3 New Keyframes (add to `_mixins.scss` or global stylesheet)

```scss
@keyframes staggered-rise {
  from {
    opacity: 0;
    transform: translateY(16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes card-slide-in {
  from {
    opacity: 0;
    transform: translateY(20rpx) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes mascot-bounce-in {
  0% {
    opacity: 0;
    transform: translateY(24rpx) scale(0.85);
  }
  60% {
    transform: translateY(-4rpx) scale(1.04);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes pending-dot-pulse {
  0%, 100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

---

## 2. Screen Design Specs

> For each screen: exact layout, spacing, typography, mascot, animation, state matrix, CSS, assets, motion choreography, before/after.

---

### 2.1 Center Hub (13 → 20) — HIGHEST IMPACT

#### What 20/20 Looks Like

**Layout (top to bottom):**
1. **Header** — 40rpx horizontal padding, 60rpx top (safe-area), 40rpx bottom
2. **Mascot Greeting Row** — Xiaoyue (120rpx) left, title + subtitle right, gap 24rpx
3. **Status Card** — gradient background, ecosystem bar, meta pills, 32rpx radius
4. **Action CTA** — full-width primary button
5. **Empty State** — Xiaoyue (200rpx) + headline + subline + CTA

**Spacing values:**
- Header → Mascot row: 0rpx (integrated)
- Mascot row → Card: 40rpx
- Card → CTA: 40rpx
- CTA → Bottom safe-area: 128rpx

**Typography:**
- Page title: `$font-size-2xl` / `$font-weight-black` / `$font-cn-display` / line-height 1.18
- Subtitle: `$font-size-base` / `$font-weight-normal` / line-height 1.6 / `$color-text-secondary`
- Card title: `$font-size-lg` / `$font-weight-bold` / line-height 1.3
- Card meta: `$font-size-sm` / `$font-weight-medium` / line-height 1.5 / `$color-text-muted`

**Mascot placement:**
- Active states: Xiaoyue "coaching" expression (120rpx) in header row
- Empty state: Xiaoyue "explore" expression (200rpx) centered
- Error state: Xiaoyue "sad" expression (160rpx) centered

**Animation:**
- Page enter: `fade-slide-up` 0.28s, easing `cubic-bezier(0.22, 1, 0.36, 1)`
- Card enter: `card-slide-in` 0.34s, delay 80ms
- CTA enter: `fade-slide-up` 0.28s, delay 160ms
- Mascot: `mascot-bounce-in` 0.4s, delay 40ms

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Header + mascot + gradient card + CTA |
| Loading | Skeleton shimmer (3 lines) inside card shell |
| Empty | Xiaoyue 200rpx + "还没有进行中的活动" + subline + "去探索" CTA |
| Error | Xiaoyue sad 160rpx + "加载没成功" + "网络不太稳定" + Taro-safe retry button |
| Success | Confetti burst (optional) + "匹配成功" celebration card |

#### CSS/SCSS Specs

```scss
.center-hub {
  @include viewport-min-height;
  background: $color-bg-gradient;
  padding-bottom: calc(128rpx + env(safe-area-inset-bottom));

  &__header {
    padding: calc(60rpx + env(safe-area-inset-top)) $container-padding $spacing-lg;
    display: flex;
    align-items: center;
    gap: $spacing-md;
  }

  &__mascot {
    @include mascot-container($mascot-size-sm);
    animation: mascot-bounce-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 40ms;
  }

  &__mascot-img {
    width: 112rpx;
    height: 112rpx;
  }

  &__header-text {
    flex: 1;
    min-width: 0;
  }

  &__title {
    @include type-title;
    display: block;
  }

  &__subtitle {
    @include type-body;
    color: $color-text-secondary;
    display: block;
    margin-top: $spacing-xs;
  }

  &__state {
    padding: 0 $container-padding;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  // PREMIUM GRADIENT CARD
  &__event-card,
  &__status-card {
    width: 100%;
    margin-top: $spacing-xl;
    text-align: left;
    @include card-premium;
    padding: $spacing-lg;
    background: $card-gradient-premium;
    border: 2rpx solid rgba($color-primary, 0.1);
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 80ms;
  }

  // ECOSYSTEM BAR
  &__ecosystem {
    @include ecosystem-bar;
    margin-bottom: $spacing-sm;
  }

  &__event-title {
    @include type-subheading;
    display: block;
  }

  &__event-meta {
    @include type-label;
    margin-top: $spacing-xs;
    display: block;
  }

  &__event-location {
    @include type-caption;
    margin-top: 4rpx;
    display: block;
  }

  &__status-pool {
    @include type-subheading;
    display: block;
  }

  &__status-text {
    @include type-label;
    margin-top: $spacing-xs;
    display: block;
  }

  &__cta {
    margin-top: $spacing-xl;
    width: 80%;
    animation: fade-slide-up 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 160ms;
  }

  // EMPTY STATE
  &__empty-art {
    margin-top: $spacing-xl;
    width: 200rpx;
    height: 200rpx;
    @include flex-center;
    animation: mascot-bounce-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__empty-img {
    width: 100%;
    height: 100%;
  }

  // LOADING STATE
  &__loading {
    @include flex-center;
    flex-direction: column;
    gap: $spacing-md;
    padding: $spacing-2xl;
  }

  &__loading-text {
    @include type-body;
    color: $color-text-secondary;
  }

  &__skeleton-line {
    height: 24rpx;
    border-radius: 8rpx;
    background: $color-divider;
    overflow: hidden;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba($color-surface, 0.6), transparent);
      transform: translateX(-100%);
      animation: shimmer-slide 1.5s ease-in-out infinite;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .center-hub__mascot,
  .center-hub__event-card,
  .center-hub__status-card,
  .center-hub__cta,
  .center-hub__empty-art {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

#### TSX Changes

```tsx
// ERROR STATE — FIX platform bug
if (isError) {
  return (
    <View className='center-hub__state'>
      <Image className='center-hub__empty-img' src={getXiaoyueExpressionAsset('sad')} mode='aspectFit' />
      <Text className='center-hub__state-title'>加载没成功</Text>
      <Text className='center-hub__state-subtitle'>网络不太稳定，下拉刷新试试</Text>
      <Button className='center-hub__cta' onClick={() => Taro.reLaunch({ url: '/pages/center-hub/index' })}>
        重新加载
      </Button>
    </View>
  )
}
```

#### Asset Requirements

| Asset | Dimensions | Usage |
|-------|-----------|-------|
| `xiaoyue-center-hub-welcome.webp` | 240×240 | Header mascot |
| `xiaoyue-center-hub-empty.webp` | 400×400 | Empty state |
| `xiaoyue-center-hub-sad.webp` | 320×320 | Error state |
| `icon-calendar.svg` | 48×48 | Card meta (replace emoji) |
| `icon-location.svg` | 48×48 | Card meta (replace emoji) |

#### Motion Choreography

| Element | Frame 0 | Frame 1 (0.1s) | Frame 2 (0.28s) | Hold |
|---------|---------|----------------|-----------------|------|
| Mascot | opacity 0, translateY 24rpx, scale 0.85 | opacity 1, translateY -4rpx, scale 1.04 | translateY 0, scale 1 | — |
| Title | opacity 0, translateY 12rpx | opacity 1, translateY 0 | — | — |
| Card | opacity 0, translateY 20rpx, scale 0.985 | opacity 1, translateY 0, scale 1 | — | — |
| CTA | opacity 0, translateY 12rpx | opacity 1, translateY 0 | — | — |

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Plain text cards, no mascot | Gradient cards, ecosystem bar, mascot in header |
| State Completeness | `window.location.reload` bug | Taro-safe reLaunch, explicit error mascot |
| Theming | Inconsistent card bg | `$card-gradient-premium`, tokenized |
| Responsive | OK | Ensure 44pt tap targets on all CTAs |
| Performance | Minimal motion | Staggered entrance, reduced-motion safe |

---

### 2.2 Events Page (14 → 20)

#### What 20/20 Looks Like

**Layout:**
1. **Header** — "我的足迹" title, 48rpx / black
2. **Tab bar** — pill tabs, 40rpx radius, active = brand gradient
3. **Event Cards** — rich cards with:
   - Top: Ecosystem bar (archetype glyphs)
   - Middle: Event title + date pill
   - Bottom: Chemistry indicator + "查看详情" CTA
4. **Empty State** — Xiaoyue mascot + copy

**Card specs:**
- Height: 220rpx (up from minimal)
- Padding: 32rpx
- Radius: 32rpx
- Background: `$card-gradient-warm` or `$card-gradient-cool` based on `accentFamily`
- Shadow: `$shadow-md`

**Typography:**
- Card title: `$font-size-lg` / `$font-weight-bold` / line-height 1.3
- Date: `$font-size-sm` / `$font-weight-medium` / line-height 1.5 / `$color-text-secondary`
- Chemistry score: `$font-size-xs` / `$font-weight-semibold`

**Animation:**
- Tab switch: cross-fade 0.2s
- Card stagger: `staggered-rise` with 60ms stagger per card
- Empty state: `mascot-bounce-in` 0.5s

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Tab bar + staggered rich cards |
| Loading | 3 skeleton cards with shimmer |
| Empty | Xiaoyue 200rpx + "还没有活动" + hint + "去发现" CTA |
| Error | StatusCard with Lovart error hero |
| Success | None (page-level) |

#### CSS/SCSS Specs

```scss
.events-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: $color-bg-gradient;

  &__header {
    padding: calc(60rpx + env(safe-area-inset-top)) $container-padding $spacing-md;
  }

  &__title {
    @include type-title;
    display: block;
  }

  &__tabs {
    display: flex;
    gap: $spacing-sm;
    padding: 0 $container-padding;
    margin-bottom: $spacing-md;
  }

  &__tab {
    padding: $spacing-sm $spacing-lg;
    border-radius: 40rpx;
    background: $color-surface;
    border: 2rpx solid $color-border;
    transition: all 0.2s ease;
    min-height: 64rpx;

    &--active {
      background: $brand-gradient;
      border-color: transparent;
      box-shadow: 0 4rpx 16rpx rgba($color-primary, 0.25);

      .events-page__tab-text {
        color: $color-text-white;
      }
    }
  }

  &__tab-text {
    @include type-label;
    font-weight: $font-weight-semibold;
  }

  &__list {
    flex: 1;
    padding: 0 $container-padding;
  }

  // RICH EVENT CARD
  &__card {
    @include card-premium;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    min-height: 220rpx;
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    animation: staggered-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;

    &:active {
      transform: scale(0.98);
    }

    &--skeleton {
      pointer-events: none;
      animation: none;
    }

    &--warm { background: $card-gradient-warm; }
    &--cool { background: $card-gradient-cool; }
    &--fire { background: $card-gradient-fire; }
  }

  &__card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $spacing-sm;
  }

  &__card-ecosystem {
    @include ecosystem-bar;
  }

  &__card-title {
    @include type-subheading;
    flex: 1;
    min-width: 0;
  }

  &__card-date {
    @include type-label;
    display: inline-flex;
    align-items: center;
    padding: 4rpx 14rpx;
    border-radius: 999rpx;
    background: rgba($color-primary, 0.08);
    color: $color-primary-dark;
    width: fit-content;
  }

  &__card-chemistry {
    display: flex;
    align-items: center;
    gap: $spacing-xs;
    margin-top: auto;
  }

  &__card-chemistry-bar {
    flex: 1;
    height: 6rpx;
    border-radius: 3rpx;
    background: rgba($color-primary, 0.12);
    overflow: hidden;
  }

  &__card-chemistry-fill {
    height: 100%;
    border-radius: 3rpx;
    background: $brand-gradient;
    transition: width 0.4s ease-out;
  }

  &__card-chemistry-text {
    @include type-caption;
    font-weight: $font-weight-semibold;
    color: $color-primary;
  }

  // EMPTY STATE
  &__empty-state {
    @include empty-state-shell;
    @include card-premium;
    padding: $spacing-2xl;
    margin-top: $spacing-xl;
  }

  &__empty-mascot {
    width: 200rpx;
    height: 200rpx;
    animation: mascot-bounce-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__empty-text {
    @include type-body;
    color: $color-text-secondary;
  }

  &__empty-hint {
    @include type-caption;
    color: $color-text-muted;
  }
}
```

#### Asset Requirements

| Asset | Dimensions | Usage |
|-------|-----------|-------|
| Archetype glyph set (12 types) | 36×36 | Ecosystem bar on each card |
| `icon-chevron-right.svg` | 40×40 | Card arrow |

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Plain title+date cards | Rich gradient cards with ecosystem bar, chemistry |
| State Completeness | Emoji empty state | Mascot empty state |
| Theming | Generic card bg | Accent-family-matched gradients |
| Responsive | OK | Safe tap targets |
| Performance | Zero animation | Staggered entrance, tab cross-fade |

---

### 2.3 Event Detail (14 → 20)

#### What 20/20 Looks Like

**Layout:**
1. **Hero** — Gradient header card with event title + Xiaoyue peeking
2. **Info Card** — Structured rows with icon slots (not raw emoji)
3. **Description Card** — Rich text with explicit line-height
4. **Support Card** — QR with gradient background
5. **Actions** — Primary CTA + secondary CTA

**Specs:**
- Hero height: auto, min-height 200rpx
- Hero background: `$card-gradient-premium`
- Info row height: min 88rpx (tap target)
- Info row icon: 48rpx SVG icon slot (not Text emoji)
- Gap between cards: 24rpx

**Animation:**
- Hero: `card-slide-in` 0.34s
- Info rows: staggered 40ms per row
- Description: `fade-slide-up` 0.28s, delay 120ms

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Hero + info + description + support + actions |
| Loading | Skeleton shimmer on hero + info rows |
| Empty field | "待定" pill with muted style, NOT hidden |
| Error | StatusCard with Lovart error hero + retry |
| Success | "进入破冰" CTA pulse on active events |

#### CSS/SCSS Specs

```scss
.event-detail {
  min-height: 100dvh;
  background: $color-bg-gradient;
  padding: $container-padding;

  &--exiting {
    opacity: 0;
    transform: translate3d(-18rpx, 0, 0) scale(0.986);
    transition:
      opacity 0.22s ease,
      transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
    pointer-events: none;
  }

  // HERO CARD
  &__hero {
    @include card-premium;
    padding: $spacing-xl $spacing-lg;
    margin-bottom: $spacing-md;
    background: $card-gradient-premium;
    position: relative;
    overflow: hidden;
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__hero-mascot {
    position: absolute;
    top: -20rpx;
    right: -20rpx;
    width: 160rpx;
    height: 160rpx;
    opacity: 0.12;
    pointer-events: none;
  }

  &__title {
    @include type-title;
    display: block;
    position: relative;
    z-index: 1;
  }

  &__type-badge {
    display: inline-flex;
    align-items: center;
    padding: $spacing-xs $spacing-md;
    border-radius: 20rpx;
    background: rgba($color-primary, 0.12);
    color: $color-primary-dark;
    @include type-caption;
    font-weight: $font-weight-semibold;
    margin-top: $spacing-sm;
    position: relative;
    z-index: 1;
  }

  // INFO CARD
  &__card {
    @include card-premium;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 60ms;
  }

  &__info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 88rpx;
    padding: $spacing-sm 0;
    border-bottom: 1rpx solid $color-divider;
    animation: fade-slide-up 0.28s ease both;

    &:nth-child(1) { animation-delay: 80ms; }
    &:nth-child(2) { animation-delay: 120ms; }
    &:nth-child(3) { animation-delay: 160ms; }
    &:nth-child(4) { animation-delay: 200ms; }

    &:last-child {
      border-bottom: none;
    }
  }

  &__info-label {
    display: flex;
    align-items: center;
    gap: 12rpx;
    @include type-body;
    color: $color-text-secondary;
  }

  &__info-icon {
    width: 48rpx;
    height: 48rpx;
    flex-shrink: 0;
  }

  &__info-value {
    @include type-body;
    font-weight: $font-weight-medium;
    text-align: right;

    &--empty {
      color: $color-text-muted;
      font-style: italic;
    }
  }

  &__description-title {
    @include type-subheading;
    display: block;
    margin-bottom: $spacing-sm;
  }

  &__description {
    @include type-body;
    line-height: $line-height-loose;
    color: $color-text-secondary;
  }

  // SUPPORT CARD
  &__support-card {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    background: linear-gradient(135deg, rgba($color-primary, 0.06) 0%, rgba($color-surface, 0.96) 56%, rgba($color-secondary, 0.08) 100%);
    border: 1rpx solid rgba($color-primary, 0.1);

    &:active {
      transform: scale(0.98);
    }
  }

  // ACTIONS
  &__actions {
    margin-top: $spacing-lg;
    display: flex;
    flex-direction: column;
    gap: $spacing-sm;
    animation: fade-slide-up 0.28s ease both;
    animation-delay: 240ms;
  }

  &__icebreaker-btn {
    @include button-primary;
    width: 100%;
    border: 0;
  }

  &__feedback-btn {
    width: 100%;
    height: $button-height;
    border-radius: $button-radius;
    background: $color-surface;
    border: 2rpx solid $color-border;
    color: $color-text-primary;
    @include type-body;
    font-weight: $font-weight-semibold;

    &::after {
      border: none;
    }

    &:active {
      background: rgba($color-text-primary, 0.05);
    }
  }
}
```

#### TSX Changes — Empty State for Missing Fields

```tsx
// BEFORE: {event.location ? (...) : null}
// AFTER: always render row, show "待定" when empty

<View className='event-detail__info-row'>
  <View className='event-detail__info-label'>
    <Image className='event-detail__info-icon' src={iconLocation} />
    <Text>地点</Text>
  </View>
  <Text className={`event-detail__info-value ${!event.location ? 'event-detail__info-value--empty' : ''}`}>
    {event.location || '待定'}
  </Text>
</View>
```

#### Asset Requirements

| Asset | Dimensions | Usage |
|-------|-----------|-------|
| `icon-calendar.svg` | 48×48 | Info row |
| `icon-location.svg` | 48×48 | Info row |
| `icon-users.svg` | 48×48 | Info row |
| `icon-status.svg` | 48×48 | Info row |
| `xiaoyue-event-detail-peek.webp` | 320×320 | Hero decoration (subtle) |

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Minimal, no mascot | Hero with mascot peek, gradient cards |
| State Completeness | Missing fields hidden | Empty fields show "待定" pill |
| Theming | Raw emoji icons | SVG icon slots |
| Responsive | OK | 88rpx min row height |
| Performance | Minimal | Staggered row entrance |

---

### 2.4 Edit Profile (14 → 20)

#### What 20/20 Looks Like

**Layout:**
1. **Section titles** — "基本信息" / "兴趣爱好"
2. **Card** — Form fields with validation error slots
3. **Radio groups** — Gender pills (already good)
4. **Interest tags** — View-wrapped chips (NOT Text with onClick)
5. **Save button** — Full-width primary

**Specs:**
- Input height: 88rpx
- Error text: 22rpx, `$color-error`, 8rpx top margin
- Interest tag: View wrapper, min-height 56rpx, padding 12rpx 20rpx
- Section gap: 40rpx

**Animation:**
- Card: `card-slide-in` 0.34s
- Fields: staggered 30ms
- Save button: `fade-slide-up` 0.28s

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Form with filled values |
| Loading | Skeleton shimmer on fields |
| Validation error | Red border on input + error text below |
| Save success | Toast + navigateBack |
| Save error | Error text below form + shake animation |

#### CSS/SCSS Specs

```scss
.edit-profile {
  min-height: 100dvh;
  background: $color-bg;

  &__section {
    padding: $spacing-lg $container-padding 0;
    animation: fade-slide-up 0.28s ease both;

    &:nth-child(1) { animation-delay: 0ms; }
    &:nth-child(2) { animation-delay: 60ms; }
  }

  &__section-title {
    @include type-subheading;
    display: block;
    margin-bottom: $spacing-md;
  }

  &__card {
    @include card-premium;
    padding: $spacing-lg;
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__field {
    margin-bottom: $spacing-lg;
    animation: fade-slide-up 0.28s ease both;

    &:nth-child(1) { animation-delay: 40ms; }
    &:nth-child(2) { animation-delay: 70ms; }
    &:nth-child(3) { animation-delay: 100ms; }
    &:nth-child(4) { animation-delay: 130ms; }
    &:nth-child(5) { animation-delay: 160ms; }

    &:last-child {
      margin-bottom: 0;
    }

    &--error {
      .edit-profile__input {
        border-color: $color-error;
        background: rgba($color-error, 0.04);
      }
    }
  }

  &__label {
    @include type-label;
    display: block;
    margin-bottom: $spacing-xs;
  }

  &__input {
    width: 100%;
    height: $input-height;
    padding: 0 $spacing-md;
    border: 2rpx solid $color-border;
    border-radius: $card-radius-sm;
    @include type-body;
    background: $color-surface;
    box-sizing: border-box;
    transition: border-color 0.2s ease, background 0.2s ease;

    &:focus {
      border-color: $color-primary;
    }
  }

  &__error-text {
    @include validation-error;
    animation: fade-slide-up 0.2s ease both;
  }

  // INTEREST TAGS — View wrapper (touch-safe)
  &__interest-tags {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-sm;
  }

  &__interest-tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 56rpx;
    padding: 12rpx 20rpx;
    border-radius: 999rpx;
    @include type-label;
    color: $color-text-secondary;
    background: $color-surface;
    border: 2rpx solid $color-border;
    transition: all 0.2s ease;
    box-sizing: border-box;

    &--selected {
      color: $color-primary;
      background: $color-primary-light;
      border-color: $color-primary;
      font-weight: $font-weight-medium;
    }

    &:active {
      transform: scale(0.95);
    }
  }

  &__footer {
    padding: $spacing-xl $container-padding;
    animation: fade-slide-up 0.28s ease both;
    animation-delay: 180ms;
  }

  &__save-btn {
    width: 100%;
  }
}
```

#### TSX Changes — Touch-Safe Tags

```tsx
// BEFORE: Text with onClick
// AFTER: View with onClick

<View className='edit-profile__interest-tags'>
  {interests.map((interest) => (
    <View
      key={interest.id}
      className={`edit-profile__interest-tag ${selectedInterests.includes(interest.id) ? 'edit-profile__interest-tag--selected' : ''}`}
      onClick={() => toggleInterest(interest.id)}
    >
      <Text className='edit-profile__interest-tag-text'>{interest.label}</Text>
    </View>
  ))}
</View>
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Plain form | Card-premium container, gradient accents |
| State Completeness | No validation errors | Red border + error text per field |
| Theming | OK | Explicit line-height tokens |
| Responsive | Text onClick (unsafe) | View onClick, min-height 56rpx |
| Performance | None | Staggered field entrance |

---

### 2.5 Profile Page (15 → 20)

#### What 20/20 Looks Like

**Layout:**
1. **Hero** — ArchetypeHead 120rpx + name + archetype label
2. **Stats row** — 2 cards: coupons + status
3. **Action section** — Card with icon-driven rows
4. **Logout** — Secondary button

**Specs:**
- Action row icon: 48rpx SVG (NOT raw emoji Text)
- Action row min-height: 96rpx
- Action row icon container: 48×48, centered
- Stats card: `card-premium`, gradient accent on left edge

**Animation:**
- Hero: `mascot-bounce-in` 0.4s
- Stats: staggered 60ms
- Action rows: staggered 40ms per row
- Error state: `fade-slide-up` 0.28s

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Hero + stats + actions |
| Loading | Skeleton on hero + stats |
| Coupon error | Inline error pill on stat card |
| Empty | Not applicable (always has user) |
| Success | None |

#### CSS/SCSS Specs

```scss
.profile-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: $color-bg-gradient;
  overflow: hidden;

  &__scroll {
    flex: 1;
    overflow: hidden;
  }

  // HERO
  &__hero {
    @include flex-center;
    flex-direction: column;
    padding: $spacing-2xl $container-padding $spacing-lg;
    text-align: center;
    animation: fade-slide-up 0.28s ease both;
  }

  &__avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 60rpx;
    background: rgba($color-primary, 0.08);
    @include flex-center;
    margin-bottom: $spacing-md;
    overflow: hidden;
    animation: mascot-bounce-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__name {
    @include type-heading;
    display: block;
    margin-bottom: $spacing-xs;
  }

  &__archetype {
    @include type-body;
    color: $color-primary;
    font-weight: $font-weight-medium;
    display: block;
  }

  // STATS
  &__stats {
    display: flex;
    gap: $spacing-md;
    padding: 0 $container-padding;
    margin-bottom: $spacing-lg;
  }

  &__stat {
    flex: 1;
    @include card-premium;
    padding: $spacing-lg;
    text-align: center;
    animation: staggered-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;

    &:nth-child(1) { animation-delay: 60ms; }
    &:nth-child(2) { animation-delay: 120ms; }

    &--error {
      border-color: rgba($color-error, 0.3);
      background: rgba($color-error, 0.04);
    }
  }

  &__stat-value {
    @include type-subheading;
    display: block;
    margin-bottom: $spacing-xs;
  }

  &__stat-label {
    @include type-caption;
  }

  &__stat-error {
    @include validation-error;
    text-align: center;
  }

  // ACTION SECTION
  &__section {
    @include card-premium;
    margin: 0 $container-padding $spacing-lg;
    overflow: hidden;
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: 100ms;
  }

  &__action-row {
    @include action-row;
    animation: fade-slide-up 0.28s ease both;

    &:nth-child(1) { animation-delay: 120ms; }
    &:nth-child(2) { animation-delay: 160ms; }
    &:nth-child(3) { animation-delay: 200ms; }
    &:nth-child(4) { animation-delay: 240ms; }
    &:nth-child(5) { animation-delay: 280ms; }
    &:nth-child(6) { animation-delay: 320ms; }
  }

  &__action-icon {
    width: 48rpx;
    height: 48rpx;
    flex-shrink: 0;
    @include flex-center;
  }

  &__action-icon-img {
    width: 40rpx;
    height: 40rpx;
  }

  &__action-text {
    flex: 1;
    @include type-body;
    font-weight: $font-weight-medium;
  }

  &__action-arrow {
    width: 40rpx;
    height: 40rpx;
    @include flex-center;
  }

  &__action-arrow-img {
    width: 24rpx;
    height: 24rpx;
    opacity: 0.4;
  }
}
```

#### TSX Changes — Icon Slots

```tsx
// BEFORE: <Text className='profile-page__action-icon'>✏️</Text>
// AFTER: <Image className='profile-page__action-icon-img' src={iconEdit} />

const ACTION_ICONS: Record<string, string> = {
  '编辑资料': iconEdit,
  '奖励福利': iconTrophy,
  '邀请好友': iconInvite,
  '我的权益': iconGift,
  '我的足迹': iconMap,
  '服务条款': iconDocument,
}

// Error state for coupons
{isCouponError ? (
  <View className='profile-page__stat profile-page__stat--error'>
    <Text className='profile-page__stat-error'>加载失败</Text>
    <Text className='profile-page__stat-label'>优惠券</Text>
  </View>
) : (
  <View className='profile-page__stat'>
    <Text className='profile-page__stat-value'>{coupons.count ?? 0}</Text>
    <Text className='profile-page__stat-label'>优惠券</Text>
  </View>
)}
```

#### Asset Requirements

| Asset | Dimensions | Usage |
|-------|-----------|-------|
| `icon-edit.svg` | 40×40 | Action row |
| `icon-trophy.svg` | 40×40 | Action row |
| `icon-invite.svg` | 40×40 | Action row |
| `icon-gift.svg` | 40×40 | Action row |
| `icon-map.svg` | 40×40 | Action row |
| `icon-document.svg` | 40×40 | Action row |
| `icon-chevron-right.svg` | 24×24 | Action arrow |

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Raw emoji icons | SVG icon slots |
| State Completeness | No coupon error | Explicit error state on stat card |
| Theming | OK | Explicit line-height |
| Responsive | OK | 96rpx min action row height |
| Performance | Minimal | Staggered row entrance |

---

### 2.6 Connections (15 → 20)

#### What 20/20 Looks Like

**Layout:**
1. **Header** — "我的连接" title + subtitle
2. **Connection Cards** — Avatar (88rpx) + info + chemistry badge + shared event pill
3. **Empty State** — Xiaoyue mascot

**Specs:**
- Card: `card-premium`, min-height 140rpx
- Avatar: 88rpx circle, `mascot-container`
- Chemistry badge: pill with color-coded background
- Shared event: muted pill below name
- Gap between cards: 16rpx

**Animation:**
- Cards: `staggered-rise` 60ms stagger
- Empty: `mascot-bounce-in`

**State matrix:**

| State | Visual |
|-------|--------|
| Default | Staggered cards with chemistry |
| Loading | Skeleton cards (3) |
| Empty | Xiaoyue 240rpx + "还没有连接" |
| Error | StatusCard |

#### CSS/SCSS Specs

```scss
.connections-page {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: $color-bg-gradient;

  &__header {
    padding: calc(60rpx + env(safe-area-inset-top)) $container-padding $spacing-md;
    animation: fade-slide-up 0.28s ease both;
  }

  &__title {
    @include type-title;
    display: block;
    margin-bottom: $spacing-xs;
  }

  &__subtitle {
    @include type-body;
    color: $color-text-secondary;
    display: block;
  }

  &__list {
    flex: 1;
    padding: 0 $container-padding;
  }

  &__card {
    @include card-premium;
    display: flex;
    align-items: center;
    gap: $spacing-md;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    min-height: 140rpx;
    animation: staggered-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;

    &:active {
      transform: scale(0.98);
    }
  }

  &__card-avatar {
    @include mascot-container(88rpx);
  }

  &__card-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
  }

  &__card-name {
    @include type-body-emphasis;
    @include text-truncate;
    display: block;
  }

  &__card-archetype {
    @include type-caption;
    color: $color-primary;
    display: block;
  }

  &__card-event {
    @include type-caption;
    color: $color-text-muted;
    display: block;
  }

  // CHEMISTRY BADGE
  &__card-chemistry {
    display: inline-flex;
    align-items: center;
    gap: 6rpx;
    padding: 4rpx 12rpx;
    border-radius: 999rpx;
    margin-top: 4rpx;
    width: fit-content;

    &--fire {
      background: $chemistry-fire-bg;
      color: $chemistry-fire-text;
    }

    &--warm {
      background: $chemistry-warm-bg;
      color: $chemistry-warm-text;
    }

    &--calm {
      background: $chemistry-calm-bg;
      color: $chemistry-calm-text;
    }

    &--mild {
      background: $chemistry-mild-bg;
      color: $chemistry-mild-text;
    }
  }

  &__card-chemistry-text {
    @include type-caption;
    font-weight: $font-weight-semibold;
  }

  // SHARED EVENT PILL
  &__card-shared-event {
    display: inline-flex;
    align-items: center;
    gap: 6rpx;
    padding: 4rpx 12rpx;
    border-radius: 999rpx;
    background: rgba($color-primary, 0.06);
    margin-top: 4rpx;
    width: fit-content;
  }

  &__card-shared-event-text {
    @include type-caption;
    color: $color-text-secondary;
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Plain cards | Chemistry badge, shared event pill |
| State Completeness | OK | — |
| Theming | OK | Chemistry color tokens |
| Responsive | OK | 140rpx min card height |
| Performance | Zero animation | Staggered entrance |

---

### 2.7 Matching Status (16 → 20)

#### What 20/20 Looks Like

**Key fixes:**
1. Pending dots: reduced-motion support
2. Hero images: explicit aspect-ratio
3. Card entrances: staggered

**CSS/SCSS Specs**

```scss
.matching-status {
  // PENDING DOTS — with reduced-motion support
  &__dots {
    display: flex;
    align-items: center;
    gap: 8rpx;
    margin-top: $spacing-sm;
  }

  &__dot {
    width: 8rpx;
    height: 8rpx;
    border-radius: 50%;
    background: $color-primary;
    animation: pending-dot-pulse 1.4s ease-in-out infinite;

    &--1 { animation-delay: 0ms; }
    &--2 { animation-delay: 200ms; }
    &--3 { animation-delay: 400ms; }
  }

  &__hero {
    width: 100%;
    height: 320rpx;
    @include flex-center;
    animation: fade-slide-up 0.28s ease both;
  }

  &__hero-img {
    width: 320rpx;
    height: 240rpx;
    object-fit: contain;
  }

  &__card {
    @include card-premium;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}

@media (prefers-reduced-motion: reduce) {
  .matching-status__dot {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Performance | Pending dots animate always | `prefers-reduced-motion` safe |

---

### 2.8 Pool Registration (16 → 20)

#### What 20/20 Looks Like

**Key fixes:**
1. Step transitions: fade-slide-up per step
2. Choice cards: staggered entrance
3. Success state: celebration animation

**CSS/SCSS Specs**

```scss
.pool-reg {
  // STEP TRANSITIONS
  &__panel {
    @include card-premium;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    background: rgba($color-surface, 0.96);
    animation: fade-slide-up 0.28s ease both;
  }

  &__choice-card {
    animation: staggered-rise 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;

    @for $i from 1 through 6 {
      &:nth-child(#{$i}) {
        animation-delay: #{$i * 40}ms;
      }
    }
  }

  // SUCCESS STATE
  &__success {
    @include flex-center;
    flex-direction: column;
    gap: $spacing-md;
    min-height: 80dvh;
    text-align: center;
    animation: fade-slide-up 0.34s ease both;
  }

  &__success-mascot {
    width: 200rpx;
    height: 200rpx;
    animation: mascot-bounce-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Performance | No step transitions | Staggered choice cards, step fade |

---

### 2.9 Icebreaker Session (16 → 20)

#### What 20/20 Looks Like

**Key fixes:**
1. Host badge: class-based, NOT inline style
2. Phase backgrounds: lazy-loaded, not eager
3. Tier selector: premium card treatment

**CSS/SCSS Specs**

```scss
.icebreaker {
  &__host-badge {
    display: inline-flex;
    align-items: center;
    padding: $spacing-xs $spacing-md;
    background: rgba(251, 191, 36, 0.15);
    border-radius: 100rpx;
  }

  &__host-badge-text {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: $font-size-sm;
    color: #92400e;
    font-weight: $font-weight-semibold;
  }

  &__host-badge-icon {
    width: 24rpx;
    height: 24rpx;
  }

  // PHASE BACKGROUNDS — lazy-loaded via class swap
  &__phase-shell {
    animation: icebreaker-phase-in 0.24s ease both;
  }

  // Remove eager inline background injection
  // Instead, use class-based lazy loading:
  &__challenge-card--auction {
    background: var(--bg-auction) center/cover no-repeat;
  }

  &__challenge-card--personality-dice {
    background: var(--bg-personality-dice) center/cover no-repeat;
  }

  // Only set CSS custom property when phase is active
  &--phase-auction { --bg-auction: url(...); }
  &--phase-personality-dice { --bg-personality-dice: url(...); }
}
```

#### TSX Changes — Host Badge

```tsx
// BEFORE: inline style on Image
// AFTER: class-based icon

<View className='icebreaker__host-badge'>
  <View className='icebreaker__host-badge-text'>
    <Image
      className='icebreaker__host-badge-icon'
      src={cdnAsset('/assets/icons/status-icons/status-crown.png')}
      lazyLoad
    />
    <Text>你是主持人</Text>
  </View>
</View>
```

#### TSX Changes — Lazy Backgrounds

```tsx
// BEFORE: bgStyles useMemo with all backgrounds eagerly defined
// AFTER: only define background for current phase

const bgClass = useMemo(() => {
  switch (phase) {
    case 'auction': return 'icebreaker--phase-auction';
    case 'personality_dice': return 'icebreaker--phase-personality-dice';
    // ... etc
    default: return '';
  }
}, [phase]);

// In render:
<ScrollView className={`icebreaker ${bgClass}`} ...>
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Brand Fidelity | Inline style host badge | Class-based badge |
| Performance | All backgrounds eager | Lazy per-phase |

---

### 2.10 Discover Page (17 → 20)

#### What 20/20 Looks Like

**Key fix:** Action emoji alignment (remove `margin-bottom` in flex row)

**CSS/SCSS Specs**

```scss
.discover-auth {
  &__action-card {
    @include card-premium;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: $spacing-sm;
    padding: $spacing-md $spacing-lg;
    min-height: 88rpx;

    &:active {
      transform: scale(0.97);
    }
  }

  &__action-emoji {
    width: 40rpx;
    height: 40rpx;
    display: block;
    // REMOVED: margin-bottom: 8rpx; (caused misalignment in flex row)
  }

  &__action-label {
    @include type-label;
    color: $color-text-primary;
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Responsive | Emoji misaligned in flex row | Vertically centered |

---

### 2.11 Login Page (18 → 20)

#### What 20/20 Looks Like

**Key fix:** Tokenize WeChat green

**CSS/SCSS Specs**

```scss
.login-page {
  &__wechat-btn {
    @include type-brand-cta-label;
    width: 100%;
    min-height: max($button-height, $cta-min-tap);
    height: $button-height;
    border-radius: $button-radius;
    background: $color-wechat-green; // TOKENIZED
    color: $color-text-white;
    font-size: $font-size-md;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6rpx 20rpx rgba(7, 193, 96, 0.28);
    transition: transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease;

    &:active {
      transform: scale(0.98);
      opacity: 0.92;
    }

    &--loading {
      opacity: 0.7;
    }

    &::after {
      border: none;
    }
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Theming | Hardcoded `#07c160` | `$color-wechat-green` token |

---

### 2.12 Onboarding Flow (18 → 20)

#### What 20/20 Looks Like

**Key fix:** Explicit line-height on all text nodes

**CSS/SCSS Specs (applies to all onboarding steps)**

```scss
.onboarding {
  &__title {
    @include type-title;
    line-height: $line-height-snug; // EXPLICIT
    display: block;
  }

  &__body {
    @include type-body;
    line-height: $line-height-relaxed; // EXPLICIT
    display: block;
  }

  &__label {
    @include type-label;
    line-height: $line-height-normal; // EXPLICIT
    display: block;
  }
}
```

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Theming | Implicit line-height | Explicit `$line-height-*` tokens |

---

### 2.13 Squad Unboxing (18 → 20)

#### What 20/20 Looks Like

**Key fix:** Replace `filter: blur` with pre-blurred asset or opacity shadow

**CSS/SCSS Specs**

```scss
.squad-unboxing {
  &__blind-box-shadow {
    position: absolute;
    left: 50%;
    bottom: 8rpx;
    width: 228rpx;
    height: 30rpx;
    border-radius: 999rpx;
    background: rgba(0, 0, 0, 0.12);
    transform: translateX(-50%);
    // REMOVED: filter: blur(10rpx); — mini-program perf issue
    // REPLACED WITH: pre-blurred shadow using opacity layers
    opacity: 0.6;
    pointer-events: none;
  }

  // ALTERNATIVE: layered opacity for soft shadow
  &__blind-box-shadow-soft {
    position: absolute;
    left: 50%;
    bottom: 8rpx;
    width: 228rpx;
    height: 30rpx;
    border-radius: 999rpx;
    background: rgba(0, 0, 0, 0.08);
    transform: translateX(-50%);
    pointer-events: none;
  }
}
```

#### Asset Requirements

| Asset | Dimensions | Usage |
|-------|-----------|-------|
| `shadow-blur-228.webp` | 228×30 | Pre-blurred shadow for blind box |

#### Before/After

| Dimension | Before | After |
|-----------|--------|-------|
| Performance | `filter: blur` | Pre-blurred asset or opacity shadow |

---

## 3. Shared Component Specs

### 3.1 `JoyJoinIcon` — Brand Icon Slot

Replace all raw emoji usage with `JoyJoinIcon` or SVG Image components:

```tsx
// Pattern: NEVER use <Text> for interactive emojis
// ALWAYS use <Image> with explicit sizing

interface JoyJoinIconProps {
  name: 'calendar' | 'location' | 'users' | 'status' | 'edit' | 'trophy' | 'invite' | 'gift' | 'map' | 'document' | 'chevronRight';
  size?: number;
  className?: string;
}
```

### 3.2 `StatusCard` — Universal State Shell

Ensure all error/empty states use `StatusCard` with:
- Lovart hero image (320×240)
- Title: `type-heading`
- Description: `type-body`
- Action: Button primary or secondary

### 3.3 `Card` — Premium Variant

All cards should support `variant="premium"`:
```tsx
<Card variant="premium" className="...">
```
Premium adds:
- `border: 2rpx solid rgba($color-border, 0.6)`
- `box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04)`
- Optional gradient background prop

### 3.4 `EcosystemBar` — Archetype Glyph Row

Reuse existing `EcosystemBar` component on:
- Events page cards
- Center hub cards
- Pool registration success

---

## 4. Asset Inventory

### 4.1 New Icons (SVG, 48×48 base)

| Filename | Usage |
|----------|-------|
| `icon-calendar.svg` | Event detail, matching status info rows |
| `icon-location.svg` | Event detail, matching status info rows |
| `icon-users.svg` | Event detail, matching status info rows |
| `icon-status.svg` | Event detail info rows |
| `icon-edit.svg` | Profile action row |
| `icon-trophy.svg` | Profile action row |
| `icon-invite.svg` | Profile action row |
| `icon-gift.svg` | Profile action row |
| `icon-map.svg` | Profile action row |
| `icon-document.svg` | Profile action row |
| `icon-chevron-right.svg` | Action row arrows |
| `icon-crown.svg` | Host badge (replace PNG with SVG) |

### 4.2 New Mascot Assets (WebP)

| Filename | Dimensions | Expression | Usage |
|----------|-----------|------------|-------|
| `xiaoyue-center-hub-welcome.webp` | 240×240 | waving | Center hub header |
| `xiaoyue-center-hub-empty.webp` | 400×400 | curious | Center hub empty |
| `xiaoyue-center-hub-sad.webp` | 320×320 | sad | Center hub error |
| `xiaoyue-event-detail-peek.webp` | 320×320 | peeking | Event detail hero decoration |
| `xiaoyue-events-empty.webp` | 400×400 | curious | Events empty state |
| `shadow-blur-228.webp` | 228×30 | — | Squad unboxing shadow |

### 4.3 Archetype Glyph Set

Ensure all 12 archetype glyphs are available at 36×36 for ecosystem bars:
- corgi, fox, koala, rooster, owl, dolphin_calm, spider, octopus, cat, panda, eagle, wolf

---

## 5. Motion Library Specs

### 5.1 Standard Entrance Patterns

| Pattern | Duration | Easing | Properties | Usage |
|---------|----------|--------|------------|-------|
| `fade-slide-up` | 280ms | `cubic-bezier(0.22, 1, 0.36, 1)` | opacity, translateY | Headers, CTAs, text blocks |
| `card-slide-in` | 340ms | `cubic-bezier(0.22, 1, 0.36, 1)` | opacity, translateY, scale | Cards, panels |
| `staggered-rise` | 340ms | `cubic-bezier(0.22, 1, 0.36, 1)` | opacity, translateY | List items, cards |
| `mascot-bounce-in` | 400–500ms | `cubic-bezier(0.22, 1, 0.36, 1)` | opacity, translateY, scale | Mascot images |
| `shimmer-slide` | 1500ms | `ease-in-out` | translateX | Skeleton loaders |
| `pending-dot-pulse` | 1400ms | `ease-in-out` | opacity, scale | Matching status dots |

### 5.2 Stagger Delays

| Context | Base Delay | Stagger Step |
|---------|-----------|--------------|
| Cards in list | 60ms | 60ms |
| Action rows | 120ms | 40ms |
| Form fields | 40ms | 30ms |
| Info rows | 80ms | 40ms |
| Choice cards | 0ms | 40ms |

### 5.3 Press/Active Feedback

| Element | Transform | Opacity | Duration |
|---------|-----------|---------|----------|
| Primary button | `scale(0.98)` | `0.92` | 120ms |
| Card | `scale(0.98)` | `1` | 120ms |
| Chip/tag | `scale(0.96)` | `1` | 100ms |
| Action row | `background: rgba(0,0,0,0.02)` | `1` | 100ms |

---

## 6. Accessibility & Reduced-Motion Specs

### 6.1 Global Reduced-Motion Rule

Add to every page stylesheet or global stylesheet:

```scss
@media (prefers-reduced-motion: reduce) {
  // All animated elements
  .center-hub__mascot,
  .center-hub__event-card,
  .center-hub__status-card,
  .center-hub__cta,
  .events-page__card,
  .connections-page__card,
  .event-detail__hero,
  .event-detail__card,
  .event-detail__info-row,
  .profile-page__avatar,
  .profile-page__stat,
  .profile-page__action-row,
  .edit-profile__section,
  .edit-profile__card,
  .edit-profile__field,
  .matching-status__dot,
  .matching-status__hero,
  .matching-status__card,
  .pool-reg__panel,
  .pool-reg__choice-card,
  .pool-reg__success,
  .pool-reg__success-mascot,
  .icebreaker__phase-shell,
  .login-page__avatar-ring,
  .login-page__float-orb,
  .squad-unboxing__blind-box-visual,
  .squad-unboxing__member-card,
  .squad-unboxing__pair-card,
  .squad-unboxing__topic-chip,
  .oracle-card,
  .oracle-card__skeleton-line,
  .oracle-card__cta--pulse {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }

  // Skeletons
  .oracle-card__skeleton-line::after,
  .pool-reg__brief-skeleton-line::after,
  .squad-unboxing__skeleton {
    animation: none !important;
    background: none !important;
  }
}
```

### 6.2 Per-Page Reduced-Motion Checklist

- [ ] Center Hub: all animated elements listed in media query
- [ ] Events: card stagger, tab transition, empty mascot
- [ ] Event Detail: hero, cards, info rows, actions
- [ ] Edit Profile: sections, cards, fields, tags
- [ ] Profile: avatar, stats, action rows
- [ ] Connections: card stagger, empty mascot
- [ ] Matching Status: dots, hero, cards
- [ ] Pool Registration: panels, choice cards, success
- [ ] Icebreaker: phase shell, modal
- [ ] Discover: oracle cards, CTA pulse, shimmer
- [ ] Login: orb float, ring pulse
- [ ] Onboarding: stage transitions
- [ ] Squad Unboxing: blind box animations, card rises

### 6.3 Touch Target Minimums

| Element | Minimum Size | Current Check |
|---------|-------------|---------------|
| Primary CTA | 96rpx × 100% | OK |
| Tab pills | 64rpx height | OK |
| Cards | 140rpx height | Enforce |
| Action rows | 96rpx height | Enforce |
| Interest tags | 56rpx height | Enforce |
| Info rows | 88rpx height | Enforce |
| Icon buttons | 48rpx × 48rpx | Enforce |
| Chips | 56rpx height | Enforce |

---

## Appendix: Implementation Order

### Phase 1 — Safety & Tokens (Week 1)
1. Add new tokens to `_variables.scss`
2. Add new mixins to `_mixins.scss`
3. Add global keyframes
4. Fix `window.location.reload` in Center Hub
5. Fix `Text` onClick → `View` onClick in Edit Profile
6. Fix hardcoded `#07c160` in Login
7. Fix `filter: blur` in Squad Unboxing
8. Fix action emoji `margin-bottom` in Discover
9. Fix host badge inline style in Icebreaker

### Phase 2 — Cards & Visuals (Week 1–2)
10. Upgrade Center Hub cards with gradients + mascot
11. Upgrade Events page cards with ecosystem bar + gradients
12. Upgrade Event Detail with hero mascot + icon slots
13. Upgrade Profile action rows with SVG icons
14. Upgrade Connections with chemistry badges
15. Add validation errors to Edit Profile

### Phase 3 — Motion (Week 2)
16. Add staggered entrance to all list screens
17. Add card-slide-in to all card screens
18. Add mascot-bounce-in to empty states
19. Add reduced-motion media queries to all pages
20. Add pending dot reduced-motion fix to Matching Status

### Phase 4 — Assets (Week 2–3)
21. Generate SVG icon set (11 icons)
22. Generate mascot assets (5 expressions)
23. Generate pre-blurred shadow asset
24. Verify archetype glyph set completeness

---

*End of specification.*
