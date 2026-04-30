---
name: stitch-design-workflow
description: >
  Brand-governed rapid UI design exploration using Google Stitch. Every prompt is
  pre-processed through JoyJoin brand constraints before generation. Output is
  exploratory only — production implementation follows existing design-system and
  frontend skills. Triggers: "Stitch design", "generate UI mockup", "Stitch screen",
  "design exploration", "rapid prototype with Stitch".
---
# Stitch Design Workflow
**Core rule:** Stitch is a **design exploration** tool, not a code generator. Every prompt is wrapped with JoyJoin brand constraints before sending to Stitch. Output is HTML/CSS reference only — production code is hand-written following `design-system-governance` and `mini-program-frontend-excellence`.
## When to use this skill
- Rapidly exploring 3–5 UI screen directions before committing to Figma
- Generating reference mockups for new user flows
- Creating visual pitch materials for stakeholders
- Validating layout ideas before engineering scoping
- Producing empty-state or loading-state screen concepts
## When NOT to use this skill
- Generating production-ready React/Taro code (Stitch outputs HTML/CSS only)
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
## JoyJoin Brand Injection (mandatory)
Every Stitch prompt must include:
- **Color system** — 8 brand hex codes (see [`references/prompt-framework.md`](./references/prompt-framework.md))
- **Typography feel** — Chinese display, English brand, system UI descriptors
- **Archetype mascot** — canonical 12 only (no Koala or Hamster)
- **Illustration style** — 插画风 low-poly geometric faceted aesthetic
## Configurable Design Dials
Set three dials at the top of every brief:
| Dial | Range | Default | Controls |
|------|-------|---------|----------|
| **DESIGN_VARIANCE** | 1–10 | 5 | Layout experimentation |
| **MOTION_INTENSITY** | 1–10 | 4 | Animation depth |
| **VISUAL_DENSITY** | 1–10 | 5 | Information per viewport |
See [`references/prompt-framework.md`](./references/prompt-framework.md) for level descriptions, dial defaults by screen type, and injection syntax.
## Troubleshooting
- **"Output doesn't match brand tone"** → Re-inject brand parameters more explicitly. Add full color table and illustration vocabulary. Request "softer, warmer, more rounded."
- **"Generated a non-canonical mascot"** → Reject and regenerate with the 12-archetype roster explicitly listed.
- **"Uses purple gradient on white"** → This is the generic AI aesthetic. Regenerate with "Warm Beige #F5F1E8 background, Vibrant Purple #8B5CF6 used sparingly as focused CTA accent only."
## Review checklist
- [ ] All 8 brand colors referenced by exact hex code in the prompt
- [ ] Archetype mascot is from the canonical 12
- [ ] Illustration style vocabulary (插画风) injected for screens with artwork
- [ ] Platform context (mobile web / mini-program) stated
- [ ] Design dials set explicitly with rationale
- [ ] Prompt is conversational, not mechanical — suitable for Stitch's AI
- [ ] Export plan includes Figma for production-ready screens
- [ ] Handoff target workspace (user-client / mini-program) is identified
- [ ] Generation budget considered — warrants Stitch vs. Lovart vs. manual
## Quick examples
**Exploring a new pool discovery screen:**
1. Set dials: variance 6, motion 5, density 6
2. Inject brand: Warm Beige #F5F1E8 background, Vibrant Purple #8B5CF6 CTA, rounded Chinese display font
3. Inject mascot: 灵感章鱼 (Octopus), creative and curious
4. Inject style: 插画风 low-poly geometric faceted, generous negative space
5. Generate 3 variations, pick best, export to Figma
**Result:** Exploratory mockups that map cleanly to `mini-program-frontend-excellence` implementation.
**Generating a loading-state concept:**
1. Set dials: variance 4, motion 8, density 2
2. Inject brand: soft white background, single mascot illustration, hopeful copy line
3. Keep platform constraint: mini-program safe (no backdrop-filter)
4. Generate 2 variations, pick best, export to Figma
**Result:** A brand-aligned loading concept ready for engineering handoff with token-mapped colors.
## Related skills
- `lovart-design-workflow` — Need brand illustrations, mascot artwork, or marketing graphics
- `design-system-governance` — Generated screen needs to map to CSS tokens or CVA variants
- `frontend-component-architecture` — Task requires deciding workspace placement for new components
- `mini-program-frontend-excellence` — Screen targets WeChat Mini Program
- `wow-elements` — Screen needs motion, micro-interactions, or emotional polish
- `joyjoin-brand-guidelines` — Brand strategy, color expansion, or mascot roster changes
- `platform-coordination-protocol` — Feature needs both web and mini-program implementation
