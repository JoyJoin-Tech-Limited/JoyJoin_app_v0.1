---
name: stitch-design-workflow
description: >
  Use Google Stitch as a brand-governed rapid UI design exploration tool for JoyJoin.
  Stitch generates screens from text prompts; this skill ensures every prompt is
  pre-processed through JoyJoin brand constraints before generation. Stitch output
  is exploratory only — production implementation follows existing design-system
  and frontend skills. Trigger phrases: "Stitch design", "generate UI mockup",
  "Stitch screen", "design exploration", "rapid prototype with Stitch",
  "Stitch onboarding screen", "Stitch pool card".
license: See repository license information.
---

# Stitch Design Workflow

**Core rule:** Stitch is a **design exploration** tool, not a code generator. Every prompt is wrapped with JoyJoin brand constraints before sending to Stitch. Output is HTML/CSS reference only — production code is hand-written following `design-system-governance` and `mini-program-frontend-excellence`.

## When to use this skill

- Rapidly exploring 3–5 UI screen directions before committing to Figma
- Generating reference mockups for new user flows (onboarding, event discovery, matching reveal)
- Creating visual pitch materials for stakeholders
- Validating layout ideas before engineering scoping
- Producing empty-state or loading-state screen concepts

## When NOT to use this skill

- Generating production-ready React/Taro code (Stitch outputs HTML/CSS only; no React export yet)
- Creating brand illustrations or mascot artwork (use `lovart-design-workflow`)
- Pixel-perfect production design handoff (use Figma after Stitch exploration)
- Animations, micro-interactions, or motion design (use `wow-elements`)

## Tooling boundary: Stitch vs. Lovart vs. Figma

| Tool | Use for | Output |
|------|---------|--------|
| **Stitch** | UI screen exploration, layout directions, rapid prototyping | HTML/CSS + Figma export |
| **Lovart** | Brand illustrations, mascot artwork, marketing graphics | PNG/SVG/MP4 assets |
| **Figma** | Production design handoff, pixel specs, component libraries | Specs for engineering |
| **Engineering** | Production implementation | React / Taro code |

## JoyJoin Brand Injection (mandatory for every prompt)

Every Stitch prompt must include these parameters. Do not omit them.

### Color system

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

### Typography feel

| Role | Visual feel | Stitch prompt guidance |
|------|-------------|----------------------|
| Chinese display | AlimamaFangYuanTiVF — thin, rounded, geometric, friendly | *"Chinese headlines in a thin rounded geometric sans-serif, friendly and modern"* |
| English brand | Quicksand — soft, geometric, approachable | *"English text in soft geometric sans-serif, approachable and modern"* |
| System UI | Clean, legible, functional | *"Body text clean and highly legible, no decorative serifs"* |

### Archetype mascot roster (canonical 12)

When mascots appear in Stitch-generated screens, use only these 12 archetypes:

| Archetype | Animal | Personality |
|-----------|--------|-------------|
| 开心柯基 | Corgi | Playful, energetic, optimistic |
| 太阳鸡 | Rooster | Bright, confident, energetic |
| 夸夸豚 | Praise Dolphin | Supportive, complimentary, warm |
| 机智狐 | Fox | Clever, adaptable, strategic |
| 淡定海豚 | Calm Dolphin | Steady, peaceful, balanced |
| 织网蛛 | Spider | Intricate, connected, detailed |
| 暖心熊 | Bear | Warm, strong, protective |
| 灵感章鱼 | Octopus | Creative, multi-faceted, curious |
| 沉思猫头鹰 | Owl | Wise, contemplative, observant |
| 定心大象 | Elephant | Steady, reliable, grounding |
| 稳如龟 | Turtle | Patient, persistent, thoughtful |
| 隐身猫 | Cat | Independent, curious, adaptable |

**Not approved:** Koala and Hamster are not canonical. Do not include them.

### Illustration style (插画风)

When Stitch generates screens with illustrations, inject these style descriptors:

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet
- **Outlines:** Minimal or none — facet edges define form
- **Gradients:** Soft color variation within individual facets
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, warm expressions
- **Composition:** Circular vignettes for portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette; brand purple #8B5CF6 for key elements only

## Screen-Type Prompt Templates

### 1. Onboarding / Welcome Screen

```
Goal: [Onboarding step — what the user is setting up]

Layout:
- Top: [Mascot illustration area / hero visual]
- Middle: [Headline + subheadline]
- Bottom: [Primary CTA button + secondary action / skip]

Brand colors:
- Background: Warm Beige #F5F1E8 or Soft White #FFFFFF
- Primary CTA: Vibrant Purple #8B5CF6 with rounded corners (24px radius feel)
- Headline: Vibrant Purple #8B5CF6 or Dark Gray #374151
- Mascot accent: [specific color from archetype]

Typography:
- Headline: thin rounded Chinese display font feel
- Body: clean legible sans-serif
- CTA: rounded friendly weight

Mood: [warm / welcoming / celebratory / calming]
Platform: [Mobile web 375×667 / WeChat Mini Program]
```

### 2. Event Pool Card / Discovery Screen

```
Goal: [What the user sees when browsing event pools]

Layout:
- Top: [Search bar / filter chips]
- Middle: [Scrollable card list]
- Bottom: [Tab bar or primary CTA]

Card structure:
- Rounded corners (soft, 16–24px feel)
- Warm Beige #F5F1E8 or Soft White #FFFFFF card background
- Vibrant Purple #8B5CF6 for pool type badge or price tag
- Warm Coral #FF9B85 for "hot" or "trending" indicator
- Generous internal padding, breathable spacing

Typography:
- Pool name: Chinese display font feel, single line
- Meta (time, location): system UI, secondary gray

Mood: [exclusive / playful / inviting]
```

### 3. Empty / Loading / Error State

```
Goal: [What state this screen handles]

Layout:
- Centered mascot illustration (circular vignette, low-poly插画风)
- Short emotional headline below illustration
- Optional: sub-copy explaining the state
- Optional: recovery CTA

Brand colors:
- Background: Warm Beige #F5F1E8
- Illustration: natural warm palette with purple accent
- Text: Dark Gray #374151

Mood: [hopeful / calm / reassuring]
```

## Generation Budget Guidance

Stitch has a **350 generations/month** cap (Standard Mode). Use it wisely:

| Scenario | Recommended tool | Why |
|----------|-----------------|-----|
| Need 1–2 quick layout directions for a new screen | **Stitch** | Fastest exploration |
| Need brand illustration or mascot artwork | **Lovart** | Stitch cannot do 插画风低多边形 illustrations well |
| Need production pixel specs | **Figma** | Stitch is not pixel-precise |
| Need to iterate existing screen with minor tweaks | **Manual code** | Faster than regenerating in Stitch |
| Need multi-screen clickable prototype | **Stitch** | Prototype linking is a strength |

## Handoff Workflow: Stitch → Figma → Code

1. **Stitch exploration** — Generate 2–4 screen variations using this skill's brand-injected prompts
2. **Design review** — Pick the best direction; note what works and what drifts from brand
3. **Figma refinement** — Export winning screen to Figma; add pixel specs, component states, responsive breakpoints
4. **Figma MCP read** (if configured) — Frontend engineer uses Figma MCP to read design tokens, component specs, and layout data directly from the Figma file
5. **Engineering handoff** — Engineer implements in React (web) or Taro (mini-program) using `design-system-governance`, `mini-program-frontend-excellence`, and `frontend-component-architecture`

**Never skip Figma for production screens.** Stitch output is reference only.

### Figma MCP integration

If the Figma MCP server is configured (`.mcp.json`), the frontend engineer can:
- **Read design context** from a Figma file URL — extract exact colors, typography, spacing, and component structure
- **Generate code** from selected Figma frames — use as reference for React/Taro implementation
- **Send live UI to Figma** — capture the implemented screen back into Figma for design comparison

This eliminates manual copying of hex codes and measurements from Figma to code.

## Output Format

Every Stitch design task routed through this skill should produce a brief:

```markdown
# Stitch Design Brief: [Screen Name]

## Goal
[One sentence objective]

## Brand Parameters
[Injected from this skill — colors, typography, mascot, illustration style]

## Screen Specifications
- Type: [onboarding / discovery / card / empty-state / profile / other]
- Platform: [mobile web / mini-program / both]
- Dimensions: [375×667 / other]
- Mood: [warm / playful / premium / calm]

## Prompt Draft
[Paste the Stitch-ready conversational prompt here]

## Export Plan
- Figma export: [Yes/No]
- Engineering handoff target: [apps/user-client/... or apps/mini-program/...]
```

## Limitations (do not workaround — respect them)

- **HTML/CSS output only** — No React, Vue, or Taro export. Do not attempt auto-conversion.
- **No design tokens** — Cannot manage component libraries natively. Use `DESIGN.md` as workaround.
- **No micro-interactions** — Cannot design hover effects, scroll behaviors, or animations. Use `wow-elements` for motion.
- **No native Taro components** — Stitch knows browser UI, not `View`/`Text`/`ScrollView`.
- **Generation variability** — Same prompt may produce different quality. Budget 2–3 iterations.

## Troubleshooting

**"Stitch output doesn't match JoyJoin brand tone"**
→ Re-inject brand parameters more explicitly. Add the full color table and illustration style vocabulary to the prompt. Request a style variation with "softer, warmer, more rounded."

**"Stitch generated a Koala/Hamster mascot"**
→ Reject and regenerate with the canonical 12-archetype roster explicitly listed.

**"Export format is wrong for our workflow"**
→ Default to Figma export for handoff. HTML/CSS is reference only.

**"Stitch screen uses purple gradient on white"**
→ This is the generic AI aesthetic JoyJoin avoids. Regenerate with "Warm Beige #F5F1E8 background, Vibrant Purple #8B5CF6 used sparingly as focused CTA accent only."

## Review Checklist

- [ ] All 8 brand colors referenced by exact hex code in the prompt
- [ ] Archetype mascot is from the canonical 12 (not Koala or Hamster)
- [ ] Illustration style vocabulary (插画风) injected for screens with artwork
- [ ] Platform context (mobile web / mini-program) stated
- [ ] Prompt is conversational, not mechanical — suitable for Stitch's AI
- [ ] Export plan includes Figma for production-ready screens
- [ ] Handoff target workspace (user-client / mini-program) is identified
- [ ] Generation budget considered — this task warrants Stitch vs. Lovart vs. manual

## Related Skills

| Skill | When to hand off |
|-------|-----------------|
| `lovart-design-workflow` | Need brand illustrations, mascot artwork, or marketing graphics |
| `design-system-governance` | Generated screen needs to map to CSS tokens, CVA variants, or new components |
| `frontend-component-architecture` | Task requires deciding workspace placement for new components |
| `mini-program-frontend-excellence` | Screen targets WeChat Mini Program and needs Taro-native implementation |
| `wow-elements` | Screen needs motion, micro-interactions, or emotional polish |
| `joyjoin-brand-guidelines` | Brand strategy, color expansion, or mascot roster changes |
| `platform-coordination-protocol` | Feature needs both web and mini-program implementation |
