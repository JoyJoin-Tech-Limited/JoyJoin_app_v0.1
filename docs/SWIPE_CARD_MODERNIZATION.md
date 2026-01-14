# Swipe Card Modernization - Visual Design Documentation

## 🎨 Design Transformation Summary

This document details the visual and interaction design improvements made to the swipe card experience.

---

## 1. Swipe Labels - Before & After

### **BEFORE (Old Design)**
```tsx
// Plain solid colors with basic text labels
- RIGHT SWIPE: Green background (#10b981), text "喜欢"
- LEFT SWIPE: Gray background (#6b7280), text "跳过"  
- UP SWIPE: Pink background (#ec4899), icon + text "超爱"
- Animation: Simple opacity 0→1, scale 0.5→1 (on/off only)
- No progressive feedback based on swipe distance
```

### **AFTER (Modern Glassmorphism)**
```tsx
// RIGHT SWIPE - Emerald Gradient with Icon
<div className="
  px-5 py-3 rounded-2xl
  bg-gradient-to-br from-emerald-400 to-emerald-600  // ← Gradient
  border-3 border-white                                // ← White border
  shadow-[0_0_30px_rgba(16,185,129,0.4)]             // ← Glow shadow
  backdrop-blur-sm                                     // ← Blur effect
">
  <Heart className="w-10 h-10 text-white fill-white" />  // ← Icon only
</div>

// LEFT SWIPE - Frosted Glass
<div className="
  px-5 py-3 rounded-2xl
  bg-white/20                          // ← Translucent
  backdrop-filter backdrop-blur-xl     // ← Heavy blur
  border-2 border-white/40             // ← Semi-transparent border
  shadow-[0_8px_32px_rgba(0,0,0,0.12)] // ← Soft shadow
">
  <X className="w-10 h-10 text-white" />
</div>

// UP SWIPE - Pink Gradient with Enhanced Glow
<div className="
  px-6 py-3 rounded-2xl
  bg-gradient-to-br from-pink-500 to-rose-600      // ← Gradient
  border-3 border-white
  shadow-[0_0_40px_rgba(236,72,153,0.5)]          // ← Intense glow
  flex items-center gap-2
">
  <Sparkles className="w-6 h-6 text-white fill-white" />
  <span className="text-white font-bold text-xl">超爱</span>
</div>

// Progressive Animation (NEW)
style={{
  opacity: dragProgress,              // ← 0 to 1 based on distance
  scale: 0.8 + (dragProgress * 0.2),  // ← 0.8 to 1.0 smoothly
  y: dragDirection === 'up' ? -10 * dragProgress : 0  // ← Upward float
}}
```

---

## 2. Drag Physics - Before & After

### **BEFORE**
```tsx
dragElastic={0.7}         // Moderate elasticity
dragMomentum={false}      // No momentum/flick
dragTransition={{ 
  bounceStiffness: 300,   // Moderate bounce
  bounceDamping: 20 
}}
// No rotation during drag
```

### **AFTER**
```tsx
dragElastic={0.9}         // ← More responsive (was 0.7)
dragMomentum={true}       // ← Enable momentum (was false)
dragTransition={{ 
  bounceStiffness: 400,   // ← Snappier (was 300)
  bounceDamping: 25,      // ← Smoother (was 20)
  power: 0.4,             // ← NEW: Velocity multiplier
  timeConstant: 300       // ← NEW: Deceleration time
}}

// Dynamic rotation based on drag
const x = useMotionValue(0);
const rotate = useTransform(x, [-200, 200], [-20, 20]);
style={{ rotate, x }}  // ← Cards rotate as you drag
```

---

## 3. Card Stacking - 3D Perspective

### **BEFORE**
```tsx
<div className="relative aspect-[3/4]">  {/* No perspective */}
  initial={{ scale: 0.95, y: 10 }}      {/* Simple scale + y */}
</div>
```

### **AFTER**
```tsx
<div 
  className="relative aspect-[3/4]" 
  style={{ perspective: "1000px" }}  // ← 3D container
>
  initial={isTop ? { 
    scale: 1, 
    y: 0,
    opacity: 1,
    rotateX: 0          // ← Front card flat
  } : { 
    scale: 0.92,        // ← Smaller
    y: 20 * stackIndex, // ← Stacked vertically
    opacity: 0.8,       // ← Slightly faded
    rotateX: 5          // ← 3D tilt backward
  }}
  transition={{ 
    type: "spring",     // ← Natural motion
    stiffness: 260, 
    damping: 20 
  }}
</div>
```

---

## 4. Haptic Feedback - Before & After

### **BEFORE**
```tsx
if (choice === 'love') {
  navigator.vibrate([30, 50, 30]);  // Basic pattern
} else if (choice === 'like') {
  navigator.vibrate(20);             // Single pulse
}
// No haptic for skip
```

### **AFTER**
```tsx
if (choice === 'love') {
  navigator.vibrate([30, 50, 30, 50, 60]);  // ← Celebration pattern
} else if (choice === 'like') {
  navigator.vibrate([15, 10, 25]);           // ← Satisfying double-tap
} else if (choice === 'skip') {
  navigator.vibrate(10);                     // ← NEW: Subtle pulse
}
```

---

## 5. Bottom Button Bar - Before & After

### **BEFORE**
```tsx
<div className="
  gap-4 px-6 py-3                    // Smaller spacing
  bg-white/90 dark:bg-gray-900/90    // Less blur
  backdrop-blur-sm                   // Light blur
  border border-gray-200/60          // Subtle border
">
  {/* Skip - white bg, gray icon, 12x12 */}
  <button className="w-12 h-12 bg-white border border-gray-200">
    <X className="w-6 h-6 text-gray-400" />
  </button>

  {/* Love - purple gradient, 14x14 */}
  <button className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-700">
    <Sparkles className="w-7 h-7 text-white" />
  </button>

  {/* Like - white bg, pink border, 12x12 */}
  <button className="w-12 h-12 bg-white border border-pink-200">
    <Heart className="w-6 h-6 text-pink-500" />
  </button>
</div>
```

### **AFTER**
```tsx
<div className="
  gap-6 px-8 py-4                        // ← Larger spacing
  bg-white/95 dark:bg-gray-900/95        // ← Higher opacity
  backdrop-blur-md                       // ← Medium blur
  border border-gray-200/80              // ← Stronger border
  shadow-2xl                             // ← Dramatic shadow
  max-w-[340px]                          // ← Constrained width
">
  {/* Skip - gradient gray, 14x14 */}
  <button className="
    w-14 h-14                                          // ← Larger (was 12x12)
    bg-gradient-to-br from-gray-100 to-gray-200       // ← Gradient
    border-2 border-gray-300                          // ← Thicker border
    shadow-lg hover:shadow-xl                         // ← Dynamic shadow
  ">
    <X className="w-7 h-7 text-gray-500" strokeWidth={2.5} />
  </button>

  {/* Love - pink-to-rose gradient, LARGER 16x16 */}
  <button className="
    w-16 h-16                                          // ← LARGEST (was 14x14)
    bg-gradient-to-br from-pink-500 to-rose-600       // ← New gradient
    shadow-[0_8px_30px_rgba(236,72,153,0.4)]         // ← Custom glow
    hover:shadow-[0_8px_40px_rgba(236,72,153,0.6)]   // ← Hover glow
  ">
    <Sparkles className="w-8 h-8 text-white fill-white" strokeWidth={2.5} />
  </button>

  {/* Like - emerald gradient, filled heart, 14x14 */}
  <button className="
    w-14 h-14                                          // ← Larger (was 12x12)
    bg-gradient-to-br from-emerald-400 to-emerald-600 // ← Gradient
    border-2 border-emerald-300                       // ← Colored border
    shadow-lg hover:shadow-xl                         // ← Dynamic shadow
  ">
    <Heart className="w-7 h-7 text-white fill-white" strokeWidth={2.5} />
  </button>
</div>
```

**Visual Hierarchy**: Center button (Love) is now **largest** (16×16) to draw attention

---

## 6. Particle Effects (NEW)

### **What It Does**
- Triggers on "super like" (upward swipe) only
- 12 particles burst radially from center
- Each particle has a unique trajectory
- Particles scale up then fade out

### **Implementation**
```tsx
// SwipeParticles.tsx
const particles = useMemo(() => {
  return Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * Math.PI * 2;  // 360° distribution
    const distance = 100 + Math.random() * 50;  // 100-150px radius
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}, []); // Memoized to prevent re-calculation

// Animation
animate={{ 
  x: particle.x, 
  y: particle.y, 
  scale: [0, 1.5, 0],      // Grow then shrink
  opacity: [1, 0.8, 0]     // Fade out
}}
transition={{ 
  duration: 0.8,           // Total animation time
  delay: i * 0.02,         // Stagger by 20ms
  ease: "easeOut" 
}}
```

---

## 7. Active Drag Glow (NEW)

### **What It Does**
Cards get a pink glow shadow when being actively dragged

### **Implementation**
```tsx
<div className={cn(
  "relative w-full h-full bg-gradient-to-br from-gray-200 to-gray-300",
  dragDirection && "shadow-[0_0_50px_rgba(236,72,153,0.3)]"  // ← Glow
)}>
```

Only applies when `dragDirection` is set (actively dragging in a direction)

---

## 8. Progressive Drag Calculation (NEW)

### **What It Does**
Labels animate progressively based on how far you've dragged

### **Implementation**
```tsx
const handleDrag = useCallback((_: any, info: PanInfo) => {
  const absX = Math.abs(info.offset.x);
  const absY = Math.abs(info.offset.y);
  const maxDistance = 150;  // Full opacity at 150px
  
  const progress = Math.min(
    Math.max(absX, absY) / maxDistance,
    1  // Cap at 1.0
  );
  
  setDragProgress(progress);  // 0 to 1
}, []);

// Applied to labels
style={{
  opacity: dragProgress,              // Fade in gradually
  scale: 0.8 + (dragProgress * 0.2),  // Grow from 0.8 to 1.0
}}
```

**Result**: The further you drag, the more opaque and larger the label becomes

---

## 🎯 Design Principles Applied

1. **Glassmorphism**: Frosted glass effects with backdrop blur
2. **Progressive Feedback**: Animations scale with user input
3. **Spring Physics**: Natural, bouncy motion (not linear)
4. **Visual Hierarchy**: Center button larger to guide attention
5. **Micro-interactions**: Haptics, particles, glows enhance engagement
6. **Depth & Layering**: 3D transforms, shadows, perspective for depth

---

## 📱 Performance Optimizations

- **60fps animations**: Only animate `transform` and `opacity` properties
- **Hardware acceleration**: `transform: translateZ(0)`, `will-change: transform`
- **Memoization**: Particle positions calculated once on mount
- **RAF batching**: Drag calculations batched with `requestAnimationFrame`
- **Lazy rendering**: Particles only render when `show={true}`

---

## ✅ Accessibility & Compatibility

- All existing test IDs maintained: `button-skip-card`, `button-love-card`, `button-like-card`
- Aria labels preserved: `aria-label="跳过此兴趣卡片"`
- Dark mode fully supported with conditional classes
- Reduced motion support via existing framework
- Touch-optimized: `touchAction: "none"` prevents scrolling interference

---

## 🔍 File Changes Summary

| File | Lines Changed | Type |
|------|--------------|------|
| `SwipeCardStack.tsx` | 171 | Modified |
| `SwipeParticles.tsx` | 47 | New |
| **Total** | **218** | |

**Key imports added:**
- `useMotionValue`, `useTransform` from `framer-motion`
- `useMemo` from `react`
- `SwipeParticles` component

---

## 🎬 Animation Timing Reference

| Interaction | Duration | Easing |
|-------------|----------|--------|
| Label appear | Spring (300/20) | Spring |
| Card swipe out | 0.3s | Default |
| Card reset | Spring (300/25) | Spring |
| Card stack transition | Spring (260/20) | Spring |
| Particle burst | 0.8s | easeOut |
| Button press | Instant | - |
| Glow fade | Transition-all | - |

---

_Last updated: 2026-01-14_
_Implemented by: GitHub Copilot Agent_
