# Mascots & Illustration

JoyJoin's visual identity is built around **12 archetype animals** that map to the personality system's canonical archetypes.

> **Source of truth:** `packages/shared/src/personality/archetypeNames.ts` and `archetypeRegistry.ts` own the canonical IDs, display names, and ordering. This document is kept in sync with those files.

## Archetype mascot roster

| ID | Current name | Animal | Primary use |
|-----------|-------------|--------|-------------|
| corgi | **社牛柯基** | Corgi | Celebration, onboarding welcome, action moments |
| rooster | **小太阳鸡** | Rooster | Steady positive energy, mood stabilizer |
| hamster_praise | **夸夸仓鼠** | Hamster | Social bonding, affirmation, warmth |
| fox | **寻宝狐** | Fox | Problem-solving, fresh ideas, game nights |
| dolphin_calm | **机灵海豚** | Dolphin | Relaxation, mindfulness, reading the room |
| spider | **人脉蛛** | Spider | Networking, connecting people, craft workshops |
| koala | **树洞考拉** | Koala | Trust moments, deep listening, emotional safety |
| octopus | **脑洞章鱼** | Octopus | Arts, brainstorming, creative multi-activity |
| owl | **好奇猫头鹰** | Owl | Knowledge sharing, deep questions, book clubs |
| elephant | **靠谱大象** | Elephant | Team building, reassurance, grounding |
| turtle | **慢热龟** | Turtle | Step-by-step progress, loading states, observation |
| cat | **小透明猫** | Cat | Solo activities, quiet companionship, creative exploration |

### Legacy names (for migration reference only)

These older names may still appear in historical docs, mockups, and asset filenames. Use `ARCHETYPE_LEGACY_NAME_MAP` in `archetypeNames.ts` to resolve them:

- 开心柯基 → corgi
- 太阳鸡 → rooster
- 夸夸豚 → hamster_praise
- 机智狐 → fox
- 淡定海豚 → dolphin_calm
- 织网蛛 → spider
- 暖心熊 → koala
- 灵感章鱼 → octopus
- 沉思猫头鹰 → owl
- 定心大象 → elephant
- 稳如龟 → turtle
- 隐身猫 → cat

## Illustration style (插画风)

JoyJoin illustrations follow a consistent **2D low-poly geometric** style:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for character portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette (earth tones, pastels, muted colors); brand purple #8B5CF6 for key elements only

**Style lock rules:**
- Always 2D illustration — never 3D render or photorealism
- Always low-poly geometric construction
- Always painterly, textured rendering with soft brushed feel
- Always soft gradients within polygonal facets
- Always atmospheric textured backgrounds with grain
- Always circular vignettes for character portraits
- Always warm natural palette with controlled purple accent

**Do not:** use harsh contrasts, neon colors, pure black backgrounds, or photorealistic gloom.

This vocabulary is for **asset generation** (see `lovart-design-workflow`). Frontend implementation follows the canonical color token system and typography roles.
