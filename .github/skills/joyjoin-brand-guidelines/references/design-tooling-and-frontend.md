# Design Tooling & Frontend Excellence

## Design Tooling

JoyJoin's design-to-code pipeline uses three upstream tools:

| Tool | Role | Output |
|------|------|--------|
| **Stitch** | Rapid UI screen exploration, layout prototyping, clickable multi-screen flows | HTML/CSS + Figma export |
| **Lovart** | Brand illustrations, mascot artwork (插画风), marketing graphics, icon sets | PNG / SVG / MP4 assets |
| **Figma** | Production design handoff, pixel specs, responsive breakpoints, component states | Engineering specs |

**Workflow:** Stitch exploration → Figma refinement → Engineering implementation (React / Taro).

**Rules:**
- Stitch output is **exploratory reference only** — never production code
- Lovart output is **asset-only** — never UI layout or component logic
- Figma is the **production handoff surface** — engineering builds from Figma specs
- All three tools are governed by this brand skill and `design-system-governance`

## Motion Guidance

Motion should feel:
- gentle
- smooth
- premium
- restrained

Prefer soft easing, calm transitions, and polished reveals.
Avoid loud, bouncy, or distracting animation.

## Avoiding generic AI aesthetics

JoyJoin screens should be unmistakably JoyJoin. Generic "AI-generated" aesthetics dilute trust and brand identity.

**Patterns to actively avoid:**

| Generic pattern | Why it hurts JoyJoin | JoyJoin alternative |
|----------------|---------------------|---------------------|
| Purple gradient on plain white | Overused across every AI social product; no brand character | Warm Beige background, Vibrant Purple as a focused CTA accent |
| Uniform card grid with no hierarchy | Flat, interchangeable | One card that leads the eye; spacing rhythm that guides the user |
| `Inter` or `system-ui` on hero copy | Invisible, unmemorable | `font-cn-display` (AlimamaFangYuanTiVF) for the single emotional headline |
| Spring-bounce animations | Corporate delight, not warm delight | Soft ease-out, calm reveals ≤ 300ms |
| Symmetrical centered layouts everywhere | No spatial identity | Breathing asymmetry; generous leading space above the key moment |
| Mascots used as background decoration | Cheapens the illustration value | One mascot per screen, placed intentionally at the emotional peak |
| Status icons in isolation with no copy | Cold, system-feeling | Mascot or warm illustration + short contextual copy for key states |

**The design direction test:** Could this exact screen appear in a generic dating, fitness, or productivity app without modification? If yes, it is not distinctive enough for JoyJoin.

## Frontend Excellence Notes

### Platform Applicability

- Applies to both Web and Taro mini-program implementations whenever JoyJoin screens, components, or motion need to feel unmistakably on-brand.
- Brand intent should remain consistent across platforms even when the renderer, font availability, or interaction model differs.
- For shared interaction baselines use [`design-system-governance`](../design-system-governance/SKILL.md); this skill owns emotional tone, typography, colour language, and overall brand feel.

### UI/UX & Aesthetic Guidance

- Reference JoyJoin's semantic typography roles, core brand colours, and token-backed spacing or radius decisions before introducing any new visual treatment.
- Use semantic web elements for navigational and interactive structure, and map the same hierarchy to native Taro components for mini-program surfaces.
- Emotional quality is part of the implementation bar: loading, error, empty, confirmation, and celebratory states should feel warm, polished, and explicit rather than visually neutral placeholders.
- Interaction feedback should feel premium and immediate: pressed states, confirmation toasts, subtle reveal timing, and clear success or recovery messaging.

### Web-Specific Considerations

- Hover and focus-visible states should reinforce the brand without becoming decorative noise; cursor styles should match affordance exactly.
- Responsive behavior must preserve the same warmth and breathing room on small mobile widths before scaling up to larger screens.

### Taro-Specific Considerations

- Keep the same hierarchy, copy tone, and emotional feel with native Taro components even when typography or renderer capabilities differ.
- If a brand treatment depends on a browser-only effect, choose the closest native-feeling alternative instead of silently dropping the cue.

### Accessibility & Performance Notes

- Brand polish must still satisfy WCAG 2.1 AA contrast, focus visibility, readable copy sizing, and non-colour-only state indication.
- Ensure reduced-motion fallbacks preserve meaning, and defer to [`wow-elements`](../wow-elements/SKILL.md) for motion-specific implementation guidance.
