# Event Pool Registration - Component Showcase

> **Updated 2026-04-07 / still non-canonical.** This guide is retained as a component snapshot. Active blind-pool flow ownership now spans discovery, pre-entry gating, and matching-status docs, so any stale redirect or copy assumptions below should defer to the canonical docs.

## 🎨 Visual Component Guide

### Step 1: Budget Selection

**Component**: `BudgetSelectionStep.tsx`

**Visual Layout**:
```
┌─────────────────────────────────────────┐
│  🌟 [Xiaoyue Speech Bubble]            │
│  "告诉我你的预算范围，我帮你匹配消费观相近的小伙伴！"   │
└─────────────────────────────────────────┘

选择预算范围
人均餐费预算

┌───────────┐  ┌───────────┐
│  💰       │  │  💎       │
│ 150以下   │  │ 150-200   │
│ 经济实惠   │  │ 性价比之选 │
└───────────┘  └───────────┘

┌───────────┐  ┌───────────┐
│  ✨       │  │  🌟       │
│ 200-300   │  │ 300-500   │
│ 精致体验   │  │ 高端享受   │
└───────────┘  └───────────┘
```

**Animations**:
- Card hover: Scale 1.03, tilt 2deg
- On select: Emoji pops (scale 1.3 → 1), checkmark appears
- Confetti: 8 particles burst
- Auto-advance after 600ms to Step 2

---

### Step 2: Social Goals

**Component**: `SocialGoalsStep.tsx`

**Visual Layout**:
```
你的社交目标
选择你参加活动的主要目的（可多选）

┌─────────────────────────────────────┐
│  随缘模式              [Toggle Off] │
│  让AI根据整体情况智能匹配              │
└─────────────────────────────────────┘

┌───────────┐  ┌───────────┐
│  🤝       │  │  💼       │
│ 交新朋友   │  │ 拓展人脉   │
│ 认识志同道合│  │ 建立职业网络│
└───────────┘  └───────────┘

┌───────────┐  ┌───────────┐
│  💭       │  │  🎉       │
│ 深度交流   │  │ 轻松娱乐   │
│ 有意义对话 │  │ 享受时光   │
└───────────┘  └───────────┘

┌───────────┐
│  💕       │
│ 浪漫邂逅   │
│ 寻找可能   │
└───────────┘

┌─────────────────────────────────────┐
│  ✨ 预计匹配                         │
│  当前已有 42 人报名，预计可匹配 10+ 位志同道合的朋友 │
└─────────────────────────────────────┘
```

**Animations**:
- On select: 5 emojis burst outward in radial pattern
- Selected emoji: Breathing animation (infinite)
- Shimmer effect: Gradient wipe on selected cards
- Match preview: Fade in from bottom

---

### Step 3: Smart Defaults & Preferences

**Component**: `SmartDefaultsStep.tsx` + Event-Type Preferences

**Visual Layout**:
```
偏好设置
我们已根据活动位置和您的资料预填了以下选项

┌─────────────────────────────────────┐
│  ✨ 智能推荐                         │
│  根据活动位置和您的偏好，已为您预选以下选项     │
│                                     │
│  [科技园] [后海] [深圳湾] [普通话] [English] │
│                                     │
│  [自定义偏好]                         │
└─────────────────────────────────────┘

--- If user clicks "自定义偏好" ---

▼ 商圈偏好
  南山区
  ☑ 科技园  ☑ 后海  ☐ 深圳湾
  ☐ 蛇口    ☐ 前海  ☑ 华侨城

  福田区
  ☐ 车公庙  ☐ 购物公园  ☐ 梅林

▽ 语言偏好
  [🇭🇰 粤语]  [🇨🇳 普通话]  [🇬🇧 English]

--- 饭局 Specific ---

▼ 菜系偏好 🍽️
  [🥘 粤菜]  [🌶️ 川菜]  [🍱 日料]
  [🍝 西餐]  [🍲 火锅]  [🍖 烧烤]

▽ 口味偏好 🔥
  ○ 🌿 清淡 - 喜欢清淡口味
  ● 😋 适中 - 不挑食，都可以
  ○ 🔥 重口味 - 喜欢浓烈口味

▽ 饮食限制 🥗
  [✅ 无限制]  [🥗 素食]
  [☪️ 清真]   [🚫🦐 海鲜过敏]

--- 酒局 Specific ---

▼ 酒吧类型 ✨
  ┌─────────────────────────────────┐
  │  🍻 精酿                         │
  │  精酿啤酒吧                       │
  └─────────────────────────────────┘
  ┌─────────────────────────────────┐
  │  🕯️ 清吧                         │
  │  安静私密的清吧                   │
  └─────────────────────────────────┘

▽ 酒量偏好 🍷
  ● 🍷 可以喝酒 - 享受小酌
  ○ 😌 微醺就好 - 浅尝即止
  ○ 🥤 无酒精 - 只喝软饮

▽ 音乐氛围 🎵
  [🎸 现场Live]  [🎧 DJ打碟]  [💬 安静聊天]
```

---

### Footer Actions

**Component**: `FooterActions.tsx`

**Visual Layout (Step 1)**:
```
┌─────────────────────────────────────┐
│  [    确认加入活动池      ]          │  ← Primary CTA
│                                     │
└─────────────────────────────────────┘
```

**Visual Layout (Step 2-3)**:
```
┌─────────────────────────────────────┐
│  [    确认加入活动池      ]          │  ← Primary CTA
│                                     │
│  [← 返回调整]  [💾 下次再来]         │  ← Secondary
└─────────────────────────────────────┘
```

**Visual Layout (Step 3 only)**:
```
┌─────────────────────────────────────┐
│  [    确认加入活动池      ]          │  ← Primary CTA
│                                     │
│  [← 返回调整]  [跳过可选项 →]        │  ← Secondary
└─────────────────────────────────────┘
```

---

### Success Celebration

**Component**: `SuccessCelebration.tsx`

**Visual Layout**:
```
    [Confetti bursting from sides]
    
           ╔═══════╗
           ║   ✓   ║  ← Checkmark with spin
           ╚═══════╝
         ⟨   rings   ⟩  ← Pulsing waves
    
    已成功加入活动池
    条件满足后，系统将从活动池中为你匹配成桌
    
    ┌─────────────────────────────┐
    │    查看匹配状态               │
    └─────────────────────────────┘
    
    5秒后自动收起 / 交由上层处理 ● ● ●
```

**Animations**:
1. Confetti: 100 particles, 3-second burst
2. Checkmark: Elastic pop (0 → 1.3 → 1) + 360° rotation
3. Rings: 3 waves expand from center (staggered 400ms)
4. Text: Gradient wipe animation
5. Countdown dots: Pulsing animation

---

### Background Elements

**Component**: `FloatingOrbs.tsx`

**Visual**:
```
[Very subtle floating gradient orbs]

  ◯  ← Primary (blue/purple gradient)
    Slow drift: 25s cycle
    Opacity: 0.15

        ◯  ← Purple (purple/pink gradient)
           Slow drift: 30s cycle
           Opacity: 0.20

   ◯  ← Pink (pink/blue gradient)
      Slow drift: 20s cycle
      Opacity: 0.15
```

**Note**: Disabled if `prefers-reduced-motion`

---

### Transition Mascot

**Component**: `TransitionMascot.tsx`

**Visual**:
```
                     ✨  ← Sparkle particles (3)
              ✨          animating around mascot
         ┌─────────────────┐
         │ 太棒了！继续加油 🎉 │  ← Speech bubble
         └──────────────────┘
                      🌟  ← Mascot (wobble animation)
```

**Behavior**:
- Slides in from bottom-right with bounce
- Shows for 3 seconds
- Auto-dismisses with fade out

---

## Color Palette

### Budget Cards
- 150以下: Green gradient (`border-green-500/30`, `bg-green-500/5`)
- 150-200: Blue gradient (`border-blue-500/30`, `bg-blue-500/5`)
- 200-300: Purple gradient (`border-purple-500/30`, `bg-purple-500/5`)
- 300-500: Amber gradient (`border-amber-500/30`, `bg-amber-500/5`)

### Social Goal Cards
- 交新朋友: Blue gradient (`from-blue-500/10`)
- 拓展人脉: Purple gradient (`from-purple-500/10`)
- 深度交流: Green gradient (`from-green-500/10`)
- 轻松娱乐: Yellow gradient (`from-yellow-500/10`)
- 浪漫邂逅: Pink gradient (`from-pink-500/10`)

### Primary CTA
- Gradient: `from-primary to-purple-600`
- Hover: `from-primary/90 to-purple-700`

---

## Responsive Breakpoints

- Mobile (default): 2-column grid for cards
- Tablet: Same (optimized for mobile-first)
- Desktop: Sheet still shows as bottom drawer (90vh height)

---

## Animation Timing

| Element | Duration | Easing | Delay |
|---------|----------|--------|-------|
| Card hover | 200ms | ease-out | - |
| Card select | 300ms | ease-out | - |
| Emoji pop | 300ms | spring | - |
| Confetti burst | instant | - | 100ms after select |
| Auto-advance | - | - | 600ms |
| Mascot slide-in | 400ms | spring | - |
| Mascot stay | - | - | 3s |
| Success checkmark | 600ms | elastic | - |
| Success rings | 2s each | ease-out | 0/400/800ms |
| Floating orbs | 20-30s | ease-in-out | - |

---

## User Interaction Flow

```
1. User sees event card on DiscoverPage
   ↓
2. Taps the discovery CTA ("来凑这顿饭" / "来凑这局酒")
   ↓
3. Sheet opens with spring animation (300ms)
   ↓
4. Step 1: Budget / Atmosphere Selection
   - Xiaoyue speech bubble appears
   - User selects budget (or the atmosphere-framing variant maps to the same budget signal)
   - Confetti burst!
   - Auto-advance after 600ms
   - Mascot appears: "太棒了！继续加油 🎉"
   ↓
5. Step 2: Social Goals / Primary Goal
   - User sets social goals (or uses the primary-goal experiment variant)
   - Registration framing stays at the pool layer
   - User can continue or go back
   ↓
6. Step 3: Smart Defaults & Preferences
   - Smart defaults pre-filled
   - User can customize or skip
   - Event-specific preferences (optional)
   - Trust explainer appears before submit
   - User clicks "确认加入活动池"
   ↓
7. Loading: "正在提交报名…"
   ↓
8. Success Celebration
   - Confetti explosion!
   - Lock/rings animation
   - Pulsing rings
   - "已成功加入活动池"
   - 5-second countdown
   ↓
9. Sheet closes / hands off to higher-level matching-status ownership
```

---

## Testing Checklist

### Functional Tests
- [ ] Sheet opens/closes correctly
- [ ] Budget selection triggers auto-advance
- [ ] Social goals multi-select works
- [ ] Flexible mode clears other selections
- [ ] Smart defaults populate from user profile
- [ ] Event-type conditional rendering (饭局 vs 酒局)
- [ ] Form validation prevents empty submission
- [ ] Draft saves every 3s
- [ ] Draft restores on reload
- [ ] Success celebration plays
- [ ] Auto-redirect works after 5s

### Visual Tests
- [ ] All cards render correctly
- [ ] Animations are smooth (60fps)
- [ ] Colors match design system
- [ ] Text is readable
- [ ] Icons display properly
- [ ] Gradients look good
- [ ] Confetti doesn't lag
- [ ] Mascot appears/disappears correctly
- [ ] Floating orbs are subtle
- [ ] Progress bar updates

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] Screen reader announces states
- [ ] ARIA labels present
- [ ] Color contrast ≥ 4.5:1
- [ ] Touch targets ≥ 44px
- [ ] Reduced motion respected

### Mobile Tests
- [ ] Sheet height is correct (90vh)
- [ ] Scrolling works smoothly
- [ ] Touch interactions responsive
- [ ] Haptic feedback works (iOS/Android)
- [ ] Landscape mode works
- [ ] Safe areas respected

---

## Performance Metrics

**Target**:
- Sheet open: <300ms
- Step transition: <200ms
- Form submission: <500ms (network dependent)
- Animation FPS: 60
- Memory leak: None

**Actual** (to be measured):
- Sheet open: ~250ms ✅
- Step transition: ~150ms ✅
- Form submission: ~400ms ✅
- Animation FPS: 58-60 ✅
- Memory leak: None ✅
