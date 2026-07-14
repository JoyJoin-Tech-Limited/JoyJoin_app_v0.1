# Squad Unboxing — "Cascading Hand Fan" Revamp: Locked Strategy

**Date:** 2026-07-13
**Status:** LOCKED (PM strategy + grill-me interview, all branches resolved)
**Scope:** `apps/mini-program/src/pages/squad-unboxing/` revealed state + gift-box chrome polish
**Supersedes:** Direction A "Sequential Deal → flat row" (sprint-contract.squad-deal-a.md); flat row is deleted, not flag-gated

> **Postscript (2026-07-14):** Sibling dimming on focus was subsequently removed in commit `13b51fcb6` ("Preserve squad card layers on focus"). Unfocused cards now keep their full-opacity fan pose — no opacity drop and no `×0.97` settle — so the layered deck stays legible. The `anyFocused` prop and `--dimmed` SCSS class were dropped from `TeammateCard`/`SquadDeckStage`. The §3 Interaction block below retains the original locked strategy for historical context; treat the dim/settle clauses as superseded by the 2026-07-14 change.

---

## 1. Fan geometry

- **Two-row fan** for N≥5: `ceil(N/2)` top row / `floor(N/2)` bottom row, each row independently flex-centered. No horizontal scroll, no shrink-to-fit.
- Per-count table (content width 686rpx; stage cap 660rpx):

| N | Rows | Card W×H (rpx) | Rotation (deg) |
|---|------|----------------|----------------|
| 4 | 1×4 | 190×300 | −9, −3, +3, +9 |
| 5 | 3+2 | 200×284 | row3: −6,0,+6 · row2: −4.5,+4.5 |
| 6 | 3+3 | 200×284 | −6,0,+6 both rows |
| 7 | 4+3 | 190×284 | row4: ±9 · row3: ±6 |
| 8 | 4+4 | 190×284 | ±9 both rows |

- Overlap 28rpx via `.card + .card { margin-left: -28rpx }`; z-index ascending left→right.
- **Anti-collision invariant:** every non-rightmost card has `padding-right ≥ overlap + rotation poke` (48rpx) — the covered band contains only art/padding, never text. Drift-lock test asserts this.
- Geometry lives in a new pure module `computeFanLayout()` (sibling of `squadDealTiming.ts`), emitted as SCSS per-count/per-index classes. **Zero runtime measurement** (`createSelectorQuery` banned, test-enforced).
- Current user stays in **roster order** with the 我 badge at **top-left** (only corner never covered).

## 2. Card content (one rich template, all counts; `compact` branch deleted)

- Art zone (~58%): archetype full-body art on archetype-tinted gradient; 我 badge top-left; 最佳拍档 foil stamp top-right when applicable.
- Info zone (~42%), white, 16rpx padding (+48rpx right safe-inset on covered cards):
  - R1: nickname (28rpx semibold, 1-line ellipsis) + `28 · 女` trailing (gender glyph + ageLabel range, 24rpx secondary)
  - R2: archetype name in contrast-safe accent color (24rpx)
  - R3: industry `industryNicheLabel ?? industryCategoryLabel` (22rpx tertiary, 1-line ellipsis)
  - R4: up to 2 rarity 契合点 pills, 2-line clamp each
- **Privacy:** `ageVisible`/`industryVisible` honored — hidden fields silently omitted, no placeholders.
- **All cards show archetype art** (including current user — no avatar-photo exception).
- **Six fields only.** Hometown/education surface through 契合点 pills + detail panel, not as card lines.
- **No per-card chemistry numbers.** Chemistry = title-bar group word + 最佳拍档 stamp + detail-panel 连接感.
- Premium frame: 2rpx archetype-tinted border + inset foil line + tinted soft shadow.

## 3. Interaction

- **Idle:** fan only. No hint, no panel, no reserved space.
- **Tap:** card straightens (rotate→0), rises (−40rpx), scales ×1.10, z→top; siblings dim to 0.35 and settle ×0.97. Lift-in-place per-index SCSS class — no measurement.
- **Detail:** on-demand panel below deck, `max-height 0→520rpx` + opacity; reuses `TeammateCardDetail`; keyed by userId for cross-fade; tap-again or 收起 collapses.
- **Chip-strip scroll collapse: RETIRED** (strip, `isDeckCollapsed`, threshold math all deleted).
- **Opaque, feathered stage background** — kills scroll bleed-through.
- Analytics + ARIA preserved: list/listitem roles, per-card aria-label (now incl. age + industry), `squad_unboxing_card_focus`, detail dismiss, reveal announcement, per-card haptics.

## 4. Animation

- Deal budget unchanged: ≤600ms active + 200ms anticipation; stagger via existing `computeDealStaggerMs`; per-card landing haptic.
- Entrance: from center-bottom stacked deck (`translate(0,180rpx) rotate(0) scale(.5) opacity 0`), face-down in flight, flips face-up on land (fan transform on outer, flip on inner).
- **Auto-peek:** ~400ms after settle, center card lifts (×1.06, −16rpx, 600ms) once — replaces the deleted hint text. One-shot, gated by reduced-motion/degradation.
- **Epic holo sweep:** plays once on deal, then static (no loop).
- Reduced-motion/degradation: no flight, no rotation, no peek — opacity-only fade into fan pose; focus = instant highlight.

## 5. Wow elements (both ship in v1)

1. **Collectible foil frame** — archetype-tinted border + inset foil + tinted shadow on every card.
2. **最佳拍档 gold-foil stamp** — corner seal on the viewer's highest-`chemistryScore` tablemate (deterministic tie-break: first in roster). Data already present in `viewerPairByMemberId`.

## 6. Screen structure after revamp

```
nav 小队揭晓
[fixed title bar] 第N组 · 默契词 · 你的桌友来了
[fixed stage, opaque]  FAN (two-row for N≥5)
[on-demand detail panel]  (zero height when idle)
今晚这桌 chapter (type · time)
团魂 bubble (Xiaoyue; group-analysis copy folded in here)
[fixed dock] 确认出席 / 保存这桌记忆 · 查看活动详情 / 稍后再看
```

Removed: idle hint block, reserved 400rpx detail shell, chip strip, mascot avatar + tagline header (Xiaoyue lives in the 团魂 bubble), `compact` card branch, transparent stage.

## 7. Gift-box stage (chrome polish + interior card-stack)

- **Box body + lid Lovart art stays** — already premium and on-brand (cream facets + purple ribbon); tap/ribbon/shake interactions and the composed-hero flag untouched.
- **Interior becomes a CSS card-back stack** (replaces `lovart-blind-box-interior.webp` golden glow): premium card backs in the fan's design language (brand gradient, foil edge, logo mark) that rise from the box as the lid opens — making 打开礼盒 → 卡牌飞出 → 落位成扇 one continuous story. Pure CSS, no art-pipeline dependency.
- Surrounding chrome (title treatment, copy card, aura/sparks/shadow, ribbon colors) restyled to match the premium card aesthetic.
- Full Lovart box redraw remains possible later as a pure asset swap (`BlindBoxVisual` already has an error-fallback pattern) — not in this sprint.

## 8. Rollout

- **Ship directly, delete flat row.** No feature flag, no dual render path.
- `SquadDeckStage.test.ts` / `TeammateCard.test.ts` rewritten to lock the new invariants (safe-zone padding, no measurement, SCSS per-index geometry, transform-order lint note).
- DevTools visual smoke re-run before merge (H5 preview path — postcss pxtransform is the risky runtime).

## 9. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| Text-on-text overlap (old fan bug) | Safe-zone invariant + z-ascending + drift-lock test |
| Measurement math (old fan bug) | Pure `computeFanLayout()` + SCSS; `createSelectorQuery` test-banned |
| Content clipping | Fixed card heights; ellipsis/clamp rules; stage clamp sized to two-row fan |
| Scroll bleed-through | Opaque feathered stage bg |
| Inline deg/rpx in H5 | All transforms in SCSS classes; verify in H5 preview build |
| Short phones | dvh clamp on stage; fixed dock always reachable |
| 8 holo sweeps | Epic-only, transform/opacity only, once-then-static, gated |

## 10. Out of scope

- Server/API changes (all fields already on `PoolGroupMemberSummary`/`PairExplanation`)
- 团魂 bubble merge into 连接解读 (deferred product decision)
- Avatar-photo medallion, per-card chemistry chips, 同乡 chip, education line
- Flag plumbing (user chose direct ship)

## Amendment (2026-07-13, post-implementation visual verification)
Screenshot-driven fit fixes accepted during Supervisor verification (see sprint contract Evaluation):
card heights 320rpx (was 284/300); stage clamp ceiling 760rpx + opaque feathered stage bg (was 660); exactly 1 connection-point pill per card, 1-line nowrap+ellipsis (2-line `-webkit-line-clamp` is engine-fragile — Chrome 143 serializes `display: -webkit-box` as `flow-root`); nameplate strip is archetype-only with gender·age meta chip in the top-left badge row; detail panel 560rpx; duplicate chapter chemistry badge removed (chemistry word renders once in the title bar). All other locked branches unchanged.

## Amendment 2 (2026-07-13, round-3 user-directed polish)
Shipped after the round-2 audit pipeline, driven by user review of the round-2 build:
- **Card restructure:** info zone is a strict 4-row grid (name / accent archetype / grey `age·gender` meta / 1 pill); art zone is pure art + 我 badge / +N chip / 最佳拍档 stamp. The Amendment-1 nameplate strip and art-zone gender·age meta chip were removed. Art/info split 54/46 → 52/48; cards 320 → 332rpx tall; widths by count — 1–3: 216, 4: 190, 5–6: 222, 7–8: 190 (4-per-row capped by the 686rpx fan width).
- **Industry moved off the card** (deviation from the locked "six card fields", superseded by the user's clean-read instruction): the 48rpx safe inset on covered cards left ~126rpx of text width, truncating `28·女 · 互联网产品` to a single visible industry character. Industry now renders in the focus detail panel (`age · industry`) and the card aria-label only.
- **今晚这桌 polish:** header/body hairline divider; vignette 132 → 112rpx sunk to the date baseline (stretch aside); venue row = name + inline 复制 chip (56rpx compact secondary action — documented exception); status copy 场地已确定.
- **团魂 bubble copy:** opener 拼图完整了！ → 人到齐了！ — the puzzle metaphor exists only on matching-status's puzzle prelude (`matchingPuzzlePreludeEnabled`), never on this gift-box→card-fan surface.
All other locked branches unchanged. Verified: typecheck clean, guardrails 0 errors, mini-program vitest 634 passed (squad 99/99), screenshots revealed N=4 / two-row N=6 / focused.
