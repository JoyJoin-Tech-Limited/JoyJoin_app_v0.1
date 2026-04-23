---
name: lovart-design-workflow
description: >
  Generate Lovart-ready design prompts and briefs for JoyJoin visual assets.
  Use when creating or requesting mascot illustrations, UI mockups, marketing
  materials, icons, or any brand-aligned visual asset via Lovart AI Design Agent.
  Trigger phrases: "generate Lovart prompt", "create illustration brief",
  "Lovart mascot design", "UI mockup Lovart", "design asset brief",
  "Lovart workflow", "brand illustration prompt", "Lovart poster",
  "social media graphic Lovart", "icon set Lovart".
---

# Lovart Design Workflow

**Core rule:** Every Lovart design request starts from the JoyJoin brand system and ends with a standardized brief that can be copied directly into Lovart's ChatCanvas. This skill does not generate code — it produces design prompts and asset handoff artifacts.

## When to use this skill

- Generating a Lovart prompt for any visual asset
- Creating a design brief for illustration, mockup, or marketing material
- Requesting mascot artwork or character design (corgi, koala, turtle)
- Producing UI screen mockups or component visuals
- Generating social media graphics or promotional assets
- Iterating on existing Lovart-generated assets with refined direction
- Converting a product requirement into a visual design brief

## When NOT to use this skill

- Task is about coding the UI component (use `frontend-component-architecture`)
- Task is about design system tokens or CSS properties (use `design-system-governance`)
- Task is about brand strategy or narrative changes (use `joyjoin-brand-guidelines`)
- Task is about animation, motion, or interaction polish (use `wow-elements`)
- Task requires API integration or server-side logic (use `server-domain-architecture` or `ai-engineer`)

### When to use Stitch instead of Lovart

| Need | Use |
|------|-----|
| UI screen exploration, layout directions, rapid prototyping | **Stitch** (`stitch-design-workflow`) |
| Brand illustrations, mascot artwork, marketing graphics | **Lovart** (this skill) |
| Production pixel specs, component libraries | **Figma** |

Stitch generates HTML/CSS screen mockups from text prompts. Lovart generates brand-aligned illustrations and marketing assets. They are complementary, not competing.

## Platform Overview — Lovart

[Lovart](https://lovart.pro) is an AI Design Agent powered by Nano Banana Pro. It uses a conversational ChatCanvas workflow where you describe your design need in natural language, annotate or sketch on canvas, and iterate collaboratively.

| Concern | Lovart Capability | How we use it |
|---------|------------------|---------------|
| Input style | Conversational brief (not rigid prompt syntax) | Write a natural design brief with brand parameters |
| Canvas | ChatCanvas with annotations and sketch overlays | Iterate on composition, copy placement, or mascot pose |
| Image output | PNG, JPG, SVG (vector where supported), high-res | Export for web and mini-program use |
| Print output | PDF (for menus, brochures, posters) | Marketing collateral and offline materials |
| Video output | MP4 (motion clips, lip-sync) | Promotional video content |
| Style control | Style selector + brand parameter injection | Always inject JoyJoin brand colors and tone |
| Iteration | Remix, upscale, variation generation | Use for A/B visual options or responsive crops |

**Current constraint:** This workflow assumes **Pro tier** (web UI / ChatCanvas only). There is no API automation. The agent produces a copy-paste-ready brief; the user pastes it into Lovart and returns with the exported asset.

## JoyJoin Brand Injection

Every Lovart brief must include these brand parameters. Do not omit them — they are what keep Lovart output on-brand.

### Color system

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

**Prompt instruction:** Always list the exact hex codes in the brief. Example: *"Use Vibrant Purple #8B5CF6 as the primary accent, Warm Coral #FF9B85 for highlights, and Warm Beige #F5F1E8 for the background."*

### Typography feel

| Role | Visual feel | Lovart prompt guidance |
|------|-------------|----------------------|
| Chinese display | AlimamaFangYuanTiVF — rounded, friendly, modern, geometric | *"Chinese text should feel rounded and friendly, with a thin geometric sans-serif character"* |
| English brand | Quicksand — soft, geometric, approachable | *"English text in soft geometric sans-serif, approachable and modern"* |
| System UI | Clean, legible, functional | *"Body text clean and highly legible, no decorative serifs"* |

### Archetype mascot roster (canonical 12)

These 12 animals map to the personality system's canonical archetypes (`packages/shared/src/personality/prototypes.ts`). Use them for all product-facing illustrations, result screens, and brand assets.

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

**Not approved:** Koala and Hamster are **not** part of the canonical archetype system. Do not generate them without explicit Product approval.

**Prompt instruction:** Specify archetype + animal + personality + scene context. Example: *"The corgi mascot (开心柯基) should be playful and energetic, mid-jump with a small gift box, expressing excitement."*

### Visual tone checklist

All Lovart output for JoyJoin should feel:
- [ ] Warm (not cold or clinical)
- [ ] Cute but tasteful (not childish or overly cartoonish)
- [ ] Rounded and soft (sharp edges only when intentionally modern)
- [ ] Lively and breathable (not cramped or overloaded)
- [ ] Minimal yet refined (premium without being corporate)

### Illustration style vocabulary (插画风风格统一) — MANDATORY

**Every Lovart brief MUST include the style lock below. No exceptions.** JoyJoin illustrations follow a locked **2D low-poly geometric illustration style** (插画风统一). Omitting these descriptors causes brand drift that Beta (UX Visionary) will veto.

Inject these descriptors into **every** Lovart prompt that generates character art or mascot illustrations:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic — built from polygonal facets and triangular planes
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for character portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette (earth tones, pastels, muted colors); brand purple #8B5CF6 for key elements only

**Style lock rules (画风统一) — MANDATORY CHECKLIST:**
- [ ] Always 2D illustration — never 3D render or photorealism
- [ ] Always low-poly geometric construction
- [ ] Always painterly, textured rendering with soft brushed feel
- [ ] Always soft gradients within polygonal facets
- [ ] Always atmospheric textured backgrounds with grain
- [ ] Always circular vignettes for character portraits
- [ ] Always warm natural palette with controlled purple accent
- [ ] Always specify exact JoyJoin hex codes (never "brand purple")

**Do not:** use harsh contrasts, neon colors, pure black backgrounds, or photorealistic gloom.

**Anti-generic test (反通用测试):** Before approving any Lovart output, ask: *"Could this exact illustration appear in a generic dating app without modification?"* If yes → iterate. If no → pass.

Avoid in Lovart prompts: corporate blue gradients, harsh neon, photorealistic gloom, cluttered layouts, cold metallic textures.

## Asset Type Prompt Templates

### 1. Mascot / Brand Illustration

**Use for:** Character artwork, scene illustrations, emotional moments, empty/loading states.

**Brief template:**
```
Goal: [Single sentence — what feeling or moment this illustration conveys]

Character: [Archetype animal] in [pose/action] expressing [emotion]
Scene: [Setting/context — minimal background or specific location]
Style (插画风):
- 2D digital illustration with low-poly / geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel within each facet
- Soft gradients within polygonal facets
- Minimal or no outlines — facet edges define form
- Atmospheric textured background with subtle grain/noise
- Circular vignette composition for character portraits
Brand colors: Vibrant Purple #8B5CF6 [as accent/highlight/background], Warm Coral #FF9B85 [as ...], Warm Beige #F5F1E8 [as ...]
Typography feel: [If text included — rounded Chinese display (AlimamaFangYuanTiVF feel), soft geometric English (Quicksand feel)]
Mood: [warm/playful/calm/celebratory/etc.]
Composition: [Centered / left-weighted / full-bleed / with breathing space]
Export: PNG with transparency, [dimensions], [minimum resolution]
```

**Example:**
```
Goal: A warm welcome illustration for the onboarding completion screen.

Character: The corgi mascot (开心柯基) sitting happily with a small open gift box, tail wagging.
Scene: Soft warm-beige background with subtle confetti dots.
Style (插画风):
- 2D digital illustration with low-poly geometric faceted aesthetic
- Painterly, textured rendering with soft brushed feel
- Soft gradients within polygonal facets
- Minimal outlines
- Atmospheric textured background with subtle grain
- Circular vignette composition
Brand colors: Vibrant Purple #8B5CF6 for the gift box ribbon, Warm Coral #FF9B85 for confetti accents, Warm Beige #F5F1E8 for background.
Typography feel: No text in the illustration itself — text will be overlaid in UI.
Mood: Celebratory, welcoming, warm.
Composition: Centered character with generous breathing space on all sides.
Export: PNG with transparency, 800x800px, 2x resolution for retina.
```

### 2. UI Mockup / Screen Design

**Use for:** New screen layouts, component visuals, onboarding page mockups, feature preview images.

**Brief template:**
```
Goal: [What this screen does and who uses it]

Platform: [Web (React/Vite) / WeChat Mini Program (Taro) / Both]
Screen type: [Full page / Modal / Card / Bottom sheet]
Layout direction: [Top-down hero + form / Two-column / Centered content / List]
Key components: [Header / Illustration area / Form fields / CTA button / Footer]
Brand colors: Vibrant Purple #8B5CF6 [primary CTA], Warm Beige #F5F1E8 [background], Soft White #FFFFFF [cards], Medium Gray #9CA3AF [borders]
Typography: Chinese display font feel for headlines, clean sans-serif for body.
Illustration: [Include mascot? Which one? Pose?]
Mood: [Functional / Friendly / Premium / Playful]
Export: [PNG / JPG], [aspect ratio], [dimensions], [show mobile frame Y/N]
```

### 3. Marketing / Social Media

**Use for:** Event posters, social media graphics, share cards, promotional banners, App Store screenshots.

**Brief template:**
```
Goal: [Campaign objective — drive registrations, announce event, celebrate milestone]

Format: [Instagram post / Story / WeChat Moment / Banner / Poster / Share card]
Aspect ratio: [1:1 / 9:16 / 16:9 / 4:5 / 1080x1920]
Copy placement: [Headline position / Body text position / CTA placement]
Headline: [Text content if known, or "placeholder for headline"]
Visual focal point: [Mascot / Product UI screenshot / Abstract illustration / Photography]
Brand colors: [Full palette with specific roles]
Mood: [Energetic / Calm / Exclusive / Playful / Surprising]
Export: [PNG / JPG / PDF], [resolution], [color profile if print]
```

### 4. Icon / Icon Set

**Use for:** Tab bar icons, feature icons, action buttons, empty state icons.

**Brief template:**
```
Goal: [Icon purpose — navigation, action, status, feature identification]

Set size: [Single icon / Set of N icons]
Style: [Line icon / Filled icon / Duotone / Gradient]
Stroke weight: [Thin / Regular / Bold]
Corner treatment: [Rounded / Sharp / Mixed]
Color mode: [Monochrome (specify color) / Multi-color (specify palette)]
Size context: [24px toolbar / 48px feature / 96px empty state]
Consistency: All icons in the set must share the same stroke weight, corner radius, and visual weight.
Export: SVG (preferred for web), PNG (for mini-program where SVG support is limited)
```

## Prompt Engineering Best Practices for Lovart

1. **Conversational, not mechanical.** Lovart's ChatCanvas responds better to design briefs than to rigid prompt syntax. Write like you're briefing a human designer.
2. **Lead with the feeling, then the details.** Example: *"This should feel like a warm invitation to a surprise party"* before listing hex codes.
3. **Always include exact hex codes.** Lovart uses them for brand-aware color generation. Do not say "our brand purple" — say "Vibrant Purple #8B5CF6".
4. **Specify aspect ratio and export format.** Prevents rework. Example: *"Export as 9:16 PNG at 1080x1920 for Instagram Stories."*
5. **Reference Nano Banana Pro style when useful.** For digital painting or illustration work, mention *"professional digital painting style, Nano Banana Pro quality"* to signal expected fidelity.
6. **Use ChatCanvas annotations for iteration.** After first generation, annotate specific areas: *"Make the corgi's expression more excited"* or *"Move the headline higher, closer to the top safe zone."*
7. **Request variations for key decisions.** When choosing between directions, ask Lovart for 2–3 variations with different compositions or color weights.

## Output Format & Handoff

### Standard deliverable: `lovart_brief.md`

Every design task routed through this skill should produce a brief in this structure:

```markdown
# Lovart Design Brief: [Asset Name]

## Goal
[One sentence objective]

## Brand Parameters
- Primary color: [Hex with name]
- Secondary color(s): [Hex with name]
- Background: [Hex with name]
- Mascot (if any): [Name + personality + pose]
- Typography feel: [Description]
- Visual tone: [warm / cute / rounded / soft / lively / minimal / refined / breathable]

## Asset Specifications
- Type: [mascot-illustration / ui-mockup / marketing-graphic / icon-set / other]
- Platform: [web / mini-program / both / social-media / print]
- Dimensions: [Width x Height]
- Aspect ratio: [1:1 / 16:9 / 9:16 / etc.]
- Export format: [PNG / JPG / SVG / PDF / MP4]
- Minimum resolution: [e.g. 2x for retina]

## Prompt Draft
[Paste the Lovart-ready conversational prompt here]

## Export Requirements
- File naming: `lovart-{type}-{date}-v1.{ext}`
- Save location: [apps/*/src/assets/lovart/ or packages/shared/src/assets/lovart/]
- Lazy loading: [Yes/No — required for mini-program bundle size]
- Subpackage: [Main bundle / Subpackage name — for mini-program only]

## Review Checklist
- [ ] Brand colors match JoyJoin palette exactly
- [ ] Mascot personality is consistent with character guide
- [ ] Typography is legible at target size
- [ ] No unintended sharp edges or cold textures
- [ ] Export format is appropriate for target platform
- [ ] File size is acceptable for web/mini-program loading
```

### Asset storage conventions

| Platform | Storage path | Notes |
|----------|-------------|-------|
| Web (user-client) | `apps/user-client/src/assets/lovart/` | Import via Vite asset pipeline |
| Web (admin-client) | `apps/admin-client/src/assets/lovart/` | Rarely needed; admin is functional |
| Mini-program | `apps/mini-program/src/assets/lovart/` | Watch bundle size; use subpackages for large assets |
| Shared | `packages/shared/src/assets/lovart/` | Only for assets used by multiple apps |

### Naming convention

```
lovart-{asset-type}-{YYYYMMDD}-v{N}.{ext}

Examples:
lovart-mascot-corgi-welcome-20260422-v1.png
lovart-mockup-onboarding-setup-20260422-v1.png
lovart-poster-spring-event-20260422-v1.jpg
lovart-icons-tab-bar-20260422-v1.svg
```

### Code reference guidance

When handing off to a frontend engineer, include:
- Exact import path
- Recommended lazy-loading strategy (`React.lazy` for web, subpackage config for mini-program)
- Accessibility: `alt` text description, `aria-label` if icon-only
- Responsive: whether multiple resolutions are needed

## Collaboration Boundaries

### Handoff to `joyjoin-brand-guidelines`
When the design request involves:
- Changing mascot personalities or introducing new characters
- Expanding the color palette beyond the 8 core colors
- Redefining the brand's visual tone or emotional positioning
- Logo variations or lockup changes

### Handoff to `design-system-governance`
When the generated asset must:
- Map to a new or existing CSS custom property
- Become a CVA variant background or icon source
- Require documented visual exception from standard tokens

### Handoff to `frontend-component-architecture`
When the task requires:
- Deciding which workspace owns the asset
- Setting up import paths and lazy loading
- Ensuring cross-app sharing vs. app-local placement

### Handoff to `wow-elements`
When the illustration is for:
- Empty states that need emotional resonance
- Loading states that need motion or micro-interaction guidance
- Completion moments or celebration animations

### Handoff to `mini-program-frontend-excellence`
When the asset targets:
- WeChat Mini Program surfaces
- Needs format optimization (e.g. WebP vs PNG)
- Must respect subpackage bundle boundaries

## Quick Examples

### Example 1: Onboarding welcome illustration
```
Generate a Lovart brief for a warm onboarding welcome illustration.
- Mascot: Corgi, playful, sitting with a small gift box
- Scene: Soft warm-beige background with subtle purple accents
- Export: PNG transparent, 800x800px, 2x
- Platform: Both web and mini-program
```

### Example 2: Event pool card background
```
Create a Lovart brief for a decorative card background pattern.
- Style: Abstract soft gradient with subtle mascot silhouettes
- Colors: Vibrant Purple #8B5CF6 to Warm Coral #FF9B85 gradient
- Mood: Exclusive, surprising, premium
- Export: JPG, 16:9, 1200x675px
- Platform: Web only
```

### Example 3: Mini-program tab bar icons
```
Generate a Lovart brief for a set of 4 tab bar icons.
- Style: Line icons, regular stroke, rounded corners
- Color: Monochrome Vibrant Purple #8B5CF6
- Size: 48px display size
- Export: SVG for web, PNG for mini-program
```

## Troubleshooting

**"Lovart output doesn't match JoyJoin brand tone"**
→ Re-inject brand parameters more explicitly. Add the visual tone checklist to the brief. Request a style variation with "softer, warmer, more rounded."

**"Export format is wrong for mini-program"**
→ Mini-program has limited SVG support. For icons, export PNG at 2x and 3x. For illustrations, PNG with transparency. Always check bundle size.

**"Mascot looks different from previous illustrations"**
→ Reference previous mascot descriptions in the brief. Include specific pose and expression instructions. Use Lovart's remix feature with a previous successful output as reference.

**"Text in Lovart output is illegible"**
→ For UI mockups, keep text minimal in the illustration and plan to overlay real text in code. For marketing graphics, specify large headline size and high contrast.

## Review Checklist

Before marking a Lovart brief complete:
- [ ] All 8 brand colors are referenced by exact hex code
- [ ] Mascot personality is consistent with the character guide (if applicable)
- [ ] Asset type matches one of the 4 templates (mascot, UI mockup, marketing, icon)
- [ ] Export format and dimensions are specified
- [ ] Target platform (web/mini-program/both) is stated
- [ ] File naming follows `lovart-{type}-{date}-v{N}.{ext}` convention
- [ ] Storage path is appropriate for the target workspace
- [ ] Brief is written in conversational style suitable for ChatCanvas
- [ ] Related skills are noted for downstream handoffs
