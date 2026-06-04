# Taro Engineer Handoff — Batch C + D Surface Wiring

> **Date:** 2026-06-04
> **From:** Supervisor (Lovart commission orchestration)
> **To:** Taro Mini-Program Frontend Engineer
> **Scope:** Wire 11 mini-program surfaces to the new Lovart-batch C + D asset registries
> **Status:** ✅ **Shipped 2026-06-04** (all 11 surfaces wired, 5 audits + P0/P1 fixes applied, Path B local-bundle active)

---

## Context

Two new Lovart asset commissions landed in the mini-program this week. Both are **Lovart-batched, grid-generated, content-bounds-cropped, WebP-optimized** and follow the existing asset pipeline pattern. Registries are in place; surface wiring is what's needed.

The 情绪价值 lift these unlock is the primary motivation:
- **Batch C (Ceremony & Belonging)** lifts 仪式感 2.5→4 and 归属感 3→4
- **Batch D (Achievement & Milestone)** lifts 成就感 2.5→4

Both are the lowest-scoring dimensions today. See [`docs/reference/emotional-value-rubric.md`](../../reference/emotional-value-rubric.md).

---

## What you need to know

| Resource | Path |
|---|---|
| **Batch C brief** (design intent, cell specs, integration notes) | `docs/design/lovart-brief-ceremony-belonging-batch-c-20260604.md` |
| **Batch D brief** (design intent, cell specs, integration notes) | `docs/design/lovart-brief-achievement-milestone-batch-d-20260604.md` |
| **Batch C registry** (8 keys) | `apps/mini-program/src/lib/ceremonyHeroes.ts` |
| **Batch D registry** (9 keys + Batch B pair map) | `apps/mini-program/src/lib/milestoneBadges.ts` |
| **Pattern reference** (existing) | `apps/mini-program/src/lib/mascot/xiaoyueExpressions.ts` |

Both registries use `localAsset()` and return WebP paths shipped inside the package at `apps/mini-program/src/assets/ceremony/` and `.../badges/`. **Path B local-bundle:** the original brief called for `cdnAsset()`; we switched to `localAsset()` after re-encoding at q=55, 600px max (was q=85, 800px) — raw total dropped from 1.1MB to 570KB and the main package zip still fits at 1.98MB (20KB headroom under the 2MB WeChat hard limit). PNG masters are kept in `apps/mini-program/assets-source/lovart/batch-{c,d}/` (NOT bundled) so re-encoding is lossless. Future batches must re-evaluate this trade-off (see `apps/mini-program/README.md` §4 for the bundled-pattern rules).

---

## Constraint: additive placement only

**Do NOT refactor existing layouts.** The new heroes/badges sit **alongside** the existing mascot / copy — not replacing it. Reasons:
- Existing mascot pairings carry their own emotional role (Xiaoyue `coachGuide` on welcome-back already works)
- Removing them risks breaking existing 情绪价值 归属感 3/4 score
- Each surface has had 17-point review against `mini-program-frontend-excellence` — don't disturb it

The placement pattern in every case is: **add the new asset as a hero/backdrop layer; keep the existing mascot + copy intact.**

---

## Surfaces to wire (11 total)

### Batch C — Ceremony & Belonging (6 surfaces)

| # | Surface | Registry key | Placement hint | WTP lift |
|---|---|---|---|---|
| C1 | `pages/onboarding/welcome-back/index.tsx` | `CEREMONY_HEROES.welcomeBack` | Full-bleed hero at top 30% of viewport, behind existing `coachGuide` mascot | 归属感 +5, 仪式感 +5 |
| C2 | `pages/blind-box-payment/index.tsx` (success state) | `CEREMONY_HEROES.eventPaidConfirmed` | ~240rpx centered hero above existing "支付成功" text, paired with `actionSuccess` Xiaoyue | 仪式感 +4, 成就感 +3 |
| C3a | `pages/icebreaker-session/tier-selector/index.tsx` (breeze card) | `TIER_VIBE_BACKDROPS.breeze` | Backdrop layer on the `breeze` tier card (~200rpx) | 身份认同 +3, 仪式感 +2 |
| C3b | Same page, glow card | `TIER_VIBE_BACKDROPS.glow` | Backdrop on `glow` tier card | 身份认同 +5, 仪式感 +3 |
| C3c | Same page, blaze card | `TIER_VIBE_BACKDROPS.blaze` | Backdrop on `blaze` tier card | 惊喜感 +3, 身份认同 +3 |
| C4 | `pages/invite/index.tsx` (share-card section) | `CEREMONY_HEROES.inviteCoBranded` | ~200rpx square hero in the share-card section | 归属感 +5, 惊喜感 +2 |
| C5 | `pages/event-feedback/index.tsx` (success state) | `CEREMONY_HEROES.eventFeedbackThanks` | ~240rpx hero above existing `thanksFeedback` Xiaoyue | 仪式感 +4, 归属感 +3 |
| C6 | `pages/icebreaker-session/phases/RecapPhaseView.tsx` (end overlay) | `CEREMONY_HEROES.seeYouNextTime` | Full-bleed end overlay (~60% viewport height) when session reaches `ended` state | 仪式感 +4, 归属感 +3 |

### Batch D — Achievement & Milestone (5 surfaces)

| # | Surface | Registry key | Placement hint | WTP lift |
|---|---|---|---|---|
| D1 | `pages/my-events/index.tsx` + profile badge | `MILESTONE_BADGES.firstEvent` | 200rpx hero on my-events empty→first join; 80rpx badge on profile | 成就感 +5, 惊喜感 +3 |
| D2 | profile + rewards | `MILESTONE_BADGES.streak3` | 80rpx badge on profile (alongside archetype hero) | 成就感 +4, 归属感 +3 |
| D3 | `pages/onboarding/personality-test/index.tsx` (Q30 trigger) | `MILESTONE_BADGES.quizHalfway` | 160rpx inline celebration with 0.5s entrance animation, paired with `coachGuide` Xiaoyue | 成就感 +3, 惊喜感 +2 |
| D4a–e | `pages/matching-status/UnifiedRevealCard.tsx` (shared-chemistry card) | `MATCH_REASON_BADGE_MAP[emoji]` (5 variants) | 240rpx hero paired with existing Batch B `REVEAL_MAP` icon (96rpx). Use emoji key from existing REVEAL_MAP to look up the right D4 hero | 被理解感 +3 to +5 |
| D5 | `pages/icebreaker-session/phases/RecapPhaseView.tsx` (end stamp) | `MILESTONE_BADGES.recapStamp` | 280rpx centered seal with wax-press CSS animation (scale + opacity) | 仪式感 +5, 身份认同 +4 |

> **Note on D4a–e:** the 5 Batch D match-reason heroes are the **magnified shared-chemistry backdrop** for the existing 5 Batch B `REVEAL_MAP` icons. The pair is by design: icon as the corner detail, hero as the visual anchor. The `MATCH_REASON_BADGE_MAP` in `milestoneBadges.ts` is the lookup table — emoji key → badge key.

---

## Reference image: 悦仔 character lock

The brand mascot 悦仔 (Welsh Corgi Pembroke, weathered purple `#8B5CF6` hoodie, sunglasses hanging from collar, vintage leather watch, silver chain necklace) is used in:
- **Batch C**: C1, C2, C5, C6 (the 4 hero cells)
- **Batch D**: D5 (the recap stamp)

**Do NOT** use the 社牛柯基 user archetype (no hoodie, bouncy) on any of these surfaces. The archetype mascot appears on user-typed surfaces only (their own archetype card).

Reference images: `tmp/xiaoyue-reference-grid.webp`, `xiaoyue-master-spritesheet.webp`.

---

## Quality bar (must pass before sign-off)

- **Pixel precision** per `mini-program-frontend-excellence` skill: hero placement respects the existing 8rpx rhythm; no shifts in copy alignment
- **Reduced motion** respected: the 0.5s entrance animation on D3 must be suppressed under `@media (prefers-reduced-motion: reduce)`
- **Haptics**: add `haptics('light')` on D3 tap (it's interactive), `haptics('success')` on C2 + C6
- **Accessibility**: hero `<Image>` needs `aria-label` if purely decorative (e.g. C1, C2, C6 — the copy carries the meaning); the D badges get `aria-label="已参加 3 场活动"` style
- **Package size**: total raw WebP is 570KB after Path B re-encode (q=55, 600px); main package zip 1.98MB (20KB headroom under 2MB WeChat hard limit, 180KB over 1.80MB guideline). PNG masters stay in `assets-source/` and are not bundled.
- **No regressions**: all 4 Xiaoyue cells (C1, C2, C5, C6) + D5 must depict the **same character** (matching the Lovart-generated assets). Verify by visual side-by-side check after the build

---

## Verification path (after changes)

```bash
# 1. Build
npm run build:weapp -w @joyjoin/mini-program

# 2. Check package size
npm run check:package-size -w @joyjoin/mini-program
# Expected: still under 2MB (current usage with new assets ~1.7MB)

# 3. Type check
npm run typecheck -w @joyjoin/mini-program

# 4. Lint
npm run lint -w @joyjoin/mini-program

# 5. Visual QA in WeChat DevTools:
#    - open pages/onboarding/welcome-back → see C1 hero behind mascot
#    - trigger payment success flow → see C2 hero
#    - open tier-selector → see C3a/b/c backdrops per card
#    - open invite → see C4 hero
#    - submit event feedback → see C5 hero
#    - end a recap session → see C6 hero
#    - trigger first event join → see D1 hero/badge
#    - check profile (after 3 events) → see D2 badge
#    - start personality test → see D3 at Q30
#    - match reveal → see D4 paired with existing icon
#    - end recap → see D5 stamp
```

---

## Out of scope (do NOT do these)

- ❌ Refactoring existing mascot placement
- ❌ Changing the existing copy / CTAs
- ❌ Wiring to the real CDN (handled by CI workflow per AGENTS.md)
- ❌ Renaming or moving asset files
- ❌ Modifying the brief docs
- ❌ Adding new mascot expressions

---

## Reference: full cell-by-cell design intent

For each cell's feeling, visual, color accent, and WTP dimension lift, see the brief docs:

- Batch C cells (C1–C6, with C3a/b/c sub-variants): `docs/design/lovart-brief-ceremony-belonging-batch-c-20260604.md`
- Batch D cells (D1–D5, with D4a–e sub-variants): `docs/design/lovart-brief-achievement-milestone-batch-d-20260604.md`

---

**Estimated effort:** 6–10 hours (1 surface = ~1h with verification). Best done as a single PR per surface family, or one batched PR if you have the test infrastructure to QA all 11 surfaces in WeChat DevTools.
