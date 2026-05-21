# Emoji Audit & Replacement Strategy

> Date: 2026-04-29  
> Scope: `apps/mini-program/src` — all emojis and generic mini-program elements  
> Method: Automated code scan + asset inventory + replacement mapping

---

## 1. Executive Summary

**Found:** 200+ emoji instances across 30+ files in the mini-program codebase.  
**Highest-impact surfaces:** Personality results (canvas + visible card), icebreaker sessions, matching status, pool registration.  
**Existing assets that can replace ~40% of emojis:** Chemistry badges, status icons, info labels, rating faces, phase icons, archetype glyphs.  
**New assets needed:** Energy icon, rank/medal icon, tap hint illustration, celebration illustration, generic social icons.

---

## 2. Emoji Inventory by Surface

### 🔴 Tier 1 — Highest Impact (Personality / Onboarding / Share)

| File | Line | Emoji | Context | Replacement Strategy |
|------|------|-------|---------|---------------------|
| `sharePoster.ts` | 454 | ★ | Holographic stamp border | Keep — Unicode star, not emoji |
| `sharePoster.ts` | 543 | ⚡ | Energy bar label | **New asset needed:** `icon-energy-bolt` |
| `sharePoster.ts` | 591 | 🎴 | Rank badge "命格编号" | **Reuse:** `status-crown.png` or **New:** `icon-rank-card` |
| `sharePoster.ts` | 606 | 🏅 | Serial number badge | **Reuse:** `status-crown.png` or **New:** `icon-medal` |
| `sharePoster.ts` | 982 | ✨ | Footer attribution sparkle | **Remove** — decorative, not functional |
| `FinalStage.tsx` | 346 | 👆 | Tap hint "点击查看详情" | **New asset needed:** `xiaoyue-pointing-down` or animated arrow |
| `FinalStage.tsx` | 368 | 🎴 | Rank chip (visible card) | **Reuse:** `status-crown.png` |
| `FinalStage.tsx` | 369 | 🏅 | Serial chip (visible card) | **Reuse:** `status-crown.png` |
| `FinalStage.tsx` | 412 | ⚡ | Energy label "社交能量" | **New asset needed:** `icon-energy-bolt` |
| `FinalStage.tsx` | 459 | ★ | Holographic stamp | Keep — Unicode star |
| `FinalStage.tsx` | 578 | ✨ | "邀请朋友" section sparkle | **Remove** — decorative |
| `momentsPosterFactory.ts` | 484 | ★ | Square poster holo stamp | Keep — Unicode star |
| `momentsPosterFactory.ts` | 738 | 🎲 | Group reveal "盲盒开箱" | **New asset needed:** `icon-blind-box` or **Reuse:** phase icon |

### 🟡 Tier 2 — Medium Impact (Matching / Icebreaker / Events)

| File | Emoji | Context | Count | Replacement Strategy |
|------|-------|---------|-------|---------------------|
| `ChemistryBadge.tsx` | 🔥✨🌱💬 | Chemistry type badges | 4 | **Reuse existing:** `chem-fire.png`, `chem-warm.png`, `chem-sprout.png`, `chem-chat.png` |
| `matching-status/` | ✨🌱💫💬🔥 | Chemistry description lines | 15 | **Reuse existing:** chemistry badge icons |
| `matching-status/` | 😕😔 | Empty / no-match states | 2 | **Reuse existing:** `rating-2-sad.png` or `rating-3-neutral.png` |
| `matching-status/` | ✅🎉 | Success states | 2 | **Reuse existing:** `rating-5-ecstatic.png` or **New:** `icon-success-check` |
| `matching-status/` | 🎯📅📍💯 | Meta info (score, date, venue) | 4 | **Reuse existing:** `label-target.png`, `label-calendar.png`, `label-location.png` |
| `icebreaker-session/` | ✅ | Config modal checkmark | 1 | **New:** `icon-check` (styled, not emoji) |
| `icebreaker-session/` | 😅 | Phase view reaction | 1 | **Reuse:** `rating-3-neutral.png` |
| `icebreaker-session/` | ✨ | Moment card sparkle | 1 | **Remove** — decorative |
| `squad-unboxing/` | ✨🌱💫💬🔥 | Chemistry lines | 5 | **Reuse existing:** chemistry badge icons |
| `squad-unboxing/` | 🎉 | Celebration | 1 | **Reuse:** `rating-5-ecstatic.png` |
| `squad-unboxing/` | 🎯📅📍 | Meta info | 3 | **Reuse existing:** info labels |
| `pool-group-detail/` | ✨📅📍🎯👥 | Meta info | 5 | **Reuse existing:** info labels |
| `pool-group-detail/` | 🏠🌆🗺 | Venue types | 3 | **New:** `icon-venue-*` or styled text |
| `pool-group-detail/` | 🚫⚠️💬 | Status badges | 3 | **New:** `icon-blocked`, `icon-warning`, `icon-chat` |
| `event-detail/` | 📅📍👥 | Meta info | 3 | **Reuse existing:** info labels |
| `event-feedback/` | 🎉 | Celebration | 1 | **Reuse:** `rating-5-ecstatic.png` |
| `discover/` | 📍🗓👋🎁📅🤝 | Cards / actions | 6 | **Reuse existing:** info labels + **New:** `icon-gift`, `icon-handshake` |
| `event-coordination/` | 📅📍 | Meta info | 2 | **Reuse existing:** info labels |
| `pool-registration/` | 🎉🎯📅📍👥 | Success / meta | 5 | **Reuse existing:** info labels |
| `pool-registration/` | ✦ | Divider decoration | 1 | **Remove** or replace with CSS line |

### 🟢 Tier 3 — Lower Impact (Profile / Rewards / Invite / Misc)

| File | Emoji | Context | Count | Replacement Strategy |
|------|-------|---------|-------|---------------------|
| `profile/` | ✏🏆🤝🎁🗺📄 | Action icons | 6 | **New:** `icon-edit`, `icon-trophy`, `icon-friends`, `icon-gift`, `icon-map`, `icon-document` |
| `rewards/` | 🎁 | Reward icon | 1 | **Reuse:** archetype gift illustration or **New:** `icon-gift` |
| `invite/` | 🎫🎁🏆🎉 | Invite rewards | 4 | **New:** `icon-ticket`, `icon-gift`, `icon-trophy`, `icon-celebration` |
| `AnalyzingAnimation.tsx` | ✨ | Loading sparkle | 1 | **Remove** — use CSS animation instead |
| `StatusCard.tsx` | 😕✨ | Empty state | 2 | **Reuse:** `rating-3-neutral.png` |
| `JoyJoinIcon.tsx` | 📅😂 | Calendar / laugh | 2 | **New:** `icon-calendar`, `icon-laugh` |
| `XiaoyueOverlay.tsx` | ✕ | Close button | 1 | **Replace with text:** "关闭" or **New:** `icon-close` |
| `XiaoyueSessionShell.tsx` | 💡 | Hint icon | 1 | **New:** `icon-lightbulb` or styled badge |
| `LandingPage.tsx` | ✓ | Checkmark | 1 | **New:** `icon-check` |
| `onboarding/essential-data/` | ✓ | Checkmark | 1 | **New:** `icon-check` |
| `onboarding/profile-review/` | ✓ | Checkmark | 1 | **New:** `icon-check` |

### 🔵 Tier 4 — Config/Data (Non-UI or Test Files)

| File | Emoji | Context | Strategy |
|------|-------|---------|----------|
| `pool-registration/flowConfig.ts` | 🇭🇰🇨🇳🇧🇬 | Location flags | Keep or replace with text — config data |
| `pool-registration/flowConfig.ts` | 💰💎✨🌟 | Pack tiers | **New:** `icon-pack-*` tier illustrations |
| `pool-registration/flowConfig.ts` | 🍺🍸🥘🌶🍱🍝🍲🍖🥗🚫🦐🌿😋🔥🍻🕯🍹🍷😌🥤 | Food/drink preferences | **Major new asset pipeline:** food/drink icon set (~20 icons) |
| `matching-status/matchingStatusViewModels.test.ts` | 🎭🍜🥟🎯 | Test data | Keep — test files only |

---

## 3. Existing Asset Inventory (Ready to Reuse)

### Chemistry Badges (4 icons)
- `chem-fire.png` → Replace 🔥
- `chem-warm.png` → Replace ✨ (warm chemistry)
- `chem-sprout.png` → Replace 🌱
- `chem-chat.png` → Replace 💬

### Status Icons (3 icons)
- `status-crown.png` → Replace 🏅/🎴 (rank/achievement)
- `status-info.png` → Replace 💡/⚠️
- `status-waiting.png` → Replace ⏳-type indicators

### Info Labels (4 icons)
- `label-calendar.png` → Replace 📅/🗓
- `label-location.png` → Replace 📍
- `label-people.png` → Replace 👥
- `label-target.png` → Replace 🎯

### Rating Faces (5 icons)
- `rating-1-disappointed.png` → Replace 😕/😔
- `rating-3-neutral.png` → Replace 😅/😐
- `rating-5-ecstatic.png` → Replace 🎉/😂/celebration emojis

### Phase Icons (10+ icons)
- Already used for icebreaker phases — can extend for other contexts

### Archetype Glyphs + Heads (24 icons)
- Used for archetype display — not directly for emoji replacement

### Mood Icons (4 icons)
- `mood-emotional.png`, `mood-funny.png`, `mood-life.png`, `mood-relaxed.png`
- Can replace emotion emojis in feedback/icebreaker contexts

---

## 4. New Assets Needed

### Priority A — Must Have (Blocks personality share card premium feel)

| Asset ID | Purpose | Replaces | Suggested Source |
|----------|---------|----------|-----------------|
| `icon-energy-bolt` | Energy bar / active skill | ⚡ | Lovart brief: "small lightning bolt icon, JoyJoin purple-gold palette" |
| `icon-rank-crown` | Rank / serial badge | 🎴🏅 | Adapt `status-crown.png` with gold styling |
| `xiaoyue-tap-hint` | Tap hint illustration | 👆 | Xiaoyue expression: pointing finger or "tap here" pose |
| `icon-check` | Success / completion | ✅✓ | Simple styled checkmark in brand colors |

### Priority B — High Value (Matching, events, icebreaker)

| Asset ID | Purpose | Replaces | Suggested Source |
|----------|---------|----------|-----------------|
| `icon-gift` | Rewards / invites | 🎁 | Lovart brief or adapt existing |
| `icon-trophy` | Achievements | 🏆 | Adapt `status-crown.png` |
| `icon-calendar` | Date/time | 📅 (when not using label) | Adapt `label-calendar.png` |
| `icon-location` | Venue | 📍 (when not using label) | Adapt `label-location.png` |
| `icon-warning` | Alert / blocked | ⚠️🚫 | New: triangle with brand colors |
| `icon-chat` | Messages / social | 💬 (when not using chemistry) | Adapt `chem-chat.png` |
| `icon-close` | Close / dismiss | ✕ | Simple X in brand colors |

### Priority C — Nice to Have (Profile, pool registration)

| Asset ID | Purpose | Replaces | Suggested Source |
|----------|---------|----------|-----------------|
| `icon-edit` | Edit profile | ✏️ | Simple pencil icon |
| `icon-friends` | Connections | 🤝 | Two stylized figures |
| `icon-map` | Venue map | 🗺 | Map pin with brand colors |
| `icon-document` | Terms / agreement | 📄 | Document icon |
| `icon-ticket` | Invite code | 🎫 | Ticket stub icon |
| `icon-handshake` | Social match | 🤝 | Styled handshake |
| `food-icons-*` | Food preferences (20+) | 🍺🍸🥘... | Major pipeline — commission Lovart food icon set |

---

## 5. Replacement Strategy by Implementation Approach

### Approach 1: Canvas Posters (`sharePoster.ts`, `momentsPosterFactory.ts`)
**Method:** `drawImage()` with preloaded icon assets
- Bundle 128×128 PNGs for each icon
- Preload via `Taro.getImageInfo()` before canvas draw
- Draw at consistent sizes (24px, 32px, 48px depending on context)
- **Challenge:** Canvas `drawImage` doesn't support SVG; need PNG exports of all icons

### Approach 2: Visible Cards (`FinalStage.tsx`, JSX components)
**Method:** `<Image>` component with icon assets
- Use existing `@2x` / `@3x` icon sets
- Consistent sizing via SCSS (e.g., `width: 32rpx; height: 32rpx;`)
- **Challenge:** Info labels are currently 1x PNGs only — need `@2x` / `@3x` versions

### Approach 3: Text-Only Replacements (config data, badges)
**Method:** Remove emoji, use styled text
- Rank badge: "No.3" instead of "🎴 No.3"
- Energy label: "能量" instead of "⚡ 能量"
- Footer: "来 JoyJoin 测测你的社交命格" instead of "...✨"
- **Advantage:** No new assets needed
- **Trade-off:** Less visual impact, but cleaner and more premium

---

## 6. Recommended Implementation Order

### Phase 1: Personality Results (Immediate — Sprints 1–4 follow-up)
1. Replace `⚡` with "能量" text in canvas + visible card
2. Replace `🎴`/`🏅` with crown icon (`status-crown.png`) or styled text
3. Replace `👆` tap hint with Xiaoyue illustration or CSS arrow animation
4. Remove decorative `✨` sparkles from footer and sections

### Phase 2: Chemistry + Matching ✅ COMPLETE (2026-04-29)
**Shipped:**
1. `chemistryPayoff.ts` ported to mini-program — generates group-level chemistry copy
2. `composeUnifiedReveal()` fuses chemistryPayoff + connectionPoints into unified reveal
3. Chemistry card now uses `UnifiedRevealCard` component
4. All emojis stripped from `matching-status/` and `squad-unboxing/`
5. `JoyJoinIcon` component maps emoji → proprietary icons via `emojiToIconMap.ts`
6. Info labels (`📅📍🎯👥`) wired back as `JoyJoinIcon` assets
7. Status emojis replaced with CSS dots
8. `hasRevealed` flag for reveal theater
9. 12 regression tests added
10. Bundle size gate added (`scripts/check-bundle-size.mjs`)
11. Emoji commit blocker in guardrails

**Original plan (retained for reference):**
1. Replace `🔥✨🌱💬` in `ChemistryBadge.tsx` with actual chemistry badge PNGs
2. Replace `😕😔` in matching status with rating face PNGs
3. Replace `📅📍🎯👥` in matching/pool screens with info label PNGs

### Phase 3: Events + Icebreaker (Following sprint)
1. Replace `✅✓` checkmarks with styled check icon
2. Replace `😅` in icebreaker with rating face PNG
3. Replace `📅📍` in event screens with info label PNGs

### Phase 4: Profile + Misc (Low priority)
1. Replace profile action emojis with icon set
2. Replace `🎁🏆🎉` in rewards/invite with icon set

### Phase 5: Food/Drink Preferences (Requires new asset pipeline)
1. Commission Lovart food/drink icon set (~20 icons)
2. Replace all food emojis in `pool-registration/flowConfig.ts`

---

## 7. Guardrails Recommendation

Add a CI guardrail to prevent new emoji commits:

```bash
# .githooks/pre-commit or CI script
# Block Unicode emojis in mini-program source files
if git diff --cached --name-only | grep -q "apps/mini-program"; then
  if git diff --cached -- apps/mini-program/src | grep -E '[\x{1F300}-\x{1F9FF}]'; then
    echo "❌ Commit blocked: Emojis detected in mini-program source"
    echo "Use brand icons from apps/mini-program/src/assets/icons/ instead"
    exit 1
  fi
fi
```

---

## 8. Cost Estimate

| Phase | Scope | New Assets | Dev Time | Priority |
|-------|-------|-----------|----------|----------|
| 1 | Personality results | 2–3 icons | 1 day | **P0** |
| 2 | Chemistry + matching | 0 (reuse) | 1 day | **P1** |
| 3 | Events + icebreaker | 2–3 icons | 1 day | P2 |
| 4 | Profile + misc | 5–6 icons | 1 day | P2 |
| 5 | Food/drink icons | ~20 icons | 3–5 days | P3 |
| **Total** | **Full codebase** | **~30 icons** | **7–10 days** | |

---

## 9. Implementation Status

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| Question bank data cleanup | **COMPLETE** | 2026-05-20 | 137 leading emojis removed from `scenarioText` across L1/L2/Extended/Advanced/Attractor question files in `packages/shared/src/personality/` |
| Phase 1: Personality Results | Pending | — | Original highest-impact surface; not yet started |
| Phase 2: Chemistry + Matching | **COMPLETE** | 2026-04-29 | Unified reveal shipped; all emojis removed from matching-status/ and squad-unboxing/; JoyJoinIcon + emojiToIconMap.ts in place; regression tests + bundle gate + guardrails added |
| Phase 3: Events + Icebreaker | Pending | — | Original plan retained below |
| Phase 4: Profile + Misc | Pending | — | Original plan retained below |
| Phase 5: Food/Drink Preferences | Pending | — | Requires new asset pipeline |

## 10. Bottom Line

**~40% of emojis can be eliminated immediately using existing assets** (chemistry badges, info labels, rating faces, status icons).  
**~30% can be replaced with simple text** (energy labels, rank badges, decorative sparkles).  
**~30% need new icon assets** (profile actions, food preferences, tap hints).

**Recommended next step:** Implement Phase 1 (personality results) immediately as a follow-up to Sprints 1–4, since that surface is actively being worked on and has the highest user-facing impact.
