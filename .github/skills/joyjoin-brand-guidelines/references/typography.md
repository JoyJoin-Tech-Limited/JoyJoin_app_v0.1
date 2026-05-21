# Typography

JoyJoin uses a **three-role semantic typography system**. Every typographic decision maps to one of these roles.

## Official font roles

| Role | Tailwind class | CSS variable | Font (when loaded) | Fallback |
|------|---------------|--------------|-------------------|----------|
| **UI** | `font-ui` | `var(--font-ui)` | System Chinese stack | PingFang SC → Microsoft YaHei → system-ui |
| **Chinese display** | `font-cn-display` | `var(--font-cn-display)` | AlimamaFangYuanTiVF | PingFang SC → Microsoft YaHei → system-ui → sans-serif |
| **English brand** | `font-en-brand` | `var(--font-en-brand)` | Quicksand | Outfit → system-ui |

The legacy `.font-brand` CSS class is an alias for `font-cn-display` and is kept for backward compatibility.

## When to use each role

### `font-ui` — invisible, reliable default
Use for everything dense and functional:
- form labels, input fields, helper text, legal text
- body copy and long-form reading
- settings pages and transactional flows
- utility buttons (save, cancel, retry, location)
- coupon input / payment screens

**Do not** apply a custom display font here.

### `font-cn-display` — warm, expressive Chinese display layer
Use for short, high-impact emotional moments only:
- hero headlines and large greeting text (`HeroWelcome`)
- branded tab labels (`SlidingTabs`, `TabNavigation`, `TabsTrigger`)
- large full-screen write-ups and premium empty-state headlines
- celebratory / milestone / reveal moments
- high-emotion primary CTAs

**Keep to short bursts** — do not apply to body copy or dense lists.

### `font-en-brand` — Quicksand accent for English identity moments
Use only for:
- JoyJoin English wordmark ("JoyJoin" in `JoyJoinLogo`)
- English brand accent text in marketing/identity contexts
- premium numerals only where visually appropriate

**Do not** apply to all English text. Most English in the app should stay on `font-ui`.

## Taro / WeChat Mini Program notes

- **Web client:** `apps/user-client/src/assets/fonts/fonts.css` self-hosts **AlimamaFangYuanTiVF-Thin** via `@font-face`.
- **WeChat Mini Program:** `apps/mini-program/src/lib/utils/brandFont.ts` loads **AlimamaFangYuanTiVF-Thin** via `Taro.loadFontFace()`. It is triggered deferred in `app.ts` (100ms after launch) and eagerly on `LandingPage.tsx` mount so returning users who bypass the landing page still receive the font. The SCSS variable `$font-cn-display` references the same family name.
- **Admin client:** No custom font is loaded; admin surfaces use the system Chinese stack for `font-cn-display`.
- Outfit, loaded via Google Fonts on the web client, acts as the effective `font-en-brand` fallback.
- WeChat Mini Program / WebView: avoid `backdrop-filter` and `hover:` states.

## Key design rules

- Do **not** apply custom display fonts globally or at the container level — only on the specific element.
- Typography should feel: rounded, friendly, soft, legible, polished.
- Do **not** mix `font-cn-display` and `font-en-brand` on the same Chinese-language surface.
- Body copy always uses `font-ui` regardless of visual context.
