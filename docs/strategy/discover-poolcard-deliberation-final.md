# Discover PoolCard Redesign — Deliberation Final Output

> **Session:** delib_20260513_discover_poolcard
> **Trigger:** Competitive audit of JoyJoin Discover vs T46
> **Consensus:** Unanimous ACK (Alpha, Beta, Gamma)
> **Date:** 2026-05-13

---

## 1. The Converged Design: The Mirror-Habitat Card

A synthesis of Alpha narrative architecture, Beta visual world-building, and Gamma performance guardrails.

### Governing Thesis
The PoolCard is a **mirror**, not a menu. It answers one question in 1.5 seconds: *Are my people here, and will I matter?* The 7 PM sins are harnessed as calibrated psychological levers.

---

## 2. Visual Spec

### Canvas
- **Width:** 686rpx (24rpx margins)
- **Height:** 384rpx (48 x 8rpx — Taro grid-safe)
- **Border-radius:** 24rpx
- **Background:** Archetype-family gradient wash at 6% opacity + glass surface
- **Shadow:** family-color at 10%, 0 8rpx 32rpx
- **Press:** scale(0.985), shadow reduces 30%

### Layer Structure (Top to Bottom)



Total: 276rpx content + 108rpx padding = 384rpx

### Layer Details

#### L1: Ecosystem Bar (48rpx)
- 5 archetype glyphs at 40rpx, overlapping by 10rpx
- User's own archetype gets a static 2rpx brand-color ring + subtle outer glow (paint-only)
- +N badge: 32rpx circle, dark at 6% opacity
- First-load: glyphs cascade in with 50ms stagger, 300ms ease-out

#### L2: Topline (32rpx)
- Left: Live pulse pill — 24rpx height, family-color bg at 10%
  - Dot: 8rpx, family color, gentle pulse 2s infinite
  - Label: momentum label, 20rpx, semibold
- Right: Countdown pill — relative time (e.g., 48 hours until close), 20rpx, muted

#### L3: Title Row (48rpx)
- Event title: 30rpx, bold, primary text, max 1 line ellipsis
- Type badge: 22rpx height pill, family-light background

#### L4: Type-Density Teaser (44rpx)
- Background: family-color at 5% opacity, 1rpx inner border at 12%
- Content: spark icon + one-line chemistry/rarity statement
- Examples:
  - High chemistry types: 3 people · Your type is rare
  - 3 of your kind joined · High chemistry: 2 people
  - Your best partner type is here
- HARD RULE: Words AI and matching are BANNED from this surface

#### L5: Progress + CTA (104rpx)
- Progress: 6rpx track, family-color fill, X/Y people label at 20rpx
- CTA Button: full-width, 72rpx height, 20rpx radius
  - Background: solid family color
  - Text: Register Now ¥price (30rpx, white, bold)
  - Subline: Unlock full chemistry map after registration (20rpx, white at 80%)
  - Gentle pulse on first viewport: scale + opacity, 200ms, once per session
  - Active state: scale(0.97)

---

## 3. The 7-Sin Design Grid (Final)

| Sin | Lever | UI Element | Honesty Guardrail |
|---|---|---|---|
| Blindness | Reveal latent desire | Type-density teaser | Framed as type reference not match prediction |
| Vanity | Identity signaling | User archetype glow ring | Static effect only |
| Clutter | Abundance signaling | 5-layer density with overlapping glyphs | Strict 384rpx height |
| Misfit | Productive tension | Your best partner type is here | Only when complementary count > 0 |
| Isolation | Exclusivity/FOMO | Your type is rare — only 1 other | Only when userTypeCount <= 2 AND total >= 8 |
| Disrespect | Ethical urgency | Countdown + narrative scarcity | Never false urgency for closed pools |
| Myopia | Instant + deferred gratification | Unlock full chemistry map after registration | Promise is real — detail page delivers |

---

## 4. Data Architecture

### New Fields on EventPoolSummary



### Server Computation (in-memory, zero extra DB queries)

All derived fields computed inside existing /api/event-pools route using already-fetched archetypeRows:

1. USER TYPE COUNT = count of user's archetype in archetypeRows
2. USER TYPE RARITY = rare (count 0-2, total >= 8) / present / dominant
3. HIGH CHEMISTRY COUNT = sum of registrant counts for archetypes with compatibility >= 70
4. TOP COMPLEMENTARY TYPE = highest-compatible archetype (score >= 85) present in pool
5. NARRATIVE PIVOT = deterministic switch based on registrationCount, userTypeCount, userTypeRarity
6. HOURS UNTIL DEADLINE = from registrationDeadline (existing field)

Complexity: O(pools x 12) integer lookups — negligible vs existing DB queries.

---

## 5. Phase 1 Scope (2 Weeks)

### Week 1: Conversion Hygiene
- [x] Add price to EventPoolSummary and API response
- [x] Add countdown pill from registrationDeadline
- [x] Remove trust pills and inline tap-to-continue from card
- [x] Implement 5-layer 384rpx card structure
- [x] Update skeleton loading state to match new height

### Week 2: Personality Social Proof + Type-Density
- [x] Expand sampleArchetypes from 3 to 5
- [x] Implement ecosystem bar with 40rpx overlapping glyphs
- [x] Add user archetype ring highlight (static, paint-only)
- [x] Add type-density teaser (one line, honest framing)
- [x] Implement 2-branch narrative pivot (rare vs common) with pre-written strings
- [x] Add progress micro-bar + full-width priced CTA with gentle pulse

### EXPLICITLY NOT in Phase 1
- Glow animations, shimmer, starburst, pulse acceleration
- Chemistry mini-grid on detail page
- 4-branch narrative pivot (ships Phase 2)
- Post-registration anticipation engine
- Long-press interactions
- AI or matching language anywhere on card

---

## 6. Implementation Status

**Phase 1 implemented:** 2026-05-13

| Component | File | Status |
|-----------|------|--------|
| Oracle Card computation (server) | `apps/server/src/lib/oracleCardComputation.ts` | ✅ Shipped |
| Oracle Card component | `apps/mini-program/src/components/discover/OracleCard.tsx` | ✅ Shipped |
| Ecosystem Bar | `apps/mini-program/src/components/discover/EcosystemBar.tsx` | ✅ Shipped |
| Compatibility Indicator | `apps/mini-program/src/components/discover/CompatibilityIndicator.tsx` | ✅ Shipped |
| Narrative Copy Engine | `apps/mini-program/src/lib/utils/discoverNarrativeCopy.ts` | ✅ Shipped |
| Shared API types | `packages/shared/src/api.ts` (EventPoolSummary expansion) | ✅ Shipped |
| Family color tokens | `packages/shared/src/archetypeColors.ts` | ✅ Shipped |
| Route wiring | `apps/server/src/routes/domains/userEventPools.ts` | ✅ Shipped |
| Discover page integration | `apps/mini-program/src/pages/discover/index.tsx` | ✅ Shipped |
| Styles | `apps/mini-program/src/pages/discover/index.scss` | ✅ Shipped |
| Tests | `apps/server/src/__tests__/oracleCardComputation.test.ts` | ✅ 23/23 pass |

**Phase 1 audit score:** 17/20 (Good) — P0 eventType localization and P1 will-change GPU leak fixed during audit.

---

## 7. Red Lines (Consensus-Locked)

1. **Never call archetype chemistry AI match preview or compatibility prediction.** It is a deterministic lookup table. Use type-density reference or archetype chemistry reference only.
2. **Never show rarity when user archetype count = 0.** Absence is not rarity. Fallback to invitation language.
3. **No animated glow or shadow effects on glyphs in scroll list.** Static paint-only. CSS border rings for highlight states.
4. **No price UI without resolved price data contract.** Schema must have price field before CTA shows price.
5. **No dynamic copy generation at request time.** Pre-written template strings only. Deterministic switch over in-memory stats.
6. **No long-press or gesture interactions on card.** Single tap to detail page. Taro longPress is unreliable.

---

## 8. Moat Verification

T46 would need to build to copy this card:
1. Personality assessment infrastructure (6-9 months)
2. 12-archetype system with chemistry matrix (3-6 months)
3. Per-user archetype aggregation on list endpoint (2-3 months)
4. Archetype-aware visual design system (2-3 months)

Even if T46 copies the visual style (glass cards, gradient accents), they cannot copy the **data layer** that makes each card personalized. The moat compounds with every new user who completes onboarding.

---

## 9. Success Metrics

| Metric | Baseline | Phase 1 Target |
|---|---|---|
| Card scan time | Current ~3s+ | < 2s |
| Discover to Detail CTR | Current | Maintain or +10% |
| Detail to Registration | Current | Maintain or +15% |
| Price visibility | 0% | 100% |
| Visual distinctiveness score | Baseline | +50% |
| Frame rate on mid-tier Android | N/A | > 50fps in scroll |
