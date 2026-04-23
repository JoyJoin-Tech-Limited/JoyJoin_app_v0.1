---
name: joyjoin-brand-guidelines
description: >
  Apply JoyJoin brand guidelines across UI, marketing, social, offline, and motion design. Use this
  skill when work must stay consistent with JoyJoin's visual identity, emotional tone, and brand
  system. Trigger phrases: "make this on-brand", "does this fit JoyJoin style?", "which colour
  should I use?", "is this too corporate?", "review this design for brand consistency".
license: See repository license information.
---

Use this skill for any JoyJoin design task that must follow the brand system clearly and consistently.

## Brand Essence

JoyJoin is an AI-powered social mini app for curated 4-6 person offline gatherings.
It should feel:
- warm
- friendly
- playful
- surprising
- premium but approachable

Core idea:
Not awkward chatting. Not random socializing. A carefully planned small-group gathering that feels like opening a surprise box.

## Brand Pillars

- **Authentic Connection** — real human interaction
- **Surprise Experience** — each gathering should feel fresh and delightful
- **Warm Socializing** — friendly, safe, emotionally welcoming

## Audience

Urban young adults looking for high-quality social experiences and real connection.

## Visual Tone

Design should feel:
- warm
- cute
- rounded
- soft
- lively
- minimal
- refined
- breathable

Avoid anything too corporate, cold, flashy, harsh, or overdesigned.

## Logo Guidance

The logo system centers on:
- a purple gift box
- three mascot characters: corgi, koala, turtle
- the idea of surprise + warm gathering

Use the correct logo variant for the context:
- full logo
- icon/logo mark only
- wordmark only
- horizontal lockup
- vertical lockup

Rules:
- keep clear space around the logo
- do not stretch, rotate, recolor, or decorate the logo
- do not place it on busy backgrounds that hurt legibility
- keep it readable at small sizes

## Color System

Use these exact core colors:

- **Vibrant Purple**: `#8B5CF6`
- **Warm Coral**: `#FF9B85`
- **Sky Blue**: `#A8C5DD`
- **Fresh Green**: `#9ACD32`
- **Warm Beige**: `#F5F1E8`
- **Soft White**: `#FFFFFF`
- **Medium Gray**: `#9CA3AF`
- **Dark Gray**: `#374151`

Color usage principles:
- purple is the main brand anchor
- use secondary colors as soft support, not visual noise
- keep saturation controlled
- preserve a premium, warm, friendly balance
- use exact HEX values for consistency

## Typography

JoyJoin uses a **three-role semantic typography system**. Every typographic decision maps to one of these roles.

### Official font roles

| Role | Tailwind class | CSS variable | Font (when loaded) | Fallback |
|------|---------------|--------------|-------------------|----------|
| **UI** | `font-ui` | `var(--font-ui)` | System Chinese stack | PingFang SC → Microsoft YaHei → system-ui |
| **Chinese display** | `font-cn-display` | `var(--font-cn-display)` | AlimamaFangYuanTiVF | PingFang SC → Microsoft YaHei → system-ui → sans-serif |
| **English brand** | `font-en-brand` | `var(--font-en-brand)` | Quicksand | Outfit → system-ui |

The legacy `.font-brand` CSS class is an alias for `font-cn-display` and is kept for backward compatibility.

### When to use each role

#### `font-ui` — invisible, reliable default
Use for everything dense and functional:
- form labels, input fields, helper text, legal text
- body copy and long-form reading
- settings pages and transactional flows
- utility buttons (save, cancel, retry, location)
- coupon input / payment screens

**Do not** apply a custom display font here.

#### `font-cn-display` — warm, expressive Chinese display layer
Use for short, high-impact emotional moments only:
- hero headlines and large greeting text (`HeroWelcome`)
- branded tab labels (`SlidingTabs`, `TabNavigation`, `TabsTrigger`)
- large full-screen write-ups and premium empty-state headlines
- celebratory / milestone / reveal moments
- high-emotion primary CTAs ("看看我会遇见谁", "去发现活动", guide stepper next/complete)

**Keep to short bursts** — do not apply to body copy or dense lists.

#### `font-en-brand` — Quicksand accent for English identity moments
Use only for:
- JoyJoin English wordmark ("JoyJoin" in `JoyJoinLogo`)
- English brand accent text in marketing/identity contexts
- premium numerals only where visually appropriate

**Do not** apply to all English text. Most English in the app should stay on `font-ui`.

### Taro / WeChat Mini Program notes

- **Web client:** `apps/user-client/src/assets/fonts/fonts.css` self-hosts **AlimamaFangYuanTiVF-Thin** via `@font-face` as the primary Chinese display font, with PingFang SC, Microsoft YaHei, `system-ui`, and `sans-serif` fallbacks.
- **WeChat Mini Program:** `apps/mini-program/src/lib/brandFont.ts` loads **AlimamaFangYuanTiVF-Thin** via `Taro.loadFontFace()` at app launch. The SCSS variable `$font-cn-display` references the same family name. This aligns the launch-primary surface with the web brand face.
- **Admin client:** No custom font is loaded; admin surfaces use the system Chinese stack for `font-cn-display`.
- Outfit, loaded via Google Fonts on the web client, acts as the effective `font-en-brand` fallback.
- WeChat Mini Program / WebView: avoid `backdrop-filter` and `hover:` states.

### Key design rules
- Do **not** apply custom display fonts globally or at the container level — only on the specific element.
- Typography should feel: rounded, friendly, soft, legible, polished.
- Do **not** mix `font-cn-display` and `font-en-brand` on the same Chinese-language surface.
- Body copy always uses `font-ui` regardless of visual context.

## Mascots & Illustration

JoyJoin's visual identity is built around **12 archetype animals** that map to the personality system's canonical archetypes (`packages/shared/src/personality/prototypes.ts`). These are the product-facing mascot roster:

| Archetype | Animal | Personality | Primary use |
|-----------|--------|-------------|-------------|
| 开心柯基 | **Corgi** | Warm, social, energetic | Celebration, onboarding welcome, action moments |
| 太阳鸡 | **Rooster** | Bright, confident, energetic | Morning events, leadership themes |
| 夸夸豚 | **Praise Dolphin** | Supportive, complimentary, warm | Social bonding, affirmation moments |
| 机智狐 | **Fox** | Clever, adaptable, strategic | Problem-solving, game nights |
| 淡定海豚 | **Calm Dolphin** | Steady, peaceful, balanced | Relaxation, mindfulness events |
| 织网蛛 | **Spider** | Intricate, connected, detailed | Networking, craft workshops |
| 暖心熊 | **Bear** | Warm, strong, protective | Trust moments, group hugs, winter themes |
| 灵感章鱼 | **Octopus** | Creative, multi-faceted, curious | Arts, brainstorming, multi-activity |
| 沉思猫头鹰 | **Owl** | Wise, contemplative, observant | Knowledge sharing, book clubs |
| 定心大象 | **Elephant** | Steady, reliable, grounding | Team building, reassurance |
| 稳如龟 | **Turtle** | Patient, persistent, thoughtful | Step-by-step progress, loading states |
| 隐身猫 | **Cat** | Independent, curious, adaptable | Solo activities, creative exploration |

**Not approved:** Koala and Hamster are **not** part of the canonical archetype system. Do not use them in product UI or canonical brand assets without explicit Product approval.

### Illustration style (插画风)

JoyJoin illustrations follow a consistent **2D low-poly geometric** style (插画风统一):

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic — built from polygonal facets and triangular planes
- **Textures:** Painterly, soft brushed feel within each polygonal facet — NOT flat vector or 3D render
- **Outlines:** Minimal or none — let facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, simplified features, warm expressions
- **Composition:** Circular vignettes for character portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette (earth tones, pastels, muted colors); brand purple #8B5CF6 for key elements only

**Style lock rules (画风统一):**
- Always 2D illustration — never 3D render or photorealism
- Always low-poly geometric construction
- Always painterly, textured rendering with soft brushed feel
- Always soft gradients within polygonal facets
- Always atmospheric textured backgrounds with grain
- Always circular vignettes for character portraits
- Always warm natural palette with controlled purple accent

**Do not:** use harsh contrasts, neon colors, pure black backgrounds, or photorealistic gloom.

This vocabulary is for **asset generation** (see `lovart-design-workflow`). Frontend implementation follows the canonical color token system and typography roles.

## UI / Layout Guidance

For product and interface design:
- use warm beige or soft light backgrounds
- prefer rounded cards and soft spacing
- keep layouts clean and breathable
- use purple for primary actions
- use mascots or brand graphics sparingly and intentionally
- keep interfaces premium, light, and welcoming

## Motion Guidance

Motion should feel:
- gentle
- smooth
- premium
- restrained

Prefer soft easing, calm transitions, and polished reveals.
Avoid loud, bouncy, or distracting animation.

## Do / Don’t

### Do
- keep the brand warm and human
- use rounded forms and soft spacing
- maintain a minimalist but friendly aesthetic
- let premium quality come from restraint and polish
- reinforce surprise, warmth, and connection

### Don’t
- make it look corporate or enterprise
- use harsh contrast or aggressive visual effects
- overuse colors or mascots
- make the design feel cold, lonely, or overly serious
- turn playfulness into childish clutter

## Avoiding generic AI aesthetics

JoyJoin screens should be unmistakably JoyJoin. Generic “AI-generated” aesthetics—the patterns that emerge when design intent is absent—dilute trust and brand identity.

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

## Output Standard

Every JoyJoin design output should feel:
- consistent with the brand system
- emotionally warm
- visually soft and polished
- simple but memorable
- premium, playful, and approachable

## Quick examples

**User says:** "Make this button feel more on-brand."
**Apply this skill by:** Checking the color system — primary actions use Vibrant Purple (`#8B5CF6`). Ensure the button uses rounded corners, soft spacing, and the brand font for any label text.
**Result:** Button feels warm, premium, and consistent with the JoyJoin identity.

---

**User says:** "Can I add a mascot to this empty-state screen?"
**Apply this skill by:** Choosing the mascot whose personality fits the moment (e.g. Koala for a calm/empty state). Keep the illustration soft-lined, cute but tasteful, and ensure it does not clutter the layout.
**Result:** Empty state feels emotionally welcoming without being noisy or childish.

## Design Tooling

JoyJoin's design-to-code pipeline uses three upstream tools, each with a distinct role:

| Tool | Role | Output |
|------|------|--------|
| **Stitch** | Rapid UI screen exploration, layout prototyping, clickable multi-screen flows | HTML/CSS + Figma export |
| **Lovart** | Brand illustrations, mascot artwork (插画风), marketing graphics, icon sets | PNG / SVG / MP4 assets |
| **Figma** | Production design handoff, pixel specs, responsive breakpoints, component states | Engineering specs |

**Workflow:** Stitch exploration → Figma refinement → Engineering implementation (React / Taro).

**Rules:**
- Stitch output is **exploratory reference only** — never production code
- Lovart output is **asset-only** — never UI layout or component logic
- Figma is the **production handoff surface** — engineering builds from Figma specs, not from Stitch or Lovart directly
- All three tools are governed by this brand skill and `design-system-governance`

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

## Troubleshooting

- **Looks too corporate or cold** — check whether background colour and typography are using warm tones. Replace stark white or dark-mode grays with Warm Beige or the `--background` token. Prefer rounded forms over sharp angles.
- **Too many colours or mascots in one view** — secondary colours should support, not compete. Reduce to purple as the anchor; demote other colours to accents only. Mascots should appear once per screen, intentionally.
- **Inconsistent typography** — check which role applies: `font-cn-display` for short emotional/display Chinese text, `font-en-brand` for English brand identity moments only, `font-ui` (or no explicit class) for everything else. Do not mix multiple display fonts on the same screen.
- **Motion feels loud or distracting** — review against motion guidance: transitions should be gentle, smooth, and restrained. Remove bouncy keyframes or aggressive fade speeds.

## Review checklist

- [ ] Primary action colour is Vibrant Purple; secondary colours are used as accents only
- [ ] Typography uses `font-cn-display` for Chinese identity/display moments; `font-en-brand` for English brand moments; `font-ui` (or no class) for body and dense UI; body copy is clean and legible
- [ ] Layout feels breathable — rounded corners, soft spacing, no harsh contrast
- [ ] Mascots or illustrations are used intentionally and only once per view
- [ ] Motion is gentle and premium — no loud or bouncy animations
- [ ] Design feels warm and premium, not corporate, cold, or cluttered
