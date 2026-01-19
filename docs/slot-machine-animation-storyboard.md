# Slot Machine to Archetype Reveal Animation Storyboard

## Document Information
- **Version**: 1.0
- **Date**: 2026-01-15
- **Status**: Technical Specification
- **Target**: Professional, polished gaming-style reveal experience

## Executive Summary

This document provides a comprehensive storyboard and technical specification for the archetype slot machine reveal animation journey. The design ensures precise landing mechanics, smooth transitions, and a cohesive Pokémon-inspired reveal experience optimized for mobile devices.

---

## Animation Journey Overview

**Total Duration**: ~5.5-6.5 seconds (configurable via A/B testing)
**Key Principle**: Build anticipation → Deliver satisfaction → Create memorable moment

```
Timeline:
0.0s ────► 0.9s ────► 3.7s ────► 4.2s ────► 4.6s ────► 6.5s
│          │          │          │          │          │
Idle    Anticipation Spinning  Slowing  Landing   Celebration
```

---

## Act-by-Act Breakdown

### Act 1: Anticipation (0.0s - 0.9s)
**Goal**: Build tension and prepare user for reveal

#### Visual Elements
- **Slot Frame**: Pulsing primary color border (0.8s cycle)
- **Perimeter Lights**: Slow chase effect (2s per rotation)
- **Reel Items**: Heavy grayscale (100%), low opacity (0.2-0.3), scale (0.8)
- **Progress Bar**: 0% → 10%
- **Background**: Subtle gradient overlay

#### Technical Parameters
```typescript
{
  duration: 900,
  intensity: 0.1 → 0.35,
  grayscale: 100,
  opacity: 0.2,
  scale: 0.8,
  borderPulse: { duration: 800, repeat: Infinity },
  lightChase: { duration: 2000, repeat: Infinity }
}
```

#### User Feedback
- **Visual**: Pulsing frame indicates something is happening
- **Haptic**: Single gentle vibration (30ms) on start
- **Audio**: (Future) Soft "wind-up" sound

---

### Act 2: Fast Spinning (0.9s - 3.7s)
**Goal**: Create excitement and blur effect for mystery

#### Visual Elements
- **Reel Movement**: Items cycle rapidly (80ms interval)
- **Speed Lines**: Vertical motion blur lines (6 lines, staggered)
- **Item Appearance**: Grayscale (80%), opacity (0.5), scale (0.9)
- **Perimeter Lights**: Fast chase (0.4s per rotation)
- **Progress Bar**: 10% → 60%
- **Phase Text**: "命运转动中..."

#### Technical Parameters
```typescript
{
  duration: 2800,
  interval: 80,
  intensity: 0.3 → 0.7,
  grayscale: 80,
  opacity: 0.5,
  scale: 0.9,
  speedLines: {
    count: 6,
    duration: 150,
    stagger: 20
  },
  lightChase: { duration: 400 }
}
```

#### Motion Design
- **Easing**: Linear for consistent spin feel
- **Item Transition**: Quick fade (40ms) for motion blur effect
- **Center Highlight**: Faint center line (30% opacity)

---

### Act 3: Dramatic Slowdown (3.7s - 4.2s)
**Goal**: Build suspense as result approaches

#### Visual Elements
- **Reel Movement**: Progressively slower (10 steps, 80ms → 530ms)
- **Item Clarity**: Grayscale reduces (80% → 40%), opacity increases (0.5 → 0.7)
- **Scale**: Items grow slightly (0.9 → 0.95)
- **Perimeter Lights**: Moderate chase (0.8s per rotation)
- **Progress Bar**: 60% → 90%
- **Haptic**: Gentle tick every 3 steps (20ms)

#### Technical Parameters
```typescript
{
  totalSteps: 10,
  baseDelay: 80,
  delayIncrement: 50,
  intensity: 0.5 → 0.8,
  grayscale: 40,
  opacity: 0.7,
  scale: 0.95,
  lightChase: { duration: 800 },
  hapticInterval: 3
}
```

#### Smart Positioning
```typescript
// Algorithm ensures we land on target
const distToTarget = (targetIndex - currentIndex + totalItems) % totalItems;
const stepsRemaining = totalSteps - currentStep;

if (distToTarget > stepsRemaining + 1) {
  jump = Math.max(1, Math.floor(distToTarget / stepsRemaining));
} else if (distToTarget > 1) {
  jump = 1;
}
// This guarantees arrival at target with natural deceleration
```

---

### Act 4: Near-Miss Tension (4.2s - 4.6s) [OPTIONAL]
**Goal**: Add dramatic tension with controlled overshoot

**Probability**: 70% (configurable)

#### Visual Elements
- **Overshoot**: Reel passes target by 1 position
- **Pause**: 400ms hold on wrong archetype
- **Snap Back**: Quick return to correct archetype (smooth transition)
- **Intensity Spike**: 1.0 (maximum visual effects)
- **Haptic**: Double pulse (40ms, pause, 40ms)

#### Technical Parameters
```typescript
{
  enabled: Math.random() < 0.7,
  overshootDistance: 1,
  pauseDuration: 400,
  snapBackDuration: 200,
  intensity: 1.0,
  haptic: [40, 20, 40]
}
```

#### Accessibility Note
- **Reduced Motion**: Skip near-miss entirely, jump straight to landing
- **Cognitive Load**: Near-miss should feel intentional, not like an error

---

### Act 5: Precise Landing (4.6s)
**Goal**: Deliver satisfaction with perfect alignment

#### Visual Elements - Frame
- **Border**: Transforms to gold/yellow (#facc15)
- **Glow**: Large radial burst (scale 0.6 → 3, opacity 0.9 → 0)
- **Perimeter Lights**: Synchronized flash (all lights at once)
- **Corner Accents**: Bright yellow glow with 25px shadow
- **Progress Bar**: Jumps to 100% with golden gradient

#### Visual Elements - Reel Item
- **Grayscale**: Removed (0%)
- **Opacity**: Full (1.0)
- **Scale**: Enlarged (1.0 → 1.15)
- **Glow**: Archetype-colored radial glow behind image
- **Name Display**: Archetype name fades in below image
- **Drop Shadow**: Purple glow (30px blur)

#### Technical Parameters
```typescript
{
  timing: "instant",
  itemScale: { from: 1.0, to: 1.15, duration: 400, easing: [0.34, 1.56, 0.64, 1] }, // Bouncy
  glowBurst: {
    scale: [0.6, 1.8, 3],
    opacity: [0.9, 0.5, 0],
    duration: 1100
  },
  borderColor: "#facc15",
  borderGlow: "0 0 30px rgba(250,204,21,0.4)",
  haptic: [100, 50, 100, 50, 200] // Victory pattern
}
```

---

### Act 6: Particle Celebration (4.6s - 7.0s)
**Goal**: Create memorable, shareable moment

#### Visual Elements - Particles
- **Count**: 40 particles (mobile-optimized)
- **Types**: 30% stars, 70% confetti
- **Colors**: Archetype color + gold (#facc15) + pink (#f472b6)
- **Origin**: Center (50%, 40%) with tight spread (±15% x, ±8% y)
- **Movement**: Radial explosion with rotation
- **Duration**: 2.4 seconds

#### Visual Elements - Background
- **Radial Tint**: Archetype color at 35% opacity
- **Rainbow Shimmer**: Rotating conic gradient (8s rotation)
- **Floating Sparkles**: 8 sparkles rising from bottom

#### Technical Parameters
```typescript
{
  particles: {
    count: 40,
    starRatio: 0.3,
    speed: { min: 140, max: 300 },
    size: { star: 10, confetti: 6 },
    colors: [archetypeColor, "#facc15", "#f472b6"],
    animation: {
      scale: [0, 1.5, 1, 0.5],
      opacity: [1, 1, 0.8, 0],
      rotation: [0, 720], // Confetti only
      duration: 2000,
      stagger: 0.2
    }
  },
  background: {
    radialTint: { opacity: 0.35, duration: 600 },
    rainbowShimmer: { rotation: 360, duration: 8000 }
  },
  floatingSparkles: {
    count: 8,
    riseDuration: { min: 3000, max: 5000 }
  }
}
```

---

### Act 7: Hero Card Reveal (4.6s - 6.5s)
**Goal**: Present result with clear hierarchy and delight

#### Visual Elements
- **Entry Animation**: Scale from 0.85 → 1.2 → 1.0 (bouncy overshoot)
- **Glow Behind**: Pulsing archetype-colored glow (1.5s cycle)
- **Emoji + Name**: Staggered letter appearance (50ms per character)
- **Confidence Badge**: Delayed appearance (400ms) with star icon
- **CTA Buttons**: Fade in at 600ms

#### Layout Hierarchy
```
┌─────────────────────────┐
│    🎉 你是 🎉           │
│                         │
│   🐕                    │ ← Emoji (scale pulse)
│   开心柯基               │ ← Name (letter by letter)
│                         │
│ ⭐ 匹配度 92%           │ ← Confidence badge
└─────────────────────────┘
```

#### Technical Parameters
```typescript
{
  entry: {
    from: { scale: 0.85, opacity: 0, y: 30 },
    to: { scale: 1, opacity: 1, y: 0 },
    keyframes: [0.85, 1.2, 1], // Bounce
    duration: 600,
    easing: [0.34, 1.56, 0.64, 1]
  },
  glow: {
    opacity: [0.3, 0.6, 0.3],
    scale: [1, 1.05, 1],
    duration: 2000,
    repeat: Infinity
  },
  letterStagger: 50,
  confidenceDelay: 400,
  ctaDelay: 600
}
```

---

## Technical Implementation Guidelines

### 1. Guaranteed Precision Landing

**Problem**: Current implementation has probabilistic landing (70% near-miss chance)

**Solution**: Deterministic path calculation
```typescript
// In useSlotMachine.ts - startSlowing()
const distToTarget = (targetIndex - currentIndex + totalItems) % totalItems;
const stepsRemaining = totalSteps - currentStep;

// Guarantee we arrive at target
if (distToTarget > stepsRemaining + 1) {
  const jump = Math.max(1, Math.floor(distToTarget / stepsRemaining));
  idx = (idx + jump) % totalItems;
} else if (distToTarget > 1) {
  idx = (idx + 1) % totalItems;
}

// ALWAYS end at targetIndex, never random
setCurrentIndex(targetIndex);
```

### 2. State Machine Refinement

```typescript
type SlotMachineState = 
  | "idle"
  | "anticipation"  // 0.9s - Build tension
  | "spinning"      // 2.8s - Fast blur
  | "slowing"       // 0.5s - Deceleration
  | "nearMiss"      // 0.4s - Optional overshoot
  | "landed"        // Instant - Final position
  | "celebrating";  // 2.4s - Particles & hero card

interface StateConfig {
  duration: number;
  intensity: number;
  grayscale: number;
  opacity: number;
  scale: number;
  onEnter?: () => void;
  onExit?: () => void;
}
```

### 3. Performance Optimization

**Mobile Considerations**:
- Reduce particle count (40 max)
- Use CSS transforms over position changes
- Leverage `will-change` for animated elements
- Implement reduced motion preferences
- Disable effects below 30fps threshold

**GPU Acceleration**:
```css
.slot-reel-item {
  will-change: transform, opacity, filter;
  transform: translateZ(0); /* Force GPU layer */
}
```

### 4. Accessibility

**Reduced Motion**:
```typescript
if (prefersReducedMotion) {
  // Skip all spinning phases
  setCurrentIndex(targetIndex);
  setState("landed");
  // Simplified celebration (no particles)
  triggerHaptic([100, 50, 100]);
  onLand();
}
```

**Screen Reader Announcements**:
```jsx
<div aria-live="polite" role="status" className="sr-only">
  {state === "landed" 
    ? `结果揭晓：你是${archetypeName}，匹配度 ${confidence}%`
    : phaseText
  }
</div>
```

### 5. A/B Testing Framework

```typescript
interface TimingVariant {
  id: "baseline" | "fast" | "dramatic";
  act1Duration: number;
  act2Duration: number;
  act3Duration: number;
  nearMissEnabled: boolean;
  particleCount: number;
}

const VARIANTS: Record<string, TimingVariant> = {
  baseline: {
    id: "baseline",
    act1Duration: 900,
    act2Duration: 2800,
    act3Duration: 500,
    nearMissEnabled: true,
    particleCount: 40
  },
  fast: {
    id: "fast",
    act1Duration: 600,
    act2Duration: 2000,
    act3Duration: 400,
    nearMissEnabled: false,
    particleCount: 30
  },
  dramatic: {
    id: "dramatic",
    act1Duration: 1200,
    act2Duration: 3200,
    act3Duration: 800,
    nearMissEnabled: true,
    particleCount: 50
  }
};
```

---

## Design Patterns & References

### Pokémon-Style Reveal Elements

1. **White Flash**: Brief full-screen white flash on landing (100ms)
2. **Growth Sequence**: Item grows from small to large with slight bounce
3. **Particle Burst**: Radial explosion of colored particles
4. **Text Reveal**: Name appears letter-by-letter with slight bounce per character
5. **Sound Design**: (Future) Achievement chime + whoosh + sparkle

### Gaming Best Practices

- **Feedback Layering**: Visual + Haptic + Audio (when available)
- **Anticipation Before Action**: Slow wind-up before fast action
- **Clear Cause & Effect**: User action → immediate visual response
- **Satisfying Completion**: Celebration must feel earned, not automatic
- **Replay Value**: Shareable moment encourages screenshots

---

## Quality Assurance Checklist

### Visual Testing
- [ ] Slot always lands on correct archetype (100% accuracy)
- [ ] Transitions are smooth (60fps maintained)
- [ ] Colors match brand guidelines
- [ ] Effects scale appropriately on different screen sizes
- [ ] Reduced motion version works correctly

### Timing Testing
- [ ] Total duration is within acceptable range (5-7s)
- [ ] No jarring pauses or rushes
- [ ] Haptic feedback aligns with visual events
- [ ] Progress bar accurately reflects progress

### Edge Cases
- [ ] Works with all 12 archetypes
- [ ] Handles missing/failed images gracefully
- [ ] Low-end device performance acceptable
- [ ] Works in different orientations (if applicable)
- [ ] Network interruption recovery

### Accessibility
- [ ] Keyboard navigation (if applicable)
- [ ] Screen reader announcements
- [ ] Reduced motion preference honored
- [ ] High contrast mode compatible
- [ ] Touch target sizes adequate (44x44 minimum)

---

## Future Enhancements

### Phase 2 Improvements
1. **Sound Design**: Achievement sounds, spin whoosh, landing chime
2. **Haptic Patterns**: More sophisticated vibration sequences
3. **Social Sharing**: Animated GIF/video export of reveal moment
4. **Customization**: User can adjust animation speed preference
5. **Easter Eggs**: Special animations for rare archetype combinations

### Analytics & Optimization
- Track completion rates (do users skip?)
- Measure engagement time
- A/B test timing variants
- Monitor performance metrics (FPS, jank)
- Gather qualitative feedback

---

## Appendix: Easing Curves

**Spring/Bounce (Landing, Hero Card)**:
```
cubic-bezier(0.34, 1.56, 0.64, 1)
```

**Smooth Ease Out (Most transitions)**:
```
cubic-bezier(0.25, 0.1, 0.25, 1)
```

**Linear (Spinning)**:
```
linear
```

**Ease In Out (Anticipation pulse)**:
```
ease-in-out
```

---

## Document History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-01-15 | Initial storyboard created | Technical Team |

---

## Approval Sign-off

- [ ] Product Manager
- [ ] UI/UX Designer  
- [ ] Gaming Animation Expert
- [ ] Engineering Lead
- [ ] QA Lead

