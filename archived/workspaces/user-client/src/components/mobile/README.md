# Mobile-First Components

This directory contains mobile-optimized React components following the Mobile UI Design Specification.

## Components

### TiltedFeatureCard

Mobile-optimized card with subtle tilt effect and touch-optimized interactions.

**Usage**:
```tsx
import { TiltedFeatureCard } from '@/components/mobile';

<TiltedFeatureCard
  icon={<Users className="w-10 h-10" />}
  title="4-6人智能匹配"
  description="告别尴尬社交"
  tiltDegrees={-1.5}
  onClick={() => console.log('tapped')}
/>
```

**Features**:
- Subtle tilt effect (customizable angle)
- Touch feedback (scale 0.98 + opacity 0.9)
- Minimum 44×44pt touch target
- Smooth 200ms animations
- Motion reduce support

### MobilePrimaryButton

Touch-optimized primary action button with gradient background.

**Usage**:
```tsx
import { MobilePrimaryButton } from '@/components/mobile';

<MobilePrimaryButton
  onClick={handleAction}
  tiltDegrees={0.8}
  enableHaptic={true}
>
  看看我会遇见谁
</MobilePrimaryButton>
```

**Features**:
- 90% width for comfortable thumb reach
- Gradient: `from-[#FF6B9D] to-[#A86BFF]`
- Haptic feedback (20ms vibration)
- Instant touch response (<100ms)
- Subtle tilt effect

### MobileContainer

Layout wrapper with safe area support for mobile viewports.

**Usage**:
```tsx
import { MobileContainer } from '@/components/mobile';

<MobileContainer enableSafeArea={true}>
  {/* Your mobile content */}
</MobileContainer>
```

**Features**:
- Dynamic viewport height (100dvh)
- Safe area insets (iOS notch, Android navigation)
- Container padding (20px / 40rpx)
- Automatic spacing adjustments

## Design Principles

### Touch Optimization

All components meet mobile touch target requirements:
- **iOS**: ≥44×44pt (Apple HIG)
- **Android**: ≥48×48dp (Material Design)

### Animations

- **Speed**: 100-200ms for instant feedback
- **Properties**: Only `transform` and `opacity` (hardware accelerated)
- **Motion Reduce**: Automatic disable for accessibility

### Responsive Design

- **Base viewport**: 375px × 667px (iPhone 8)
- **Safe areas**: iOS notch, home indicator, Android navigation
- **Units**: px/rem with mobile-first media queries

## Related Documentation

- [Mobile Design System](../../../../../docs/mobile-design-system.md)
- [Implementation Summary](../../../../../archived/docs/MOBILE_UI_IMPLEMENTATION.md)
- [WeChat Mini Program Reference](../../../../../docs/wechat-mini-program-reference.md)

## Demo

Visit `/dev/mobile-landing` in non-production builds to see these components in action.

## Browser Support

- iOS Safari 14+
- Android Chrome 90+
- WeChat WebView (future)
