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

- Generating Lovart-ready prompts for mascot illustrations, UI mockups, or marketing graphics
- Converting product requirements into a standardized visual design brief
- Requesting brand-aligned icons, posters, or social media assets
- Handing off design artifacts from Lovart to frontend engineers
- Choosing between Lovart (illustration) vs Stitch (UI exploration) vs Figma (production specs)

## When NOT to use

- Coding UI components → `frontend-component-architecture`
- Design system tokens → `design-system-governance`
- Brand strategy changes → `joyjoin-brand-guidelines`
- Animation / motion → `wow-elements`
- API / server logic → `server-domain-architecture`

### Stitch vs Lovart

| Need | Tool |
|------|------|
| UI screen exploration, rapid prototyping | **Stitch** (`stitch-design-workflow`) |
| Brand illustrations, mascot artwork, marketing graphics | **Lovart** (this skill) |
| Production pixel specs, component libraries | **Figma** |

## Platform Overview

[Lovart](https://lovart.pro) is an AI Design Agent using a conversational ChatCanvas workflow. See [`references/platform-overview.md`](./references/platform-overview.md) for capability table and Pro-tier constraints.

## JoyJoin Brand Injection

Every Lovart brief must include brand parameters. See [`references/brand-injection.md`](./references/brand-injection.md) for:
- Full color system with exact hex codes
- Typography feel guidance
- Canonical 12-archetype mascot roster
- Visual tone checklist
- Mandatory illustration style vocabulary (插画风统一)

## Asset Type Prompt Templates

See [`references/prompt-templates.md`](./references/prompt-templates.md) for:
- Mascot / brand illustration template
- UI mockup / screen design template
- Marketing / social media template
- Icon / icon set template
- Prompt engineering best practices

## Output Format & Handoff

See [`references/output-handoff.md`](./references/output-handoff.md) for:
- Standard `lovart_brief.md` deliverable structure
- Asset storage conventions and naming
- Code reference guidance for frontend handoff
- Collaboration boundaries with related skills

## Quick examples

- **Mascot illustration brief:** Corgi archetype mascot, playful surprised pose, warm-beige background, soft line art, PNG transparent 800x800px 2x.
- **Marketing poster brief:** Event pool launch graphic, Vibrant Purple to Warm Coral gradient, minimal text overlay, brand font for headline, JPG 1200x1600px.

## Troubleshooting

**"Lovart output doesn't match JoyJoin brand tone"**
→ Re-inject brand parameters more explicitly. Add the visual tone checklist. Request "softer, warmer, more rounded."

**"Export format is wrong for mini-program"**
→ Mini-program has limited SVG support. Use PNG at 2x and 3x for icons. Check bundle size.

**"Mascot looks different from previous illustrations"**
→ Reference previous mascot descriptions. Include specific pose and expression instructions. Use Lovart's remix feature.

**"Text in Lovart output is illegible"**
→ For UI mockups, keep text minimal and overlay real text in code. For marketing, specify large headline size and high contrast.

## Review checklist

- [ ] All 8 brand colors referenced by exact hex code
- [ ] Mascot personality consistent with character guide
- [ ] Asset type matches one of the 4 templates
- [ ] Export format and dimensions specified
- [ ] Target platform stated
- [ ] File naming follows `lovart-{type}-{date}-v{N}.{ext}`
- [ ] Brief is conversational style for ChatCanvas
- [ ] Related skills noted for downstream handoffs
