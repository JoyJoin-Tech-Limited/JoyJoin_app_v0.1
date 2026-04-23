# Xiaoyue Intro Page Animation — Creative Brief

> **For:** Animator / Motion Designer / AI Animation Agent  
> **Scene:** Personality Test Intro Page (`pages/onboarding/personality-test/index.tsx`)  
> **Current State:** Static image, 280rpx × 280rpx, no animation  
> **Goal:** Bring Xiaoyue to life as an inviting, curious host

---

## 1. The Moment

This is the **persuasion screen**. The user has landed on the personality test intro and has not yet tapped "开始测试". Xiaoyue's job is to make them feel:

- **Curious** — "This might actually be interesting"
- **Safe** — "It's only 3 minutes, no pressure"
- **Seen** — "This character is actually looking at ME"

The animation should feel like Xiaoyue is **leaning in with genuine curiosity** — not bouncing with excitement, not robotic, but alive and attentive.

---

## 2. Animation Concept: "Curious Invitation Loop"

**Total duration:** 5.0 seconds (seamless loop)  
**Loop structure:** Invitation → Hold → Rest → Micro-reaction → Rest  
**Motion/stillness ratio:** ~35% motion / 65% stillness

### Narrative Beat (5.0-second loop)

```
0.0s — NEUTRAL POSE
       Relaxed stance, lazy half-smile, subtle breathing
       (This is the "resting" frame — matches your base model)

0.5s — LEAN IN
       Body shifts weight forward, shoulders rotate slightly toward viewer
       Ears perk up just a touch (attentive, not alarmed)
       Eyes widen slightly — "Oh, you're here"

0.9s — HEAD TILT
       Classic corgi curious tilt, 15°
       Eyebrows raise slightly — "I'm wondering about you"
       Smile warms up — inviting, not pushy

1.1s — PAW WAVE
       One paw raises to chest height, small beckoning gesture
       Fingers/paw pads open slightly — "Come on, let's do this"
       Hold through 1.8s — let the gesture read clearly

1.8s — SETTLE BACK (slow)
       Body eases back toward neutral, paw lowers gently
       Head returns to center over 0.6s
       Smile softens back to lazy half-smile

2.4s — REST (primary hold)
       Full neutral, breathing subtly
       This is the longest still segment — lets the eye rest

3.2s — MICRO-REACTION (ear twitch + blink)
       One ear twitches independently (0.2s)
       Brief eye blink (0.15s)
       Tiny head bob, as if reacting to a thought
       This "micro" moment keeps the character alive during the long rest

3.6s — SECOND BREATH / SIGH
       Slight chest expansion, almost a contented sigh
       Eyes close briefly then reopen (slow blink)
       Very subtle weight shift from one paw to the other

4.2s — FINAL REST
       Returns to full neutral
       0.8s pause before loop repeats
       (This long pause prevents the animation from feeling manic)
```

### Energy Arc

```
Energy
  ▲
  │              ╭────────╮
  │             ╱          ╲
  │            ╱            ╲────────╮
  │      ╭────╯                       ╲
  │     ╱    micro-reaction             ╲
  │  ╭─╯                                 ╰──────
  │ ╱
  └──────────────────────────────────────────────▶ Time
    0s   0.5  1.0  1.5  2.0  2.5  3.0  3.5  4.0  4.5  5.0
```

**Rule:** The animation spends most of its time "resting." The two motion peaks (invitation wave + micro-reaction) are separated by a long calm period. This creates a premium, breathing-alive feel rather than a frantic screensaver.

---

## 3. Crop Points for Shorter Loops

Since you mentioned cropping later, here are natural edit points within the 5s master:

| Crop | Start | End | Duration | Best For |
|------|-------|-----|----------|----------|
| **A — Full loop** | 0.0s | 5.0s | 5.0s | Intro page hero (recommended) |
| **B — Invitation only** | 0.0s | 2.5s | 2.5s | Chat bubble, small avatars |
| **C — Resting alive** | 2.4s | 5.0s | 2.6s | Loading states, "thinking" moments |
| **D — Wave gesture** | 0.9s | 1.9s | 1.0s | CTA hover/focus reactions |

**B (0–2.5s)** is the "greatest hits" — it contains the full invitation arc (lean → tilt → wave → settle) and can stand alone as a shorter loop. The 2.4s–5.0s rest segment assumes the preceding motion; it won't loop cleanly on its own.

---

## 4. Technical Spec

### Container Constraints

| Attribute | Value |
|-----------|-------|
| **Display size** | 280rpx × 280rpx (~210px on iPhone 14) |
| **Frame shape** | Square frame, `aspectFit` |
| **Background** | Halo glow behind character (already implemented) |
| **Loop behavior** | Infinite, seamless |
| **Reduced motion** | Must provide static fallback frame |

### Delivery Formats (in priority order)

#### Format A: Animated WebP (Immediate Use)
- **Resolution:** 480 × 480px (2× the display size for retina)
- **Duration:** 5.0s loop
- **Frame rate:** 12 fps (60 frames total)
- **Target size:** ~120–200KB
- **Loop:** Seamless
- **Why:** WeChat Mini Program `<Image>` supports animated WebP natively (base library 2.12.0+). Zero code changes needed — just swap the `src` from static `.webp` to animated `.webp`.

#### Format B: Lottie JSON (Future-Proof)
- **After Effects bodymovin / Rive / LottieFiles export**
- **Frame rate:** 30 fps (150 frames)
- **Target size:** ~40–80KB
- **Why:** Smallest file size, infinitely scalable, supports interactivity (can pause/play/react to user input). Requires adding `lottie-miniprogram` dependency later.

#### Format C: Frame Sequence PNGs (Fallback)
- **60 frames** at 480 × 480px
- **Transparent background**
- **Why:** Gives maximum control if CSS frame-swapping or programmatic animation is needed later.

---

## 5. Animation Do's and Don'ts

### ✅ Do
- **Keep the purple hoodie, sunglasses, watch, necklace** — same accessories as base model
- **Subtle secondary motion** — ear twitch at 3.2s, slow blink at 3.6s, tiny weight shift
- **Overlapping action** — head tilts while body leans, paw raises while eyebrows lift
- **Ease in/out** — no linear movements, everything should feel organic
- **Maintain the "street-smart veteran" vibe** — lazy confidence, not eager puppy energy
- **Long rest periods** — the character should feel like they're "breathing," not performing

### ❌ Don't
- **No bouncing** — this is not the 开心柯基 archetype; Xiaoyue doesn't bounce
- **No rapid looping** — 5s minimum loop length; the calm rest is the point
- **No mouth opening wide** — keep mouth movements minimal (closed-mouth smile)
- **No background changes** — transparent background only, halo handled by CSS
- **No symmetrical/balanced posing** — weight should always be slightly off-center

---

## 6. Creative Prompt for Animator / AI Agent

```
Goal: Create a 5.0-second looping animation of Xiaoyue, an anthropomorphic corgi AI assistant, for a personality test intro screen.

Character: Welsh Corgi Pembroke, standing on two legs, young adult (25-30 human vibe). Wearing a lightly weathered purple hoodie (#8B5CF6) with sunglasses hanging from collar, vintage leather watch, silver chain. Street-smart veteran personality — relaxed, slightly knowing, never cutesy or hyperactive.

CRITICAL: Distinct from playful 开心柯基 archetype. Xiaoyue is CHILL, not bouncy.

Animation — "Curious Invitation Loop" (5.0 seconds):
1. NEUTRAL (0.0s): relaxed stance, lazy half-smile, subtle breathing
2. LEAN IN (0.3s): body shifts forward, ears perk slightly, eyes widen subtly
3. HEAD TILT (0.2s): classic corgi 15° curious tilt, eyebrows raise, smile warms
4. PAW WAVE (0.7s): one paw raises to chest, small beckoning "come here" gesture, hold
5. SETTLE BACK (0.6s): ease back to neutral, paw lowers gently, head returns
6. REST (0.8s): full neutral, breathing — long calm moment
7. MICRO-REACTION (0.4s): one ear twitches, brief eye blink, tiny head bob
8. SECOND BREATH (0.6s): contented sigh, slow blink, subtle weight shift
9. FINAL REST (0.8s): full neutral, breathing, before loop repeats

The animation spends 65% of its time in rest/stillness. The two motion moments (invitation wave + micro-reaction) are separated by a long calm period.

Style: 2D low-poly geometric illustration (插画风) matching the base model's aesthetic.

Motion principles:
- Ease in/out on all movements — no linear motion
- 35% motion / 65% stillness ratio
- Overlapping action: head tilts while body leans
- Secondary motion: ear twitch at 3.2s, subtle tail movement if visible
- Eye blinks: two per loop — quick at 3.2s, slow at 3.6s

Crop points (for later editing):
- 0.0s–2.5s: "Invitation only" — can be cropped as standalone 2.5s loop
- 0.9s–1.9s: "Wave gesture" — 1.0s segment for CTA reactions
- 2.4s–5.0s: "Resting alive" — calm breathing segment

Delivery:
- Primary: Animated WebP, 480×480px, 12fps, 5.0s loop, transparent background, ~150KB
- Secondary: Lottie JSON, 30fps, ~60KB
- Tertiary: 60-frame PNG sequence, 480×480px, transparent

Anti-generic test: The animation should feel like a wise, relaxed corgi inviting you to something interesting — NOT a generic cute mascot bouncing for attention. The long stillness periods are intentional; they make the character feel alive, not performing.
```

---

## 7. Implementation Plan (For Engineers)

### Phase 1: Animated WebP (Immediate, no new deps)

Replace the static image in `index.tsx`:

```tsx
// Before (static)
<Image
  className='personality-test__mascot'
  src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero)}
  mode='aspectFit'
/>

// After (animated)
<Image
  className='personality-test__mascot personality-test__mascot--animated'
  src='/assets/personality/xiaoyue/xiaoyue-intro-animated.webp'
  mode='aspectFit'
/>
```

Add CSS for reduced-motion fallback:

```scss
@media (prefers-reduced-motion: reduce) {
  .personality-test__mascot--animated {
    // Swap to static frame for accessibility
    content: url('/assets/personality/xiaoyue/xiaoyue-home-welcome.webp');
  }
}
```

### Phase 2: Lottie (Later, when adding lottie-miniprogram)

Swap the `<Image>` for a `<Lottie>` component with the JSON file. Gain:
- Programmatic play/pause (pause when user scrolls away)
- Frame-seeking (jump to "wave" frame when user taps CTA)
- Even smaller file size

---

## 8. Reference Animations

| Reference | What to steal | What to avoid |
|-----------|--------------|---------------|
| Duolingo owl wave | The "inviting wave" gesture | The frantic energy, the guilt-tripping |
| Headspace character breathe | The calm breathing rhythm | The overly meditative slowness |
| Notion AI sparkle | The subtle "alive" quality | The abstract/non-character nature |
| Corgi butt wiggle (meme) | The breed-specific charm | The hyperactivity, the lack of purpose |
| Studio Ghibli background characters | The long pauses between movements | The non-looping, scene-specific nature |

---

## 9. Acceptance Criteria

- [ ] Animation loops seamlessly at 5.0s
- [ ] 0.0s–2.5s segment can be cleanly cropped as standalone loop
- [ ] Character is recognizable at 280rpx display size
- [ ] File size under 200KB (WebP) or 80KB (Lottie)
- [ ] Transparent background, no artifacts
- [ ] Static fallback frame provided for reduced-motion
- [ ] Style matches the locked low-poly corgi base model
- [ ] Energy feels "curious and relaxed" NOT "hyper and pushy"
- [ ] At least 60% of the loop is stillness/rest, not motion
