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

## JoyJoin Brand Injection

Every Stitch prompt must include brand parameters. See [`references/brand-injection.md`](./references/brand-injection.md) for:
- Full color system with exact hex codes
- Typography feel guidance
- Canonical 12-archetype mascot roster
- Mandatory illustration style vocabulary (插画风统一)

## Handoff Workflow

See [`references/handoff-workflow.md`](./references/handoff-workflow.md) for:
- Generation budget guidance (350 generations/month cap)
- Stitch → Figma → Code workflow
- Figma MCP integration notes
- Standard `stitch_brief.md` output format

## Limitations (do not workaround — respect them)

- **HTML/CSS output only** — No React, Vue, or Taro export. Do not attempt auto-conversion.
- **No design tokens** — Cannot manage component libraries natively.
- **No micro-interactions** — Cannot design hover effects, scroll behaviors, or animations. Use `wow-elements` for motion.
- **No native Taro components** — Stitch knows browser UI, not `View`/`Text`/`ScrollView`.
- **Generation variability** — Same prompt may produce different quality. Budget 2–3 iterations.

## Troubleshooting

**"Stitch output doesn't match JoyJoin brand tone"**
→ Re-inject brand parameters more explicitly. Add the full color table and illustration style vocabulary to the prompt. Request "softer, warmer, more rounded."

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
