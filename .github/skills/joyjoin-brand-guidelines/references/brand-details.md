# Brand Details

## Logo Guidance

The logo system centers on: a purple gift box, three mascot characters (corgi, koala, turtle), and the idea of surprise + warm gathering.

**Rules:**
- Maintain clear space around the logo (minimum 1× logo height on all sides)
- Do not stretch, rotate, or recolor the logo
- Avoid busy backgrounds behind the logo
- Keep readable at small sizes (favicon, app icon)

## Color System Details

**Core palette:**

| Token | HEX | Role |
|-------|-----|------|
| Vibrant Purple | `#8B5CF6` | Primary actions, brand anchor |
| Warm Coral | `#FF9B85` | Warm accents, highlights |
| Sky Blue | `#A8C5DD` | Secondary accents, calm moments |
| Fresh Green | `#9ACD32` | Positive states, success |
| Warm Beige | `#F5F1E8` | Primary backgrounds |
| Soft White | `#FFFFFF` | Cards, surfaces |
| Medium Gray | `#9CA3AF` | Placeholders, disabled |
| Dark Gray | `#374151` | Body text, headings |

**Principles:**
- Purple is the anchor; secondary colours are soft support
- Use exact HEX values; do not approximate
- Dark mode requires paired tokens in both app `index.css` files

## Voice and Tone

- **Warm** — speak like a friendly host, not a system admin
- **Playful** — light humour is welcome; never sarcastic or cold
- **Premium but approachable** — polished without being stiff
- **Surprising** — reward attention with small delightful phrasing
- **Inclusive** — "we" and "you" over impersonal directives

**Examples:**
- ✅ "Your group is ready — time to open the box!"
- ❌ "Event match complete. Proceed to registration."

## Typography Scale

See [`typography.md`](./typography.md) for the full three-role system, font loading, and Taro-specific notes.

Summary:
- `font-ui` — all dense functional UI
- `font-cn-display` — short emotional Chinese moments only
- `font-en-brand` — JoyJoin wordmark / English brand accent only

## Motion Principles

Motion should feel: gentle, smooth, premium, restrained.

- Prefer soft easing (`ease-out`, `cubic-bezier(0.25, 0.1, 0.25, 1)`)
- Keep transitions ≤ 300ms for UI feedback, ≤ 500ms for reveals
- Avoid bouncy or elastic keyframes
- Use opacity and transform over layout-triggering properties
- Provide reduced-motion fallbacks

## Offline Materials

- Maintain rounded forms and soft spacing in print
- Use Warm Beige backgrounds for handouts and signage
- One mascot per piece, placed at the emotional peak
- Keep typography hierarchy identical to digital: purple anchor, minimal secondary colours

## Social Media Rules

- Lead with warmth: mascot + short copy over plain screenshots
- Use Vibrant Purple for CTAs, Warm Beige for backgrounds
- Never crop or alter mascot proportions
- Maintain 8px / 8rpx spacing rhythm in social graphics

## Do / Don't Rationale

| Do | Don't | Why |
|---|---|---|
| Keep the brand warm and human | Make it look corporate or enterprise | JoyJoin is a social product; cold UI kills emotional safety |
| Use rounded forms and soft spacing | Use harsh contrast or aggressive effects | Softness signals approachability |
| Maintain minimalist but friendly aesthetic | Overuse colours or mascots | Restraint = premium; clutter = cheap |
| Let premium quality come from restraint | Make it feel cold, lonely, or overly serious | Loneliness is the problem JoyJoin solves |
| Reinforce surprise, warmth, and connection | Turn playfulness into childish clutter | Playful ≠ juvenile |

## Avoiding Generic AI Aesthetics

See [`design-tooling-and-frontend.md`](./design-tooling-and-frontend.md) for the full generic-patterns table and the design direction test.

Quick test: *Could this exact screen appear in a generic dating, fitness, or productivity app without modification?* If yes, it is not distinctive enough for JoyJoin.
