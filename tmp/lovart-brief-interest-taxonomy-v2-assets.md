# Lovart Design Brief: Interest Taxonomy v2.0 — Full 48-Asset Redraw

## Decision

All 48 active interest images are missing locally and need to be regenerated as a unified set for CDN `/images/interests/{id}.jpg`.

Per **Plan A**, these images are **not displayed on the onboarding interest picker**. They are used in:
- User profile display
- Match explanation / 契合点 cards
- Event pool / activity cards
- Share posters / moments

Therefore the style is **atmospheric spot illustration**, not tiny scan-optimized thumbnail.

---

## Batch Strategy

48 assets is too many for one Lovart prompt. Generate by macro category in 6 batches:

| Batch | Category | Count | Dominant color |
|---|---|---|---|
| 1 | 美食小酌 food | 10 | `#E8A87C` |
| 2 | 聚会玩乐 play | 8 | `#8FB8E8` |
| 3 | 运动户外 sports | 7 | `#8FBFA3` |
| 4 | 文艺现场 culture | 8 | `#B8A8D8` |
| 5 | 生活美学 life | 8 | `#E8C48C` |
| 6 | 思想成长 growth | 7 | `#9BB8D8` |

**Recommended pilot:** Batch 1 (food) or Batch 2 (play) — highest user familiarity, easiest to judge style fit.

---

## Master Style Guide (applies to all 48)

**Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
**Textures:** Painterly, soft brushed feel within each facet — NOT flat vector or 3D render
**Outlines:** Minimal or none — facet edges define form
**Gradients:** Soft color variation within individual facets, not global gradients
**Backgrounds:** Atmospheric textured washes with subtle grain/noise
**Lighting:** Consistent soft top-left warm light
**Composition:** Centered subject, generous breathing space, 1:1 square
**Characters:** If included, geometric polygonal bodies, large expressive glossy eyes, simplified features
**Color rule:** Each illustration is dominated by its category color (~60–70%). Brand purple `#8B5CF6` and coral `#FF9B85` are reserved for small accents only.
**No text, no logos, no watermarks, no photorealism, no stock-photo feel.**

**Export:** 1200×1200px source, delivered as WebP + JPG, runtime resized to 600×600px
**File naming:** `lovart-interest-{id}-20260618-v1.webp` / `.jpg`
**Runtime path:** `/images/interests/{id}.jpg`

---

## Category Icon Audit

| New key | 中文 | Existing file | Action |
|---|---|---|---|
| `category-food` | 美食小酌 | `category-food` (steaming bowl) | ✅ Keep |
| `category-culture` | 文艺现场 | `category-culture` (theater masks) | ✅ Keep |
| `category-play` | 聚会玩乐 | `category-entertainment` (game controller) | 🟡 Rename / recolor to `#8FB8E8` |
| `category-sports` | 运动户外 | — | 🆕 Generate new |
| `category-life` | 生活美学 | `category-lifestyle` (cup + plant) | ❌ Do not reuse; generate new |
| `category-growth` | 思想成长 | `category-social` (speech bubbles) | ❌ Do not reuse; generate new |

**Cleanup after migration:** remove `category-entertainment`, `category-lifestyle`, `category-social`, and legacy `dabianlu.jpg`.

---

## Asset List & Visual Concepts

### Batch 1 — 美食小酌 food (10) — `#E8A87C`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `hotpot` | 火锅 | Bubbling hotpot from above, steam rising, chopsticks hovering | Warm Coral #FF9B85 for broth highlights |
| `bbq` | 撸串 | Skewers on a small grill, gentle smoke, warm glow | Dark grill texture, coral embers |
| `cantonese` | 早茶 | Stacked bamboo steamers, tea cup, soft morning light | Soft White #FFFFFF steam |
| `japanese` | 日料 | Simplified sushi platter, chopsticks, minimal backdrop | Fresh Green #9ACD32 wasabi accent |
| `western` | 西餐 | Rounded plate with pasta or steak, wine glass, candle | Warm Coral #FF9B85 candle glow |
| `dessert` | 下午茶 | Layered cake or macarons, small teapot, cozy table | Soft White highlights, sky blue saucer |
| `coffee` | 咖啡 | Latte art in rounded cup, coffee beans scattered gently | Warm Beige #F5F1E8 foam |
| `food_hunting` | 探店 | Stylized storefront or map pin with a steaming bowl | Vibrant Purple #8B5CF6 pin accent |
| `private_kitchen` | 私厨 | Homey round table with shared dishes, warm lamp | Coral lamp glow |
| `wine` | 小酌 | Wine glass or sake bottle with soft bokeh lights | Sky Blue #A8C5DD for cool evening accent |

---

### Batch 2 — 聚会玩乐 play (8) — `#8FB8E8`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `script_kill` | 剧本杀 | Closed mystery envelope or vintage folder, magnifying glass, candle | Warm Coral #FF9B85 candle |
| `escape_room` | 密室 | A stylized keyhole with light beams, padlock, clock | Vibrant Purple #8B5CF6 mystery glow |
| `board_games` | 桌游 | Dice, cards, and meeple on a soft table | Coral dice pips |
| `ktv` | KTV | Rounded microphone, music notes, soft stage lights | Purple #8B5CF6 stage accent |
| `gaming` | 电竞 | Friendly game controller or headset with small spark | Coral button highlights |
| `live_house` | LiveHouse | Small stage with speakers, crowd silhouettes, spotlights | Purple spotlight beams |
| `bar` | 小酒馆 | Bar counter with rounded bottles, soft amber glow | Warm Coral #FF9B85 ambient light |
| `werewolf` | 狼人杀/阿瓦隆 | Round table with face-down cards, glossy eyes peeking over | Warm Beige #F5F1E8 table |

---

### Batch 3 — 运动户外 sports (7) — `#8FBFA3`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `hiking` | 徒步 | Backpack and boots on a mountain trail, sun rising | Sky Blue #A8C5DD sky |
| `fitness` | 健身 | Kettlebell or dumbbell with towel, gym floor | Warm Coral #FF9B85 energy accent |
| `climbing` | 攀岩 | Climbing wall with colorful holds, chalk bag | Purple #8B5CF6 hold accent |
| `camping` | 露营 | Tent under stars, small campfire, trees | Warm Coral #FF9B85 fire |
| `extreme_sports` | 户外冒险 | Paraglider or cliff jump silhouette, dramatic sky | Sky Blue #A8C5DD clouds |
| `sailing` | 水上运动 | Sailboat or paddleboard on calm water, sun reflection | Sky Blue water |
| `cycling` | 骑行 | Bicycle on curved path, soft hills, sunny sky | Warm Beige #F5F1E8 path |

---

### Batch 4 — 文艺现场 culture (8) — `#B8A8D8`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `exhibition` | 看展 | Gallery wall with framed abstract art, spotlight | Warm Coral #FF9B85 frame accent |
| `music` | 玩音乐 | Guitar or keyboard with floating notes, headphones | Sky Blue #A8C5DD note accent |
| `theater` | 话剧 | Theater masks or stage curtains, spotlight | Warm Beige #F5F1E8 curtain |
| `cinema` | 电影 | Film reel, popcorn bucket, soft cinema light | Warm Coral #FF9B85 seat glow |
| `flea_market` | 市集 | Market stall with small objects, string lights, awning | Fresh Green #9ACD32 plant accent |
| `standup` | 脱口秀 | Single microphone under spotlight, small stool | Warm Coral #FF9B85 spotlight |
| `concert` | 演唱会 | Crowd hands raised, stage lights, confetti | Vibrant Purple #8B5CF6 lights |
| `binge_watch` | 追剧 | Cozy sofa with screen glow, snack bowl, blanket | Warm Beige #F5F1E8 blanket |

---

### Batch 5 — 生活美学 life (8) — `#E8C48C`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `photography` | 摄影 | Vintage camera or phone framing a sunset scene | Sky Blue #A8C5DD sky in viewfinder |
| `diy` | 手作 | Hands holding clay pot or scissors/thread, workbench | Warm Coral #FF9B85 thread accent |
| `vintage` | 淘古着 | Rounded clothes rack with hangers, mirror, plant | Fresh Green #9ACD32 plant |
| `travel` | 旅行 | Small suitcase with stickers, map, airplane trail | Sky Blue #A8C5DD sky |
| `pets` | 宠物 | Round pet bed with cat or dog, paw print, toy | Warm Coral #FF9B85 toy |
| `citywalk` | CityWalk | City street scene with coffee cup, pedestrian view | Warm Beige #F5F1E8 pavement |
| `fashion` | 穿搭 | Hanger with stylish jacket, hat, sunglasses | Vibrant Purple #8B5CF6 accessory |
| `beauty` | 护肤美妆 | Cosmetic bottles, mirror, flower petal, powder puff | Warm Coral #FF9B85 blush |

---

### Batch 6 — 思想成长 growth (7) — `#9BB8D8`

| ID | Label | Visual concept | Accent notes |
|---|---|---|---|
| `reading` | 阅读 | Open book with soft light, reading glasses, bookmark | Warm Beige #F5F1E8 pages |
| `tech` | 科技 | Laptop or robot head with small circuit lines | Vibrant Purple #8B5CF6 screen glow |
| `podcasts` | 播客 | Microphone with headphones, sound waves, cozy corner | Warm Coral #FF9B85 foam cover |
| `variety` | 八卦 | Popcorn bucket with sparkles, TV glow, chat bubbles | Warm Coral #FF9B85 popcorn |
| `career` | 搞事业 | Briefcase or desk lamp with notebook, coffee | Warm Beige #F5F1E8 paper |
| `startup` | 创业 | Rocket launching from a laptop, chart line rising | Fresh Green #9ACD32 trail |
| `language` | 语言搭子 | Speech bubbles with small globe or letters, books | Soft White #FFFFFF bubble |

---

## Per-Category Lovart Prompts

Use one prompt per batch. After generating a batch, review for style consistency before moving to the next.

### Batch 1 prompt — food

```
Goal: Generate 10 cohesive spot illustrations for JoyJoin's "美食小酌" (food & drink) interest category. These appear in profiles, match cards, event cards, and share posters — not as tiny selection thumbnails.

Style lock:
- 2D low-poly geometric faceted illustration
- Painterly soft brushed texture within facets
- Minimal outlines
- Soft top-left warm lighting
- Atmospheric grain background
- No text, no logos, no photorealism
- 1:1 square, 1200×1200px, WebP + JPG

Dominant color: warm terracotta #E8A87C (60–70% of each image)
Accents: Warm Coral #FF9B85, Warm Beige #F5F1E8, Soft White #FFFFFF, Sky Blue #A8C5DD

Generate 10 images:
1. hotpot — bubbling hotpot from above, steam, chopsticks
2. bbq — skewers on grill, gentle smoke
3. cantonese — stacked bamboo steamers, tea cup
4. japanese — sushi platter, chopsticks
5. western — plate with pasta/steak, wine glass, candle
6. dessert — cake/macarons, teapot
7. coffee — latte art cup, beans
8. food_hunting — storefront or map pin with bowl
9. private_kitchen — homey table with shared dishes
10. wine — wine glass or sake bottle with soft lights

Please generate rough compositions first, then finalize all 10 as a cohesive set.
```

### Batch 2 prompt — play

```
Goal: Generate 8 cohesive spot illustrations for JoyJoin's "聚会玩乐" (social play) interest category.

Style lock: [same as Batch 1]

Dominant color: playful sky blue #8FB8E8
Accents: Warm Coral #FF9B85, Warm Beige #F5F1E8, Vibrant Purple #8B5CF6

Generate 8 images:
1. script_kill — mystery envelope, magnifying glass, candle
2. escape_room — keyhole with light, padlock, clock
3. board_games — dice, cards, meeple
4. ktv — microphone, music notes, stage lights
5. gaming — controller or headset with spark
6. live_house — small stage, speakers, crowd silhouettes
7. bar — bar counter, bottles, amber glow
8. werewolf — round table, cards, eyes peeking over
```

### Batch 3 prompt — sports

```
Goal: Generate 7 cohesive spot illustrations for JoyJoin's "运动户外" (sports & outdoors) interest category.

Style lock: [same as Batch 1]

Dominant color: fresh sage green #8FBFA3
Accents: Sky Blue #A8C5DD, Warm Beige #F5F1E8, Warm Coral #FF9B85, Fresh Green #9ACD32

Generate 7 images:
1. hiking — backpack, boots, mountain trail
2. fitness — kettlebell/dumbbell, towel
3. climbing — climbing wall, colorful holds, chalk bag
4. camping — tent, campfire, stars
5. extreme_sports — paraglider or cliff jump, dramatic sky
6. sailing — sailboat or paddleboard on calm water
7. cycling — bicycle on curved path, hills
```

### Batch 4 prompt — culture

```
Goal: Generate 8 cohesive spot illustrations for JoyJoin's "文艺现场" (arts & culture) interest category.

Style lock: [same as Batch 1]

Dominant color: soft lavender #B8A8D8
Accents: Warm Coral #FF9B85, Warm Beige #F5F1E8, Vibrant Purple #8B5CF6

Generate 8 images:
1. exhibition — gallery wall, framed art, spotlight
2. music — guitar/keyboard, floating notes, headphones
3. theater — masks or curtains, spotlight
4. cinema — film reel, popcorn, cinema light
5. flea_market — market stall, string lights, awning
6. standup — microphone, spotlight, stool
7. concert — crowd hands, stage lights, confetti
8. binge_watch — cozy sofa, screen glow, snack bowl
```

### Batch 5 prompt — life

```
Goal: Generate 8 cohesive spot illustrations for JoyJoin's "生活美学" (life aesthetics) interest category.

Style lock: [same as Batch 1]

Dominant color: warm sand #E8C48C
Accents: Warm Coral #FF9B85, Warm Beige #F5F1E8, Sky Blue #A8C5DD, Fresh Green #9ACD32

Generate 8 images:
1. photography — camera or phone framing sunset
2. diy — hands with clay pot or craft tools
3. vintage — clothes rack, mirror, plant
4. travel — suitcase, map, airplane trail
5. pets — pet bed with cat/dog, paw print
6. citywalk — city street, coffee cup
7. fashion — hanger with jacket, hat, sunglasses
8. beauty — cosmetic bottles, mirror, flower petal
```

### Batch 6 prompt — growth

```
Goal: Generate 7 cohesive spot illustrations for JoyJoin's "思想成长" (growth & learning) interest category.

Style lock: [same as Batch 1]

Dominant color: calm denim #9BB8D8
Accents: Warm Beige #F5F1E8, Vibrant Purple #8B5CF6, Warm Coral #FF9B85, Fresh Green #9ACD32

Generate 7 images:
1. reading — open book, glasses, bookmark
2. tech — laptop or robot, circuit lines
3. podcasts — microphone, headphones, sound waves
4. variety — popcorn, TV glow, chat bubbles
5. career — briefcase or desk lamp, notebook
6. startup — rocket launching from laptop
7. language — speech bubbles, globe, books
```

---

## Category Icon Prompt

```
Goal: Create 3 small category icons for a WeChat Mini Program interest-selection UI, matching the existing JoyJoin icon family.

Existing icons to match:
- Food: steaming bowl (warm terracotta #E8A87C)
- Culture: theater masks (soft lavender #B8A8D8)

Style lock:
- 32×32px display, plus 64×64px (@2x) and 96×96px (@3x)
- Transparent background (WebP/PNG)
- Rounded, emoji-like, friendly geometric forms
- Minimal outlines
- No text
- Consistent stroke weight and visual weight

Icon 1 — Sports / 运动户外 (category color #8FBFA3): simplified leaf, running shoe, or sun-over-hills. Sage green dominant, Fresh Green #9ACD32 accent, Sky Blue #A8C5DD tiny sky.

Icon 2 — Life / 生活美学 (category color #E8C48C): small rounded house with heart window, or coffee cup with plant. Warm sand dominant, Warm Coral #FF9B85 accent, Soft White #FFFFFF highlights.

Icon 3 — Growth / 思想成长 (category color #9BB8D8): sprouting plant, rising sun, or open book with sparkle. Calm denim dominant, Vibrant Purple #8B5CF6 sparkle, Fresh Green #9ACD32 leaf.

Optional: recolor existing game-controller icon to playful sky blue #8FB8E8 for Play / 聚会玩乐.

Deliver as 32×32, 64×64, 96×96 in WebP + PNG.
```

---

## Export & Runtime Mapping

### Interest images

- **Source size:** 1200×1200px
- **Display size:** 600×600px
- **Format:** WebP primary + JPG fallback
- **Quality target:** WebP ~75, JPG ~75–80 progressive
- **File size target:** < 80KB per image at display size
- **Naming:** `lovart-interest-{id}-20260618-v1.webp`
- **Runtime path:** `/images/interests/{id}.jpg`

### Category icons

| key | Base | @2x | @3x | fallback emoji |
|---|---|---|---|---|
| food | `category-food.webp` | `category-food@2x.webp` | `category-food@3x.webp` | 🍜 |
| play | `category-play.webp` | `category-play@2x.webp` | `category-play@3x.webp` | 🎮 |
| sports | `category-sports.webp` | `category-sports@2x.webp` | `category-sports@3x.webp` | 🌿 |
| culture | `category-culture.webp` | `category-culture@2x.webp` | `category-culture@3x.webp` | 🎭 |
| life | `category-life.webp` | `category-life@2x.webp` | `category-life@3x.webp` | 🏠 |
| growth | `category-growth.webp` | `category-growth@2x.webp` | `category-growth@3x.webp` | 💡 |

---

## Implementation Plan

1. **Pilot:** Generate Batch 1 (food) or Batch 2 (play) first.
2. **Review:** Check style consistency against `category-food` / `category-culture` icons and JoyJoin brand.
3. **Iterate:** Adjust prompt if needed.
4. **Generate remaining 5 batches** in category order.
5. **Generate 3 new category icons** + recolor play icon.
6. **Upload** all interest images to CDN `/images/interests/`.
7. **Place** category icons in `apps/mini-program/src/assets/icons/category-icons/`.
8. **Cleanup:** Remove `category-entertainment`, `category-lifestyle`, `category-social`, and legacy `dabianlu.jpg`.
9. **Run guardrails:** `npm run guardrails` after local icon changes.

---

## Review Checklist

- [ ] All 48 interest illustrations share the same low-poly geometric painterly style
- [ ] Each illustration uses its category color as the dominant hue
- [ ] No text, logos, watermarks, or photorealism
- [ ] All 6 category icons share visual weight with existing food/culture icons
- [ ] New category icons have transparent backgrounds with no white fringe
- [ ] All file naming and paths match the mapping tables
- [ ] Legacy icons and `dabianlu.jpg` are removed
- [ ] `npm run guardrails` passes after icon changes
