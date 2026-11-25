# Mini-Program Visual Consistency Audit — 2026-11-10

> Follow-up to the Profile / native tab / equipment recovery and Discover-aligned Events card iteration. This audit checks shared contracts without forcing different user jobs into the same layout.

## Scope and evidence

- **47 active user-facing routes** from `MINI_PROGRAM_ROUTES`, excluding only the explicit `pages/alang/debug/index` and `pages/profile-linked/my-image/qa3d/index` development surfaces.
- Direct H5/system-Chrome render of every route at 390px with reduced motion, mock API fixtures, viewport screenshots, console/page-error capture, text/app presence and horizontal-overflow measurement.
- Targeted Events / Center Hub / Profile matrices additionally covered 320 / 360 / 390 / 414px where implemented.
- **Final crawl:** 47 rendered, 0 navigation failures, 0 blank pages, 0 horizontal overflow.
- Full mini-program regression: **377 files / 3738 passed + 1 skipped**. Typecheck, guardrails and class coverage PASS.
- This is not native WeChat approval and not an exhaustive business-state matrix. Parameterized pages were evaluated in their mock/default/error state; native motion, haptics, cold/warm subpackage entry and real-device image decoding remain manual gates.

## Shared contracts

1. No overlap, unintended clipping, blank stages, horizontal overflow or unreachable actions.
2. Interactive targets remain at least 88rpx where the shared rule applies; selection has surface + text + ARIA, not color alone.
3. Short Chinese display titles use Alimama; supporting Chinese uses system UI; numeric time/price/stat runs use Quicksand through `type-en-brand-numeric` without mixed-CJK baseline artifacts.
4. Discover / Footprint / `EventSummaryCard` consumers reuse `getOracleCardCornerAsset`; the same event type must not acquire a different visual subject.
5. Loading preserves useful geometry; empty/error states remain honest, branded and recoverable.
6. Identical 进行中 / 待开始 / 已结束 semantics use one shared segmented-control implementation.
7. Primary CTAs remain solid brand purple; metadata and selection chrome do not become competing CTAs.
8. Tab pages own one shared title bar (`TabPageNav`, `navigationStyle: 'custom'`): Alimama 36rpx centered page name in an 88rpx row below the measured status bar. Right-side actions use the capsule-safe slot (`getMenuButtonBoundingClientRect()`), never a raw right offset.

## Intentional differences — no forced unification

- **Discover:** conversion, narrative hook, social proof and stronger CTA.
- **Footprint:** compact recognition/history, status/countdown and feedback.
- **Detail:** decision confidence and logistics; larger media is allowed.
- **Checkout:** order/entitlement/price clarity over scenic competition.
- **Gameplay:** phase and host/player action authority over event-card anatomy.
- **Profile:** identity, avatar, equipment, growth and story own the stage.

## Findings and resolutions

| Priority | Finding | Resolution / evidence |
|---|---|---|
| P0 | Connections crashed on runtime `null` despite the array DTO (`connections.length`). | Normalize runtime data with `Array.isArray`; branded empty state now renders. Regression: `pages/connections/index.test.tsx`; final direct render has content and no error. |
| P0 | Icebreaker changed Hook count after loading/error early returns (`handleWarmupOverlayVisibilityChange` was below them), producing React 310 and a blank page. | Moved the callback above every early return; structural regression in `quietConciergeContract.test.ts`; final direct render shows the real session. |
| P1 | Center Hub retained three separate pills for the exact same semantics as Events. | Extracted `components/events/EventStatusTabs.tsx` + SCSS; both pages now share one track, equal hit areas, active thumb, ARIA, reduced-motion and same-tab no-op behavior. |
| P1 | Footprint had lost Discover's event-type recognition and used flat left-column typography. | Reused the exact dining/drinks assets, eager loading, warm gradients, title/date/support hierarchy and separate numeric text runs; terminal art remains quieter. |
| P1 | `groupSize` was mislabeled as registration count / 小队. | PM-confirmed assigned-table semantics: `groupId` required; active 已排进 N 人桌, historical/terminal N 人桌, cancelled/missing-group omitted. |
| P1 | Compact countdown inherited rail-only `width:100%` and overflowed in the integrated topline. | Footprint topline overrides it to content width; 320/390 visual scanners report zero violations. |
| P1 | Profile equipment status covered the avatar; 320px dock copy/thumbnails/entry collided. | Status/retry moved to the attached dock; ≤340px hides only secondary thumbnails. Ready/loading/error and 320/360/390/414 renders reviewed. |
| P1 | Dynamic titles could mix Alimama and PingFang mid-string while the full font waited an extra 500ms; the 236-glyph minimal subset does not cover characters such as 兴/局/罗湖/南山. | Minimal and complete Alimama tiers now start together; `brandFont.test.ts` locks the immediate complete-font load, and direct font probes/screenshots show one title font stack with separate Quicksand time runs. |
| Tooling | Profile/Events screenshots could capture entered shells before scene/image readiness. | Canonical generators now wait for viewport reveal and image settling. |

## Remaining release checks

- WeChat DevTools + real device: rapid native tab taps, Events/Center Hub segment glide and haptics, reduced motion, offline/failure recovery, and cold/warm settings navigation.
- Native image decoding / CDN failure fallback on physical devices.
- Compact Profile actions with historical sub-88rpx geometry need native touch verification or documented hit-area compensation; no overlap was observed in the supplied renders.
- Business-specific all-state coverage remains owned by each page's focused tests and existing smoke checklists; the 47-route crawl alone must not be cited as all-state approval.

## Verification commands

```bash
npm run typecheck -w mini-program
npm run test -w mini-program
npm run guardrails
npm run build:weapp -w mini-program
npm run verify:subpackage-styles -w mini-program
npm run harness:gate
```

Harness remains non-blocking CONCERN only for existing large-file warnings (Profile and the screenshot server). Auto-Eval manual-report timed out earlier and is not claimed as passed.
