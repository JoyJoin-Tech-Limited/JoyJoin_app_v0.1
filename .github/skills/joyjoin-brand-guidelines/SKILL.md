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
| **Chinese display** | `font-cn-display` | `var(--font-cn-display)` | AlibabaPuHuiTi-3 | PingFang SC → Microsoft YaHei → system-ui |
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

- Font loading via self-hosted TTF files is already active in the web client (see `apps/user-client/src/assets/fonts/fonts.css`). AlibabaPuHuiTi-3 (`@font-face`) is the primary Chinese display font; it falls back to system Chinese (PingFang SC, Microsoft YaHei) if not available.
- Outfit (loaded via Google Fonts) acts as the effective `font-en-brand` fallback.
- WeChat Mini Program / WebView: avoid `backdrop-filter`, `hover:` states, and loading many font weights.
- Self-hosted fonts in mini programs must be uploaded as CDN assets, not bundled inline.

### Key design rules
- Do **not** apply custom display fonts globally or at the container level — only on the specific element.
- Typography should feel: rounded, friendly, soft, legible, polished.
- Do **not** mix `font-cn-display` and `font-en-brand` on the same Chinese-language surface.
- Body copy always uses `font-ui` regardless of visual context.

## Mascots & Illustration

The three mascots express the brand personality:

- **Corgi** — warm, social, energetic
- **Koala** — gentle, healing, empathetic
- **Turtle** — steady, thoughtful, reliable

Illustration style should be:
- rounded
- soft-lined
- cute but tasteful
- emotionally positive
- never chaotic or childish

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
