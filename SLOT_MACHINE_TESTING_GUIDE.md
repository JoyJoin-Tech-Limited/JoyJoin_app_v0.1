# Slot Machine Animation Testing Guide

## Quick Start

To test the enhanced slot machine animation:

1. **Start Development Server**:
   ```bash
   npm run dev:user
   ```

2. **Navigate to Personality Test**:
   - Complete personality test questionnaire
   - Animation will play automatically when results are ready

3. **Direct Testing** (if available):
   - Navigate to `/personality-test-result` route
   - Animation triggers on page load

## What to Test

### 1. Precision Landing (Critical)
- [ ] **Test all 12 archetypes**: Verify slot ALWAYS stops on correct archetype
- [ ] **No mismatches**: Final archetype in slot = final archetype in hero card
- [ ] **Consistency**: Test 5-10 times per archetype to ensure 100% accuracy

**Archetypes to Test**:
- 开心柯基 (Happy Corgi)
- 机智狐 (Clever Fox)
- 暖心熊 (Warm Bear)
- 织网蛛 (Web Spider)
- 夸夸豚 (Praising Pig)
- 太阳鸡 (Sun Chicken)
- 淡定海豚 (Calm Dolphin)
- 沉思猫头鹰 (Thoughtful Owl)
- 稳如龟 (Steady Turtle)
- 隐身猫 (Invisible Cat)
- 定心大象 (Calming Elephant)
- 灵感章鱼 (Inspired Octopus)

### 2. Visual Smoothness
- [ ] **Anticipation phase**: Pulsing frame, no jarring
- [ ] **Spin phase**: Smooth blur effect, readable
- [ ] **Slowdown phase**: Natural deceleration, no sudden jumps
- [ ] **Landing**: Bouncy reveal feels satisfying
- [ ] **Hero card**: Smooth transition from slot to full reveal

### 3. Animation Timing
- [ ] **Total duration**: ~5.5-6.5 seconds (acceptable range)
- [ ] **Anticipation**: ~0.9s feels appropriate
- [ ] **Spinning**: ~2.8s creates excitement
- [ ] **Particle explosion**: Synchronized with landing
- [ ] **No awkward pauses**: All transitions flow naturally

### 4. Performance
- [ ] **Frame rate**: Maintains 60fps throughout
- [ ] **Mobile devices**: Test on actual device if possible
- [ ] **Low-end devices**: No stuttering or lag
- [ ] **Particle count**: 40 particles performs well

### 5. Accessibility
- [ ] **Reduced motion**: Enable system preference
  - macOS: System Preferences → Accessibility → Display → Reduce motion
  - Windows: Settings → Ease of Access → Display → Show animations
  - iOS/Android: Settings → Accessibility → Reduce motion
- [ ] **Skip animation**: Works without landing
- [ ] **Screen reader**: Announces results clearly

### 6. Visual Polish
- [ ] **Pokémon-style bounce**: Image scales [1 → 1.15 → 1.1] smoothly
- [ ] **Name reveal**: Bounces in with spring effect
- [ ] **Glow effects**: Archetype-colored glow pulses nicely
- [ ] **Particle colors**: Match archetype theme
- [ ] **Border transition**: Gray → Gold on landing

## Testing Checklist by Device

### Desktop (Chrome/Firefox/Safari)
- [ ] Animation plays smoothly
- [ ] Precision landing works
- [ ] Reduced motion works
- [ ] Skip button works

### Mobile (iOS Safari)
- [ ] Animation performs well (60fps)
- [ ] Touch interactions work
- [ ] Haptic feedback triggers (if device supports)
- [ ] Reduced motion works

### Mobile (Android Chrome)
- [ ] Animation performs well (60fps)
- [ ] Touch interactions work
- [ ] Haptic feedback triggers (if device supports)
- [ ] Reduced motion works

### WeChat Mini Program (if applicable)
- [ ] Animation loads and plays
- [ ] Performance acceptable
- [ ] No rendering artifacts

## Known Issues to Watch For

### ❌ Issues That Should NOT Occur (Fixed)
- ❌ Slot lands on wrong archetype
- ❌ Near-miss fails to snap back to correct archetype
- ❌ Abrupt transitions or jarring movements
- ❌ Timing inconsistencies between runs

### ✅ Expected Behavior
- ✅ Slot ALWAYS lands on correct archetype (100% accuracy)
- ✅ Smooth deceleration to target
- ✅ Bouncy reveal feels satisfying
- ✅ Particle explosion synchronized with landing
- ✅ Hero card appears smoothly after slot reveal

## Performance Benchmarks

### Target Metrics
- **Frame Rate**: 60fps sustained
- **Total Duration**: 5.5-6.5 seconds
- **Particle Count**: 40 (mobile optimized)
- **Memory Usage**: <50MB increase during animation

### Performance Testing
```javascript
// Open browser console during animation
// Check frame rate
performance.mark('animation-start');
// ... wait for animation to complete
performance.mark('animation-end');
performance.measure('animation-duration', 'animation-start', 'animation-end');
console.log(performance.getEntriesByName('animation-duration'));
```

## Debugging Tips

### Enable Console Logging
The components already have image load logging:
```
Image loaded: 开心柯基 [path]
Image failed to load: [archetype] [error]
```

### Check State Machine
Add breakpoint or console.log in `useSlotMachine.ts`:
```typescript
const updateState = useCallback((newState: SlotMachineState) => {
  console.log('State transition:', state, '→', newState); // Add this
  setState(newState);
  onPhaseChange?.(newState);
}, [onPhaseChange]);
```

### Verify Final Index
Check that final archetype index matches target:
```typescript
console.log('Target archetype:', finalArchetype);
console.log('Target index:', targetIndex);
console.log('Final index:', currentIndex);
console.log('Match:', ARCHETYPE_NAMES[currentIndex] === finalArchetype);
```

## Recording Test Results

### Success Criteria
- ✅ 100% precision landing across all archetypes
- ✅ Smooth 60fps animation on target devices
- ✅ Satisfying "feel" and emotional impact
- ✅ Accessibility features work correctly

### Failure Criteria
- ❌ Any archetype mismatch (precision <100%)
- ❌ Frame rate drops below 30fps
- ❌ Jarring or abrupt transitions
- ❌ Accessibility features broken

## Reporting Issues

If you find issues, please report:
1. **Archetype**: Which archetype was being revealed
2. **Browser/Device**: Chrome 120 on macOS 14.2, etc.
3. **Issue Description**: What went wrong
4. **Expected vs Actual**: What should have happened vs what did happen
5. **Screenshot/Video**: If possible, capture the issue

## Next Steps After Testing

1. **Gather Feedback**: Collect qualitative user feedback
2. **Performance Analysis**: Review frame rate data
3. **Design Review**: Share results with UI/UX team
4. **Iteration**: Adjust timing parameters if needed
5. **A/B Testing Setup**: Prepare for production testing

---

## Contact

For questions or to report findings:
- **Technical Issues**: Engineering team
- **Design Feedback**: UI/UX team
- **Product Questions**: Product team
