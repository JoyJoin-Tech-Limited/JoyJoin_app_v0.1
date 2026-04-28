# JoyJoin Mini-Program — Complete Visual System Design Brief

> **Total scope:** 366 assets across 7 tiers  
> **Icons:** 85 proprietary icons  
> **Illustrations:** 36 state assets + 12 share cards  
> **Patterns:** 180 generative backgrounds  
> **Style:** Low-poly geometric (插画风), matching Xiaoyue  
> **For:** Designer / Lovart AI Agent  
> **Delivery:** 8-week phased roadmap

---

## STYLE LOCK (Applies to Every Asset)

```
Style (插画风统一 — MANDATORY):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Built from polygonal facets and triangular planes
- Painterly, soft brushed feel within each facet — NOT flat vector
- Minimal or no outlines — facet edges define form
- Soft color variation within individual facets
- Natural warm palette with JoyJoin brand colors:
  - Vibrant Purple #8B5CF6 (primary accent)
  - Warm Coral #FF9B85 (warm highlights)
  - Sky Blue #A8C5DD (cool accents)
  - Fresh Green #9ACD32 (positive signals)
- Transparent background (PNG/WebP) or currentColor (SVG)
- No gradients across the whole icon — only within facets

Anti-generic test: If this asset could appear in a generic Chinese social app
without modification, it's not on-brand.

Grid: Generate all icons on a single reference sheet per tier — 8 icons per row,
evenly spaced, with small labels beneath each. This helps verify style consistency.
```

---

## TIER 1 — ARCHETYPE VISUAL SYSTEM (24 Icons + 12 Color Sets)

### 1.1 — Archetype Head Icons (40×40px viewBox)

**Purpose:** Replace initials in all avatar contexts (squad unboxing, pool group detail, connections, matching status, icebreaker roster).

**Spec:**
- ViewBox: 40×40px
- Head/face only, filling 85% of frame
- Circular mask or rounded-square frame (consistent across all 12)
- 3-4 distinctive features that make archetype recognizable
- Low-poly geometric construction (triangular facets)
- Transparent background

**Prompt template for each:**
```
Archetype head icon for JoyJoin mini-program.
Character: [ARCHETYPE_NAME] — [DESCRIPTION]
Style: 2D low-poly geometric digital illustration, 40×40px viewBox
Construction: Head/face only, filling frame, circular mask
Colors: Warm natural palette, [ACCENT_COLOR] as primary facet color
Distinctive features: [FEATURE_1], [FEATURE_2], [FEATURE_3]
Expression: [EXPRESSION]
Background: Transparent
Anti-generic: Must be recognizable as [ANIMAL] even at 40px. Not abstract.
```

| # | Archetype | Accent Color | Distinctive Features | Expression |
|---|-----------|--------------|---------------------|------------|
| 1 | 气氛组柯基 | Warm orange #D4845C | Perky triangular ears, tongue out, big smile | Playful, energetic |
| 2 | 情绪稳定鸡 | Warm coral #FF9B85 | Bright comb, alert eyes, proud neck | Confident, radiant |
| 3 | 捧场王仓鼠 | Sky blue #A8C5DD | Curved body, heart-shaped tail, gentle smile | Supportive, warm |
| 4 | 探宝雷达狐 | Warm orange #D4845C | Pointed ears, glasses frame, winking eye | Clever, knowing |
| 5 | 读空气海豚 | Sky blue #5B9BD5 | Smooth forehead, closed peaceful eyes, serene smile | Calm, content |
| 6 | 社交裁缝蛛 | Purple-gray #8B7FB0 | Multiple small eyes, delicate leg silhouette | Intricate, watchful |
| 7 | 情绪树洞考拉 | Warm brown #A0522D | Round ears, soft eyes, protective posture | Warm, strong |
| 8 | 脑洞喷泉章鱼 | Purple #8B5CF6 | Tentacle holding brush, curious wide eyes | Creative, curious |
| 9 | 追问猫头鹰 | Deep blue #4A6FA5 | Large forward eyes, feather tufts, book hint | Wise, contemplative |
| 10 | 定海神针大象 | Gray-blue #708090 | Trunk curve, large ear flaps, steady gaze | Grounded, steady |
| 11 | 慢半拍龟 | Forest green #6B8E6B | Shell dome pattern, patient old eyes, slow blink | Patient, timeless |
| 12 | 静音模式猫 | Soft gray #9CA3AF | One eye peeking, mysterious half-smile, soft ears | Mysterious, subtle |

**Export:** SVG source + PNG 40×40, 80×80, 120×120 (1×/2×/3×)

---

### 1.2 — Archetype Micro Glyphs (16×16px viewBox)

**Purpose:** Discover pool palette — small inline indicators of registered archetypes.

**Spec:**
- ViewBox: 16×16px
- Must be recognizable at 16px (very small)
- Simplified silhouette of archetype head — 2-3 key features only
- Monochrome (filled shape, no internal detail)
- Transparent background

| # | Archetype | Key Silhouette Features |
|---|-----------|------------------------|
| 1 | 气氛组柯基 | Round head + two triangular ear peaks |
| 2 | 情绪稳定鸡 | Comb crest + beak profile |
| 3 | 捧场王仓鼠 | Curved body + heart tail |
| 4 | 探宝雷达狐 | Pointed ears + diamond face |
| 5 | 读空气海豚 | Smooth curved forehead + smile |
| 6 | 社交裁缝蛛 | Hexagon body + 4 visible legs |
| 7 | 情绪树洞考拉 | Round ears + broad snout |
| 8 | 脑洞喷泉章鱼 | Star body + 3 tentacles |
| 9 | 追问猫头鹰 | Large eyes + ear tufts |
| 10 | 定海神针大象 | Trunk + large ear flap |
| 11 | 慢半拍龟 | Dome shell + small head |
| 12 | 静音模式猫 | Peeking eye + curved back |

**Export:** SVG source + PNG 16×16, 32×32, 48×48

---

### 1.3 — Archetype Color Token Sets (12 sets)

Each archetype gets a 5-color palette for theming:

```
气氛组柯基:  { primary: '#D4845C', light: '#FDBA74', dark: '#9A3412', bg: '#FFF7ED', surface: '#FED7AA' }
情绪稳定鸡:    { primary: '#FF9B85', light: '#FDBA74', dark: '#C2410C', bg: '#FFF7ED', surface: '#FED7AA' }
捧场王仓鼠:    { primary: '#A8C5DD', light: '#BFDBFE', dark: '#1E40AF', bg: '#EFF6FF', surface: '#DBEAFE' }
探宝雷达狐:    { primary: '#D4845C', light: '#FDBA74', dark: '#9A3412', bg: '#FFF7ED', surface: '#FED7AA' }
读空气海豚:  { primary: '#5B9BD5', light: '#93C5FD', dark: '#1E3A8A', bg: '#EFF6FF', surface: '#DBEAFE' }
社交裁缝蛛:    { primary: '#8B7FB0', light: '#C4B5FD', dark: '#5B21B6', bg: '#F5F3FF', surface: '#DDD6FE' }
情绪树洞考拉:    { primary: '#A0522D', light: '#FDBA74', dark: '#7C2D12', bg: '#FFF7ED', surface: '#FED7AA' }
脑洞喷泉章鱼:  { primary: '#8B5CF6', light: '#C4B5FD', dark: '#5B21B6', bg: '#F5F3FF', surface: '#DDD6FE' }
追问猫头鹰: { primary: '#4A6FA5', light: '#93C5FD', dark: '#1E3A8A', bg: '#EFF6FF', surface: '#DBEAFE' }
定海神针大象:  { primary: '#708090', light: '#CBD5E1', dark: '#334155', bg: '#F8FAFC', surface: '#E2E8F0' }
慢半拍龟:    { primary: '#6B8E6B', light: '#86EFAC', dark: '#14532D', bg: '#F0FDF4', surface: '#BBF7D0' }
静音模式猫:    { primary: '#9CA3AF', light: '#D1D5DB', dark: '#374151', bg: '#F9FAFB', surface: '#E5E7EB' }
```

**Deliverable:** Color reference sheet (12 palettes × 5 colors)

---

## TIER 2 — FUNCTIONAL ICONS (33 Icons)

### 2.1 — Info Label Icons (24×24px)

| # | Icon | Current | Direction |
|---|------|---------|-----------|
| 1 | info-calendar | 📅 | Calendar grid with event dot, geometric facets |
| 2 | info-location | 📍 | Location pin with triangular facets, warm accent |
| 3 | info-people | 👥 | Two overlapping silhouettes, low-poly construction |
| 4 | info-target | 🎯 | Concentric circles with center dot, target facets |

**Export:** SVG + PNG 24×24, 48×48, 72×72

---

### 2.2 — Chemistry Badge Icons (24×24px)

Unified badge shape: circular coin base with glyph inside.

| # | Icon | Current | Badge Color | Glyph Direction |
|---|------|---------|-------------|-----------------|
| 1 | chemistry-inferno | 🔥 | Red #EF4444 | Flame burst, upward energy |
| 2 | chemistry-warm | ✨ | Orange #F97316 | Glowing orb with warmth lines |
| 3 | chemistry-mild | 🌱 | Blue #60A5FA | Balanced cloud/sun |
| 4 | chemistry-cold | 💬 | Gray #9CA3AF | Crystal/snowflake facets |
| 5 | chemistry-fallback | 💫 | Purple #8B5CF6 | Orbital ring with dot |

**Export:** SVG + PNG 24×24, 48×48, 72×72

---

### 2.3 — Phase Header Icons (32×32px)

| # | Phase | Current | Direction |
|---|-------|---------|-----------|
| 1 | phase-warmup | 🌅 | Sunrise arc with radiating rays — awakening |
| 2 | phase-challenge | ⚡ | Lightning bolt of connected triangles — spark |
| 3 | phase-detective | 🕵️ | Magnifying glass with eye — truth-seeking |
| 4 | phase-dice | 🎲 | Script scroll unfurling — narrative flow |
| 5 | phase-auction | 🎪 | Gavel striking block — bidding ritual |
| 6 | phase-script | 🎭 | Theater masks overlapping — story/role |
| 7 | phase-recap | ✨ | Star constellation connecting dots — summary |

**Export:** SVG + PNG 32×32, 64×64, 96×96

---

### 2.4 — Rating Face Icons (40×40px)

Low-poly geometric face expressions for event feedback.

| # | Rating | Current | Expression |
|---|--------|---------|------------|
| 1 | rating-1 | 😕 | Frown, downturned eyes, disappointed |
| 2 | rating-2 | 🙁 | Slight frown, concerned eyes |
| 3 | rating-3 | 😐 | Neutral, flat expression |
| 4 | rating-4 | 🙂 | Gentle smile, warm eyes |
| 5 | rating-5 | 🤩 | Big excited smile, star eyes |

**Style:** Consistent base face shape (rounded, low-poly) with expression variations. Not literal emoji recreations — JoyJoin geometric faces.

**Export:** SVG + PNG 40×40, 80×80, 120×120

---

### 2.5 — Profile Action Icons (24×24px)

| # | Action | Current | Direction |
|---|--------|---------|-----------|
| 1 | action-edit | ✏️ | Pencil with facet shading |
| 2 | action-rewards | 🏆 | Trophy with geometric handles |
| 3 | action-connections | 🤝 | Two hands clasping, low-poly |
| 4 | action-invite | 🎁 | Gift box with ribbon facets |
| 5 | action-map | 🗺️ | Folded map with location pin |
| 6 | action-terms | 📄 | Document with lines and seal |

**Export:** SVG + PNG 24×24, 48×48, 72×72

---

### 2.6 — Status Symbols (16×16px)

Small, bold, high-contrast symbols.

| # | Symbol | Current | Direction |
|---|--------|---------|-----------|
| 1 | symbol-check | ✓ | Thick checkmark, 2px stroke, rounded ends |
| 2 | symbol-pending | · | Hollow circle (ring), 2px stroke |
| 3 | symbol-bullet | • | Solid circle, 6px diameter |
| 4 | symbol-chevron | › | Arrow head, 2px stroke |
| 5 | symbol-close | × | X cross, 2px stroke, rounded ends |
| 6 | symbol-star | ★ | Five-point star, geometric facets |

**Export:** SVG + PNG 16×16, 32×32, 48×48

---

## TIER 3 — REGISTRATION FLOW ICONS (28 Icons, 24×24px)

### 3.1 — Language (3 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | lang-cantonese | Speech bubble with 粵 character hint |
| 2 | lang-mandarin | Speech bubble with 普 character hint |
| 3 | lang-english | Speech bubble with "A" letter |

### 3.2 — Budget (4 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | budget-low | Small coin stack (1 coin) |
| 2 | budget-mid | Medium coin stack (2 coins) |
| 3 | budget-high | Large coin stack (3 coins) |
| 4 | budget-premium | Diamond/gem shape |

### 3.3 — Drinks Budget (2 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | drinks-low | Small glass |
| 2 | drinks-high | Large glass with foam |

### 3.4 — Cuisine (6 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | cuisine-cantonese | Steaming basket layers |
| 2 | cuisine-sichuan | Flame + pepper cross |
| 3 | cuisine-japanese | Sushi roll cylinder |
| 4 | cuisine-western | Fork + knife crossed |
| 5 | cuisine-hotpot | Bubbling pot with steam |
| 6 | cuisine-bbq | Grill grate with flame |

### 3.5 — Dietary (4 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | dietary-none | Empty plate with checkmark |
| 2 | dietary-vegetarian | Leaf + sprout |
| 3 | dietary-halal | Crescent + star (subtle) |
| 4 | dietary-seafood-free | Fish silhouette with cross |

### 3.6 — Taste (3 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | taste-mild | Gentle wave lines |
| 2 | taste-medium | Medium wave lines |
| 3 | taste-spicy | Flame burst |

### 3.7 — Bar Theme (3 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | bar-craft | Beer mug with hop leaf |
| 2 | bar-quiet | Wine glass with calm surface |
| 3 | bar-cocktail | Cocktail glass with stirrer |

### 3.8 — Alcohol (3 icons)

| # | Choice | Direction |
|---|--------|-----------|
| 1 | alcohol-yes | Wine glass |
| 2 | alcohol-tipsy | Wine glass with wavy line |
| 3 | alcohol-no | Glass with cross |

**Export all:** SVG + PNG 24×24, 48×48, 72×72

---

## TIER 4 — LOADING & MOTION (5 Animations)

### 4.1 — Xiaoyue Loading Animations

| Animation | Expression Base | Motion | Duration |
|-----------|----------------|--------|----------|
| loading-system | `xiaoyue-loading-system` | Breathing scale 1→1.03→1, subtle head bob | 2s loop |
| loading-social | `xiaoyue-match-waiting` | Gentle sway left→right, ear twitch | 3s loop |
| loading-success | `xiaoyue-match-success` | Pop-in (scale 0.8→1.05→1) + confetti burst | One-shot 1s |
| loading-error | `xiaoyue-action-failure` | Gentle shake (±3° rotation) + settle | One-shot 0.8s |

**Format:** Animated WebP, 480×480px, transparent background  
**File size target:** 100–200KB each

### 4.2 — Payment Spinner Redesign

Replace CSS rotating border with Xiaoyue `xiaoyue-loading-system` expression + pulsing ring.

**Format:** Static WebP with CSS pulse animation overlay

---

## TIER 5 — STATE ILLUSTRATIONS (36 Assets)

**3 states × 12 archetypes = 36 unique Xiaoyue-style archetype illustrations**

**Style:** Same low-poly geometric as archetype head icons, but full upper body (not just head). 200×200px. Transparent background.

### State: Empty

| Archetype | Pose/Expression |
|-----------|----------------|
| 气氛组柯基 | Head tilt, paw on chin, curious "where is everyone?" |
| 情绪稳定鸡 | Looking around brightly, confused but optimistic |
| 探宝雷达狐 | Adjusting glasses, analyzing the empty space |
| 读空气海豚 | Eyes closed, meditating, "it's fine, they'll come" |
| 社交裁缝蛛 | Weaving a small web, patient, "I'll wait" |
| 情绪树洞考拉 | Arms open, welcoming, "come join me" |
| 脑洞喷泉章鱼 | Tentacles sketching in air, "I'll create something" |
| 追问猫头鹰 | Chin on wing, thoughtful, "interesting... nobody here" |
| 定海神针大象 | Standing steady, calm, "no rush, I'm here" |
| 慢半拍龟 | Slow blink, patient, "I've got time" |
| 静音模式猫 | Peeking from behind invisible wall, "I'm here... kind of" |

### State: Error

| Archetype | Pose/Expression |
|-----------|----------------|
| 气氛组柯基 | Paws up, surprised, "oops!" |
| 情绪稳定鸡 | Ruffled feathers, confused, "what happened?" |
| 探宝雷达狐 | Glasses askew, quick fix, "let me think..." |
| 读空气海豚 | Gentle shrug, "no big deal, try again" |
| 社交裁缝蛛 | Web slightly torn, repairing, "I'll fix this" |
| 情绪树洞考拉 | Gentle pat, "don't worry, we'll sort it out" |
| 脑洞喷泉章鱼 | Ink splatter, creative recovery, "accidental art!" |
| 追问猫头鹰 | Adjusting glasses, analyzing error, "fascinating..." |
| 定海神针大象 | Steady stance, grounding gesture, "stay calm" |
| 慢半拍龟 | Shell slightly cracked (metaphor), "this too shall pass" |
| 静音模式猫 | Half-visible, "error? I didn't see anything" |

### State: Loading

| Archetype | Pose/Expression |
|-----------|----------------|
| 气氛组柯基 | Tail wag, excited bounce, "coming soon!" |
| 情绪稳定鸡 | Pacing in small circle, warm glow, "almost ready!" |
| 探宝雷达狐 | Tapping foot, calculating, "processing..." |
| 读空气海豚 | Floating calmly, gentle bob, "taking its time" |
| 社交裁缝蛛 | Spinning web in spiral, "weaving something" |
| 情绪树洞考拉 | Gentle rock, patient, "worth the wait" |
| 脑洞喷泉章鱼 | Multiple tentacles working, "creating magic" |
| 追问猫头鹰 | Page turning, studying, "gathering wisdom" |
| 定海神针大象 | Slow nod, steady, "building something solid" |
| 慢半拍龟 | Slow walk, determined, "getting there" |
| 静音模式猫 | Fading in/out, "loading... can you see me?" |

**Export:** PNG/WebP 200×200, 400×400, transparent background

---

## TIER 6 — SHARE CARD SYSTEM (12 Layouts)

Each archetype gets a unique share card layout for personality test results.

### Layout Direction Per Archetype

| Archetype | Background | Layout | Typography | Accent Elements |
|-----------|-----------|--------|------------|-----------------|
| 气氛组柯基 | Warm orange gradient, scattered paw prints | Diagonal split, playful asymmetry | Rounded, bold | Bone icon, tennis ball pattern |
| 情绪稳定鸡 | Radiating sunburst, golden rays | Centered hero, radiating outward | Bright, confident | Sun icon, feather accents |
| 捧场王仓鼠 | Soft blue waves, heart bubbles | Flowing curves, gentle rhythm | Soft, rounded | Heart splash, wave lines |
| 探宝雷达狐 | Teal geometric grid, maze paths | Sharp angles, strategic layout | Clean, modern | Glasses icon, puzzle pieces |
| 读空气海豚 | Smooth blue gradients, ripple circles | Horizontal flow, calm spacing | Elegant, thin | Water ripple, bubble accents |
| 社交裁缝蛛 | Dark purple web, node network | Intricate border, connected dots | Technical, precise | Web corner, thread lines |
| 情绪树洞考拉 | Warm brown gradient, soft circles | Embracing layout, centered warmth | Friendly, soft | Honey drop, heart accents |
| 脑洞喷泉章鱼 | Purple paint splatter, color bursts | Asymmetrical, creative chaos | Expressive, varied | Paintbrush, color swatches |
| 追问猫头鹰 | Deep blue night sky, stars | Structured, book-like columns | Scholarly, serif-like | Moon, book stack, stars |
| 定海神针大象 | Gray mountain layers, stable grid | Grounded, heavy bottom weight | Strong, stable | Mountain peak, stone texture |
| 慢半拍龟 | Green spiral, ancient patterns | Slow spiral flow, timeless | Classic, patient | Shell pattern, spiral accents |
| 静音模式猫 | Gray shadow gradients, soft edges | Mysterious, partially hidden | Subtle, elusive | Shadow shapes, peeking eye |

**Export:** PNG/WebP 1080×1920 (vertical share card), transparent overlays

---

## TIER 7 — GENERATIVE BACKGROUNDS (180 Patterns)

### Approach: Pre-generated SVG Pattern Library

**180 SVG files:** 12 archetypes × 15 variations each  
**Size:** ~2-5KB per SVG, total ~900KB  
**Selection:** Deterministic hash of user ID → "personal" pattern

### Pattern Variations Per Archetype (15 each)

For each archetype, generate 15 variations of the same pattern language with different:
- Random seed positions
- Density variations (sparse to dense)
- Color intensity (subtle to bold)
- Rotation angles
- Scale variations

**Example: 气氛组柯基 pattern variations**
1. Sparse paw prints, small scale, warm orange
2. Dense paw prints, large scale, coral accents
3. Scattered with tennis ball trajectories
4. Bouncing ball path lines
5. Playful random scatter
6. Organized grid of paw prints
7. Large single paw print with small ones
8. Trail of paw prints (walking path)
9. Overlapping paw prints
10. Paw prints with heart accents
11. Minimal (3-4 prints)
12. Maximum density
13. Rotated prints (chaotic)
14. Aligned prints (orderly)
15. Mixed sizes (adult + puppy)

**Export:** SVG files, optimized with svgo

---

## TECHNICAL SPECIFICATIONS

### SVG Requirements
- ViewBox must match target size exactly
- Use only basic shapes: `circle`, `rect`, `ellipse`, `polygon`, `path`
- No external references, no gradients (facet colors only)
- `fill='currentColor'` for monochrome icons
- Stroke: 2px for UI icons, rounded caps and joins

### PNG/WebP Requirements
- Transparent background (alpha channel)
- 1×/2×/3× exports for all raster assets
- WebP quality: 85 for illustrations, 90 for icons
- Max dimension: 480px for illustrations, 120px for icons

### Animation Requirements
- CSS `@keyframes` only (no GIF, no Lottie)
- `prefers-reduced-motion` fallback for all animations
- Max 3 simultaneous animated elements per screen
- Duration: 0.3s for interactions, 1-3s for loops

---

## FILE NAMING CONVENTION

```
Icons:
  icon-{category}-{name}.svg
  icon-{category}-{name}@2x.png
  icon-{category}-{name}@3x.png

Examples:
  icon-archetype-head-corgi.svg
  icon-chemistry-inferno.svg
  icon-phase-warmup.svg
  icon-reg-cuisine-hotpot.svg

Illustrations:
  state-{archetype}-{state}.webp
  Example: state-corgi-empty.webp

Patterns:
  pattern-{archetype}-{variant}.svg
  Example: pattern-corgi-07.svg

Share Cards:
  share-card-{archetype}.webp
  Example: share-card-corgi.webp
```

---

## DELIVERY WORKFLOW

### Phase 1: Foundation (Week 1-2)
**Designer delivers:**
- [ ] 12 archetype head icons (SVG + PNG)
- [ ] 12 archetype micro glyphs (SVG + PNG)
- [ ] 12 color token sets (reference sheet)

**Engineering:**
- [ ] ArchetypeAvatar component (40-48rpx)
- [ ] ArchetypeGlyph redesign (16rpx)
- [ ] Color theming engine
- [ ] Redesign: squad unboxing, pool detail, connections, matching status, icebreaker roster, discover

### Phase 2: Expression (Week 3-4)
**Designer delivers:**
- [ ] 4 info label icons
- [ ] 5 chemistry badge icons
- [ ] 7 phase header icons
- [ ] 5 rating face icons
- [ ] 6 profile action icons
- [ ] 6 status symbols
- [ ] 28 registration flow icons

**Engineering:**
- [ ] Wire all functional icons into components
- [ ] Idle animations (12 CSS @keyframes)
- [ ] Motion language (12 enter/exit animations)

### Phase 3: Immersion (Week 5-6)
**Designer delivers:**
- [ ] 36 state illustrations (3 states × 12 archetypes)
- [ ] Haptic pattern reference (12 signatures)

**Engineering:**
- [ ] State illustration system
- [ ] Haptic pattern implementation
- [ ] Generative background integration
- [ ] Theming engine full rollout

### Phase 4: Polish (Week 7-8)
**Designer delivers:**
- [ ] 12 share card layouts
- [ ] 180 generative background patterns

**Engineering:**
- [ ] Share card system
- [ ] Chemistry constellation visualization
- [ ] Final QA and performance optimization

---

## MASTER PROMPT FOR DESIGNER

```
Goal: Generate the complete visual system for JoyJoin mini-program, a social-matching
platform with 12 personality archetypes.

Style lock (插画风 — applies to EVERY asset):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Built from polygonal facets and triangular planes
- Painterly, soft brushed feel within each facet
- Minimal or no outlines — facet edges define form
- Soft color variation within individual facets
- Natural warm palette with brand colors: Purple #8B5CF6, Coral #FF9B85, Sky #A8C5DD, Green #9ACD32
- Transparent background

Anti-generic test: This asset should NOT look like it could appear in a generic
dating or social app. The low-poly geometric construction makes it unmistakably JoyJoin.

Grid: Generate all icons on a single reference sheet per tier — evenly spaced, with labels.

Export: PNG with transparency for icons and illustrations. SVG for icons (source files).
```

---

## COMPLETE COUNT SUMMARY

| Tier | Category | Count | Format |
|------|----------|-------|--------|
| 1.1 | Archetype head icons | 12 | SVG + PNG |
| 1.2 | Archetype micro glyphs | 12 | SVG + PNG |
| 1.3 | Archetype color sets | 12 | Reference |
| 2.1 | Info label icons | 4 | SVG + PNG |
| 2.2 | Chemistry badge icons | 5 | SVG + PNG |
| 2.3 | Phase header icons | 7 | SVG + PNG |
| 2.4 | Rating face icons | 5 | SVG + PNG |
| 2.5 | Profile action icons | 6 | SVG + PNG |
| 2.6 | Status symbols | 6 | SVG + PNG |
| 3 | Registration flow icons | 28 | SVG + PNG |
| 4 | Loading animations | 5 | Animated WebP |
| 5 | State illustrations | 36 | PNG/WebP |
| 6 | Share card layouts | 12 | PNG/WebP |
| 7 | Generative backgrounds | 180 | SVG |
| **TOTAL** | | **330 assets** | |

Plus: 12 idle animations (CSS), 12 motion patterns (CSS), 12 haptic signatures (code)
