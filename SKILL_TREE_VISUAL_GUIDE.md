# Pokemon Card Skill Tree - Visual Design Guide

## 📐 Layout Structure

```
┌────────────────────────────────────────────────────────────────┐
│  ⚡ 技能树                                      🔥 热情         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────┬──────────────────────────┐      │
│  │    ACTIVE SKILL          │    PASSIVE SKILL         │      │
│  │  ┌────────────────────┐  │  ┌────────────────────┐ │      │
│  │  │      [主动]         │  │  │      [被动]         │ │      │
│  │  │                     │  │  │                     │ │      │
│  │  │      ┌───┐          │  │  │      ┌───┐          │ │      │
│  │  │      │ ⚡│          │  │  │      │ 🔋│          │ │      │
│  │  │      └───┘          │  │  │      └───┘          │ │      │
│  │  │                     │  │  │                     │ │      │
│  │  │   摇尾热场波        │  │  │    永动引擎         │ │      │
│  │  │                     │  │  │                     │ │      │
│  │  │    [2🔥]           │  │  │   ● 常驻效果        │ │      │
│  │  │                     │  │  │                     │ │      │
│  │  │  破冰启动           │  │  │  能量恢复速度       │ │      │
│  │  │  参与度+50%         │  │  │  +1/分钟           │ │      │
│  │  └────────────────────┘  │  └────────────────────┘ │      │
│  └──────────────────────────┴──────────────────────────┘      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## 🎨 Color Scheme

### Active Skill Column (Left)
- **Border**: Card variant color with 30% opacity
- **Background**: White (#FFFFFF)
- **Badge**: Purple-to-pink gradient
  - From: `#9333EA` (purple-600)
  - To: `#DB2777` (pink-600)
- **Icon Circle**: Purple-to-pink gradient (100-200 tones)
- **Energy Pill**: Purple background with purple-700 text

### Passive Skill Column (Right)
- **Border**: Amber-300 with 50% opacity
- **Background**: Amber-to-yellow gradient (50-50 tones)
- **Badge**: Amber-to-yellow gradient
  - From: `#D97706` (amber-600)
  - To: `#CA8A04` (yellow-600)
- **Icon Circle**: Amber-to-yellow gradient (100-200 tones)
- **Status Dot**: Green-500 (#22C55E)

## 📏 Dimensions & Spacing

### Section Container
- Padding: `p-2.5` (10px)
- Border Radius: `rounded-xl` (12px)
- Background: Purple-pink gradient with 90% opacity
- Border: Purple-200 with 30% opacity

### Skill Cards
- Padding: `p-1.5` (6px)
- Border Radius: `rounded-lg` (8px)
- Gap between columns: `gap-1.5` (6px)

### Icon Circles
- Size: `w-7 h-7` (28x28px)
- Border: 2px solid with 50% opacity
- Font size: `text-base` (16px emoji)

### Text Sizes
- Section header: `text-[10px]`
- Attribute badge: `text-[9px]`
- Badge labels: `text-[7px]`
- Skill names: `text-[9px]`
- Energy cost: `text-[9px]`
- Effect text: `text-[8px]`
- Status label: `text-[7px]`

## 🎯 Typography

### Font Weights
- Section header: `font-extrabold`
- Skill names: `font-bold`
- Energy cost: `font-bold`
- Attribute badge: `font-bold`
- Badge labels: `font-bold`
- Effect text: Regular (400)

### Text Alignment
All text is center-aligned for symmetry

### Line Heights
- Skill names: `leading-tight`
- Effect text: `leading-tight`

## 🔮 Badge Design

### Active Badge (主动)
```css
position: absolute
top: -4px (−0.25rem)
right: -4px (−0.25rem)
background: linear-gradient(to right, #9333EA, #DB2777)
color: white
font-size: 7px (0.4375rem)
padding: 2px 6px (py-0.5 px-1.5)
border-radius: 9999px (full)
font-weight: bold
box-shadow: 0 1px 2px rgba(0,0,0,0.1)
z-index: 10
```

### Passive Badge (被动)
```css
position: absolute
top: -4px
right: -4px
background: linear-gradient(to right, #D97706, #CA8A04)
color: white
font-size: 7px
padding: 2px 6px
border-radius: 9999px
font-weight: bold
box-shadow: 0 1px 2px rgba(0,0,0,0.1)
z-index: 10
```

## ⚡ Energy Cost Indicator

### Structure
```html
<div class="energy-pill">
  <span class="cost-number">2</span>
  <span class="energy-emoji">🔥</span>
</div>
```

### Styling
- Background: Purple-50 with 60% opacity
- Border Radius: Full (pill shape)
- Padding: `py-0.5 px-1.5`
- Gap: `gap-0.5`
- Display: Flex, center-aligned
- Width: Fit content, centered

## 🟢 Always Active Indicator

### Structure
```html
<div class="status-indicator">
  <div class="status-dot"></div>
  <span class="status-text">常驻效果</span>
</div>
```

### Styling
- **Dot**: 
  - Size: `w-1 h-1` (4x4px)
  - Color: Green-500
  - Shape: Rounded full (circle)
- **Text**:
  - Size: `text-[7px]`
  - Color: Gray-500
  - Weight: Medium

## 📊 Responsive Behavior

The skill cards maintain readability at card width of 420px:
- Grid: 2 equal columns
- Icons remain visible and centered
- Text truncates gracefully with ellipsis if needed
- Spacing scales proportionally

## 🎪 Animation (Preview Mode Only)

### Skill Card Hover
```css
transition: transform 0.2s ease
transform: translateY(-2px) on hover
```

### Badge Shimmer (Future Enhancement)
- Holographic shine effect
- Subtle gradient animation
- Triggered on card preview

## 🌈 Energy Type Attributes

Each archetype has a unique energy type with emoji and color:

| Energy Type | Emoji | Color Theme |
|-------------|-------|-------------|
| 热情 | 🔥 | Orange-Red |
| 探索 | 🗺️ | Blue-Cyan |
| 共情 | 🧸 | Pink-Rose |
| 洞察 | 💡 | Yellow-Amber |
| 连接 | 🕸️ | Purple-Violet |
| 调和 | 🌊 | Cyan-Blue |
| 鼓舞 | ✨ | Pink-Fuchsia |
| 暖意 | ☀️ | Yellow-Orange |
| 安定 | 🐘 | Gray-Slate |
| 真知 | 💎 | Emerald-Teal |
| 灵感 | 🎨 | Violet-Purple |
| 陪伴 | 🌙 | Indigo-Blue |

## 🎯 Design Principles

1. **Clarity**: Each element serves a purpose
2. **Contrast**: Active vs passive distinction is immediate
3. **Balance**: Two-column symmetry creates harmony
4. **Readability**: Text sizes optimized for mobile card sharing
5. **Authenticity**: Faithful to Pokemon TCG aesthetic
6. **Accessibility**: High contrast, clear labels

## 📱 Mobile Optimization

At 420px width (standard share card):
- Icons: 28x28px (clearly visible)
- Text: 7-10px (readable on mobile)
- Spacing: 6px gaps (touch-friendly)
- Borders: 2px (visible but not overwhelming)

## ✨ Polish Details

1. **Gradient Text**: Section header uses gradient clip-text
2. **Border Glow**: Active cards have subtle variant color glow
3. **Shadow Depth**: Multiple shadow layers for card-like depth
4. **Status Indicator**: Green dot provides instant visual feedback
5. **Energy Pills**: Rounded pills feel tactile and game-like

---

**Design Version**: 1.0.0  
**Last Updated**: 2026-01-28  
**Status**: Production Ready ✅
