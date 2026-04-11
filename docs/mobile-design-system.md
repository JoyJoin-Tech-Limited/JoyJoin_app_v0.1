# Mobile-First Design System

> **Status:** Active web-mobile design-system reference — last verified 2026-04-11.
> **Scope:** This document primarily describes the mobile-first browser implementation in `apps/user-client`. The repo also has an active Taro + React mini-program client in `apps/mini-program`; use `docs/PLATFORM_COORDINATION.md` for current cross-platform ownership and drift tracking.

## Overview

This document describes the mobile-first design system implementation for JoyJoin, based on the Mobile UI Design Specification. The system is optimized for the browser-first mobile experience in `apps/user-client` and should be read alongside the active mini-program coordination docs rather than as a pre-mini-program planning artifact.

## Platform Support

- ✅ **Mobile Web (PWA)**: Primary design-system implementation (`apps/user-client`, React + Tailwind CSS)
- 🟢 **Taro Mini Program**: Active sibling client (`apps/mini-program`) that shares design intent but requires explicit parity review
- 📚 **Raw WeChat Reference**: Supplemental conversion guidance only in `docs/wechat-mini-program-reference.md`
- 📱 **Native Mobile**: Future consideration (React Native)

## Design Principles

### 1. Mobile-First Layout

**Screen Base**: 375px × 667px (iPhone 8 standard)
**Implementation**: Responsive units (px, rem) with mobile-first media queries

**Component Spacing** (converted from rpx):
```
Container padding: 20px (40rpx)
Section margin: 30px vertical (60rpx)
Card size: 165px × 140px (330rpx × 280rpx)
Grid gap: 15px (30rpx)
Button height: 48px (96rpx)
Button radius: 24px (48rpx)
```

### 2. Touch-Optimized Components

**Minimum Touch Targets**:
- iOS: 44×44pt (Apple HIG)
- Android: 48×48dp (Material Design)
- Implementation: `min-w-[44px] min-h-[44px]`

**Touch Feedback**:
- Tap response: <100ms
- Active state: `scale(0.98)` + `opacity(0.9)`
- Transition: 200ms ease-out

### 3. Tilted Components

**Mobile-Optimized Angles**:
```css
Card 1: -1.5deg (subtle for mobile)
Card 2: 1.2deg
Card 3: 0.8deg
Card 4: -1.2deg
```

**Interaction States**:
- Default: `rotate(var(--tilt))`
- Active: `rotate(0deg) scale(0.98)`
- Motion Reduce: No rotation

## Component Library

### TiltedFeatureCard

Mobile-optimized card with subtle tilt effect.

**Props**:
```typescript
interface TiltedFeatureCardProps {
  icon: ReactNode;
  title: string;
  description?: string;
  tiltDegrees?: number;
  onClick?: () => void;
  className?: string;
}
```

**Usage**:
```tsx
<TiltedFeatureCard
  icon={<Users />}
  title="4-6人智能匹配"
  description="告别尴尬社交"
  tiltDegrees={-1.5}
  onClick={() => console.log('tapped')}
/>
```

### MobilePrimaryButton

Touch-optimized primary action button with gradient.

**Props**:
```typescript
interface MobilePrimaryButtonProps {
  tiltDegrees?: number;
  enableHaptic?: boolean;
  // ...standard button props
}
```

**Features**:
- 90% width (comfortable thumb reach)
- 48px height (comfortable tap)
- Gradient: `from-[#FF6B9D] to-[#A86BFF]`
- Haptic feedback: 20ms vibration on tap
- Instant feedback: 100ms transition

**Usage**:
```tsx
<MobilePrimaryButton
  onClick={handleAction}
  tiltDegrees={0.8}
  enableHaptic={true}
>
  看看我会遇见谁
</MobilePrimaryButton>
```

### MobileContainer

Layout wrapper with safe area support.

**Props**:
```typescript
interface MobileContainerProps {
  children: ReactNode;
  className?: string;
  enableSafeArea?: boolean;
}
```

**Features**:
- Dynamic viewport height: `100dvh`
- Safe area insets: iOS notch, Android navigation
- Container padding: 20px (40rpx)

**Usage**:
```tsx
<MobileContainer enableSafeArea={true}>
  {/* Your content */}
</MobileContainer>
```

## CSS Utilities

### Mobile-Specific Classes

```css
/* Viewport */
.mobile-viewport { height: 100dvh; }

/* Tilt effects */
.tilt-1 { transform: rotate(-1.5deg); }
.tilt-2 { transform: rotate(1.2deg); }
.tilt-3 { transform: rotate(0.8deg); }
.tilt-4 { transform: rotate(-1.2deg); }

/* Touch states */
.mobile-active:active {
  transform: scale(0.98);
  opacity: 0.9;
}

/* Safe areas */
.pt-safe { padding-top: env(safe-area-inset-top, 1.5rem); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom, 1.5rem); }
.pl-safe { padding-left: env(safe-area-inset-left, 1.25rem); }
.pr-safe { padding-right: env(safe-area-inset-right, 1.25rem); }

/* Gradient text */
.gradient-text-mobile {
  background: linear-gradient(135deg, #FF6B9D, #A86BFF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Motion Reduce Support

All animations respect `prefers-reduced-motion`:
```css
@media (prefers-reduced-motion: reduce) {
  .tilt-1, .tilt-2, .tilt-3, .tilt-4 {
    transform: none !important;
  }
  
  .mobile-active:active {
    transform: none !important;
  }
}
```

## Typography

**Mobile Font Stack**:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
```

**Sizes** (based on spec):
```
Brand:       3rem (64rpx) - gradient
Tagline:     1rem (32rpx) - #666
Feature:     0.875rem (28rpx) - #333
Description: 0.75rem (24rpx) - #666
Button:      1rem (32rpx) - #FFF
Link:        0.875rem (28rpx) - #A86BFF
Legal:       0.6875rem (22rpx) - #999
```

## Color Palette

**Primary Gradient**:
```css
from-[#FF6B9D] to-[#A86BFF]
```

**Backgrounds**:
```css
from-[#FAFAFA] via-[#FFF5F7] to-[#FFE4E1]
```

**Text Colors**:
- Primary: `#333`
- Secondary: `#666`
- Muted: `#999`
- Accent: `#A86BFF`
- Pink: `#FF6B9D`

## Responsive Behavior

### Portrait Mode

**Large Phones** (≥414px):
- Scale up proportionally
- Maintain 2×2 grid

**Small Phones** (≤320px):
- Switch to 1-column grid
- Remove tilt effects
- Reduce spacing

```css
@media (max-width: 320px) {
  .features-grid {
    grid-template-columns: 1fr;
  }
  
  .feature-card {
    transform: rotate(0deg) !important;
  }
}
```

### Landscape Mode

- Switch to 1×4 horizontal grid
- Reduce tilt angles by 50%
- Adjust button to fixed top-right

## Performance Optimizations

### 1. CSS Containment
```css
.mobile-card {
  contain: layout style paint;
}
```

### 2. Image Optimization
- Use WebP format
- Appropriate sizes for mobile
- Lazy loading for non-critical assets

### 3. Animation Performance
- Use `transform` and `opacity` only
- Avoid layout thrashing
- Hardware acceleration: `will-change: transform`

### 4. Memory Management
- Clean up event listeners
- Avoid memory leaks in components
- Optimize re-renders

## Accessibility

### Screen Readers
```tsx
<button aria-label="4-6人智能匹配">
  {/* Content */}
</button>
```

### Dynamic Text
- Support font scaling
- Test with 200% zoom
- Minimum 16px base font

### Color Contrast
- Normal text: ≥4.5:1
- Large text: ≥3:1
- Use contrast checker tools

### Touch Targets
- Minimum: 44×44pt
- Ensure adequate spacing
- Avoid overlapping targets

## Mini-program references and boundaries

Use these references in order:

1. `docs/PLATFORM_COORDINATION.md` — current platform ownership, parity risks, and coordination rules
2. `apps/mini-program/README.md` — active workspace entry point for the Taro client
3. `docs/wechat-mini-program-reference.md` — supplemental raw WXML/WXSS translation guide retained for legacy design-reference purposes

The table below is a raw platform-concept translation reference, not the architecture of the current Taro implementation.

### Key Differences

| Web design-system concept | Raw WeChat reference concept |
|---------------------------|------------------------------|
| React JSX | WXML |
| CSS/Tailwind | WXSS |
| px/rem units | rpx units |
| onClick | bind:tap |
| className | class |
| style prop | style inline |

### Example Conversion

**React (Current)**:
```tsx
<button onClick={handleClick} className="btn">
  Click me
</button>
```

**Raw WeChat Reference**:
```xml
<button bind:tap="handleClick" class="btn">
  Click me
</button>
```

## Quality Checklist

Before releasing:

- [ ] All touch targets ≥44×44pt
- [ ] Tilt effects subtle on mobile
- [ ] Gradient renders correctly
- [ ] Text readable without zoom
- [ ] Works with screen readers
- [ ] No horizontal scrolling
- [ ] Fast tap response (<100ms)
- [ ] Memory efficient
- [ ] Battery efficient animations
- [ ] Tested on iOS Safari
- [ ] Tested on Android Chrome
- [ ] Safe area insets work
- [ ] Motion reduce respected

## Browser Support

**Target Browsers**:
- iOS Safari 14+
- Android Chrome 90+
- Mobile WebView scenarios used by the web client

**Progressive Enhancement**:
- Core functionality works without JS
- Fallbacks for unsupported features
- Safe area insets with fallbacks

## Future Enhancements

1. **Shared web/mini-program primitives**
  - Extract more shared contracts and mobile primitives where duplicated behavior is stable
  - Reduce design-system drift between `apps/user-client` and `apps/mini-program`
  - Keep renderer-specific implementation details in platform-owned workspaces

2. **Native Mobile Apps**
   - React Native implementation
   - Platform-specific components
   - Native haptic feedback

3. **Advanced Features**
   - Swipe gestures
   - Pull-to-refresh
   - Bottom sheet modals
   - Native share sheet

## Related Files

- `/apps/user-client/src/components/mobile/` - Mobile component library
- `/apps/user-client/src/pages/MobileLandingPage.tsx` - Reference implementation
- `/apps/mini-program/` - Active Taro mini-program client
- `/apps/user-client/src/index.css` - Mobile CSS utilities
- `/docs/PLATFORM_COORDINATION.md` - Active web/mini-program coordination playbook
- `/docs/wechat-mini-program-reference.md` - Supplemental raw WeChat reference guide
