# JoyJoin Mini-Program 20/20 Engineering Implementation Plan

> **Synthesis of:** PM Roadmap (`reports/mini-program-20-20-roadmap.md`) + Design Spec (`reports/mini-program-20-20-design-spec.md`)  
> **Date:** 2026-05-21  
> **Target:** `apps/mini-program`  
> **Estimated Dev Effort:** 3 weeks (1 engineer)

---

## 0. Pre-Flight Checklist

Before touching any code:
- [ ] `cd apps/mini-program && npm run build:weapp` passes clean
- [ ] `cd ../.. && npm run guardrails` passes
- [ ] `npm run design:audit` baseline captured (current average: 15.8/20)
- [ ] WeChat DevTools open with iPhone 14 Pro + Xiaomi Redmi presets

---

## Phase 1: Safety & Tokens (Week 1, Days 1–3)

**Goal:** Fix all P0 bugs, establish token foundation, eliminate platform-safety violations. Average: 15.8 → 17.2.

> **Sprint Contract:** `.git/.orchestration/sprints/sprint-contract.mp-20-20-polish-20260521.md`

### Day 1a — Token Foundation + P0 Bug

#### 1.1 Add Design Tokens to `_variables.scss`

**File:** `apps/mini-program/src/styles/_variables.scss`

Add after existing `$line-height-*` tokens (or at end if none exist):

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

// ─── Icon Slot Sizes ─────────────────────────────────────────────
$icon-slot-sm:    40rpx;
$icon-slot-md:    48rpx;
$icon-slot-lg:    56rpx;

// ─── Line-height Token Overrides ─────────────────────────────────
$line-height-tight:   1.2;
$line-height-snug:    1.3;
$line-height-normal:  1.5;
$line-height-relaxed: 1.6;
$line-height-loose:   1.75;

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

> **Verify:** `npm run build:weapp` — SCSS compiles without "undefined variable" errors.

#### 1.2 Add Mixins to `_mixins.scss`

**File:** `apps/mini-program/src/styles/_mixins.scss`

Append:

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

#### 1.3 Add Global Keyframes

**File:** `apps/mini-program/src/styles/_mixins.scss` (or create `apps/mini-program/src/styles/_animations.scss` if preferred)

Append:

```scss
@keyframes staggered-rise {
  from { opacity: 0; transform: translateY(16rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes card-slide-in {
  from { opacity: 0; transform: translateY(20rpx) scale(0.985); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes mascot-bounce-in {
  0%   { opacity: 0; transform: translateY(24rpx) scale(0.85); }
  60%  { transform: translateY(-4rpx) scale(1.04); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes pending-dot-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50%      { opacity: 1; transform: scale(1.1); }
}

@keyframes fade-slide-up {
  from { opacity: 0; transform: translateY(12rpx); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes shimmer-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
```

#### 1.4 P0 Bug Fix: `window.location.reload` → `Taro.reLaunch`

> **Verified:** Bug exists at `center-hub/index.tsx:111`.

**File:** `apps/mini-program/src/pages/center-hub/index.tsx`

**Current (line ~112):**
```tsx
<Button className='center-hub__cta' onClick={() => window.location.reload?.()}>
  重新加载
</Button>
```

**Replace with:**
```tsx
import Taro from '@tarojs/taro'

// ... in render:
<Button className='center-hub__cta' onClick={() => Taro.reLaunch({ url: '/pages/center-hub/index' })}>
  重新加载
</Button>
```

> **Verify:** Build passes. Test in WeChat DevTools — button reloads page without error.

#### 1.5 Touch Target Safety Sweep — All `Text` with `onClick`

> **Scope expanded per expert review:** Found 4 instances across 3 files (plan originally covered 2).

**Instance 1 — Edit Profile interest tags:**
**File:** `apps/mini-program/src/pages/edit-profile/index.tsx:333`

**File:** `apps/mini-program/src/pages/edit-profile/index.tsx`

Find interest tag rendering. Current pattern:
```tsx
<Text onClick={toggleTag}>标签名</Text>
```

**Instance 2 — Edit Profile gender option:**
**File:** `apps/mini-program/src/pages/edit-profile/index.tsx:260`

**Replace `<Text>` with `<View>` wrapper.**

**Instance 3 — Squad Unboxing skip link:**
**File:** `apps/mini-program/src/pages/squad-unboxing/index.tsx:530`

**Replace `<Text>` with `<View>` or `<Button>`.**

**Instance 4 — Icebreaker MiniScript back button:**
**File:** `apps/mini-program/src/pages/icebreaker-session/overlays/MiniScriptConfigModal.tsx:215`

**Replace `<Text>` with `<View>` or `<Button>`.**

**Add to Edit Profile tags (Instance 1):**
```tsx
<View className='edit-profile__tag' onClick={toggleTag}>
  <Text className='edit-profile__tag-text'>标签名</Text>
</View>
```

Add SCSS:
```scss
.edit-profile__tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: $spacing-xs $spacing-md;
  border-radius: 100rpx;
  background: $color-surface;
  border: 1rpx solid $color-border;

  &--active {
    background: rgba($color-primary, 0.1);
    border-color: $color-primary;
  }

  &:active {
    transform: scale(0.96);
  }
}

.edit-profile__tag-text {
  font-size: $font-size-sm;
  color: $color-text-primary;
  line-height: $line-height-normal;
}
```

> **Verify:** All interest tags are tappable with ≥ 56rpx height. No `Text` elements have `onClick`.

#### 1.6 Fix Hardcoded `#07c160` in Login

**File:** `apps/mini-program/src/pages/login/index.tsx` (or SCSS)

Find any `#07c160` or `#06ad56` and replace with `$color-wechat-green` / `$color-wechat-green-hover`.

#### 1.7 Blur Filter Removal — All Instances

> **Scope expanded per expert review:** Found 7 instances across 4 files (plan originally covered 1).

| File | Line | Current | Replacement |
|------|------|---------|-------------|
| `squad-unboxing/index.scss` | 256 | `filter: blur(10rpx)` | `opacity: 0.6` or pre-blurred asset |
| `matching-status/styles/_overlay.scss` | 20 | `backdrop-filter: blur(12rpx)` | `background: rgba(0,0,0,0.X)` solid overlay |
| `matching-status/styles/_hero.scss` | 73 | `filter: blur(28rpx)` | Pre-blurred asset or opacity fade |
| `icebreaker-session/index.scss` | 885 | `backdrop-filter: blur(6rpx)` | Solid background fallback |
| `icebreaker-session/index.scss` | 2373 | `backdrop-filter: blur(6rpx)` | Solid background fallback |
| `icebreaker-session/index.scss` | 2445 | `backdrop-filter: blur(6rpx)` | Solid background fallback |
| `icebreaker-session/index.scss` | 2463 | `backdrop-filter: blur(12rpx)` | Solid background fallback |

> **Rationale:** Onboarding code already acknowledges `backdrop-filter` is unreliable in WeChat (`MascotQuestionHeader.scss:44`: "WeChat: backdrop-filter unreliable — solid fallback for production").

**File:** `apps/mini-program/src/pages/squad-unboxing/index.scss`

Find:
```scss
.squad-unboxing__blind-box-shadow {
  filter: blur(10rpx);
}
```

**Replace with:**
```scss
.squad-unboxing__blind-box-shadow {
  // REMOVED: filter: blur(10rpx); — causes GPU composite overhead
  // Replaced with pre-rendered shadow asset or opacity-based fallback
  opacity: 0.6;
}
```

> **Note:** Full fix (pre-blurred WebP asset) is Phase 4. The opacity fallback removes the perf penalty immediately.

#### 1.8 Fix Action Emoji Misalignment in Discover

**File:** `apps/mini-program/src/pages/discover/index.scss`

Find:
```scss
.discover-auth__action-emoji {
  // ...
  margin-bottom: 8rpx;
}
```

**Remove `margin-bottom: 8rpx`** — it breaks `align-items: center` in the flex row.

#### 1.9 Fix Host Badge Inline Style in Icebreaker

**File:** `apps/mini-program/src/pages/icebreaker-session/index.tsx`

Find inline-style host badge (e.g., `<View style={{ background: '...' }}>`). **Replace with className:**

```tsx
<View className='icebreaker__host-badge'>
  <Image className='icebreaker__host-badge-icon' src={cdnAsset('/assets/icons/status-icons/status-crown.png')} lazyLoad />
  <Text className='icebreaker__host-badge-text'>你是主持人</Text>
</View>
```

Add SCSS:
```scss
.icebreaker__host-badge {
  display: inline-flex;
  align-items: center;
  padding: $spacing-xs $spacing-md;
  background: rgba(251, 191, 36, 0.15);
  border-radius: 100rpx;
}
.icebreaker__host-badge-text {
  font-size: $font-size-sm;
  color: #92400e;
  font-weight: $font-weight-semibold;
}
.icebreaker__host-badge-icon {
  width: 24rpx;
  height: 24rpx;
  margin-right: 8rpx;
}
```

**End of Day 1a — Run:**
```bash
cd apps/mini-program && npm run build:weapp
```
All must pass.

---

### Day 1b — Quick Fixes Sweep (Expanded Scope)

Complete the remaining Day 1 quick fixes:
- Fix all 4 `Text` with `onClick` instances (§1.5)
- Remove all 7 blur filter instances (§1.7)
- Fix action emoji misalignment in Discover (§1.8)
- Fix host badge inline style in Icebreaker (§1.9)
- Tokenize `#07c160` in Login (§1.6)

**End of Day 1b — Run:**

#### 2.1 Build `XiaoyueEmptyState`

**File:** `apps/mini-program/src/components/mascot/XiaoyueEmptyState/index.tsx` (new)

> **Placement note:** Placed in `components/mascot/` for consistency with existing mascot components (`ArchetypeHead.tsx`, `XiaoyueChatBubble.tsx`, `ChemistryBadge.tsx`).

```tsx
import { View, Image, Text } from '@tarojs/components'
import { cdnAsset } from '@/lib/asset'

interface XiaoyueEmptyStateProps {
  emotion: 'coaching' | 'celebration' | 'waiting' | 'sad' | 'curious'
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_MAP = { sm: 160, md: 200, lg: 240 }
const [imgError, setImgError] = useState(false)

const EMOTION_MAP: Record<string, string> = {
  coaching:    'xiaoyue-coach-guide',
  celebration: 'xiaoyue-home-welcome',
  waiting:     'xiaoyue-match-waiting',
  sad:         'xiaoyue-neutral-information',
  curious:     'xiaoyue-connections-empty',
}

export default function XiaoyueEmptyState({
  emotion, title, subtitle, actionLabel, onAction, size = 'md'
}: XiaoyueEmptyStateProps) {
  const dim = SIZE_MAP[size]
  return (
    <View className='xiaoyue-empty-state'>
      <Image
        className='xiaoyue-empty-state__mascot'
        src={cdnAsset(`/assets/personality/xiaoyue/${EMOTION_MAP[emotion]}.webp`)}
        onError={() => {
          // CDN failure — hide mascot, fall back to text-only state
          setImgError(true)
        }}
        style={{ display: imgError ? 'none' : 'block' }}
        style={{ width: `${dim}rpx`, height: `${dim}rpx` }}
        mode='aspectFit'
        lazyLoad
      />
      <Text className='xiaoyue-empty-state__title'>{title}</Text>
      {subtitle && <Text className='xiaoyue-empty-state__subtitle'>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View className='xiaoyue-empty-state__action' onClick={onAction}>
          <Text className='xiaoyue-empty-state__action-text'>{actionLabel}</Text>
        </View>
      )}
    </View>
  )
}
```

**File:** `apps/mini-program/src/components/XiaoyueEmptyState/index.scss`

```scss
.xiaoyue-empty-state {
  @include empty-state-shell;

  &__mascot {
    animation: mascot-bounce-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  &__title {
    @include type-subheading;
    margin-top: $spacing-md;
  }

  &__subtitle {
    @include type-body;
    color: $color-text-secondary;
    margin-top: $spacing-xs;
    line-height: $line-height-relaxed;
  }

  &__action {
    margin-top: $spacing-lg;
    padding: $spacing-sm $spacing-xl;
    background: $color-primary;
    border-radius: 100rpx;
    min-height: $cta-min-tap;
    @include flex-center;

    &:active {
      transform: scale(0.98);
      opacity: 0.92;
    }
  }

  &__action-text {
    @include type-brand-cta-label;
    color: $color-surface;
  }
}

@media (prefers-reduced-motion: reduce) {
  .xiaoyue-empty-state__mascot {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

#### 2.2 Build `RichListCard` (extracted from OracleCard)

**File:** `apps/mini-program/src/components/RichListCard/index.tsx` (new)

```tsx
import { View, Text } from '@tarojs/components'

interface RichListCardProps {
  title: string
  subtitle?: string
  meta?: string
  ecosystem?: React.ReactNode
  gradient?: 'warm' | 'cool' | 'fire' | 'premium'
  children?: React.ReactNode
  onClick?: () => void
  index?: number
}

const GRADIENT_MAP = {
  warm:    '$card-gradient-warm',
  cool:    '$card-gradient-cool',
  fire:    '$card-gradient-fire',
  premium: '$card-gradient-premium',
}

export default function RichListCard({
  title, subtitle, meta, ecosystem, gradient = 'premium', children, onClick, index = 0
}: RichListCardProps) {
  return (
    <View
      className={`rich-list-card rich-list-card--${gradient}`}
      onClick={onClick}
      style={index > 0 ? { animationDelay: `${index * 60}ms` } : undefined}
    >
      {ecosystem && <View className='rich-list-card__ecosystem'>{ecosystem}</View>}
      <Text className='rich-list-card__title'>{title}</Text>
      {subtitle && <Text className='rich-list-card__subtitle'>{subtitle}</Text>}
      {meta && <Text className='rich-list-card__meta'>{meta}</Text>}
      {children}
    </View>
  )
}
```

**File:** `apps/mini-program/src/components/RichListCard/index.scss`

```scss
.rich-list-card {
  width: 100%;
  padding: $spacing-lg;
  border-radius: 32rpx;
  border: 2rpx solid rgba($color-primary, 0.1);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
  animation: card-slide-in 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;
  min-height: 140rpx;

  &--warm    { background: $card-gradient-warm; }
  &--cool    { background: $card-gradient-cool; }
  &--fire    { background: $card-gradient-fire; }
  &--premium { background: $card-gradient-premium; }

  &:active {
    transform: scale(0.98);
  }

  &__ecosystem {
    @include ecosystem-bar;
    margin-bottom: $spacing-sm;
  }

  &__title {
    @include type-subheading;
    display: block;
  }

  &__subtitle {
    @include type-body;
    color: $color-text-secondary;
    margin-top: $spacing-xs;
    display: block;
    line-height: $line-height-normal;
  }

  &__meta {
    @include type-caption;
    color: $color-text-muted;
    margin-top: 4rpx;
    display: block;
    line-height: $line-height-normal;
  }
}

@media (prefers-reduced-motion: reduce) {
  .rich-list-card {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
```

> **Verify:** Import `RichListCard` in a test page; renders without SCSS errors.

### Day 2 — Shared Components (Layer 1)
```bash
cd apps/mini-program && npm run build:weapp
npm run guardrails
```

---

### Day 3 — Screen Fixes (Layer 2 Begins)

#### 3.1 Events Page: Apply `RichListCard` + `XiaoyueEmptyState`

**File:** `apps/mini-program/src/pages/events/index.tsx`

- Replace empty state `✨ 还没有活动` → `<XiaoyueEmptyState emotion="curious" title="还没有活动" subtitle="去发现感兴趣的活动吧" actionLabel="去发现" onAction={navigateToDiscover} />`
- Replace minimal event cards with `<RichListCard>`
- Add `line-height: $line-height-relaxed` to all multi-line text

**File:** `apps/mini-program/src/pages/events/index.scss`

- Add `line-height` tokens to card text
- Add `min-height: 140rpx` to card base

#### 3.2 Center Hub: Apply `RichListCard` + Fix Error State

**File:** `apps/mini-program/src/pages/center-hub/index.tsx`

- Replace error state reload with `Taro.reLaunch` (already done Day 1)
- Add `XiaoyueEmptyState` to empty state
- Replace plain text cards with `RichListCard`
- Add Xiaoyue mascot to header (reuse `xiaoyue-home-welcome.webp`)

**File:** `apps/mini-program/src/pages/center-hub/index.scss`

Apply design spec §2.1 CSS.

#### 3.3 Matching Status: Line-height + Copy Fix

**File:** `apps/mini-program/src/pages/matching-status/index.tsx`

- Replace "当前状态" with "匹配进度"
- Add `line-height: $line-height-relaxed` to hint text blocks

#### 3.4 Connections: `ArchetypeGlyph` + `XiaoyueEmptyState`

**File:** `apps/mini-program/src/pages/connections/index.tsx`

- Swap text initials for `<ArchetypeGlyph>` component
- Replace empty state with `<XiaoyueEmptyState emotion="curious" ...>`

#### 3.5 Discover: Emoji Alignment Fix

**File:** `apps/mini-program/src/pages/discover/index.scss`

- Remove `margin-bottom: 8rpx` from `.discover-auth__action-emoji`
- Ensure `align-items: center` on parent flex container

**End of Day 3 — Run:**
```bash
npm run design:audit center-hub
npm run design:audit events
npm run design:audit matching-status
npm run design:audit connections
npm run design:audit discover
```
All scores should be ≥ 17.

---

## Phase 2: Core Screens Enrichment (Week 2, Days 4–8)

**Goal:** Push Events, Event Detail, Profile, Center Hub, Edit Profile into 18–19 band. Average: 17.2 → 18.1.

### Day 4 — Event Detail Deep Polish

**File:** `apps/mini-program/src/pages/event-detail/index.tsx` + `.scss`

- Add `line-height: $line-height-relaxed` to description block
- Add Xiaoyue tip bubble (reuse `xiaoyue-neutral-information.webp`) above description
- Add hero image gradient overlay
- Add "活动氛围" preview card using `RichListCard`
- Replace emoji info rows with `JoyJoinIcon` SVG slots (or `<Image>` with icon assets)

### Day 5 — Profile Redesign

**File:** `apps/mini-program/src/pages/profile/index.tsx` + `.scss`

- Remove confusing "当前状态" stat row (or relabel to "匹配进度")
- Add archetype celebration card with `ArchetypeGlyph` and color-matched gradient
- Add Xiaoyue greeting bubble (reuse `xiaoyue-home-welcome.webp`)
- Replace emoji action row icons with `JoyJoinIcon` (or `<Image>`)
- Add count badges to menu cards

### Day 6 — Edit Profile Enhancement

**File:** `apps/mini-program/src/pages/edit-profile/index.tsx` + `.scss`

- Add live preview card at top (mini profile card using `RichListCard`)
- Add `xiaoyue-coach-guide.webp` coaching bubble
- Interest tags use heat-level colors (warm/medium/cool based on count)
- Form section `line-height` fixes
- Touch target verification (all tags ≥ 56rpx)

### Day 7 — Center Hub Deep Polish

**File:** `apps/mini-program/src/pages/center-hub/index.tsx` + `.scss`

- Deepen `RichListCard` with countdown pill + location icon + event-type badge
- Add Xiaoyue peeking from bottom on non-empty states
- Ensure all 4 states (matched-event, pending-registration, matched-pool, empty) have mascot

### Day 8 — Events + Discover Polish

**Events:**
- Add event-type badge to cards
- Add "即将开始" countdown on upcoming events
- VirtualList safety threshold logging

**Discover:**
- Add Xiaoyue greeting header (conditional, if user has no name yet)
- Polish OracleCard micro-animation (scale entrance on filter change)

**End of Week 2 — Run:**
```bash
npm run design:audit  # all screens
```
Average should be ≥ 18.0.

---

## Phase 3: Deep Polish (Week 3, Days 9–12)

**Goal:** Push all screens to 18+ with surgical fixes. Average: 18.1 → 18.8.

### Day 9 — Motion & Reduced-Motion

1. Add staggered entrance to all list screens (Events, Connections, Discover)
2. Add `card-slide-in` to all card screens (Center Hub, Event Detail, Profile)
3. Add `mascot-bounce-in` to all empty states
4. Add global `@media (prefers-reduced-motion: reduce)` rule to all page SCSS files

**Pattern per page SCSS:**
```scss
@media (prefers-reduced-motion: reduce) {
  .page-name__animated-element {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }
}
```

### Day 10 — Icebreaker + Squad Unboxing

**Icebreaker Session:**
- Lazy-load phase backgrounds (class swap instead of eager `useMemo`)
- Add Xiaoyue phase-transition toast
- Set all phase copy `line-height: $line-height-relaxed`

**Squad Unboxing:**
- Replace `filter: blur` with pre-blurred shadow asset OR opacity fallback
- Tighten unboxing sequence timing

### Day 11 — Pool Registration + Matching Status

**Pool Registration:**
- Deduplicate bar/non-bar tier copy into shared copy module
- Add tier selector mascot illustration
- Step transition animations

**Matching Status:**
- Compass preference chips touch-target padding
- Pending dots reduced-motion guard verification

### Day 12 — Onboarding + Login Final Polish

**Onboarding Flow:**
- LandingPage card border colors → brand palette tokens
- Legal text `line-height: $line-height-relaxed`
- Onboarding entry mascot consistency

**Login Page:**
- Ad-hoc text color `#7B6A96` → token
- Button pressed-state scale consistency

**End of Week 3 — Final Audit:**
```bash
npm run design:audit  # all 13 screens
```
Zero screens below 17; 80% at 18+; average ≥ 18.5.

---

## Phase 4: Asset Generation (Async, Can Run in Parallel)

**Only 2 new Lovart assets needed (per PM roadmap):**

| Asset | Dimensions | Prompt Direction |
|-------|-----------|------------------|
| `xiaoyue-events-empty.webp` | 400×400 | Xiaoyue curious expression, soft pastel background, centered |
| `xiaoyue-event-detail-tip.webp` | 320×320 | Xiaoyue peeking from corner, pointing gesture, warm |

**SVG Icons (11 total, 48×48):**
Use existing icon set or generate: calendar, location, users, status, edit, trophy, invite, gift, map, document, chevron-right, crown.

**Pre-blurred Shadow:**
`shadow-blur-228.webp` (228×30) — static shadow for Squad Unboxing.

---

## Verification Ritual (End of Each Phase)

1. **Build check:** `npm run build:weapp` — zero errors
2. **Guardrails:** `npm run guardrails` — passes
3. **Design audit:** `npm run design:audit <screen>` — score meets target
4. **DevTools screenshots:** iPhone 14 Pro + Xiaomi Redmi (375px / 390px)
5. **Touch target test:** Tap every interactive element; all ≥ 88rpx effective area
6. **Reduced-motion test:** Enable "减弱动态效果" in iOS Settings → Accessibility; verify all animations disable

---

## Risk Mitigation (Engineering Actions)

| Risk | Engineering Mitigation |
|------|----------------------|
| Token cascade breakage | Keep old gradient visually identical initially; tokenize in follow-up PR |
| Touch target regression | Wrap `Text` inside `View` (Text for copy, View for hit area); add visual regression |
| Animation jank | `transform` + `opacity` only; no `box-shadow` animation; CPU throttle test |
| Bundle bloat | Reuse existing assets; only 2 new WebPs; verify subpackages < 2MB |
| Lazy-load white flash | Preload next-phase background on advance; keep current bg until next loads |

---

## File Change Summary

| Phase | Files Changed | New Files | Est. LOC |
|-------|--------------|-----------|----------|
| 1 | 12 page files + 2 token files + 2 guardrails | 0 | ~200 |
| 2 | 6 page files | 2 (`XiaoyueEmptyState`, `RichListCard`) | ~400 |
| 3 | 10 page files + 2 component files | 0 | ~300 |
| 4 | 0 | 2–13 asset files | N/A |
| **Total** | **28 page files** | **2 components + ~13 assets** | **~900** |

---

## Appendix: Sprint Contract

- **Sprint ID:** `sprint_20260521_5096xa`
- **Task ID:** `mp-20-20-polish-20260521`
- **Tier:** 2 (contract required)
- **Contract path:** `.git/.orchestration/sprints/sprint-contract.mp-20-20-polish-20260521.md`
- **Generator:** Taro Mini-Program Frontend Engineer
- **Evaluator:** Verifier
- **Sprint Evaluator:** QA Agent
- **Status:** Draft (awaiting acceptance criteria negotiation)

---

*Ready for engineering kickoff. Start with Phase 1, Day 1.*
