# JoyJoin Proprietary Icon System — Design Brief

> **Total scope:** 133 icons + 3 spot illustrations, phased delivery  
> **Style:** Low-poly geometric (插画风), matching Xiaoyue expression assets  
> **Format:** SVG masters + 1×/2×/3× PNG/WebP exports  
> **For:** Character / Icon Designer / Lovart AI Agent

---

## STYLE LOCK (Apply to EVERY Icon)

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
- Transparent background
- No gradients across the whole icon — only within facets

Anti-generic test: If this icon could appear in a generic Chinese social app without modification, it's not on-brand.
```

---

## PHASE 1 — 29 Icons (Ship First)

### 1.1 — 12 Archetype Glyph Icons (32×32px)

Small head/badge versions of the 12 personality archetypes. NOT full-body illustrations — just recognizable head/face glyphs for inline use in cards, tables, and chips.

**Prompt template:**
```
Goal: A small archetype glyph icon for JoyJoin's personality system.

Character: [ARCHETYPE_NAME] — [DESCRIPTION]
Style: 2D low-poly geometric faceted icon, 32×32px viewport
Construction: Head/face only, filling the frame, no body
Colors: Warm natural palette, [ACCENT_COLOR] as primary facet color
Expression: [EXPRESSION_DESC]
Background: Transparent

Anti-generic: This should feel like a premium game character portrait, not a stock emoji.
```

| # | Archetype | Description | Accent Color | Expression |
|---|-----------|-------------|--------------|------------|
| 1 | 气氛组柯基 (Happy Corgi) | Playful, energetic, optimistic | Warm orange #D4845C | Big open smile, tongue slightly out, perky ears |
| 2 | 情绪稳定鸡 (Sun Rooster) | Bright, confident, energetic | Warm coral #FF9B85 | Head high, chest puffed, alert eyes |
| 3 | 捧场王仓鼠 (Praise Dolphin) | Supportive, complimentary, warm | Sky blue #A8C5DD | Gentle smile, heart-shaped blowhole spray |
| 4 | 探宝雷达狐 (Clever Fox) | Clever, adaptable, strategic | Warm orange #D4845C | Winking one eye, knowing smirk, glasses |
| 5 | 读空气海豚 (Calm Dolphin) | Steady, peaceful, balanced | Sky blue #5B9BD5 | Eyes closed in contentment, serene smile |
| 6 | 社交裁缝蛛 (Weaver Spider) | Intricate, connected, detailed | Purple-gray #8B7FB0 | Multiple eyes gleaming, delicate web pattern in facets |
| 7 | 情绪树洞考拉 (Warm Bear) | Warm, strong, protective | Warm brown #A0522D | Soft eyes, protective stance, gentle smile |
| 8 | 脑洞喷泉章鱼 (Inspiration Octopus) | Creative, multi-faceted, curious | Purple #8B5CF6 | One tentacle holding paintbrush, curious wide eyes |
| 9 | 追问猫头鹰 (Contemplation Owl) | Wise, contemplative, observant | Deep blue #4A6FA5 | Large forward eyes, book tucked under wing |
| 10 | 定海神针大象 (Grounding Elephant) | Steady, reliable, grounding | Gray-blue #708090 | Steady gaze, large ears spread calm |
| 11 | 慢半拍龟 (Steady Turtle) | Patient, persistent, thoughtful | Forest green #6B8E6B | Slow blink, wise old eyes, shell pattern visible |
| 12 | 静音模式猫 (Stealth Cat) | Independent, curious, adaptable | Soft gray #9CA3AF | One eye peeking from shadow, mysterious half-smile |

**Export:** SVG + PNG 32×32, 64×64, 96×96

---

### 1.2 — 9 Chemistry / Vibe Badge Icons (24×24px)

Score-based match chemistry indicators. These appear as inline badges next to match scores.

**Unified badge shape:** All 9 share a consistent circular/badge base (like a coin or medal) with the glyph inside. The badge color changes per state.

| # | Icon ID | Current Emoji | Label | Badge Color | Glyph Direction |
|---|---------|---------------|-------|-------------|-----------------|
| 1 | chemistry-inferno | 🔥 | 炽热 | Red gradient #EF4444 → #DC2626 | Flame/comet burst, upward energy |
| 2 | chemistry-warm | 🌡️ | 温暖 | Orange gradient #F97316 → #EA580C | Glowing orb/sun with radiating warmth |
| 3 | chemistry-mild | 🌤️ | 适宜 | Blue gradient #60A5FA → #3B82F6 | Balanced cloud parting to reveal sun |
| 4 | chemistry-cold | ❄️ | 冷淡 | Gray gradient #9CA3AF → #6B7280 | Crystal/snowflake with geometric facets |
| 5 | chemistry-talkative | 💬 | 健谈 | Green gradient #22C55E → #16A34A | Three stacked chat bubbles, ascending |
| 6 | chemistry-sparkling | ✨ | 闪耀 | Purple gradient #A855F7 → #9333EA | Star burst with 4 points and inner glow |
| 7 | chemistry-growing | 🌱 | 成长 | Teal gradient #14B8A6 → #0D9488 | Bud/sprout emerging from geometric soil |
| 8 | chemistry-magical | 💫 | 奇妙 | Pink gradient #EC4899 → #DB2777 | Orbital ring with central dot, motion implied |
| 9 | chemistry-unknown | 🌤️ | 适宜 | Gray #9CA3AF (fallback) | Neutral circle with question mark facets |

**Export:** SVG + PNG 24×24, 48×48, 72×72

---

### 1.3 — 8 Status Indicator Icons (16×16px)

Tiny status glyphs for tables, lists, and inline indicators.

| # | Icon ID | Meaning | Shape | Color |
|---|---------|---------|-------|-------|
| 1 | status-success | Matched / Paid / Verified | Filled circle with centered check mark | Green #22C55E |
| 2 | status-pending | Waiting / Pending / Processing | Hollow circle with rotating dot (animated) | Amber #F59E0B |
| 3 | status-error | Failed / Cancelled / Rejected | Circle with X cross inside | Red #EF4444 |
| 4 | status-active | Online / Active / Live | Solid circle with inner white dot (glow) | Green #22C55E |
| 5 | status-inactive | Offline / Inactive | Hollow circle (ring only) | Gray #9CA3AF |
| 6 | status-new | Unread / New / Notification | Solid circle with notification ring | Red #EF4444 |
| 7 | status-verified | Identity Verified | Shield shape with check mark | Blue #3B82F6 |
| 8 | status-premium | VIP / Premium Member | Diamond / gem shape with facet lines | Purple #8B5CF6 |

**Style notes:**
- 16×16px is VERY small — keep shapes simple and high-contrast
- Use 2px minimum feature size
- Solid + outline variants of each (e.g., `status-success` and `status-success-outline`)

**Export:** SVG + PNG 16×16, 32×32, 48×48

---

## PHASE 2 — 61 Icons (Ship Second)

### 2.1 — 35 Interest Category Icons (24×24px)

Abstract geometric glyphs for interest categories and topics. NOT literal food/activity illustrations — use metaphor and abstraction.

**Categories:**

| Category | Sub-topics | Icon Direction |
|----------|-----------|----------------|
| **Food & Dining 美食** | Hotpot, BBQ, Dim Sum, Sushi, Fine Dining, Street Food, Dessert, Vegetarian | Abstract taste/gesture glyphs |
| 1 | food-hotpot | Bubbling pot with steam facets |
| 2 | food-bbq | Flame-grill cross pattern |
| 3 | food-dimsum | Stacked steam basket layers |
| 4 | food-sushi | Rolled cylinder with rice texture |
| 5 | food-finedining | Fork + knife crossed elegantly |
| 6 | food-street | Cart wheel + steam puff |
| 7 | food-dessert | Swirl/cream peak |
| 8 | food-vegetarian | Leaf + sprout combined |
| **Drinks & Nightlife 饮品夜生活** | Coffee, Tea, Cocktail, Wine, Beer, Club | Abstract vessel/glass shapes |
| 9 | drink-coffee | Steaming cup silhouette |
| 10 | drink-tea | Teapot spout curve |
| 11 | drink-cocktail | Triangular glass with olive dot |
| 12 | drink-wine | Curved goblet bowl |
| 13 | drink-beer | Foam head over curved mug |
| 14 | drink-club | Sound wave + spotlight beams |
| **Lifestyle 生活方式** | Fitness, Travel, Reading, Pets, Wellness | Movement/calm metaphors |
| 15 | lifestyle-fitness | Heartbeat line + muscle curve |
| 16 | lifestyle-travel | Compass needle + path line |
| 17 | lifestyle-reading | Open book with page fold |
| 18 | lifestyle-pets | Paw print with heart pad |
| 19 | lifestyle-wellness | Lotus / balance scale |
| **Sports 运动** | Hiking, Swimming, Ball Sports, Gym | Dynamic motion lines |
| 20 | sport-hiking | Mountain peak + boot print |
| 21 | sport-swimming | Water ripple + dive arc |
| 22 | sport-ball | Hexagon pattern (ball surface) |
| 23 | sport-gym | Dumbbell + flex curve |
| **Arts & Culture 文艺** | Music, Film, Photography, Museum, Theater | Creative tool abstractions |
| 24 | art-music | Sound wave + note stem |
| 25 | art-film | Film strip frame |
| 26 | art-photo | Aperture blades |
| 27 | art-museum | Column + pediment shape |
| 28 | art-theater | Mask silhouette (comedy/tragedy) |
| **Outdoor 户外** | Camping, Beach, Park, Cycling | Nature element abstractions |
| 29 | outdoor-camping | Tent peak + star above |
| 30 | outdoor-beach | Sun arc + wave line |
| 31 | outdoor-park | Tree canopy + bench |
| 32 | outdoor-cycling | Wheel + motion streak |
| **Gaming 游戏** | Board Games, Video Games, Escape Room, Karaoke | Play/interaction metaphors |
| 33 | game-board | Dice + pawn silhouette |
| 34 | game-video | Controller cross + buttons |
| 35 | game-escape | Keyhole + maze path |

**Export:** SVG + PNG 24×24, 48×48, 72×72

---

### 2.2 — 20 Industry / Occupation Icons (20×20px)

Abstract professional glyphs for profile industry selectors and admin tables.

| # | Industry | Direction |
|---|----------|-----------|
| 1 | tech-software | Code bracket + circuit line |
| 2 | tech-ai | Neural node network |
| 3 | tech-data | Bar chart + connecting dots |
| 4 | finance-banking | Column/pillar stability |
| 5 | finance-investment | Upward trend arrow |
| 6 | finance-accounting | Balance scale |
| 7 | legal | Gavel + book spine |
| 8 | real-estate | Building outline + key |
| 9 | hospitality | Bed + service bell |
| 10 | healthcare | Cross + heartbeat line |
| 11 | education | Open book + graduation cap |
| 12 | marketing | Megaphone + target rings |
| 13 | design | Pen tool + curve handle |
| 14 | consulting | Chess knight + path arrow |
| 15 | manufacturing | Gear + assembly line |
| 16 | media | Camera + broadcast waves |
| 17 | retail | Shopping bag + price tag |
| 18 | government | Shield + laurel branches |
| 19 | non-profit | Hands cupped + heart |
| 20 | student | Graduation cap + book stack |

**Export:** SVG + PNG 20×20, 40×40, 60×60

---

### 2.3 — 6 Icebreaker Phase Icons (32×32px)

Ritual/phase icons for the social icebreaker session flow.

| # | Phase | Current | Direction |
|---|-------|---------|-----------|
| 1 | phase-warmup | 🌅 | Sunrise arc with rays emerging — awakening energy |
| 2 | phase-challenge | ⚡ | Lightning bolt made of connected triangles — spark of competition |
| 3 | phase-detective | 🕵️ | Magnifying glass with eye inside — truth-seeking |
| 4 | phase-auction | 🎪 | Gavel striking block — bidding ritual |
| 5 | phase-miniscript | 🎲 | Script scroll unfurling with story beats — narrative flow |
| 6 | phase-recap | ✨ | Star constellation connecting dots — summary/closure |

**Export:** SVG + PNG 32×32, 64×64, 96×96

---

## PHASE 3 — 27 Assets (Ship Third)

### 3.1 — 20 Core UI Icons (20×20px)

Replace the most visible Lucide icons with proprietary versions.

**Navigation (4):**
| Icon | Lucide Equivalent | Direction |
|------|------------------|-----------|
| nav-home | Home | House silhouette with triangular roof facets |
| nav-discover | Compass | Compass needle pointing, circular bezel |
| nav-events | Calendar | Calendar grid with event dot |
| nav-profile | User | Silhouette with Xiaoyue-style corgi ears hint |

**Actions (8):**
| Icon | Lucide Equivalent | Direction |
|------|------------------|-----------|
| action-search | Search | Magnifying glass with hexagonal lens |
| action-filter | Filter | Funnel with gradient layers |
| action-heart | Heart | Geometric heart made of two triangles |
| action-share | Share | Three connected nodes in share pattern |
| action-message | MessageCircle | Speech bubble with tail curve |
| action-plus | Plus | Plus sign with rounded arms, 2px stroke |
| action-edit | Edit3 | Pencil with facet shading |
| action-delete | Trash2 | Bin with lid angle, minimal lines |

**System (8):**
| Icon | Lucide Equivalent | Direction |
|------|------------------|-----------|
| sys-check | Check | Check mark with thick 2px stroke, rounded ends |
| sys-close | X | X cross with thick 2px stroke |
| sys-chevron-right | ChevronRight | Arrow head with 2px stroke |
| sys-chevron-left | ChevronLeft | Same, mirrored |
| sys-settings | Settings | Gear with 6 triangular teeth |
| sys-lock | Lock | Padlock with keyhole |
| sys-eye | Eye | Eye shape with pupil dot |
| sys-eye-off | EyeOff | Eye with diagonal line across |

**Specs:** 2px stroke weight, rounded caps (round), rounded joins (round), 20×20px viewport. Outline style (not filled).

**Export:** SVG + PNG 20×20, 40×40, 60×60

---

### 3.2 — 4 Loading Xiaoyue Animations

Animated Xiaoyue expressions for loading states. Use the existing expression assets as base, add subtle motion.

| Animation | Expression Base | Motion | Duration |
|-----------|----------------|--------|----------|
| loading-system | `xiaoyue-loading-system` | Breathing scale 1→1.03→1, subtle head bob | 2s loop |
| loading-social | `xiaoyue-match-waiting` | Gentle sway left→right, ear twitch | 3s loop |
| loading-success | `xiaoyue-match-success` | Pop-in (scale 0.8→1.05→1) + confetti burst | One-shot 1s |
| loading-error | `xiaoyue-action-failure` | Gentle shake (±3° rotation) + settle | One-shot 0.8s |

**Format:** Animated WebP, 480×480px, transparent background
**File size target:** 100–200KB each

---

### 3.3 — 3 Empty-State Spot Illustrations (200×200px)

Small scene illustrations for empty/error states.

| Illustration | Scene | Direction |
|--------------|-------|-----------|
| empty-generic | Nothing here yet | Xiaoyue sitting with paw on chin, looking at empty space, curious but not worried |
| empty-search | No results found | Xiaoyue peeking behind a search magnifying glass, playful "not found" expression |
| error-generic | Something went wrong | Xiaoyue shrugging with one paw, relaxed "no big deal" expression |

**Export:** PNG/WebP 200×200, 400×400, transparent background

---

## PHASE 4 — 40+ Icons (Ship Fourth)

### 4.1 — 3 Energy Level Icons (20×20px)

| Level | Current | Direction |
|-------|---------|-----------|
| energy-high | 🔥 | Thermometer near max, radiating heat lines |
| energy-medium | 💫 | Thermometer at midpoint, gentle glow |
| energy-low | (none) | Thermometer near bottom, calm stillness |

### 4.2 — 8 Theme / Event Type Icons (24×24px)

| Theme | Current | Direction |
|-------|---------|-----------|
| theme-energetic | 🔥 | Explosion/starburst of energy |
| theme-chill | ☕ | Steam rising from calm surface |
| theme-intellectual | ⚡ | Brain/lightbulb spark |
| theme-night | 🌙 | Crescent with stars |
| theme-creative | 🎨 | Palette with color swatches |
| theme-outdoor | 🌲 | Mountain + sun horizon |
| theme-foodie | 🍽️ | Crossed utensils with steam |
| theme-music | 🎵 | Sound wave bars |

### 4.3 — Remaining Lucide Replacements (60 icons, 20×20px)

Full list of all remaining functional UI icons to replace. Only proceed with Phase 4 if Phase 1–3 are complete and design resources remain.

*(Detailed list available on request — ~60 additional icons covering: arrows, media controls, file operations, form inputs, social actions, navigation variants)*

---

## MASTER PROMPT (For Lovart / Designer)

```
Goal: Generate a set of proprietary icons for JoyJoin, a social-matching platform.

Style lock (插画风 — applies to every icon):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Built from polygonal facets and triangular planes
- Painterly, soft brushed feel within each facet
- Minimal or no outlines — facet edges define form
- Soft color variation within individual facets
- Natural warm palette with JoyJoin brand colors:
  - Vibrant Purple #8B5CF6
  - Warm Coral #FF9B85
  - Sky Blue #A8C5DD
  - Fresh Green #9ACD32
- Transparent background

Anti-generic test: This icon should NOT look like it could appear in a generic dating or social app. The low-poly geometric construction makes it unmistakably JoyJoin.

Grid: Generate all icons on a single reference sheet — 8 icons per row, evenly spaced, with small labels beneath each. This helps verify style consistency across the set.

Export: PNG with transparency, each icon isolated on its own canvas at the specified size.
```

---

## Delivery Workflow

```
Phase 1 (29 icons) → designer delivers → we code migration → ship
Phase 2 (61 icons) → designer delivers → we code migration → ship
Phase 3 (27 assets) → designer delivers → we code migration → ship
Phase 4 (40+ icons) → designer delivers → we code migration → ship
```

For each phase:
1. Designer delivers PNGs with transparency
2. We run them through `npm run optimize:icons` (SVG → WebP raster pipeline)
3. We update the code references (emoji → icon constant)
4. We smoke-test in WeChat DevTools + web browser

---

## File Naming Convention

```
icon-{category}-{name}.svg
icon-{category}-{name}.png
icon-{category}-{name}@2x.png
icon-{category}-{name}@3x.png

Examples:
icon-archetype-corgi.svg
icon-chemistry-inferno.svg
icon-status-success.svg
icon-interest-food-hotpot.svg
icon-ui-nav-home.svg
```
