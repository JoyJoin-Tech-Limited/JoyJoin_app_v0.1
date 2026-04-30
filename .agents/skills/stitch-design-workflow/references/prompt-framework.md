# Stitch Prompt Framework

Full brand injection tables, design dials, screen-type templates, generation budget, handoff workflow, and output format for the `stitch-design-workflow` skill.

---

## Brand Injection (mandatory for every prompt)

Do not omit these parameters. They ensure Stitch output feels unmistakably JoyJoin.

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
| 气氛组柯基 | Corgi | Playful, energetic, optimistic |
| 情绪稳定鸡 | Rooster | Bright, confident, energetic |
| 捧场王仓鼠 | Hamster | Supportive, complimentary, warm |
| 探宝雷达狐 | Fox | Clever, adaptable, strategic |
| 读空气海豚 | Perceptive Dolphin | Steady, peaceful, balanced |
| 社交裁缝蛛 | Spider | Intricate, connected, detailed |
| 情绪树洞考拉 | Bear | Warm, strong, protective |
| 脑洞喷泉章鱼 | Octopus | Creative, multi-faceted, curious |
| 追问猫头鹰 | Owl | Wise, contemplative, observant |
| 定海神针大象 | Elephant | Steady, reliable, grounding |
| 慢半拍龟 | Turtle | Patient, persistent, thoughtful |
| 静音模式猫 | Cat | Independent, curious, adaptable |

All 12 archetypes above are canonical. See `packages/shared/src/personality/archetypeNames.ts` for the legacy name migration map.

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

---

## Configurable Design Dials

Adapt the visual direction without rewriting the entire prompt. Set these dials at the top of every Stitch brief.

### The Three Dials

| Dial | Range | Default | What it controls |
|------|-------|---------|------------------|
| **DESIGN_VARIANCE** | 1–10 | 5 | Layout experimentation and symmetry breaking |
| **MOTION_INTENSITY** | 1–10 | 4 | Animation depth and micro-interaction ambition |
| **VISUAL_DENSITY** | 1–10 | 5 | Information per viewport and spacing tightness |

### DESIGN_VARIANCE — Layout experimentation

**1–3 (Predictable / Safe)**
- Centered layouts, symmetrical grids, equal padding
- Safe for: onboarding first steps, auth flows, legal screens, payment forms
- Prompt injection: *"Centered, symmetrical layout with generous breathing room. Avoid experimental compositions."*

**4–7 (Offset / Dynamic)**
- Overlapping elements, varied image aspect ratios, left-aligned headers over centered data
- Safe for: event discovery, personality results, profile screens
- Prompt injection: *"Asymmetric offsets — left-aligned headline over centered content, overlapping mascot illustration with text, varied card sizes."*

**8–10 (Experimental / Editorial)**
- Masonry grids, fractional CSS Grid units, massive empty zones, broken grids
- Safe for: marketing landing pages, campaign heroes, editorial content
- Prompt injection: *"Editorial layout — broken grid, massive whitespace zones, asymmetric composition, overlapping layers."*

### MOTION_INTENSITY — Animation depth

**1–3 (Static / Tactile only)**
- No automatic animations. Hover/active states only.
- Safe for: settings panels, data tables, admin dashboards, forms
- Prompt injection: *"Static design — no animated elements. Focus on clean states and tactile press feedback only."*

**4–7 (Fluid / Polished)**
- Smooth CSS transitions (200–300ms), subtle fade-ins, staggered list reveals
- Safe for: card lists, navigation, tab switches, modal entrances
- Prompt injection: *"Fluid motion — gentle fade-up entrances, smooth 250ms transitions between states, staggered list choreography."*

**8–10 (Cinematic / Choreographed)**
- Scroll-triggered reveals, parallax, complex entrance sequences
- Safe for: onboarding heroes, personality reveal, celebratory moments
- Prompt injection: *"Cinematic motion — scroll-triggered reveals, layered parallax, dramatic entrance choreography."*

### VISUAL_DENSITY — Information per viewport

**1–3 (Art Gallery / Airy)**
- Lots of whitespace, huge section gaps, minimal elements per screen
- Safe for: empty states, welcome screens, premium moments, first impressions
- Prompt injection: *"Art gallery spacing — massive whitespace, single focal point per viewport, everything feels expensive and unhurried."*

**4–7 (Daily App / Balanced)**
- Standard spacing for functional screens, readable information hierarchy
- Safe for: discovery feeds, event lists, profile views, settings
- Prompt injection: *"Balanced app density — comfortable padding, clear hierarchy, readable without feeling sparse or cramped."*

**8–10 (Cockpit / Dense)**
- Tiny paddings, data-rich, 1px separators, packed information
- Safe for: admin dashboards, analytics, data tables, advanced settings
- Prompt injection: *"Data-dense cockpit — minimal padding, 1px separators, information-rich, every pixel carries data."*

### Dial defaults by screen type

| Screen type | DESIGN_VARIANCE | MOTION_INTENSITY | VISUAL_DENSITY | Rationale |
|-------------|-----------------|------------------|----------------|-----------|
| Onboarding welcome | 6 | 7 | 3 | Editorial first impression, cinematic reveal, airy |
| Onboarding form | 2 | 3 | 5 | Predictable, static, balanced |
| Event discovery | 5 | 4 | 5 | Offset cards, fluid lists, balanced |
| Pool card | 4 | 3 | 6 | Consistent card rhythm, static, readable |
| Personality results | 7 | 8 | 3 | Asymmetric hero, cinematic reveal, gallery spacing |
| Profile view | 4 | 3 | 5 | Structured, static, balanced |
| Empty / loading | 5 | 5 | 2 | Centered mascot, gentle motion, very airy |
| Admin dashboard | 3 | 2 | 8 | Predictable grid, static, data-dense |
| Payment / checkout | 2 | 3 | 5 | Centered, static, balanced |

### How to inject dials into a prompt

After the screen-type template, append the dial paragraph:

```
Design direction dials (set these explicitly):
- Layout variance: [DESIGN_VARIANCE description from table above]
- Motion depth: [MOTION_INTENSITY description from table above]
- Visual density: [VISUAL_DENSITY description from table above]
```

**Example for personality results screen (variance 7, motion 8, density 3):**

```
Design direction dials:
- Layout variance: Editorial layout — broken grid, massive whitespace zones, asymmetric composition with the personality card as a dominant focal point.
- Motion depth: Cinematic motion — scroll-triggered reveals, layered parallax, dramatic entrance choreography for the archetype reveal moment.
- Visual density: Art gallery spacing — massive whitespace, single focal point per viewport, everything feels expensive and unhurried.
```

---

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

---

## Generation Budget Guidance

Stitch has a **350 generations/month** cap (Standard Mode). Use it wisely:

| Scenario | Recommended tool | Why |
|----------|-----------------|-----|
| Need 1–2 quick layout directions for a new screen | **Stitch** | Fastest exploration |
| Need brand illustration or mascot artwork | **Lovart** | Stitch cannot do 插画风低多边形 illustrations well |
| Need production pixel specs | **Figma** | Stitch is not pixel-precise |
| Need to iterate existing screen with minor tweaks | **Manual code** | Faster than regenerating in Stitch |
| Need multi-screen clickable prototype | **Stitch** | Prototype linking is a strength |

---

## Handoff Workflow: Stitch → Figma → Code

1. **Stitch exploration** — Generate 2–4 screen variations using brand-injected prompts
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

---

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

## Design Dials
- DESIGN_VARIANCE: [1–10] — [predictable / offset / experimental]
- MOTION_INTENSITY: [1–10] — [static / fluid / cinematic]
- VISUAL_DENSITY: [1–10] — [airy / balanced / dense]

## Prompt Draft
[Paste the Stitch-ready conversational prompt here]

## Export Plan
- Figma export: [Yes/No]
- Engineering handoff target: [apps/user-client/... or apps/mini-program/...]
```

---

## Limitations (do not workaround — respect them)

- **HTML/CSS output only** — No React, Vue, or Taro export. Do not attempt auto-conversion.
- **No design tokens** — Cannot manage component libraries natively. Use `DESIGN.md` as workaround.
- **No micro-interactions** — Cannot design hover effects, scroll behaviors, or animations. Use `wow-elements` for motion.
- **No native Taro components** — Stitch knows browser UI, not `View`/`Text`/`ScrollView`.
- **Generation variability** — Same prompt may produce different quality. Budget 2–3 iterations.
