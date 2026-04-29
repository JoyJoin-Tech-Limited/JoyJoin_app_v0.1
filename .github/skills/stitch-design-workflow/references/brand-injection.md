# JoyJoin Brand Injection for Stitch

Every Stitch prompt must include these parameters. Do not omit them.

## Color system

| Token | Hex | Usage in Stitch prompts |
|-------|-----|------------------------|
| Vibrant Purple | `#8B5CF6` | Primary CTA, brand accent, key UI elements |
| Warm Coral | `#FF9B85` | Emotional peaks, celebration, highlights |
| Sky Blue | `#A8C5DD` | Calm states, secondary support, info surfaces |
| Fresh Green | `#9ACD32` | Success, positive signals, nature moments |
| Warm Beige | `#F5F1E8` | Page backgrounds, card surfaces, whitespace |
| Soft White | `#FFFFFF` | Text on dark, clean space, premium moments |
| Medium Gray | `#9CA3AF` | Borders, disabled states, secondary text |
| Dark Gray | `#374151` | Primary text, strong contrast |

**Prompt instruction:** Always list exact hex codes. Example: *"Use Vibrant Purple #8B5CF6 for the primary CTA button, Warm Beige #F5F1E8 for the page background, and Warm Coral #FF9B85 for celebration badges."*

## Typography feel

| Role | Visual feel | Stitch prompt guidance |
|------|-------------|----------------------|
| Chinese display | AlimamaFangYuanTiVF — rounded, friendly, modern, geometric | *"Chinese text should feel rounded and friendly, with a thin geometric sans-serif character"* |
| English brand | Quicksand — soft, geometric, approachable | *"English text in soft geometric sans-serif, approachable and modern"* |
| System UI | Clean, legible, functional | *"Body text clean and highly legible, no decorative serifs"* |

## Archetype mascot roster (canonical 12)

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

## Illustration style vocabulary (插画风) — MANDATORY

**Every Stitch brief MUST include the style lock below.**

Inject these descriptors into **every** prompt that generates character art or mascot illustrations:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for character portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette; brand purple #8B5CF6 for key elements only

**Style lock rules (画风统一):**
- [ ] Always 2D illustration — never 3D render or photorealism
- [ ] Always low-poly geometric construction
- [ ] Always painterly, textured rendering with soft brushed feel
- [ ] Always soft gradients within polygonal facets
- [ ] Always atmospheric textured backgrounds with grain
- [ ] Always circular vignettes for character portraits
- [ ] Always warm natural palette with controlled purple accent
- [ ] Always specify exact JoyJoin hex codes

**Do not:** use harsh contrasts, neon colors, pure black backgrounds, or photorealistic gloom.
