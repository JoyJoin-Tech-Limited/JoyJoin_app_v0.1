---
name: mini-program-frontend-excellence
description: >
  Deliver premium, JoyJoin-native UI in apps/mini-program using Taro-native primitives,
  brand-aligned hierarchy, complete state design, and mini-program-safe performance discipline.
  Enforces pixel-precision when specs exist (match exactly; ≤1px effective deviation only with
  documented exception) and strict 8rpx spacing rhythm when they do not. Two-tier: Routine changes
  use a 5-point quick check; Full changes require WeChat DevTools inspection before merge.
  Use when implementing or refining Taro pages/components, raising a screen above generic
  "cheap mini-program" quality, or reviewing whether a mini-program UI feels native-quality.
  Trigger phrases: "mini-program UI", "Taro page", "make this feel premium", "native-quality
  mini-program", "cheap mini-program feel", "improve mini-program empty state", "pixel perfect",
  "match Figma", "rpx spacing", "WeChat DevTools".
---

# Mini-Program Frontend Excellence

**Core rule:** JoyJoin mini-program UI must feel unmistakably JoyJoin and operationally native. Do not ship browser ideas squeezed into Taro, and do not ship low-effort UI that merely "works".

## Speed tiering — which rules apply?

**Routine** (typos, copy, color tweaks, padding nudges, icon swaps): quick check below; DevTools recommended.
**Full** (new screens, components, layout changes, visual redesign): full checklist; DevTools **mandatory**.
When in doubt, treat as Full. A padding change that affects visual hierarchy = Full.

## Routine dev quick check (60 seconds)

1. [ ] Spacing consistent with sibling screens? (eyeball)
2. [ ] Color from token, not hex literal?
3. [ ] No browser-only APIs (`window.*`, DOM measurement); viewport follows `viewport-zero-scroll` (`100dvh` + `100vh` fallback, never `vw`)?
4. [ ] Press/hover feedback on interactive elements?
5. [ ] Layout on smallest target device?

## When to use this skill

- Implementing or refining UI in `apps/mini-program`
- Translating web product intent into Taro-native UI
- Raising the quality bar on a screen that feels generic, cheap, or off-brand
- Reviewing whether a mini-program interaction feels premium, tactile, and complete

## Pixel precision

**Read [`references/pixel-precision.md`](references/pixel-precision.md) before shipping or approving Full-tier UI changes.**

- **Spec present** — Match measurements **exactly** (≤1px effective error only with documented exception + design sign-off).
- **No spec** — Primary spacing on **multiples of 8rpx**; 4rpx only for hairlines/optical tweaks (comment why).
- **DevTools** — Mandatory for Full tier: verify computed layout/typography on changed screens. CI cannot replace DevTools.

## Taro framework

Deep reference: [`references/taro-ui-framework.md`](references/taro-ui-framework.md). Workflow: [`references/implementation-guide.md`](references/implementation-guide.md).

- **Components:** `View`, `Text`, `Image`, `ScrollView` from `@tarojs/components`; `RichText` for rich content. Never `dangerouslySetInnerHTML`.
- **Styling:** Sass/SCSS, BEM class names, `rpx` units. `1rpx`/`1px` hairlines are the only `px` exceptions; no `vw`; viewport height follows `viewport-zero-scroll` (`100dvh` + `100vh` fallback).
- **Performance:** `VirtualList` at the canonical thresholds (~60 rich cards / 100 lightweight rows — [`frontend-excellence-thresholds.md`](../design-system-governance/references/frontend-excellence-thresholds.md)); `CustomWrapper` only when profiled; animate only `transform` + `opacity`.
- **CI gates:** `npm run guardrails` (inline-emoji ban, BEM class coverage) and `npm run design:audit:changed` before merge. Full list: `references/taro-ui-framework.md` §9.
- **Recurring traps:** page-stack flags (`useResetOnShow`), hooks above early returns, `ScrollView scrollIntoView` vs `Taro.pageScrollTo` (no-op inside ScrollView), disabled-CTA platform colour, `packOptions.include` allow-list — see `AGENTS.md` §6 and [`docs/agent-context/mini-program-patterns.md`](../../../docs/agent-context/mini-program-patterns.md).

## Copy posture (WeChat review)

- Visible copy uses event-booking vocabulary (排桌中/排桌完成/合拍度/活动画像/轮桌畅聊); never 匹配/社交/灵魂/撮合/AI. No inline emoji in TS/TSX — use `JoyJoinIcon` or CSS/text. AIGC 角标 render only when content was actually AI-generated (fail-closed).

## Quick examples

- **New screen:** classify scope → design direction → Taro-native structure → full state matrix → polish → Full checklist.
- **Loading/empty:** shape skeleton `View` nodes to the content layout (`{loading ? <Skeleton /> : <Content />}`); empty states get a Xiaoyue illustration + warm copy + CTA, not bare text.

## Troubleshooting

- **Screen feels like a cheap template** — reduce repetitive card patterns, create one focal hierarchy, remove decorative gradients that don't support the flow.
- **Looks on-brand on web but flat in mini-program** — rework spacing, copy rhythm, and pressed-state feedback using native Taro primitives instead of mimicking browser-only effects.
- **Polished interaction janks on device** — cut layout-triggering animation, compress assets, simplify to `transform` and `opacity` only.
- **Spec asks for something off-brand, or CSS-in-JS is proposed** — name the exact conflict (colour, font, motion, mascot use, density) and flag before implementation; default to existing repo Taro styling patterns.
- **Chinese text breaks awkwardly** — never use `overflow-wrap: anywhere` on CJK display text (produces 孤字). Default `overflow-wrap: normal` is correct.
- **Pill/tag floats high or low next to a title** — R2 baseline trap: an `inline-flex` sibling aligns on its own text baseline, and WeChat `<Text>` is inline. Wrap the pair in `display: flex; align-items: center`, or stack via `flex-direction: column`. See `references/taro-ui-framework.md` §WXSS layout semantics (L1–L5).
- **Entrance animations feel generic** — use `cubic-bezier(0.22, 1, 0.36, 1)`. Reserve `ease-out`/`ease-in-out` for loops only.
- **Component looks styled in H5 / DevTools but unstyled on device** — Taro may have chunked its SCSS into the subpackage's `sub-common.wxss`, which WeChat never loads. Fix: `@use` the component SCSS in the consuming page SCSS and remove the matching `import './X.scss'` from the component TSX; then run `npm run verify:subpackage-styles -w mini-program` (see `docs/runbooks/mini-program-asset-delivery.md` §4.6).
- **DevTools MCP cannot screenshot** — it only launches/navigates/dumps state. For pixels use the H5 + Playwright flow in [`mini-program-screenshot-workflow`](../mini-program-screenshot-workflow/SKILL.md); never claim a visual check you did not run.

## Full review checklist (12 items)

For Full-tier changes. Routine changes use the quick check above; after Full-tier work, run [`references/grill-me-checklist.md`](references/grill-me-checklist.md) as a stress-test interview.

- [ ] Scope classified as `MINI_PROGRAM_ONLY` or `BOTH_REQUIRED`
- [ ] **Pixel discipline:** spec values match within tolerance; no-spec work uses **8rpx rhythm**; exceptions documented
- [ ] **WeChat DevTools:** computed layout/typography verified on changed screens (attach H5/Playwright or device screenshots, or selector notes in PR)
- [ ] Clear JoyJoin visual direction; brand colours, typography, spacing, mascot follow `joyjoin-brand-guidelines`
- [ ] Taro-native primitives + WXSS-safe patterns; no browser-first assumptions; no dynamic CSS custom properties for per-frame values; `RichText`/structured nodes instead of `dangerouslySetInnerHTML`
- [ ] **Layout semantics:** flex-first; vertical stacking via block/flex-column (L1/L3); mixed-size same-line pairs use flex row + `align-items: center` (L2)
- [ ] Large lists use `CustomWrapper` / `VirtualList` at the documented thresholds
- [ ] Loading, empty, error, disabled, busy, success, and pressed states are explicit; touch targets ≥ `44 pt` (~88rpx) with visible active feedback
- [ ] Assets crisp and within budget; oversized rasters flagged; new bundled dirs covered by `packOptions.include`
- [ ] Motion restrained (`transform`/`opacity`), entrance `cubic-bezier(0.22, 1, 0.36, 1)`, reduced-motion suppressed; no `overflow-wrap: anywhere` on CJK text
- [ ] Copy posture respected (review-safe vocabulary, no inline emoji, honest AIGC 角标)
- [ ] Subpackage pages: `npm run build:weapp -w mini-program && npm run verify:subpackage-styles -w mini-program` passes with no non-empty `sub-common.wxss`; 情绪价值 scored via `docs/reference/emotional-value-rubric.md`; screen is unmistakably JoyJoin, not "functional but cheap"

## Related skills

- **Audits:** [`ui-layout-audit`](../ui-layout-audit/SKILL.md) · [`frontend-design-audit`](../frontend-design-audit/SKILL.md) · [`completeness-audit`](../completeness-audit/SKILL.md) · [`performance-audit`](../performance-audit/SKILL.md)
- **Platform & craft:** [`viewport-zero-scroll`](../viewport-zero-scroll/SKILL.md) · [`mini-program-screenshot-workflow`](../mini-program-screenshot-workflow/SKILL.md) · [`platform-coordination-protocol`](../platform-coordination-protocol/SKILL.md) · [`joyjoin-brand-guidelines`](../joyjoin-brand-guidelines/SKILL.md) · [`design-system-governance`](../design-system-governance/SKILL.md) · [`wow-elements`](../wow-elements/SKILL.md) · [`render-integrity-checklist.md`](../ui-layout-audit/references/render-integrity-checklist.md)
