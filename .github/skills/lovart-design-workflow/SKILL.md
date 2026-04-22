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
| Chinese display | AlibabaPuHuiTi-3 — rounded, friendly, modern | *"Chinese text should feel rounded and friendly, like a contemporary sans-serif Chinese display font"* |
| English brand | Quicksand — soft, geometric, approachable | *"English text in soft geometric sans-serif, approachable and modern"* |
| System UI | Clean, legible, functional | *"Body text clean and highly legible, no decorative serifs"* |

### Mascots

| Mascot | Personality | Best used for |
|--------|-------------|---------------|
| Corgi (开心柯基) | Playful, energetic, optimistic | Celebration, onboarding welcome, action moments, success states |
| Koala | Calm, warm, thoughtful | Empty states, relaxation, trust moments, gentle guidance |
| Turtle | Steady, reliable, patient | Loading states, persistence, step-by-step progress, reassurance |

**Prompt instruction:** Specify mascot + personality + scene context. Example: *"The corgi mascot should be playful and energetic, mid-jump with a small gift box, expressing excitement."*

### Visual tone checklist

All Lovart output for JoyJoin should feel:
- [ ] Warm (not cold or clinical)
- [ ] Cute but tasteful (not childish or overly cartoonish)
- [ ] Rounded and soft (sharp edges only when intentionally modern)
- [ ] Lively and breathable (not cramped or overloaded)
- [ ] Minimal yet refined (premium without being corporate)

Avoid in Lovart prompts: corporate blue gradients, harsh neon, photorealistic gloom, cluttered layouts, cold metallic textures.

## Asset Type Prompt Templates

### 1. Mascot / Brand Illustration

**Use for:** Character artwork, scene illustrations, emotional moments, empty/loading states.

**Brief template:**
```
Goal: [Single sentence — what feeling or moment this illustration conveys]

Character: [Mascot name] in [pose/action] expressing [emotion]
Scene: [Setting/context — minimal background or specific location]
Style: Soft-lined illustration, warm pastel tones, rounded shapes, minimal detail
Brand colors: Vibrant Purple #8B5CF6 [as accent/highlight/background], Warm Coral #FF9B85 [as ...], Warm Beige #F5F1E8 [as ...]
Typography feel: [If text included — rounded Chinese display, soft geometric English]
Mood: [warm/playful/calm/celebratory/etc.]
Composition: [Centered / left-weighted / full-bleed / with breathing space]
Export: PNG with transparency, [dimensions], [minimum resolution]
```

**Example:**
```
Goal: A warm welcome illustration for the onboarding completion screen.

Character: The corgi mascot sitting happily with a small open gift box, tail wagging.
Scene: Soft warm-beige background with subtle confetti dots.
Style: Soft-lined illustration, warm pastel tones, rounded shapes, minimal background detail.
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
