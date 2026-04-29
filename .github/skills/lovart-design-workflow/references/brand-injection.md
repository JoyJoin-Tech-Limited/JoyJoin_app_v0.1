# JoyJoin Brand Injection for Lovart

Every Lovart brief must include these brand parameters. Do not omit them.

## Color system

| Token | Hex | Usage in Lovart prompts |
|-------|-----|------------------------|
| Vibrant Purple | `#8B5CF6` | Primary brand anchor, CTA accents, hero backgrounds |
| Warm Coral | `#FF9B85` | Warm highlights, emotional peaks, celebration moments |
| Sky Blue | `#A8C5DD` | Secondary support, calm states, informational surfaces |
| Fresh Green | `#9ACD32` | Positive signals, success states, nature moments |
| Warm Beige | `#F5F1E8` | Page backgrounds, card surfaces, breathable whitespace |
| Soft White | `#FFFFFF` | Text on dark, clean space, premium moments |
| Medium Gray | `#9CA3AF` | Subtle borders, disabled states, secondary text |
| Dark Gray | `#374151` | Primary text, strong contrast moments |

**Prompt instruction:** Always list exact hex codes. Example: *"Use Vibrant Purple #8B5CF6 as the primary accent, Warm Coral #FF9B85 for highlights, and Warm Beige #F5F1E8 for the background."*

## Typography feel

| Role | Visual feel | Lovart prompt guidance |
|------|-------------|----------------------|
| Chinese display | AlimamaFangYuanTiVF — rounded, friendly, modern, geometric | *"Chinese text should feel rounded and friendly, with a thin geometric sans-serif character"* |
| English brand | Quicksand — soft, geometric, approachable | *"English text in soft geometric sans-serif, approachable and modern"* |
| System UI | Clean, legible, functional | *"Body text clean and highly legible, no decorative serifs"* |

## Archetype mascot roster (canonical 12)

These map to `packages/shared/src/personality/prototypes.ts`.

| Archetype | Animal | Personality | Best used for |
|-----------|--------|-------------|---------------|
| 开心柯基 | **Corgi** | Playful, energetic, optimistic | Celebration, onboarding welcome, action moments |
| 太阳鸡 | **Rooster** | Bright, confident, energetic | Morning events, leadership themes |
| 夸夸豚 | **Praise Dolphin** | Supportive, complimentary, warm | Social bonding, affirmation moments |
| 机智狐 | **Fox** | Clever, adaptable, strategic | Problem-solving, game nights |
| 淡定海豚 | **Calm Dolphin** | Steady, peaceful, balanced | Relaxation, mindfulness events |
| 织网蛛 | **Spider** | Intricate, connected, detailed | Networking, craft workshops |
| 暖心熊 | **Bear** | Warm, strong, protective | Trust moments, group hugs, winter themes |
| 灵感章鱼 | **Octopus** | Creative, multi-faceted, curious | Arts, brainstorming, multi-activity |
| 沉思猫头鹰 | **Owl** | Wise, contemplative, observant | Knowledge sharing, book clubs |
| 定心大象 | **Elephant** | Steady, reliable, grounding | Team building, reassurance |
| 稳如龟 | **Turtle** | Patient, persistent, thoughtful | Step-by-step progress, loading states |
| 隐身猫 | **Cat** | Independent, curious, adaptable | Solo activities, creative exploration |

**Not approved:** Koala and Hamster are **not** part of the canonical archetype system.

**Prompt instruction:** Specify archetype + animal + personality + scene context.

## Visual tone checklist

All Lovart output for JoyJoin should feel:
- [ ] Warm (not cold or clinical)
- [ ] Cute but tasteful (not childish or overly cartoonish)
- [ ] Rounded and soft (sharp edges only when intentionally modern)
- [ ] Lively and breathable (not cramped or overloaded)
- [ ] Minimal yet refined (premium without being corporate)

## Illustration style vocabulary (插画风风格统一) — MANDATORY

**Every Lovart brief MUST include the style lock below.**

Inject these descriptors into **every** Lovart prompt that generates character art or mascot illustrations:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for character portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette; brand purple #8B5CF6 for key elements only

**Style lock rules (画风统一) — MANDATORY CHECKLIST:**
- [ ] Always 2D illustration — never 3D render or photorealism
- [ ] Always low-poly geometric construction
- [ ] Always painterly, textured rendering with soft brushed feel
- [ ] Always soft gradients within polygonal facets
- [ ] Always atmospheric textured backgrounds with grain
- [ ] Always circular vignettes for character portraits
- [ ] Always warm natural palette with controlled purple accent
- [ ] Always specify exact JoyJoin hex codes

**Do not:** use harsh contrasts, neon colors, pure black backgrounds, or photorealistic gloom.

**Anti-generic test (反通用测试):** Before approving any Lovart output, ask: *"Could this exact illustration appear in a generic dating app without modification?"* If yes → iterate. If no → pass.
