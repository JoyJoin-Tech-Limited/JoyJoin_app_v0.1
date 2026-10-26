# Profile Waves B–D — UIUX Design Inputs (2026-10-26)

> Author: senior UIUX design advisor · Status: DECISION INPUT for the remaining Waves B–D
> Scope: decisions and human visual verification only. No code changed; no git staging/commit.
> Read against: the 2026-10-22 UIUX memo, 2026-10-23 convergence memo, current Profile TSX/SCSS/constants, and the native poster renderer.

## Decision summary

- **Wave B:** keep 「本周 +N 潮流值」 deleted. Production has no XP-ledger evidence, so do not replace it with another weekly proxy or leave a placeholder. The existing hierarchy — 潮流值 → level progress → level/streak — is complete without a fourth fact.
- **Badge tier 5:** **15 vs 20 remains PM-owned**. UIUX has no preference and no 15场 visual/copy blocker; if PM chooses 15, this is threshold math only—no re-art or layout work.
- **A6-3 poster v2:** **badge-count-only is a NO**. Keep v1 unless PM greenlights the full minimum craft bar below: editorial hero + composed achievement signature + anchored QR/brand footer + native text robustness.
- **Wave D:** require a human WeChat DevTools + real-device pass. H5 evidence remains useful for layout, but cannot sign off native motion, haptics, CDN fallbacks, or canvas export.

---

## 1. D-4 tier 5 — conditional UIUX ruling

- **Decision owner:** PM chooses 15 or 20. Empty pre-launch `eventsJoined p95 = 0` is not meaningful design evidence; UIUX does not convert it into a threshold recommendation.
- **Design verdict:** both thresholds are shippable. If PM selects **15场**, there is **no visual or copy implication beyond derived threshold numbers**. Do not reopen the Lovart art, badge-wall geometry, 「城市传说」 name, or proximity-copy template.

### Exact visual/content impact

- If selected, change only the user-facing threshold in `MILESTONES` (`profileConstants.ts:133-138`): **20 → 15**. Keep the order `1 / 3 / 5 / 10 / 15`.
- **No artwork, cell geometry, label, or aria-label change is needed.** 「城市传说」 still works, the art is numeral-free, and the five-up wall remains unchanged.
- `getBadgeProximity` needs **no logic change**. Expected collapsed-row teasers become:
  - 12 场：「再 3 场点亮城市传说」
  - 13 场：「再 2 场点亮城市传说」
  - 14 场：「再 1 场点亮城市传说」
  - 15+ 场：「已点亮 5/5 枚」, with no proximity suffix.
- The expanded locked hint also needs **no logic change**: `remaining = milestone.threshold - joinedEventsCount` and 「还差 N 场」 already derive from the same threshold (`index.tsx:1443-1446,1490-1493`).
- Keep `legend20` / `MILESTONE_BADGES.legend20` as stable internal asset/ledger identifiers unless engineering separately wants a hygiene rename. A rename has no visual value and must not accidentally reset seen-badge state. Update the existing threshold/proximity tests as non-visual implementation hygiene (`profileConstants.test.ts:436-448`).

---

## 2. A6-3 poster v2 — conditional minimum craft bar

**Scope gate:** v1 remains a privacy-safe utility 名片. A canvas revision that only adds 「已点亮 N/5 枚」 is **rejected**—more data, not a stronger artifact. If PM greenlights v2, items 1–4 are one indivisible craft pass; otherwise keep v1.

1. **Editorial hero, not more modules.** Replace the current small 320px portrait + evenly weighted centred stack with a **420–440px** portrait, one quiet archetype-tinted halo/contact shadow, a dominant displayName, and clearly secondary family/潮流值/tagline. Keep deliberate whitespace; no second mascot, busy pattern, or promotional line.
2. **One composed achievement signature.** Use **latest/highest unlocked medallion + its label + 「已点亮 N/5 枚」** as one small module. A `badge_glow` share features the fresh badge. At zero badges omit the whole module; never export locked art, 「0/5」, or proximity pressure. Do not add an isolated badge-count line.
3. **Anchored QR/brand footer.** Replace the floating QR/copy with one calm bottom band: shared safe margins, clear brand lockup, white QR plate, and a protected **≥4-module quiet zone**. QR-absent gets a neutral non-scan band, not an empty code frame or scan instruction. Exported QR must scan from a second phone.
4. **Native text/export robustness.** Constrain displayName to one measured, ellipsized line; cap the family pill; wrap tagline to ≤2 lines or omit it. Nothing enters the QR/footer zone. Keep **1080×1560** and verify crisp portrait layers, alpha, CJK glyphs, and no clipping on real iOS + Android exports. The displayName and no-QR fixes are also required on v1 (§4).

**Explicitly NOT worth scope:** new Lovart poster art or 12 archetype themes; reproducing the full badge wall; animated/3D canvas; multiple templates or aspect ratios; weekly XP; city/age/interests/bio/referral/real-name fields; incentive wording. Keep the existing privacy contract and per-tap generation/save/share/preview pipeline.

---

## 3. Wave D — five blocking device checks

**Minimum evidence:** WeChat DevTools GUI at **320 / 390 / 414px** for D2–D3; real iOS + real Android Preview for D1–D5. Prepare max-content identity, high XP/target + two-line streak, equipment claim / rare / max-pity states, tier-5 `N−3 / N−1 / N` (12/14/15 if 15 wins), fullest story, fresh badge, and QR success/failure. Cover normal, OS reduced-motion, degradation, and one OS light/dark parity run. Not a full permutation matrix: every listed state at least once, both OSes for native export.

### D1 — Native poster bitmap + QR (highest risk)

**Regions:** `lib/profile/profileCardPoster.ts:60-185,246-285`; `lib/profile/useProfileCardShare.ts`; `pages/profile/index.tsx:1713-1721` / `.profile-page__poster-canvas`.

- [ ] On each OS, inspect the **exported 1080×1560 image**, not the offscreen Canvas: non-blank on first attempt and retry; standard/custom-outfit/fallback portraits are crisp, complete, correctly ordered, with clean alpha.
- [ ] Long displayName, family pill, 潮流值 and tagline stay inside safe edges; QR has a clean quiet zone and the **exported image scans from a second phone**. QR-absent has no scan instruction (§4.3).
- [ ] Preview/save/share/cancel and background→return leave no stuck 「正在生成…」, duplicate action sheet, black bitmap, or permission-dead-end. No private fields, incentive copy, or unwarranted AIGC label.

### D2 — 320px identity/growth geometry + native font metrics

**Regions:** `pages/profile/index.scss:917-1045,1576-1772,2828-2966`; `index.tsx` identity rail and `profile-page__growth-foot` / `profile-page__streak-capsule`.

- [ ] At 320/390/414, use long displayName, two-line event/daily greeting, maximum kept pills, high XP/nextTarget, level plate, and longest two-line streak continuation. Identity copy, growth card, avatar, and equipment reservation never touch, clip, or create horizontal scroll.
- [ ] **320px:** growth cap is 224rpx and the streak hint is intentionally hidden; **390/414px:** the full hint remains visible above the equipment strip. Native rpx rounding produces no 1px collision or clipped baseline.
- [ ] Cold font load → Alimama/Quicksand loaded: no tofu, fallback “irregular bold”, CJK clipping, count-up width jitter, or post-font-load overlap.

### D3 — Dense native flex rows: equipment strip + five-up badge wall

**Regions:** `pages/profile/index.scss:656-920,1774-2115,2828-2966`; `index.tsx:1076-1208,1401-1500`.

- [ ] Claim chip + rare slots + 「我的形象」 and, separately, 「下一抽必得新装备」 / 「上次同步」 fit without squeezing the action. **320px shows only three preview slots; 390/414px shows four.** Empty/loading/error/teaser states keep the same strip geometry.
- [ ] Expanded wall keeps five equal cells: four-character labels, 「还差 N 场」, lock corners, and fresh ring are not clipped; collapsed proximity copy at `N−3 / N−1 / N` stays readable with the chevron visible. No row-width change during pop-in or image decode.
- [ ] Cold CDN/offline: badge and equipment art resolves or takes its deliberate fallback—never broken-image chrome, raw emoji, or a geometry jump.
- [ ] Fresh unlock on a phone: one auto-expand, one restrained ring, one success haptic; tab switch and background/foreground do not replay them. Poster copy/glow remains latched without a perpetual repaint loop.

### D4 — Safe areas, custom tab bar, and overlay stacking

**Regions:** `pages/profile/index.scss:77-191,245-263,2657-2660`; `index.tsx:1710-1764`; native custom tab bar.

- [ ] Notch/Dynamic Island + home-indicator devices: nav title/bell never enter the status area; unread 0/1/9/10+ (cap 9+) never collides with the title. Final settings/story/quest content clears the custom tab bar—no missing or double bottom inset.
- [ ] Guidance dock never covers the story action, settings, or tab controls. Slow up/down scroll across the 64/96rpx hysteresis shows exactly one title, no flicker/jitter, and no trapped scroll region.

### D5 — Native compositing, story crop, and light/dark parity

**Regions:** `pages/profile/index.scss:20-38,2416-2640,2671-2703,2724-2826`; `index.tsx:1544-1641`.

- [ ] **OS light + dark:** Profile remains the intentionally light product surface; navigation text, glass, story wash, badge locks, and body copy do not auto-invert or lose contrast. This is a parity check, not a request for a new dark theme.
- [ ] Fullest 320rpx story state (pending badge + long chapter title + summary + privacy line + dated CTA) fits without the circular action covering text. Native Image develop/drift never exposes an edge, flashes a blank frame, or makes stage-glass text unreadable.
- [ ] Normal/RM/degradation: no native transform/opacity flicker or scroll jank; hidden tabs pause decorative motion. Static states keep progress, badge/claim/rare meaning, and the fresh-poster **gold rim**; nothing is stranded at opacity zero.

**Sign-off rule:** attach device/OS, width, mode, fixture, and screenshot/export for each failure. Any reproduced overlap, clipping, blank required art/export, failed QR scan, missing static information, or misleading fresh-badge state blocks Wave D. H5 alone cannot sign off any D1–D5 item.

---

## 4. Residual high-confidence 精致度 concerns (four; no other reopen items)

**Sign-off decision:** four small fixes below, no broader redesign. This is the audited pre-fix snapshot; if a fix has already landed, Wave D verifies that outcome rather than reopening the design.

1. **Degradation drops the fresh-poster static gold rim, contrary to the locked fallback.** `index.tsx:1621` applies `--glow` only when `!deviceTier.isDegradation`; the border and animation are coupled in `index.scss:2691-2697`. The convergence memo explicitly kept the static gold edge in degradation. Keep the border as the static pose and suppress only the animation.
2. **User-controlled poster names have no canvas width constraint.** `profileCardPoster.ts:118-124` draws `displayName` without `maxWidth`, truncation or wrapping. A long nickname can escape the 96px safe edges (`:67-68`) on the real exported bitmap. This is a v1 robustness fix, not a reason to commission v2.
3. **No-QR export still says “微信扫一扫”.** The copy is unconditional at `profileCardPoster.ts:168-177` (constant at `:36`), while only the QR image is conditional. In the failure state the instruction has no referent; use a neutral non-scan footer when QR is absent.
4. **The poster glow is a perpetual `box-shadow` animation.** `index.scss:2700-2703` repaints a shadow and violates the transform/opacity motion rule; an endless glow also reads less premium after the craft pass made the story ring one-shot. Use a separate ring for **one 2.8s opacity-only pulse, then rest at a static gold rim + fresh copy until tap**. Do not animate `box-shadow`; RM/degradation shows the same static rim immediately.

Everything else reviewed after the craft pass is an accepted design trade-off, not new work.
