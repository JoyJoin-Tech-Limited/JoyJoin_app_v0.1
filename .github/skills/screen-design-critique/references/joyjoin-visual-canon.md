# JoyJoin Visual Canon — the design law a critique cites

The "what to never do" compendium for JoyJoin surfaces. Each law names its owning skill or doc — **cite, don't re-derive**: if a law's owner already produced findings, quote them as evidence rather than duplicating the audit.

## Hard laws (P0 when broken)

| Law | Rule | Owner / source |
|---|---|---|
| CTA solidity | CTAs use solid `$color-primary` #8B5CF6 — **no gradient**. The 2026-05-23 purge stays purged; gradient reads as AI-generated. | `mini-program-frontend-excellence`, AGENTS.md §6 |
| Disabled re-assertion | Keep the native `disabled` attribute for interactivity, but **re-assert colour from an ancestor selector** — WeChat/Taro inject `button[disabled]` colours that outrank any single-class override (0,1,1 vs higher). Render-caught 2026-10-16: ✓ 已评价 sat white-on-white invisible. | `mini-program-frontend-excellence`, AGENTS.md §6 |
| Emoji ban | No inline emoji in mini-program TS/TSX primary copy (CI-guarded). Use `JoyJoinIcon` (local webp → CDN → emoji fallback chain) or text. | `joyjoin-brand-guidelines`, guardrails §7 |
| Zero-emoji primary copy | Question/primary copy never carries emojis that dilute seriousness — chips and meta are not exempt from judgment. | `ui-layout-audit` |
| WeChat copy posture | Visible copy uses event-booking vocabulary (排桌中/排桌完成/合拍度/活动画像/轮桌畅聊) — never 匹配/社交/灵魂/撮合/AI. Machine identifiers are exempt. | `docs/runbooks/wechat-review-submission.md` |
| AIGC badge fail-closed | 角标 render only when content was actually AI-generated — a fabricated badge is a WeChat rejection risk. | AGENTS.md §6 |
| Zero-scroll viewport | 100dvh shell (+ `100vh` fallback), no document/page scroll, ScrollView children use `@include scroll-view-centered-state` for loading/empty/error. | `viewport-zero-scroll` |
| State completeness | Loading / empty / error render full, centred, on-brand surfaces — never a blank screen or raw spinner on a tab page. | AGENTS.md §6, `frontend-design-audit` Step 0 |
| Class A render defects | Overlap, overflow, clipping, occlusion outside the benign-overlay rule = automatic P0 regardless of everything else. | `frontend-design-audit` visual-correctness gate |

## Rhythm laws (P1 when broken)

| Law | Rule | Owner / source |
|---|---|---|
| 8rpx rhythm | Spacing in {8, 16, 24, 40, 64, 96}rpx (`$spacing-xs`…`$spacing-2xl`). Default inter-section gap 24rpx (white-card pairs 16rpx); card padding 40rpx standard / 24rpx compact. | `ui-layout-audit` |
| Multiplier rule | Related elements gap `g` → next group gap ≥ `2g`. Uniform gaps flatten hierarchy. | `ui-layout-audit` |
| One-emphasis-zone | Exactly one primary emphasis zone per view; brand purple is spent on the primary action, not decoration. | this skill, dim 1 |
| Three type levels | Display / title / body-meta — no more, no fewer on a typical screen. | this skill, dim 4 |
| WXSS constraints | No `min()`/`max()`/`clamp()` in WXSS (rpx + media queries); no 40rpx+ gaps without structural purpose; `ResponsiveSpacer` heightRpx in [12, 48]. | `ui-layout-audit`, `wow-elements` |
| Material alphas | Icebreaker scrims {0.45 sheet, 0.55 ritual}; accent alphas {0.08 fill, 0.12 shadow, 0.32 border}; no new `font-size: 18|26|30rpx` literals in `pages/icebreaker-session/**`. | `check-icebreaker-visuals.mjs` ratchet |
| Hit targets | Tappable ≥ 88rpx tall; icon-only actions need labels or a11y text. | `mini-program-frontend-excellence` |

## Platform survival laws (P0/P1)

| Law | Rule | Owner / source |
|---|---|---|
| Subpackage style ownership | A component only a subpackage page renders must `@use` its SCSS into the consuming page WXSS (no side-effect `import './X.scss'` in TSX) — otherwise styles silently vanish on device while H5 looks fine. | `verify-subpackage-styles` gate, AGENTS.md §7 |
| Swipe-back flag recovery | Pages resetting `isExiting`/`isSubmitting` must clear them in `useDidShow` (`useResetOnShow`) — surviving flags freeze CTAs on swipe-back. | AGENTS.md §6 |
| ScrollView scrollTo | `Taro.pageScrollTo` fails inside ScrollView — use `scrollIntoView` with element ids. | AGENTS.md §6 |
| tabBar validation | `switchTab` targets must exist in `tabBar.list` even with `custom: true`; `centerHub` needs a non-empty iconPath. | AGENTS.md §6 |
| Bundled asset allow-list | New bundled asset directories need a `packOptions.include` regexp or miniprogram-ci silently drops them from the upload. | AGENTS.md §6 |

## Judgment references (P1/P2 guidance)

- **Emotional depth** — a screen can be token-correct and emotionally vacant. 归属感 / 身份认同 sub-scores from `docs/reference/emotional-value-rubric.md` override surface-level brand scores; low emotional value caps the Brand Consistency dimension at `minor issue` even when tokens are perfect.
- **Delight budget** — motion and ornament must earn their place: accessibility and performance are hard constraints (`wow-elements`). Never prescribe motion for its own sake.
- **Honest states** — never fabricate content to fill a surface (the console-truth philosophy applied to UI): collapsed approximate beats invented precise (Quiet Concierge).
- **Read like a treat** — the composite bar: spacing rhythm + type levels + contrast + copy posture all pass and the screen still feels tiring → it fails the composite even when no single law breaks. Log as P2 with the specific tiring element named.
