# Roadmap to 49/50 — Mini-Program UI Aesthetic Excellence

> **Current Average:** 31.2/50 (Grade C)  
> **Target Average:** 49/50 (Grade A)  
> **Gap:** +17.8 points across 29 screens  
> **Estimated Effort:** 4–6 weeks (parallel execution)

---

## The Math

| Grade | Score | Current Count | Target Count |
|-------|-------|---------------|--------------|
| A+ | 47–50 | 0 | 20 |
| A | 42–46 | 0 | 8 |
| B+ | 38–41 | 0 | 1 (Terms, intentionally plain) |
| B | 35–37 | 6 | 0 |
| C | 25–34 | 22 | 0 |

**To hit 49/50 average:** 20 screens at A+, 8 screens at A, 1 screen at B+.

This is not a "polish pass." This is a **product-quality transformation**.

---

## Part 1: System-Level Foundations (Week 1)

> These changes lift ALL 29 screens simultaneously. Do these first.

### 1.1 Brand Token Enforcement Layer

**Problem:** Developers can still write ad-hoc hex colors. The `_variables.scss` file has tokens, but nothing prevents `#E8A598` from appearing in a new file.

**Solution:** Add a CI guardrail + VS Code snippet enforcement.

| Deliverable | How |
|-------------|-----|
| `guardrails-brand-colors.mjs` | New script that scans all `.scss` files for hex colors not in an allowlist. Fails CI if found. |
| VS Code snippets | Auto-complete for `$color-primary`, `$color-secondary`, etc. |
| `COLOR_ALLOWLIST` | Documented list of 20 approved hex values. Any new color must be PR-reviewed. |

**Expected lift:** Brand pillar +2 across all 29 screens = **+58 points total**

### 1.2 Global State Component Library

**Problem:** Loading, empty, error, success states are inconsistent. Some screens have custom illustrations, others have plain text.

**Solution:** 4 standardized components, used everywhere.

```
components/loading-states/
├── JoyJoinLoadingScreen      # Animated Xiaoyue + pulsing dots + skeleton
├── JoyJoinEmptyState         # Xiaoyue illustration + headline + CTA
├── JoyJoinErrorState         # Xiaoyue sad expression + message + retry
└── JoyJoinSuccessState       # Confetti + Xiaoyue celebration + haptics
```

**Specs:**
- Loading: Xiaoyue `loadingSystem` pose, 3 pulsing dots, 3 skeleton lines
- Empty: Xiaoyue `emptyState` pose, headline in `$font-brand`, primary CTA
- Error: Xiaoyue `actionFailure` pose, actionable message, retry button
- Success: Xiaoyue `actionSuccess` pose, 2-second confetti burst, auto-dismiss

**Expected lift:** Structural pillar +2 across all 29 screens = **+58 points total**

### 1.3 Xiaoyue Overlay System

**Problem:** Xiaoyue only appears on ~8 screens. 21 screens have zero mascot presence.

**Solution:** `XiaoyueOverlay` component — a floating, dismissible mascot that appears on every screen with contextual coaching copy.

```tsx
<XiaoyueOverlay
  context="discover"        // pulls contextual copy from a registry
  position="bottom-right"   // or "top-left", "inline"
  trigger="on-mount"        // or "on-scroll", "on-action"
/>
```

**Contextual copy registry (examples):**
| Screen | Xiaoyue Copy |
|--------|-------------|
| Discover | "今晚有好几个饭局正在报名，看看有没有你感兴趣的？" |
| EventDetail | "这场活动的氛围和你很搭哦，要不要报名试试？" |
| Profile | "你的社交护照越来越丰富了，继续探索吧！" |
| Events | "期待你的下一次活动回顾~" |
| Connections | "这些都是和你聊得来的朋友，保持联系哦" |
| Rewards | "你积累的每一份成长，都会在这里发光。" |

**Expected lift:** Emotional pillar +3 across 21 screens = **+63 points total**

### 1.4 Micro-Interaction Library

**Problem:** Tap feedback is inconsistent. Some elements scale, others opacity, others do nothing.

**Solution:** Standardized interaction tokens.

```scss
// _mixins.scss additions
@mixin tap-feedback {
  transition: transform 0.1s ease, opacity 0.1s ease;
  &:active { transform: scale(0.97); opacity: 0.92; }
}

@mixin tap-feedback-strong {
  transition: transform 0.08s ease, box-shadow 0.08s ease;
  &:active { transform: scale(0.95) translateY(2rpx); }
}

@mixin celebrate-on-tap {
  @include tap-feedback-strong;
  // Trigger haptics on click handler
}
```

**Apply to:** Buttons, cards, list items, chips, avatars.

**Expected lift:** Interaction +1, Emotional +1 across all 29 screens = **+58 points each**

### 1.5 Page Transition System

**Problem:** Page transitions are jarring or non-existent.

**Solution:** Shared-element transitions for key journeys.

| From | To | Transition |
|------|-----|-----------|
| LandingPage | LoginPage | Fade + slide up |
| LoginPage | EssentialData | Slide right |
| Discover | EventDetail | Shared element (card expands) |
| EventDetail | PoolRegistration | Slide up (modal feel) |
| MatchingStatus | SquadUnboxing | Confetti burst + reveal |
| SquadUnboxing | PoolGroupDetail | Fade in group members |

**Implementation:** Taro navigation with custom animation classes.

**Expected lift:** Interaction +1, Emotional +1 across key journeys = **+30 points total**

### 1.6 Haptics Integration

**Problem:** No haptic feedback anywhere.

**Solution:** Haptics at every meaningful action.

```ts
// hapticsRegistry.ts
export const HAPTIC_REGISTRY = {
  'button-primary': 'medium',
  'button-success': 'heavy',
  'selection-chip': 'light',
  'interest-heat-up': 'medium',
  'match-reveal': 'heavy',
  'squad-unbox': 'heavy',
  'error-toast': 'error',
  'success-toast': 'success',
} as const
```

**Apply to:** All CTAs, selections, toggles, completions, errors.

**Expected lift:** Emotional +1 across all 29 screens = **+29 points total**

---

## Part 2: Screen-by-Screen Deep Dive (Weeks 2–5)

### Tier 1: P0 Screens — Must Be A+ (47–50)

These 8 screens are the highest-traffic, highest-emotional-impact surfaces. Each needs individual Stitch redesign + custom Lovart assets.

| # | Screen | Current | Target | Key Transformation |
|---|--------|---------|--------|-------------------|
| 1 | **LandingPage** | 30 C | 50 A+ | Full cinematic hero, 插画风 illustrations, Xiaoyue entrance animation |
| 2 | **Discover** | 29 C | 48 A+ | Magazine feed, premium cards, filter animations |
| 3 | **LoginPage** | 40 B | 48 A+ | Add Xiaoyue welcome sequence, particle background |
| 4 | **EssentialData** | 35 B | 47 A+ | Step animations, field celebrations, progress fireworks |
| 5 | **PersonalityTest** | 37 B | 48 A+ | Question transitions, answer haptics, Xiaoyue reactions |
| 6 | **PersonalityResults** | 40 B | 50 A+ | Already strong — add share animation, haptic reveal |
| 7 | **MatchingStatus** | 36 B | 47 A+ | Live countdown animation, chemistry visualization |
| 8 | **SquadUnboxing** | 38 B | 49 A+ | Blind box 3D open animation, member reveal sequence |

**Deliverables per screen:**
- Stitch-generated HTML/CSS layout
- Lovart-generated hero illustration (if needed)
- Custom animation keyframes
- Haptics mapping
- Xiaoyue contextual copy

### Tier 2: P1 Screens — Must Be A (42–46)

These 12 screens are secondary but still user-facing. System-level changes + targeted Stitch briefs.

| # | Screen | Current | Target | Key Transformation |
|---|--------|---------|--------|-------------------|
| 9 | **EventDetail** | 27 C | 45 A | Magazine layout, atmosphere preview, host card |
| 10 | **Profile** | 30 C | 44 A | Identity passport, archetype celebration, stats visualization |
| 11 | **PoolRegistration** | 35 B | 44 A | Step celebration, choice card animations, payment trust UI |
| 12 | **ExtendedData** | 35 B | 43 A | Heat level animations, category color system, completion burst |
| 13 | **IcebreakerSession** | 32 C | 42 A | Phase transition animations, game-specific UI polish |
| 14 | **EventCoordination** | 27 C | 42 A | Event timeline, venue map preview, countdown |
| 15 | **Events** | 32 C | 42 A | Event card refresh, tab morphing, empty state illustration |
| 16 | **Connections** | 28 C | 43 A | Archetype avatar rings, chemistry visualization, grouping |
| 17 | **EditProfile** | 26 C | 42 A | Live preview, field animations, interest heat visualization |
| 18 | **Rewards** | 29 C | 42 A | Coin balance animation, reward unlock sequence, level-up celebration |
| 19 | **InvitePage** | 28 C | 43 A | Confetti hero, reward ladder, share card preview |
| 20 | **BlindBoxPayment** | 33 C | 42 A | Plan selection animation, trust indicators, payment success celebration |

### Tier 3: P2 Screens — Must Be A- (42+)

These 8 screens are utility/transactional. System-level changes + minimal targeted polish.

| # | Screen | Current | Target | Key Transformation |
|---|--------|---------|--------|-------------------|
| 21 | **PaymentVerification** | 34 C | 42 A- | Status animation, Xiaoyue expression per status, auto-redirect countdown |
| 22 | **OnboardingEntry** | 33 C | 42 A- | Already a redirect — make loading shell beautiful |
| 23 | **ProfileReview** | 32 C | 42 A- | Profile preview card with archetype flair |
| 24 | **CenterTabEmpty** | 32 C | 42 A- | Already has illustration — add Xiaoyue + CTA animation |
| 25 | **PoolGroupDetail** | 31 C | 42 A- | Member cards with archetype colors, countdown, venue preview |
| 26 | **EventFeedback** | 35 B | 44 A | Emoji rating animation, submit celebration, thank-you sequence |
| 27 | **Index** (redirect) | N/A | N/A | Not user-facing |
| 28 | **PersonalityTest/AuthGate** | 29 C | 42 A- | Make auth gate feel like part of onboarding |
| 29 | **Terms** | 27 C | 38 B+ | Intentionally plain legal page — beautiful typography is enough |

---

## Part 3: Asset Requirements

### Lovart Illustrations (batch generation)

| Asset | Count | For Screens | Priority |
|-------|-------|-------------|----------|
| Empty state Xiaoyue poses | 8 | All empty states | P0 |
| Hero card illustrations | 5 | LandingPage, Discover | P0 |
| Archetype mascot mini-avatars | 12 | Connections, Profile, everywhere | P0 |
| Event type icons | 5 | Discover, EventDetail, Events | P1 |
| Achievement/celebration illustrations | 6 | Rewards, PersonalityResults | P1 |
| Icebreaker phase icons | 6 | IcebreakerSession | P2 |

### Stitch Templates (generate once, customize per screen)

| Template | For Screens | Priority |
|----------|-------------|----------|
| Hero landing template | LandingPage, LoginPage | P0 |
| Magazine feed card | Discover, Events | P0 |
| Profile passport | Profile, EditProfile, ProfileReview | P0 |
| Event story page | EventDetail, EventCoordination | P1 |
| Form celebration | EssentialData, ExtendedData, PoolRegistration | P1 |
| Unboxing reveal | SquadUnboxing, MatchingStatus | P1 |

---

## Part 4: Implementation Sequence

### Week 1: Foundations
- [ ] Merge all Quick Wins (done)
- [ ] Build `JoyJoinLoadingScreen`, `JoyJoinEmptyState`, `JoyJoinErrorState`, `JoyJoinSuccessState`
- [ ] Build `XiaoyueOverlay` system with context registry
- [ ] Build micro-interaction mixin library
- [ ] Build page transition system
- [ ] Add haptics integration
- [ ] Add brand-color guardrail to CI
- [ ] Generate Lovart empty-state assets

### Week 2: Tier 1 Screens to A+
- [ ] Stitch: LandingPage redesign
- [ ] Stitch: Discover redesign
- [ ] Stitch: LoginPage redesign
- [ ] Lovart: LandingPage hero illustrations
- [ ] Implement: LandingPage
- [ ] Implement: Discover
- [ ] Implement: LoginPage

### Week 3: Onboarding Flow to A+
- [ ] Stitch: EssentialData redesign
- [ ] Stitch: ExtendedData redesign
- [ ] Stitch: PersonalityTest redesign
- [ ] Lovart: PersonalityResults celebration assets
- [ ] Implement: EssentialData
- [ ] Implement: ExtendedData
- [ ] Implement: PersonalityTest
- [ ] Polish: PersonalityResults

### Week 4: Core Product to A
- [ ] Stitch: EventDetail redesign
- [ ] Stitch: MatchingStatus redesign
- [ ] Stitch: SquadUnboxing redesign
- [ ] Stitch: PoolRegistration redesign
- [ ] Implement: EventDetail
- [ ] Implement: MatchingStatus
- [ ] Implement: SquadUnboxing
- [ ] Implement: PoolRegistration

### Week 5: Social & Utility to A
- [ ] Stitch: Profile redesign
- [ ] Stitch: Connections redesign
- [ ] Stitch: Rewards redesign
- [ ] Stitch: InvitePage redesign
- [ ] Implement: all Tier 2 screens

### Week 6: Polish & Performance
- [ ] Implement: all Tier 3 screens
- [ ] Animation audit (60fps check)
- [ ] Low-end Android testing
- [ ] Accessibility audit
- [ ] Re-run full 29-screen scorecard
- [ ] Target: 49/50 average

---

## Part 5: Cost Analysis

### Stitch Usage
- 29 screens × 2 iterations average = ~58 generations
- Stitch Pro plan: $20/month for 100 generations
- **Cost: ~$20–40/month**

### Lovart Usage
- ~50 illustration assets
- Lovart pricing varies by resolution/complexity
- **Cost: ~$30–50 one-time**

### Engineering Time
- Week 1: 3 days (foundations)
- Weeks 2–5: 4 weeks × 5 days = 20 days (screen implementations)
- Week 6: 3 days (polish)
- **Total: ~26 engineering days**

### Parallelization
- Designer (Stitch/Lovart) and engineer can work in parallel
- Staggered by 1 week (design Week N, implement Week N+1)
- **Real calendar time: 5–6 weeks**

---

## Part 6: Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Stitch generation doesn't match brand | Use brand injection in every prompt; iterate 2–3x per screen |
| Lovart assets don't arrive on time | Use gradient placeholders + emoji as fallback; swap later |
| Low-end Android performance | Test on WeChat DevTools with CPU throttling; use `will-change` sparingly |
| WeChat Mini Program limitations | No `backdrop-filter`, no CSS Grid, no `position: fixed` on complex pages |
| Scope creep | Freeze screen list at 29; no new screens until 49/50 hit |
| Team bandwidth | Parallelize: designer runs Stitch while engineer implements previous week's screens |

---

## Bottom Line

**49/50 is achievable.** It requires:
1. **System-level foundations** that lift all 29 screens (Week 1)
2. **Stitch + Lovart** for top 20 screens (Weeks 2–5)
3. **Animation + haptics** polish pass (Week 6)
4. **~26 engineering days** + **~$50 tool costs**

The biggest lever is **Xiaoyue on every screen** (+3 Emotional) + **global state components** (+2 Structural) + **brand token enforcement** (+2 Brand). Those three alone add ~7 points per screen = **+203 points total**, which gets us from 31 → ~38 average.

The remaining +11 points come from Stitch-generated layouts, Lovart illustrations, custom animations, and haptics — the "delight layer."
