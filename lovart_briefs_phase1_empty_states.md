# Phase 1 — Empty State Illustrations: Asset Strategy Update

## Strategy Change (2026-04-22)

After auditing web (`apps/user-client`) assets, we discovered that web already has Lovart-generated SVG illustrations for most empty/error states. These SVGs convert to compact WebP (33–59 KB) via sharp and can be reused in the mini-program.

**Result:** Only **3 new Lovart assets** are needed (down from 7).

| Scene | Original Plan | New Approach | Asset Path |
|-------|--------------|--------------|------------|
| Rewards — no coupons | New Lovart | **New Lovart** (no web equivalent) | `lovart-rewards-empty-{date}-v1` |
| Rewards — shop unavailable | New Lovart | **New Lovart** (no web equivalent) | `lovart-rewards-shop-{date}-v1` |
| Rewards — no history | New Lovart | **New Lovart** (no web equivalent) | `lovart-rewards-history-{date}-v1` |
| Discover — no pools | New Lovart | **Reuse web** `gift box + animals` | `lovart-generic-empty.webp` |
| Events — no events | New Lovart | **Reuse web** `gift box + animals` | `lovart-generic-empty.webp` |
| Connections — no connections | New Lovart | **Reuse web** `gift box + animals` | `lovart-generic-empty.webp` |
| Pool reg — unavailable | New Lovart | **Reuse web** `join-error-hero` | `lovart-generic-error.webp` |

Additional web assets converted:
- `extended-data-empty-hero` → `lovart-profile-incomplete.webp`
- `test-incomplete-hero` → `lovart-test-incomplete.webp`

Existing mini-program PNGs optimized to WebP:
- `center-empty-illustration`, `center-empty-bg`, `matching-bg`, `matching-no-match-hero`, `matching-waiting-hero`

---

## Remaining: 3 Lovart Briefs for Rewards

### 1. Rewards — "No Rewards Yet"

**Goal:** A warm, hopeful empty state for the rewards page when the user hasn't earned any rewards yet.

**Brand Parameters**
- Primary color: Vibrant Purple `#8B5CF6` — subtle accent sparkles
- Secondary: Warm Coral `#FF9B85` — small warm highlights
- Background: Warm Beige `#F5F1E8` with soft radial glow
- Mascot: Koala — calm, warm, patient personality
- Visual tone: warm, cute, rounded, soft, minimal, refined, breathable

**Asset Specifications**
- Type: empty-state-illustration
- Platform: mini-program
- Dimensions: 800×800px
- Aspect ratio: 1:1
- Export: PNG transparent

**Prompt Draft**
> Create a warm, hopeful empty-state illustration for a social app's rewards screen.
>
> **Character:** The koala mascot — round fluffy ears, gentle half-lidded eyes, small soft smile. Calm and patient personality. Sitting comfortably with front paws resting on a small open gift box that contains only a few soft sparkles.
>
> **Scene:** Minimal background. The koala is centered. A few tiny Vibrant Purple `#8B5CF6` sparkles float gently above the empty gift box. One or two Warm Coral `#FF9B85` confetti dots drift nearby — keep it very light, not cluttered.
>
> **Style:** Soft-lined illustration, warm pastel tones, rounded organic shapes, minimal detail. Modern app illustration style — cute but tasteful, never childish. No sharp edges or harsh shadows.
>
> **Color palette:**
> - Background: transparent (for overlay on app UI)
> - Koala fur: soft gray with warm cream belly and ear interiors
> - Gift box: Warm Beige `#F5F1E8` with Vibrant Purple `#8B5CF6` ribbon
> - Sparkles: Vibrant Purple `#8B5CF6` at low opacity
> - Accents: Warm Coral `#FF9B85` for tiny confetti dots
> - Eye highlights: Soft White `#FFFFFF`
>
> **Mood:** Hopeful and patient — "Good things are coming your way." The koala should feel reassuring, not sad about the empty box.
>
> **Composition:** Centered character with generous breathing space. The gift box should feel small and intimate, not dominant.
>
> **No text** in the illustration.
>
> **Export:** PNG with transparent background, 800×800px, clean edges.

**Integration:** Replace `lovart-generic-empty.webp` in `rewards/index.tsx` (coupons empty state).

---

### 2. Rewards — "Redeem Shop Unavailable"

**Goal:** A reassuring empty state when the rewards redeem shop is temporarily down or under maintenance.

**Brand Parameters**
- Primary color: Warm Beige `#F5F1E8` — background wash
- Accent: Sky Blue `#A8C5DD` — "construction" sign elements
- Mascot: Turtle — steady, reliable, reassuring
- Visual tone: warm, cute, rounded, soft, minimal, refined

**Asset Specifications**
- Type: empty-state-illustration
- Platform: mini-program
- Dimensions: 800×800px
- Export: PNG transparent

**Prompt Draft**
> Create a warm, reassuring empty-state illustration for a social app's rewards shop when it's temporarily unavailable.
>
> **Character:** The turtle mascot — small round shell with soft hexagonal pattern, gentle patient eyes, small friendly smile. Steady and reliable personality. Peeking from behind a small cute "建设中" (under construction) sign or a gently closed shop door.
>
> **Scene:** The turtle is slightly off-center, peeking around a soft rounded sign. The sign is Warm Beige `#F5F1E8` with Sky Blue `#A8C5DD` border and a small hammer or wrench icon in Vibrant Purple `#8B5CF6`. Keep the sign small and cute, not industrial.
>
> **Style:** Soft-lined illustration, warm pastel tones, rounded organic shapes, minimal background detail. Cute but tasteful — the construction theme should feel gentle and temporary, not harsh.
>
> **Color palette:**
> - Background: transparent
> - Turtle shell: soft green-brown with warm cream accents
> - Sign: Warm Beige `#F5F1E8` with Sky Blue `#A8C5DD` border
> - Tool icon: Vibrant Purple `#8B5CF6`
> - Skin: warm cream
>
> **Mood:** Reassuring and patient — "We're working on it, come back soon." The turtle's steady presence should make the user feel calm about the temporary unavailability.
>
> **No text** in the illustration.
>
> **Export:** PNG transparent, 800×800px.

**Integration:** Replace `lovart-generic-empty.webp` in `rewards/index.tsx` (redeemable empty state, compact variant).

---

### 3. Rewards — "No Reward History"

**Goal:** An encouraging empty state when the user has no reward history yet.

**Brand Parameters**
- Primary color: Vibrant Purple `#8B5CF6` — calendar/scroll accent
- Accent: Fresh Green `#9ACD32` — growth, positive signal
- Mascot: Koala — calm, warm, thoughtful
- Visual tone: warm, cute, rounded, soft, lively, minimal

**Asset Specifications**
- Type: empty-state-illustration
- Platform: mini-program
- Dimensions: 800×800px
- Export: PNG transparent

**Prompt Draft**
> Create an encouraging empty-state illustration for a social app's rewards history screen.
>
> **Character:** The koala mascot — round fluffy ears, gentle thoughtful eyes, small content smile. Warm and patient personality. Looking at a small empty scroll or calendar page with a curious, optimistic expression.
>
> **Scene:** The koala is centered, holding or looking at a small unfurled scroll/blank calendar page. A few small Fresh Green `#9ACD32` leaf or star sparkles float near the scroll suggesting future growth. One Vibrant Purple `#8B5CF6` bookmark ribbon dangles from the scroll.
>
> **Style:** Soft-lined illustration, warm pastel tones, rounded organic shapes. The koala should feel like it's saying "Your story is just beginning!" — optimistic, not disappointed.
>
> **Color palette:**
> - Background: transparent
> - Koala: soft gray with warm cream belly and ear interiors
> - Scroll/calendar: Warm Beige `#F5F1E8` with Vibrant Purple `#8B5CF6` ribbon
> - Growth sparkles: Fresh Green `#9ACD32`
> - Cheeks: soft Warm Coral `#FF9B85` blush
>
> **Mood:** Encouraging and optimistic — "Keep going, your first reward is just around the corner."
>
> **No text** in the illustration.
>
> **Export:** PNG transparent, 800×800px.

**Integration:** Replace `lovart-generic-empty.webp` in `rewards/index.tsx` (history empty state, compact variant).

---

## Integration Quick Reference (Implemented)

| Page | State | Asset Used | Status |
|------|-------|-----------|--------|
| `discover` | Empty pools | `lovart-generic-empty.webp` | ✅ Integrated |
| `discover` | Load error | `lovart-generic-error.webp` | ✅ Integrated |
| `events` | Empty upcoming/completed | `lovart-generic-empty.webp` | ✅ Integrated |
| `connections` | No connections | `lovart-generic-empty.webp` | ✅ Integrated |
| `rewards` | No coupons | `lovart-generic-empty.webp` | ⏳ Placeholder — swap with `#1` |
| `rewards` | Shop unavailable | `lovart-generic-empty.webp` | ⏳ Placeholder — swap with `#2` |
| `rewards` | No history | `lovart-generic-empty.webp` | ⏳ Placeholder — swap with `#3` |
| `rewards` | Load error | `lovart-generic-error.webp` | ✅ Integrated |
| `pool-registration` | Unavailable | `lovart-generic-error.webp` | ✅ Integrated |
| `matching-status` | Error | `lovart-generic-error.webp` | ✅ Integrated |
| `matching-status` | Not found | `lovart-generic-error.webp` | ✅ Integrated |
| `squad-unboxing` | Error | `lovart-generic-error.webp` | ✅ Integrated |
| `icebreaker-session` | Error | `lovart-generic-error.webp` | ✅ Integrated |
| `event-detail` | Error | `lovart-generic-error.webp` | ✅ Integrated |
| `pool-group-detail` | Error | `lovart-generic-error.webp` | ✅ Integrated |

## Post-Generation Steps

After generating the 3 remaining PNGs:

1. Save to `apps/mini-program/raw-assets/lovart/`
2. Run:
   ```bash
   cd apps/mini-program && npm run optimize:lovart && npm run check:lovart-assets
   ```
3. Update `rewards/index.tsx` to swap placeholder paths:
   - `#1` → `lovart-rewards-empty-{date}-v1.webp`
   - `#2` → `lovart-rewards-shop-{date}-v1.webp`
   - `#3` → `lovart-rewards-history-{date}-v1.webp`
