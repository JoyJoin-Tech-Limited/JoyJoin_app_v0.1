# Mini-Program Squad Unboxing — Smoke Runbook

> **Scope:** Verify that the squad-unboxing reveal page renders correctly in every visual state (`ready`, `shaking`, `revealed`) and does not overlap fixed-stage visuals with scrollable content.
>
> **Audience:** Frontend engineers and QA validating `apps/mini-program/src/pages/squad-unboxing` in WeChat DevTools or on a real device.
>
> **Last updated:** 2026-07-24

---

## What this runbook proves

The squad-unboxing page renders a fixed-position stage (gift box, then fanned card deck) above a scrollable story. The page has three visual states and several hard-won layout constraints:

1. `ready` — gift box with breath idle animation + header (eyebrow `第N组 · M位同桌`, title `你的桌友来了`, tagline) + `DragRevealRibbon` restacked below header; no copy card.
2. `shaking` — box shakes with `success` haptic at lid apex (550ms); ribbon unmounted.
3. `revealed` — header, analysis bubble, chapters (bubble + chapter gated by `dealSettled`), and action dock below the fanned deck.

This smoke proves:

1. The fixed stage **never overlaps** the scrollable content.
2. The gift box fits inside the `ready`/`shaking` stage; the fanned deck fits inside the `revealed` stage.
3. All entrance animations, haptics, and reduced-motion/degradation fallbacks work without layout regression.
4. The action dock and success overlay do not obscure the wrong layer.
5. Swipe-back re-entry resets focus, flip state, and header-ready animation correctly.

---

## Deterministic checks to run first

From the repo root:

```bash
npm run typecheck -w mini-program
npm run guardrails
npm run test -w mini-program
npm run check:package-size -w mini-program
npm run build:weapp -w mini-program
```

Expected result:

- TypeScript passes.
- Guardrails pass.
- Mini-program tests pass (550 as of 2026-07-09).
- Main package is under 2.00 MB.
- WeChat build succeeds and refreshes `apps/mini-program/dist`.

These checks catch type, import, and regression issues. The manual DevTools smoke below is **still required** to confirm runtime layout and overlap behavior.

---

## The golden rule of squad-unboxing smoke tests

> **Render the page in every state, not just the final revealed state.**
>
> The most common regression is a fixed-stage visual (gift box / deck) overlapping the scrollable story because the scroll container's `padding-top` or the stage's `height` changed. Automated tests cannot detect overlap; a WeChat DevTools preview (or real-device screenshot) is mandatory.

### Minimum states to preview

| State | How to reach | What to look for |
| --- | --- | --- |
| `ready` | Land on `pages/squad-unboxing/index` for a matched group that has not been revealed. | Gift box is tappable (`role="button"`, pressed state) with breath idle animation; header shows `第N组 · M位同桌` + `你的桌友来了` + tagline; `DragRevealRibbon` restacked below header (not below box); vertical scroll works in tap-fallback / low-end mode. |
| `shaking` | Tap the gift box or drag the ribbon past 50%. | Gift box shakes for 1000ms (220ms RM); `success` haptic fires at 550ms lid apex (150ms RM); ribbon unmounted; no overlap. |
| `revealed` | After shake completes. | Fanned deck is visible; header + analysis bubble are below the deck; scroll down to see chapters and action dock. |
| `error` | Force a failed group fetch (e.g., disconnect network or use a bad group ID). | Full-screen error state centered; CTA reachable. |
| `empty deck` | Matched group with zero members. | Empty-deck state with Xiaoyue `actionFailure` mascot; copy readable. |
| `success overlay` | Tap **确认出席**. | Success overlay covers the full screen; background interactions are disabled. |

---

## Visual checklist per state

Use the WeChat DevTools **Inspect** panel (or real-device screenshot) and confirm:

- [ ] No fixed-stage element overlaps any text, card, or tappable surface in the scrollable area.
- [ ] The stage bottom aligns with the top of the scrollable story; no copy card below the stage.
- [ ] Tapping the gift box in `ready` state triggers the `shaking` → `revealed` flow.
- [ ] The `DragRevealRibbon` is anchored below the header (not below the box) and remains reachable on all screen heights.
- [ ] Drag mode blocks parent `ScrollView` scroll; tap-fallback / low-end mode allows vertical scroll.
- [ ] **Cascading fan deal:** after the box opens, cards deal **face-down** one-by-one (staggered slide-up) and settle into a rotated hand-fan pose (rotation per position, 28rpx overlap); the whole deal finishes within ~600ms + a ~200ms anticipation beat. Cards then flip face-up via controller-owned `squadFlipState`: my card auto-flips on deal (`auto_me`), other cards flip on tap (`tap`), and the reveal-all count chip flips every remaining card (`reveal_all`).
- [ ] 4–6 members render on a single fanned row; 7–8 members wrap to two fanned rows and both rows stay fully inside the revealed stage (no clipping top or bottom).
- [ ] In `revealed` state, tapping a face-down card flips it face-up **and** lifts it (scale 1.1 + translateY) while siblings preserve their full-opacity fan pose — **sibling dimming was removed 2026-07-14** so the layered deck stays legible. Re-entry with the per-group `jj_revealed_${groupId}` flag renders every card face-up immediately.
- [ ] Focused-card narration renders in the Xiaoyue dock bubble (burst > member > tease > soul chain) with a typewriter reveal: tapping a face-up card focuses it, tapping the narrating card fast-forwards the typewriter, and tapping a focused card after the reveal dismisses (unfocus, emits `squad_unboxing_card_detail_dismiss`). The inline `TeammateCardDetail` panel was retired 2026-07-14 — focusing a card causes NO scroll jump/reflow.
- [ ] **Every card has a hook (2026-07-16):** cards with a viewer connection point show a filled rarity pill; cards without one show the member's top interest as a **neutral-outline** pill (transparent background — visually distinct from the filled connection pill). No card collapses to a 3-row face just because it lacks a connection point.
- [ ] **Focused-card caption (2026-07-16):** the lifted card shows an art-zone bottom caption (`本科 · 互联网产品`, education · industry, privacy-gated fields omitted) over a soft surface scrim — legible over both archetype art and real avatar photos; covered/unfocused cards never render it, and the caption never pushes the info grid out of the card (it is an overlay, not a 5th row).
- [ ] A longpress on a card fires once and swallows exactly one trailing tap (no double action); a tap more than ~3 s after the longpress behaves as a normal tap.
- [ ] In `revealed` state, vertical scroll can initiate over the margins around the fan while card taps still register (parent-none/child-auto pointer-events).
- [ ] The covered band on each non-rightmost card is art/padding only — no name, archetype, meta, or pill text is hidden by the overlapping card to its right. A one-time shimmer sweep plays across the face-down backs after the deal (the center-card auto-peek and the session front holo were retired 2026-07-14).
- [ ] All tap targets (cards, drag ribbon, dismiss button, action dock buttons) are ≥ 88rpx tall and not overlapped.
- [ ] Reduced-motion preference suppresses entrance animations (deal becomes an opacity fade) but preserves layout.
- [ ] Degradation-tier device (or simulated low-end) shortens transitions but preserves layout.
- [ ] On the smallest target device (iPhone SE / 375 × 667), the header, ribbon, and action dock are still visible without needing to scroll.

---

## Common regression patterns to watch

| Symptom | Likely cause |
| --- | --- |
| Stage overlaps scrollable content | Scroll `padding-top` is too small (often overriden by `safe-area-top` mixin) or the stage `height` is too small. |
| Fanned deck is clipped at the top or bottom | `revealed` stage height `clamp(500rpx, 56dvh, 660rpx)` is smaller than the fanned deck (two 284rpx rows + 8rpx row gap + title bar). |
| Header or analysis bubble appears behind the stage | Root `squad-unboxing--${flowState}` class is missing, so `padding-top` for that state is not applied. |
| White card is off-screen at the bottom | Stage height is too large for the ready state; reduce `clamp(420rpx, 54vh, 560rpx)` minimum. |
| Action dock overlaps content | `fixed-footer-reserve` is missing or the wrong value is used. |
| Success overlay is not full-screen | `z-index` of the overlay is lower than another fixed element. |

---

## Wow-pass psychology checklist (2026-07-24)

### Card geometry
- [ ] N≤6 members render on a single row, each card 245rpx wide at fan scale 0.85; 4 members split [2,2]; the rightmost card shows the full pill row (hook + temperature chip).
- [ ] N=7–8 members render two fanned rows at legacy 190rpx; no card exceeds the stage boundary.
- [ ] Fan rotation: ±5° for cards in the top row of a multi-row layout; the whole fan sits at scale 0.85.
- [ ] Stage revealed height clamps to 460–640rpx (3rd gear) and is bottom-anchored.
- [ ] Focused card drops its covered-band safe inset so the pill row has the full 245rpx width; sibling info zones ghost-fade to opacity 0.12 via `deck-fan--has-focus`.

### Pair-temperature chips
- [ ] Every pair-backed card shows a tier-aware temperature chip (`超级火花` → fire/warm pink, `暖意融融` → warm pink, `相聊甚欢` → mild purple, `慢慢发现` → cold grey).
- [ ] Covered cards (non-rightmost, non-focused) show the temperature chip only — the connection pill row is hidden behind the overlapping neighbour.
- [ ] Connection pills use `shortenConnectionPointForPill` — filler prefixes (都爱/喜欢/是/偏/相信) are stripped; the 1-line ellipsis never shows a truncated filler word.
- [ ] Cards without a viewer connection point show the member's top interest as a neutral-outline pill (transparent background, visually distinct).

### 最佳拍档
- [ ] The highest pair-chemistry card (`computeBestPartnerUserId`, strict `>` tie-break) flips at 0.6× speed via `--slow-flip`, with a gold 1s sheen and heartbeat haptics (medium → 90ms gap → light).
- [ ] Narration delay for the best-partner card extends to 700ms (normal: 400ms).
- [ ] The best-partner stamp is inset to `$fan-safe-inset` on non-rightmost cards so the overlapping neighbour cannot paint over it.

### Structured 同频分析 + dignity-floor copy
- [ ] Focusing a tablemate upgrades the dock bubble from flat prose to verdict (typewriter) → evidence chips (gated on verdict `onComplete`) → one concrete opener quote.
- [ ] When pair data is sparse, the fallback keeps a warm prose format (no degeneracy).
- [ ] `buildFocusedMemberBubbleText` never outputs "没找到共同点" or equivalent — empty connections reframe as complementarity (test-locked).
- [ ] 桌型诊断 chips (气氛组/深度派/暖心派) render inside the bubble footer — deterministic archetype→role map, no LLM.

### Self-relevance (我 card)
- [ ] The 我 card carries a top-left role badge (`气氛担当`/`深度担当`/`暖心担当`) that is never covered by the overlapping card to its right.
- [ ] `buildSelfCardBubbleText` renders role-positioned self narration (different from the narrative used for other members).

### Press-and-hold anticipation
- [ ] Pressing and holding a face-down card tilts it +8° along the fan direction + foil glint + haptic tick.
- [ ] The tilt and glint are cleared on release, cancel, flip, or pocket (store → foreground re-entry).
- [ ] Under reduced-motion / degradation tier: anticipation is completely suppressed (including the foil glint).

### 契合点光迹 (flip trails)
- [ ] Each live flip spawns a single falling archetype-tinted blob (transform + opacity only).
- [ ] Motion-tiers only: suppressed under reduced-motion and degradation tier.

### 桌卡 poster
- [ ] 「这桌的桌卡」 collectible banner is visible once every card is face-up; persists on re-entry.
- [ ] Tap `保存桌卡` triggers `squadTableCardPoster.ts` — generates a 750×1100 canvas (archetype head ring + chemistry word + date), calls `saveImageToPhotosAlbum`.
- [ ] Canvas DOM is unmounted immediately after successful save (avoids 13MB backing-store leak).
- [ ] On save failure (incl. album-permission denial), a toast shows and the CTA remains tappable.
- [ ] Degradation-tier devices hide the poster banner entirely (canvas generation excluded).
- [ ] Analytics: `squad_unboxing_table_card_tap` / `_saved` / `_save_failed` fire correctly.

### Peak-end settle breath
- [ ] After the last flip lands, after a 420ms delay, the stage performs a scale 1.0→1.015→1.0 settle + `haptics('success')`.
- [ ] Suppressed under reduced-motion and degradation tier.
- [ ] Does not fire on re-entry (group already revealed) — only on the live last flip.

### CTA lit state
- [ ] The confirm CTA shows a `::after` opacity-pulse glow + label 「确认出席 · 锁定座位」 after all cards are face-up.
- [ ] The CTA is always tappable — the glow is cosmetic. `aria-disabled` is never set; conversion is not gated.

### Return thread
- [ ] 「活动结束后，回来看看这桌的故事」 renders below the CTA in the action dock (opacity 0.6, smaller font).
- [ ] RM / degradation keeps the text but removes any entrance animation.

### Flip reliability
- [ ] Rapid double-taps on a face-down card never double-flip it (pending-trailing-tap guard).
- [ ] `FLIP_IN_FLIGHT_GUARD_MS` prevents concurrent flip burst — cards flip one at a time with no overlap.
- [ ] Flip hold-to-onLoad (userId-keyed, 1200ms ceiling, `HELD_FLIP_MAX_RETRIES=3`) — never flips into a skeleton and never stacks mid-burst.
- [ ] `onError` fallback on archetype art does not block the flip — the card shows a gradient placeholder and the user can still focus it.

### 人→关系→场合 narrative arc
- [ ] The transition line 「都认识了，就差一张桌子」 renders above the event brief card.
- [ ] The event brief card inherits the table's chemistry colour as a foil top border (`--chem-fire/warm/mild/cold/fallback`).
- [ ] The gap hierarchy is 16/16/32rpx (no visual collisions between the transition line, event card, and CTA).

---

## How to simulate states in DevTools

If you cannot easily reach a state naturally:

1. **Local dev override:** add a temporary `useState` default in `useSquadUnboxingController` for the desired `flowState` (revert before commit).
2. **Mock route:** use the DevTools page-path input to enter `/pages/squad-unboxing/index?groupId=<id>` and hardcode the controller to return that state.
3. **Network / device:** disable network for the error state; use a test group with zero members for the empty deck.

---

## Sign-off

Before marking a squad-unboxing PR ready:

- [ ] Deterministic checks pass.
- [ ] DevTools preview (or real-device screenshots) attached for `ready`, `shaking`, and `revealed`.
- [ ] Visual checklist above is complete.
- [ ] No overlap, clipping, or unreachable tap targets observed.
