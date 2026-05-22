# JoyJoin Design System

> **Purpose:** Canonical design system reference for human designers, AI design tools (Stitch, Lovart), and frontend engineers. Keep this file in sync with `joyjoin-brand-guidelines` and `design-system-governance` skills.
> **Last updated:** 2026-04-22

---

## Brand Identity

**Name:** JoyJoin (悦聚)
**Tagline:** AI-powered curated offline gatherings for urban youth
**Core feeling:** Warm · Friendly · Playful · Surprising · Premium but approachable

**Brand pillars:**
- Authentic Connection — real human interaction
- Surprise Experience — every gathering feels fresh and delightful
- Warm Socializing — friendly, safe, emotionally welcoming

---

## Color System

Use these exact HEX values. Do not approximate.

| Token | Hex | Role |
|-------|-----|------|
| Vibrant Purple | `#8B5CF6` | Primary brand anchor, CTAs, key UI elements |
| Warm Coral | `#FF9B85` | Emotional peaks, celebration, highlights |
| Sky Blue | `#A8C5DD` | Calm states, secondary support, info surfaces |
| Fresh Green | `#9ACD32` | Success, positive signals, nature moments |
| Warm Beige | `#F5F1E8` | Page backgrounds, card surfaces, whitespace |
| Soft White | `#FFFFFF` | Text on dark, clean space, premium moments |
| Medium Gray | `#9CA3AF` | Borders, disabled states, secondary text |
| Dark Gray | `#374151` | Primary text, strong contrast |

**Usage principles:**
- Purple is the single brand anchor — use it as a focused accent, not scattered tints
- Secondary colors support; they do not compete
- Keep saturation controlled
- Preserve a premium, warm, friendly balance

---

## Typography

### Semantic roles

| Role | CSS variable | Font (when loaded) | Fallback | Use for |
|------|-------------|-------------------|----------|---------|
| UI | `--font-ui` | System Chinese stack | PingFang SC → Microsoft YaHei → system-ui | All dense/functional UI — forms, body, labels, legal |
| Chinese display | `--font-cn-display` | AlimamaFangYuanTiVF | PingFang SC → Microsoft YaHei → system-ui | Short high-impact Chinese moments — headlines, tabs, CTAs |
| English brand | `--font-en-brand` | Quicksand | Outfit → system-ui | JoyJoin wordmark, English brand accent only |

**Key rules:**
- Do not apply display fonts globally — only on the specific element
- Do not mix `font-cn-display` and `font-en-brand` on the same Chinese surface
- Body copy always uses `font-ui`

### Platform notes

- **Web (user-client):** Self-hosts AlimamaFangYuanTiVF-Thin via `@font-face` in `apps/user-client/src/assets/fonts/fonts.css`
- **Mini-program:** Loads AlimamaFangYuanTiVF-Thin via `Taro.loadFontFace()` in `apps/mini-program/src/lib/utils/brandFont.ts`
- **Admin client:** Uses system fonts only (no custom font loading)

---

## Spacing Scale

### Web (px)

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 48px |

### Mini-program (rpx)

| Token | Value |
|-------|-------|
| xs | 8rpx |
| sm | 16rpx |
| md | 24rpx |
| lg | 40rpx |
| xl | 60rpx |
| 2xl | 80rpx |

**Container padding:** 20px (web) / 40rpx (mini-program)
**Grid gap:** 15px (web) / 30rpx (mini-program)

---

## Component Primitives

### Button

| Variant | Background | Text | Border | Shadow |
|---------|-----------|------|--------|--------|
| Primary (default) | `--btn-primary-gradient` (warm purple) | White | None | `--btn-shadow-primary` |
| Secondary | `hsl(var(--secondary))` | `hsl(var(--secondary-foreground))` | None | None |
| Outline | Transparent | `hsl(var(--primary))` | `var(--primary-border)` | None |
| Ghost | Transparent | `hsl(var(--foreground))` | None | None |
| Destructive | `hsl(var(--destructive))` | `hsl(var(--destructive-foreground))` | None | None |

**Sizes:** `sm` (32px h), `default` (36px h), `lg` (44px h), `icon` (square)
**Radius:** `rounded-xl` (12px) for default, `rounded-md` (6px) for compact

### Card

- Background: Warm Beige `#F5F1E8` or Soft White `#FFFFFF`
- Radius: 16–24px (web), 32rpx (mini-program)
- Shadow: subtle, warm-tinted (`rgba(168, 85, 247, 0.15)`)
- Padding: generous internal spacing

### Input

- Background: Soft White `#FFFFFF` on Warm Beige `#F5F1E8` page
- Border: Medium Gray `#9CA3AF`, 1px
- Focus ring: `--ring` token (warm purple)
- Radius: 12px

---

## Archetype Mascot Roster (Canonical 12)

These animals map to the personality system's 12 archetypes.

| Archetype | Animal | Personality | Color hint |
|-----------|--------|-------------|------------|
| 开心柯基 | Corgi | Playful, energetic, optimistic | Warm gold |
| 太阳鸡 | Rooster | Bright, confident, energetic | Sunny yellow |
| 夸夸仓鼠 | Supportive Hamster | Supportive, complimentary, warm | Pink |
| 机智狐 | Fox | Clever, adaptable, strategic | Orange |
| 机灵海豚 | Perceptive Dolphin | Steady, perceptive, balanced | Cyan |
| 织网蛛 | Spider | Intricate, connected, detailed | Purple |
| 树洞考拉 | Warm Koala | Warm, empathetic, protective | Rose |
| 灵感章鱼 | Octopus | Creative, multi-faceted, curious | Lavender |
| 沉思猫头鹰 | Owl | Wise, contemplative, observant | Blue |
| 定心大象 | Elephant | Steady, reliable, grounding | Slate |
| 稳如龟 | Turtle | Patient, persistent, thoughtful | Olive |
| 隐身猫 | Cat | Independent, curious, adaptable | Coral |

**Not approved:** Koala, Hamster (not in canonical archetype system).

---

## Illustration Style (插画风)

**Style lock (画风统一):**

- **Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic
- **Textures:** Painterly, soft brushed feel within each polygonal facet
- **Outlines:** Minimal or none — facet edges define form
- **Gradients:** Soft color variation within individual facets, not global gradients
- **Backgrounds:** Atmospheric textured washes with subtle grain/noise
- **Characters:** Geometric polygonal bodies, large expressive glossy eyes, warm expressions
- **Composition:** Circular vignettes for portraits, centered subjects, generous negative space
- **Color treatment:** Natural warm palette (earth tones, pastels, muted colors); brand purple #8B5CF6 for key elements only

**Always:** 2D illustration, low-poly geometric, painterly textures, soft gradients within facets, atmospheric grain, circular vignettes, warm palette.

**Never:** 3D render, photorealism, harsh contrasts, neon, pure black backgrounds, flat vector without texture.

---

## Platform Constraints

### Web (user-client)
- React 18 + Vite + Tailwind CSS
- Self-hosted fonts via `@font-face`
- Hover and `:focus-visible` states supported
- Responsive: mobile-first, scales to desktop

### WeChat Mini Program (mini-program)
- Taro 4.2 + React 18
- Fonts loaded via `Taro.loadFontFace()`
- No `backdrop-filter`, no CSS `:hover` states
- Use `hoverClass` for pressed states
- Animations: `transform` and `opacity` only
- Bundle size awareness — subpackage large assets

### Admin client
- React 18 + Vite + Tailwind CSS
- Functional, minimal brand expression
- No custom fonts loaded

---

## Design Tooling

| Tool | Purpose | Output |
|------|---------|--------|
| **Stitch** | Rapid UI screen exploration, layout prototyping | HTML/CSS + Figma export |
| **Lovart** | Brand illustrations, mascot artwork, marketing graphics | PNG/SVG/MP4 assets |
| **Figma** | Production design handoff, pixel specs, component libraries | Specs for engineering |
| **Engineering** | Production implementation | React / Taro code |

**Workflow:** Stitch exploration → Figma refinement → Engineering implementation.

---

## Anti-Generic AI Aesthetics

Patterns to actively avoid in JoyJoin designs:

| Generic pattern | JoyJoin alternative |
|----------------|---------------------|
| Purple gradient on plain white | Warm Beige background, Vibrant Purple as focused CTA accent |
| Uniform card grid with no hierarchy | One card leads the eye; spacing rhythm guides the user |
| `Inter` or `system-ui` on hero copy | `font-cn-display` (AlimamaFangYuanTiVF) for the single emotional headline |
| Spring-bounce animations | Soft ease-out, calm reveals ≤ 300ms |
| Symmetrical centered layouts everywhere | Breathing asymmetry; generous leading space above the key moment |
| Mascots used as background decoration | One mascot per screen, placed intentionally at the emotional peak |
| Status icons in isolation with no copy | Mascot or warm illustration + short contextual copy |

**The design direction test:** Could this exact screen appear in a generic dating, fitness, or productivity app without modification? If yes, it is not distinctive enough for JoyJoin.
