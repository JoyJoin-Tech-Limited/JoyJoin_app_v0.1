# Handoff Workflow: Stitch → Figma → Code

## Budgeting

Stitch has a **350 generations/month** cap (Standard Mode). Use it wisely:

| Scenario | Recommended tool | Why |
|----------|-----------------|-----|
| Need 1–2 quick layout directions for a new screen | **Stitch** | Fastest exploration |
| Need brand illustration or mascot artwork | **Lovart** | Stitch cannot do 插画风低多边形 illustrations well |
| Need production pixel specs | **Figma** | Stitch is not pixel-precise |
| Need to iterate existing screen with minor tweaks | **Manual code** | Faster than regenerating in Stitch |
| Need multi-screen clickable prototype | **Stitch** | Prototype linking is a strength |

## Workflow

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

## Output Format

Every Stitch design task should produce a brief:

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
