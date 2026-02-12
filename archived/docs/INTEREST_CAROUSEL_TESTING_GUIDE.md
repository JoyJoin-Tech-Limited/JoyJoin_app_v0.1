# Interest Carousel - Visual Testing & QA Guide

## Prerequisites
- Device with touch capabilities (or browser DevTools touch simulation)
- Access to both light and dark mode
- Screen reader installed (VoiceOver on iOS/Mac, TalkBack on Android, NVDA/JAWS on Windows)
- Physical mobile device for haptic feedback testing (optional but recommended)

---

## Test Suite

### 1. Selection Preview Component (P1)

#### Test Case 1.1: Preview Appears at 3+ Selections
**Steps:**
1. Navigate to Interest Carousel page
2. Select 0-2 interests
3. Verify preview does NOT appear
4. Select 3rd interest
5. Verify preview appears with animation

**Expected Result:**
- Preview smoothly animates in below the category tabs
- Shows first 3 selected interest emojis (2xl size)

#### Test Case 1.2: Preview Shows Exactly 6 Emojis
**Steps:**
1. Select exactly 6 interests from different categories
2. Observe selection preview

**Expected Result:**
- All 6 emojis visible
- No "+N" indicator shown
- Emojis are horizontally scrollable if needed

#### Test Case 1.3: Overflow Indicator
**Steps:**
1. Select 7 or more interests
2. Observe selection preview

**Expected Result:**
- First 6 emojis shown
- "+1" (or appropriate number) indicator appears
- Indicator has muted styling: `bg-muted px-2 py-1 rounded-full`

#### Test Case 1.4: Dark Mode Preview
**Steps:**
1. Enable system dark mode
2. Select 3+ interests
3. Observe preview background

**Expected Result:**
- Preview has subtle dark background: `dark:bg-gray-800/50`
- Emojis remain clearly visible
- Rounded corners and padding intact

---

### 2. Onboarding Tooltip (P1)

#### Test Case 2.1: First Visit Tooltip Delay
**Steps:**
1. Clear localStorage (DevTools → Application → Local Storage → Delete `joyjoin_interest_onboarding_seen`)
2. Reload page
3. Observe tooltip

**Expected Result:**
- Tooltip appears exactly 1 second after page load
- Smooth fade-in animation (opacity 0 → 1, y: -10 → 0)
- Tooltip positioned at top with clear message

**Message:** "如何选择兴趣？点击卡片可多次选择，每次点击增加热度：💜 感兴趣 → 💗 很喜欢 → 🧡 超热爱"

#### Test Case 2.2: Tooltip Dismissal on Tap
**Steps:**
1. Wait for tooltip to appear
2. Tap any interest bubble

**Expected Result:**
- Tooltip immediately fades out
- `joyjoin_interest_onboarding_seen` set to `'true'` in localStorage
- Tooltip does not reappear on subsequent visits

#### Test Case 2.3: Tooltip Manual Dismissal
**Steps:**
1. Clear localStorage and reload
2. Wait for tooltip
3. Click the "✕" close button

**Expected Result:**
- Tooltip fades out smoothly
- localStorage updated
- Tooltip does not reappear

#### Test Case 2.4: Tooltip Dark Mode
**Steps:**
1. Enable dark mode
2. Clear localStorage and reload
3. Observe tooltip styling

**Expected Result:**
- Background: `dark:bg-gray-900`
- Border: `dark:border dark:border-gray-700`
- Text: `dark:text-gray-100`
- Good contrast, fully readable

---

### 3. Refined Interest Bubble Styling (P2)

#### Test Case 3.1: Level 0 (Unselected) Border
**Steps:**
1. Find any unselected interest bubble
2. Inspect border

**Expected Result:**
- Border: `1.5px solid` with `hsl(var(--border))` color
- Light gray in light mode
- Subtle border in dark mode
- Emoji opacity: 0.6 (slightly faded)

#### Test Case 3.2: Level 1 (有兴趣) Progression
**Steps:**
1. Tap unselected bubble once
2. Observe transition

**Expected Result:**
- Border changes to `2px solid #A78BFA` (purple)
- Badge emoji "💜" appears top-right
- Subtle shadow: `0 2px 8px rgba(167, 139, 250, 0.25)`
- Smooth scale animation (1.0 → 1.02)
- Text becomes medium weight, purple color

#### Test Case 3.3: Level 2 (很喜欢) Gradient Border
**Steps:**
1. Tap Level 1 bubble again
2. Observe border change

**Expected Result:**
- Border: `2.5px solid transparent` with pink gradient
- Gradient: `linear-gradient(135deg, #EC4899, #F472B6)`
- Badge emoji changes to "💗"
- Shadow increases: `0 3px 12px rgba(236, 72, 153, 0.3)`
- Scale: 1.05

#### Test Case 3.4: Level 3 (很热爱) Maximum Heat
**Steps:**
1. Tap Level 2 bubble again
2. Observe maximum styling

**Expected Result:**
- Border: `3px solid transparent` with orange gradient
- Gradient: `linear-gradient(135deg, #FB923C, #F59E0B)`
- Badge emoji: "🧡"
- Background gradient on bubble itself (warm yellow-orange)
- Shadow: `0 4px 16px rgba(251, 146, 60, 0.35)`
- Pulsing glow animation (infinite, 2s duration)
- Scale: 1.08

#### Test Case 3.5: Hover Glow Effect
**Steps:**
1. Use mouse to hover over Level 1, 2, or 3 bubble
2. Observe hover state

**Expected Result:**
- Brightness increases slightly: `filter: brightness(1.05)`
- Glow appears: colored box-shadow matching level
- Transition smooth (200ms ease-out)
- No glow on Level 0 bubbles

#### Test Case 3.6: Tap Animation
**Steps:**
1. Tap and hold any bubble
2. Observe scale

**Expected Result:**
- Bubble scales down to 95% of current scale on tap
- Releases back smoothly with spring animation
- Feels responsive and tactile

---

### 4. Dark Mode Compatibility (P2)

#### Test Case 4.1: System Dark Mode Toggle
**Steps:**
1. View Interest Carousel in light mode
2. Toggle system to dark mode
3. Verify all components

**Expected Result:**
- All text readable (proper contrast)
- Borders visible but not harsh
- Background colors adjust appropriately
- No "white flash" or jarring transitions

#### Test Case 4.2: Unselected Bubbles in Dark
**Steps:**
1. In dark mode, observe Level 0 bubbles

**Expected Result:**
- Border color adjusts to dark theme
- Background uses `hsl(var(--background))`
- Emoji still slightly faded (opacity 0.6)

#### Test Case 4.3: Level Progression in Dark
**Steps:**
1. In dark mode, tap through all 4 levels
2. Observe colors

**Expected Result:**
- Level 1: Purple text → `dark:text-purple-400`
- Level 2: Pink text → `dark:text-pink-400`
- Level 3: Orange text → `dark:text-orange-600`
- All colors have good contrast against dark background

#### Test Case 4.4: Heat Meter in Dark
**Steps:**
1. In dark mode, observe heat meter bar

**Expected Result:**
- Gradient visible: `from-purple-400 via-pink-400 to-orange-500`
- Background bar visible but subtle
- Progress animates smoothly

#### Test Case 4.5: Category Tabs in Dark
**Steps:**
1. In dark mode, observe category quick-nav tabs

**Expected Result:**
- Active tab: `bg-primary text-primary-foreground`
- Inactive tabs: `bg-muted text-muted-foreground`
- Good contrast between active and inactive

---

### 5. Accessibility (P2)

#### Test Case 5.1: Screen Reader - Bubble Labels
**Steps:**
1. Enable VoiceOver (iOS/Mac) or TalkBack (Android)
2. Navigate to first interest bubble
3. Listen to announcement

**Expected Result:**
- Announces: "{Topic name}, 未选择" (or current heat level)
- Example: "创业（做自己的事）, 未选择"
- Clear, descriptive, non-redundant

#### Test Case 5.2: Screen Reader - Selection Changes
**Steps:**
1. Enable screen reader
2. Tap an interest bubble to select it
3. Listen for announcement

**Expected Result:**
- Live region announces: "已{heat level} {topic name}"
- Example: "已有兴趣 创业（做自己的事）"
- Announcement is polite (doesn't interrupt)

#### Test Case 5.3: Screen Reader - Heat Meter
**Steps:**
1. Enable screen reader
2. Navigate to heat meter progress bar
3. Listen to announcement

**Expected Result:**
- Announces: "兴趣热度进度, progress bar"
- Current value announced (e.g., "30 of 100")
- Additional text: "已选择 5 个兴趣"

#### Test Case 5.4: Keyboard - Tab Navigation
**Steps:**
1. Use Tab key to navigate
2. Observe focus order

**Expected Result:**
- Back button → Category tabs → Interest bubbles → Scroll-to-top (if visible) → Continue button
- Focus visible (outline or focus ring)
- No keyboard traps

#### Test Case 5.5: Keyboard - Space/Enter on Bubbles
**Steps:**
1. Tab to an interest bubble
2. Press Space or Enter

**Expected Result:**
- Bubble level increments
- Same behavior as mouse click
- Focus remains on bubble

#### Test Case 5.6: Keyboard - Arrow Keys on Tabs
**Steps:**
1. Tab to category tabs area
2. Press Right Arrow key

**Expected Result:**
- Focus moves to next category tab
- Page scrolls to that category
- Smooth scroll animation

**Steps:**
3. Press Left Arrow key

**Expected Result:**
- Focus moves to previous category tab
- Wraps around (last → first, first → last)

#### Test Case 5.7: ARIA - Tab Pattern
**Steps:**
1. Inspect category tabs in DevTools
2. Check ARIA attributes

**Expected Result:**
- Container: `role="tablist" aria-label="兴趣分类"`
- Each tab: `role="tab" aria-selected="true/false"`
- Tab controls panel: `aria-controls="category-panel-{id}"`
- Correct `tabIndex`: 0 for active, -1 for inactive

---

### 6. Haptic Feedback (P3)

**Note:** Requires physical iOS/Android device. Haptic feedback may not work in browser on desktop.

#### Test Case 6.1: Level 1 Vibration
**Steps:**
1. On physical device, tap unselected bubble (0 → 1)

**Expected Result:**
- Light vibration: 10ms
- Single, quick tap

#### Test Case 6.2: Level 2 Vibration
**Steps:**
1. Tap Level 1 bubble (1 → 2)

**Expected Result:**
- Medium vibration: 15ms
- Slightly stronger than Level 1

#### Test Case 6.3: Level 3 Vibration
**Steps:**
1. Tap Level 2 bubble (2 → 3)

**Expected Result:**
- Double tap pattern: [10ms, pause 20ms, 10ms]
- Distinctive "tap-tap" feel

#### Test Case 6.4: Deselect Vibration
**Steps:**
1. Tap Level 3 bubble (3 → 0)

**Expected Result:**
- Very light vibration: 5ms
- Subtle confirmation of deselection

#### Test Case 6.5: Reduced Motion Preference
**Steps:**
1. Enable "Reduce Motion" in system settings
2. Tap bubbles through all levels

**Expected Result:**
- NO vibration at any level
- Haptic feedback completely disabled
- UI still functional

---

### 7. Edge Cases & Performance

#### Test Case 7.1: Rapid Tapping
**Steps:**
1. Rapidly tap the same bubble 10+ times

**Expected Result:**
- Bubble cycles through levels smoothly
- No UI glitches or stuck states
- Animations remain smooth
- Live region doesn't flood announcements

#### Test Case 7.2: Select Maximum Interests
**Steps:**
1. Select all 56 interests
2. Observe preview and heat meter

**Expected Result:**
- Preview shows first 6 + "+50" indicator
- Heat meter fills completely (or close to it)
- No layout breaks
- Continue button functional

#### Test Case 7.3: Low-End Device Performance
**Steps:**
1. Test on older device (e.g., iPhone 8, Pixel 3)
2. Navigate through categories
3. Tap multiple bubbles quickly

**Expected Result:**
- Scrolling smooth (60fps or close)
- Animations don't lag
- Haptics don't delay selection
- No memory issues

#### Test Case 7.4: Reduced Motion - Full Disable
**Steps:**
1. Enable "Reduce Motion" preference
2. Interact with all carousel features

**Expected Result:**
- Selection preview: Appears instantly (no fade-in)
- Onboarding tooltip: Appears instantly (no fade-in)
- Category scroll: Instant (no smooth scroll)
- Bubble animations: Static (no scale/glow)
- Haptics: Disabled
- All functionality still works

---

## Testing Checklist

### Visual Testing
- [ ] Selection preview shows 6 emojis + overflow
- [ ] Onboarding tooltip appears after 1 second
- [ ] All 4 bubble levels have distinct borders
- [ ] Border gradients render correctly (Level 2, 3)
- [ ] Hover glow effect works
- [ ] Dark mode: All components visible and styled
- [ ] Animations smooth (60fps target)

### Accessibility Testing
- [ ] VoiceOver announces bubble states correctly
- [ ] Live region announces selection changes
- [ ] Heat meter has progressbar role
- [ ] Tab key navigates through all elements
- [ ] Arrow keys navigate category tabs
- [ ] Space/Enter activates bubbles
- [ ] Focus visible throughout
- [ ] ARIA attributes correct in inspector

### Device Testing
- [ ] Haptic feedback on iOS device
- [ ] Haptic feedback on Android device
- [ ] Reduced motion disables haptics
- [ ] Touch targets meet 44x44dp minimum
- [ ] Performance smooth on low-end device

### Edge Cases
- [ ] Rapid tapping doesn't break UI
- [ ] Selecting 56 interests works
- [ ] Dark/light mode toggle smooth
- [ ] localStorage persistence works
- [ ] Tooltip only shows on first visit

### Browser Compatibility
- [ ] iOS Safari (light + dark)
- [ ] Android Chrome (light + dark)
- [ ] Desktop Chrome
- [ ] Desktop Safari
- [ ] Desktop Firefox

---

## Bug Report Template

If you find any issues, please report using this format:

```
**Test Case:** [e.g., 3.2 - Level 1 Progression]
**Device/Browser:** [e.g., iPhone 14 Pro, iOS 17, Safari]
**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshots/Video:**
[Attach if possible]

**Severity:** [Critical / High / Medium / Low]
```

---

## Sign-off Criteria

All tests must pass before merge:
- ✅ All P1 features functional
- ✅ All P2 features functional
- ✅ All P3 features functional
- ✅ No accessibility regressions
- ✅ Dark mode fully supported
- ✅ Performance acceptable on target devices
- ✅ No TypeScript errors
- ✅ Build successful

---

**Last Updated:** 2026-02-02
**Tested By:** [Name]
**Test Environment:** [Device/Browser details]
**Test Results:** [Pass/Fail + Notes]
