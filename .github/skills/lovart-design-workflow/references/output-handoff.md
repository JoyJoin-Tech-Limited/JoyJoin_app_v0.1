# Output Format & Handoff

## Standard deliverable: `lovart_brief.md`

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

## Asset storage conventions

| Platform | Storage path | Notes |
|----------|-------------|-------|
| Web (user-client) | `apps/user-client/src/assets/lovart/` | Import via Vite asset pipeline |
| Web (admin-client) | `apps/admin-client/src/assets/lovart/` | Rarely needed; admin is functional |
| Mini-program | `apps/mini-program/src/assets/lovart/` | Watch bundle size; use subpackages for large assets |
| Shared | `packages/shared/src/assets/lovart/` | Only for assets used by multiple apps |

## Naming convention

```
lovart-{asset-type}-{YYYYMMDD}-v{N}.{ext}

Examples:
lovart-mascot-corgi-welcome-20260422-v1.png
lovart-mockup-onboarding-setup-20260422-v1.png
lovart-poster-spring-event-20260422-v1.jpg
lovart-icons-tab-bar-20260422-v1.svg
```

## Code reference guidance

When handing off to a frontend engineer, include:
- Exact import path
- Recommended lazy-loading strategy (`React.lazy` for web, subpackage config for mini-program)
- Accessibility: `alt` text description, `aria-label` if icon-only
- Responsive: whether multiple resolutions are needed

## Collaboration boundaries

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
