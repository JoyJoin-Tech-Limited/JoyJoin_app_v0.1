# Gen Z Device Baselines for Performance Audit

> Source: `docs/reference/perf.md`, `apps/mini-program/docs/DEVICE_QA_CHECKLIST.md`
> Rationale: Gen Z users in tier-1 Chinese cities do NOT use low-end devices.
> Optimize for the Primary tier. Degradation tier is fallback, not target.

## Primary Tier — Android (target)

| Attribute | Baseline |
|-----------|----------|
| RAM | 8GB+ (global avg 8.4GB; Huawei avg 12GB in China) |
| Display | 120Hz AMOLED |
| Network | 5G (65.9% national penetration; tier-1 cities have 5G-A at 131+ Mbps) |
| SoC | Snapdragon 7s Gen 2 / Dimensity 8200+ or better |
| OS | Android 12+ |
| WeChat | 8.0+ |

**Market share among under-24 users (QuestMobile Jun 2025):**
- vivo: 40.7%
- Xiaomi: 35.2%
- OPPO: 32.8%
- iPhone: ~25% among tier-1 city Gen Z (estimate; iOS consistently ~20–30% of premium segment in China)
- Gen Z upgrading to >3,000 yuan devices (+1.4% YoY)

**Representative Android devices to test on:**
- Xiaomi 13/14, Redmi K70 (Snapdragon 8 Gen 2/3, 8–12GB RAM)
- OPPO Reno 12/13, Find X7 (Dimensity 8200+/9300, 8–12GB RAM)
- vivo X100/S20 (Dimensity 9300, 8–12GB RAM)
- Huawei Pura 70/Mate 60 (Kirin 9000S, 12GB RAM)

## Primary Tier — iPhone (co-equal target)

iPhone is **not** a secondary platform. ~20–30% of tier-1 city Gen Z use iPhone, and they skew toward higher spending and higher engagement. iPhone mini-program behavior differs from Android in critical ways — treat it as a **distinct primary target** with its own baseline, not a footnote.

| Attribute | Baseline |
|-----------|----------|
| RAM | 6–8GB (iOS memory compression outperforms Android at equivalent GB) |
| Display | 60Hz (iPhone 15/Plus) or 120Hz ProMotion (Pro models) |
| Network | 5G (all iPhone 12+) |
| SoC | A16 Bionic (iPhone 15) / A18 (iPhone 16) — significantly faster single-core than Snapdragon 8 Gen 3 |
| OS | iOS 16+ (iPhone XR and newer) |
| WeChat | 8.0+ |
| WebView | WKWebView (NOT Chromium — different CSS rendering, compositing, and memory behavior) |

**Representative iPhones to test on:**
- iPhone 15 (A16, 6GB, 60Hz) — most common iPhone for Gen Z
- iPhone 16 Pro (A18 Pro, 8GB, 120Hz) — high-end baseline
- iPhone 14 (A15, 6GB, 60Hz) — still large installed base

**iPhone-specific gotchas (not found on Android):**
| Issue | Details |
|-------|---------|
| No `benchmarkLevel` | iOS WeChat does not expose `getSystemInfoSync().benchmarkLevel`. Active heuristic in `apps/mini-program/src/hooks/useDeviceTier.ts`: iPhone XR/XS/XS Max and iPhone SE 2/3 are primary; old iPhone X/8/7/6/6s/first-gen SE or iOS <15 are degradation. |
| WKWebView `backdrop-filter` | `backdrop-filter: blur()` is notoriously slow on WKWebView. Prefer opaque backgrounds + separate blur layer. |
| Safe area quirks | Dynamic Island + home indicator require `env(safe-area-inset-*)`. Test both portrait and landscape. |
| `position: fixed` + keyboard | WKWebView handles fixed positioning differently when keyboard is open. Use `adjustPosition={false}` + manual padding. |
| Canvas WebP | iOS Safari/WebView canvas support for WebP is newer. Always test canvas WebP rendering on iPhone; PNG fallback must work. |
| Haptic richness | iPhone Taptic Engine supports richer feedback than Android. Use `Taro.vibrateShort('light'/'medium'/'heavy')` — the 'heavy' type is iPhone-only. |
| Memory kills | iPhone mini-programs have a **stricter memory ceiling** (~300–500MB per mini-program) than Android. Canvas at high DPR is the #1 killer. |
| Font rendering | iOS renders CJK fonts differently (thinner, more letter-spacing). Test `font-weight` and `letter-spacing` on iPhone specifically. |

## Degradation Tier (fallback only)

| Attribute | Baseline |
|-----------|----------|
| RAM | 4–6GB |
| Display | 60Hz LCD |
| Network | 4G |
| SoC | Older MediaTek or budget Snapdragon |
| OS | Android 9–10 or older iOS |

**When Degradation tier matters:**
- Lower-tier cities with older device inventory
- Users who haven't upgraded in 3+ years
- WeChat 7.x users (declining share)

## Performance Budgets by Tier

| Metric | Primary | Degradation |
|--------|---------|-------------|
| TTI | ≤ 1.5s (p75, 5G) | ≤ 2.5s (p75, 4G) |
| Route transition | ≤ 600ms | ≤ 1s |
| JS Bundle (gzip) | ≤ 200KB | ≤ 150KB |
| FCP | ≤ 1.2s | ≤ 1.8s |
| LCP | ≤ 2.0s | ≤ 3.0s |
| CLS | ≤ 0.1 | ≤ 0.1 |

## Degradation Patterns (must exist for Primary-only features)

| Feature | Primary | Degradation fallback |
|---------|---------|---------------------|
| Staggered entrance animations | Full stagger, 120Hz smooth | Reduced stagger or instant reveal |
| Particle / shader effects | Full fidelity | Disabled or static replacement |
| Mascot intro animation | Animated WebP (~450–500 KB) | Static WebP (~10 KB) via `prefers-reduced-motion` |
| High-res images | WebP Q85, full size | WebP Q60, downscaled |
| Real-time WebSocket | Enabled | Polling fallback or deferred sync |
| Preload aggressive | Preload next 2–3 screens | Preload only next screen |

## Key Principle

> "Do not let the Degradation tier dictate the ceiling for the Primary tier."

Frontend work optimizes for Primary first. Degradation is a safety net, not a design constraint.
