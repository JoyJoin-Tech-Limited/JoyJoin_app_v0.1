# Character Dossier 2.0 - Visual Design Guide

## Component Layout Structure

```
┌─────────────────────────────────────────┐
│ 🌟 SOCIAL TAG BANNER                    │
│ ┌─────────────────────────────────────┐ │
│ │ AI生成的社交印象                     │ │
│ │ [Shimmer animation overlay]         │ │
│ │                                     │ │
│ │ "数据拓荒人·巷口密探"                │ │
│ │ (or user's actual social tag)       │ │
│ │                                     │ │
│ │ "好奇心强、信息灵通"                 │ │
│ │ (archetype description)              │ │
│ └─────────────────────────────────────┘ │
│   Gradient: amber → orange → pink       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🦊 ARCHETYPE CHARACTER                  │
│                                         │
│         [Glow Effect Background]        │
│                                         │
│         ╔═══════════════════╗           │
│         ║                   ║           │
│         ║   [Character]     ║           │
│         ║   280 x 320px     ║           │
│         ║                   ║           │
│         ║   PNG Image       ║           │
│         ╚═══════════════════╝           │
│                                         │
│              🦊 机智狐                  │
│            "巷口密探"                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 💬 XIAOYUE AI ANALYSIS CARD             │
│ ┌─────────────────────────────────────┐ │
│ │ [Avatar] 💬 小悦的专属洞察           │ │
│ │          基于你的性格测试生成        │ │
│ │                                     │ │
│ │ 你是一个充满好奇心的探索者，对新鲜  │ │
│ │ 事物保持敏锐的洞察力。擅长发现城市  │ │
│ │ 中隐藏的宝藏，并乐于与他人分享这些  │ │
│ │ 独特的体验...                       │ │
│ └─────────────────────────────────────┘ │
│   Blue/Purple gradient card             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ✨ TOP 3 TRAITS (核心特质)              │
│                                         │
│ ┌──────┐  ┌──────┐  ┌──────┐           │
│ │ 🎯  │  │ 💫  │  │ 🌟  │           │
│ │开放性│  │外向性│  │亲和力│           │
│ │      │  │      │  │      │           │
│ │ 85%  │  │ 72%  │  │ 68%  │           │
│ └──────┘  └──────┘  └──────┘           │
│                                         │
│   Achievement badge style cards         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🔥 INTEREST HEAT MAP (兴趣热力榜)       │
│                                         │
│ 🎬 文化娱乐                              │
│ [████████░░] 80%                        │
│                                         │
│ 🍜 生活方式                              │
│ [██████░░░░] 60%                        │
│                                         │
│ 🏙️ 城市探索                             │
│ [█████░░░░░] 50%                        │
│                                         │
│ 🧠 思想哲学                              │
│ [████░░░░░░] 40%                        │
│                                         │
│ 💼 职业发展                              │
│ [███░░░░░░░] 30%                        │
│                                         │
│   Purple → Pink gradient progress bars  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 📌 STICKY CTA FOOTER (Fixed Bottom)     │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │  ┌───────────────────────────────┐ │ │
│ │  │ 开始探索活动 →                │ │ │
│ │  │ (Gradient Button)              │ │ │
│ │  └───────────────────────────────┘ │ │
│ │                                     │ │
│ │  我们已为你匹配推荐活动              │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│   Purple → Pink gradient button         │
│   Backdrop blur with safe area insets   │
└─────────────────────────────────────────┘
```

## Animation Sequence (5 seconds)

```
Timeline:
┌─────────────────────────────────────────┐
│ 0.0s                                    │
│  ↓ Social tag banner slides down        │
│                                         │
│ 0.5s                                    │
│  ↓ Character zooms in (blur→focus)      │
│                                         │
│ 1.0s                                    │
│  ↓ Name badge fades in                  │
│                                         │
│ 1.5s                                    │
│  ↓ Xiaoyue card rises from bottom       │
│                                         │
│ 2.5s                                    │
│  ↓ Trait card 1 pops in                 │
│                                         │
│ 2.65s                                   │
│  ↓ Trait card 2 pops in                 │
│                                         │
│ 2.8s                                    │
│  ↓ Trait card 3 pops in                 │
│                                         │
│ 3.5s                                    │
│  ↓ Interest section fades in            │
│                                         │
│ 4.0s                                    │
│  ↓ Progress bar 1 animates              │
│                                         │
│ 4.1s                                    │
│  ↓ Progress bar 2 animates              │
│                                         │
│ 4.2s                                    │
│  ↓ Progress bar 3 animates              │
│                                         │
│ 4.3s                                    │
│  ↓ Progress bar 4 animates              │
│                                         │
│ 4.4s                                    │
│  ↓ Progress bar 5 animates              │
│                                         │
│ 5.0s                                    │
│  ↓ CTA footer slides up                 │
│                                         │
│ ✓ Animation complete                    │
└─────────────────────────────────────────┘
```

## Color Palette

### Social Tag Banner
```css
background: linear-gradient(to right, #f59e0b, #f97316, #ec4899)
/* Amber-500 → Orange-500 → Pink-500 */

shimmer: rgba(255, 255, 255, 0.3)
text: white
badge-bg: rgba(255, 255, 255, 0.2)
badge-border: rgba(255, 255, 255, 0.4)
```

### Archetype Section
```css
glow-background: linear-gradient(
  to bottom right, 
  rgba(168, 85, 247, 0.2),  /* Purple-500/20 */
  rgba(236, 72, 153, 0.2)   /* Pink-500/20 */
)
icon: text-4xl (emoji)
name: text-2xl font-black (foreground)
description: text-sm (muted-foreground)
```

### Xiaoyue Card
```css
background: linear-gradient(
  to bottom right,
  #eff6ff,  /* Blue-50 */
  #faf5ff   /* Purple-50 */
)
dark-mode: linear-gradient(
  to bottom right,
  rgba(30, 58, 138, 0.3),   /* Blue-950/30 */
  rgba(88, 28, 135, 0.3)    /* Purple-950/30 */
)
border: 2px solid #bfdbfe (Blue-200)
dark-border: 2px solid #1e3a8a (Blue-800)
```

### Trait Cards
```css
background: white / gray-800 (dark)
border: 2px solid #e9d5ff (Purple-200)
dark-border: 2px solid #6b21a8 (Purple-800)
icon: text-3xl (emoji)
label: text-xs (gray-600/400)
score: text-xl font-black (purple-600/400)
```

### Interest Heat Map
```css
card-background: white / gray-800 (dark)
progress-bar-bg: gray-200 / gray-700 (dark)
progress-fill: linear-gradient(
  to right,
  #9333ea,  /* Purple-600 */
  #db2777   /* Pink-600 */
)
label: text-sm font-semibold (foreground)
percentage: text-sm font-bold (purple-600/400)
```

### CTA Footer
```css
background: rgba(255, 255, 255, 0.95) / rgba(17, 24, 39, 0.95)
backdrop-filter: blur(24px)
border-top: 1px solid #e9d5ff / #6b21a8 (Purple-200/800)
button-bg: linear-gradient(
  to right,
  #9333ea,  /* Purple-600 */
  #db2777   /* Pink-600 */
)
button-hover: linear-gradient(
  to right,
  #7e22ce,  /* Purple-700 */
  #be185d   /* Pink-700 */
)
button-shadow: 0 10px 15px rgba(147, 51, 234, 0.5)
```

## Typography

```css
/* Social Tag Banner */
h1: text-3xl font-black text-white drop-shadow-lg
subtitle: text-sm text-white/90

/* Archetype Section */
emoji: text-4xl
name: text-2xl font-black text-foreground
description: text-sm text-muted-foreground

/* Xiaoyue Card */
header: text-sm font-bold text-blue-600/400
subheader: text-xs text-gray-500/400
content: text-sm text-gray-800/200 leading-relaxed

/* Trait Cards */
icon: text-3xl
label: text-xs text-gray-600/400
score: text-xl font-black text-purple-600/400

/* Interest Heat Map */
section-title: text-lg font-bold text-foreground
emoji: text-xl
label: text-sm font-semibold text-foreground
percentage: text-sm font-bold text-purple-600/400

/* CTA Footer */
button: text-lg font-bold
subtitle: text-xs text-center text-gray-500/400
```

## Spacing & Layout

```css
/* Overall Container */
min-height: 100vh
padding-bottom: 6rem (24 = 96px for sticky footer)

/* Social Tag Banner */
padding: 1.5rem (py-6) 1.5rem (px-6)
margin-bottom: 0

/* Archetype Section */
margin-top: 2rem (mt-8)
padding-horizontal: 1.5rem (px-6)
character-spacing: margin-top: 1rem (mt-4)

/* Xiaoyue Card */
margin: 1.5rem (mx-4 mt-6)
padding: 1.25rem (p-5)
avatar-size: 3rem × 3rem (w-12 h-12)
gap: 0.75rem (gap-3)

/* Trait Cards */
margin-top: 1.5rem (mt-6)
padding-horizontal: 1rem (px-4)
grid: grid-cols-3 gap-3
card-padding: 1rem (p-4)
card-border-radius: 1rem (rounded-2xl)

/* Interest Heat Map */
margin-top: 1.5rem (mt-6)
padding-horizontal: 1rem (px-4)
gap-between-items: 0.75rem (space-y-3)
card-padding: 0.75rem (p-3)
progress-height: 0.5rem (h-2)

/* CTA Footer */
position: fixed bottom-0
padding: 1rem (p-4)
button-height: 3.5rem (h-14)
button-border-radius: 1rem (rounded-2xl)
safe-area: pb-safe (env(safe-area-inset-bottom, 1rem))
```

## Responsive Breakpoints

```css
/* Mobile First (375px - 428px) */
- Social tag banner: full width
- Character: 280px × 320px
- Trait cards: 3 columns
- Interest bars: full width
- CTA: fixed bottom

/* Tablet (768px+) */
- Content centered with max-width
- Larger text sizes
- More spacing

/* Desktop (1024px+) */
- Component remains mobile-optimized
- Content centered
- Max width constraints
```

## Interactive States

### Social Tag Banner
```css
initial: { scale: 0.9, opacity: 0 }
animate: { scale: 1, opacity: 1 }
shimmer: translateX(-100%) → translateX(100%) (infinite, 3s)
```

### Archetype Character
```css
initial: { scale: 0.8, filter: blur(10px), opacity: 0 }
animate: { scale: 1, filter: blur(0), opacity: 1 }
transition: spring (0.6s delay)
```

### Xiaoyue Card
```css
initial: { opacity: 0, y: 20 }
animate: { opacity: 1, y: 0 }
loading-icon: rotate(360deg) infinite
```

### Trait Cards
```css
initial: { scale: 0, opacity: 0 }
animate: { scale: 1, opacity: 1 }
transition: spring (staggered 0.15s each)
```

### Interest Progress Bars
```css
initial: { width: 0 }
animate: { width: percentage }
transition: 0.5s ease (staggered 0.1s each)
```

### CTA Footer
```css
initial: { opacity: 0, y: 50 }
animate: { opacity: 1, y: 0 }
button-hover: opacity: 0.9
```

## Accessibility Features

### Reduced Motion Support
When `prefers-reduced-motion: reduce`:
- All animations become instant (opacity: 0 → 1)
- No shimmer effect
- No transform animations
- No blur effects
- Maintains layout and functionality

### Safe Area Support
```css
/* iOS Safe Area Insets */
padding-bottom: env(safe-area-inset-bottom, 1rem)
/* Falls back to 1rem if not supported */
```

### Semantic HTML
```html
<h1>Social Tag</h1>
<h2>Archetype Name</h2>
<h3>Section Titles</h3>
<img alt="Descriptive text">
<button aria-label="Clear action">
```

### Dark Mode Support
All colors have dark mode variants:
- Backgrounds: gray-800, gray-900
- Text: gray-200, gray-400
- Borders: Darker variants of accent colors
- Gradients: Opacity-based overlays

## Component States

### Loading States
1. **User Loading**: Shows fallback text and placeholders
2. **Assessment Loading**: Hides trait section
3. **Interests Loading**: Hides interest section
4. **Xiaoyue Loading**: Shows spinner with text

### Error States
1. **User Error**: Shows generic error message
2. **Assessment Error**: Trait section hidden
3. **Interests Error (404)**: Returns null, section hidden
4. **Xiaoyue Error**: Shows friendly error message

### Empty States
1. **No Archetype**: Shows fallback "你的角色画像"
2. **No Assessment**: Trait section hidden
3. **No Interests**: Interest section hidden
4. **No Xiaoyue Analysis**: Shows "完成性格测试后生成"

### Success States
1. **All Data Loaded**: Full experience visible
2. **Partial Data**: Gracefully degrades to available sections
3. **Animation Complete**: CTA visible and interactive
