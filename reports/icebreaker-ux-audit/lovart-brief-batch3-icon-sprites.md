# Lovart Batch 3 — Icon Sprite Sheets (3 Sets)

> **Purpose:** Small UI icons for states, currency, and role indicators  
> **Style lock:** JoyJoin low-poly geometric faceted illustration  
> **Format:** PNG sprite sheets (WeChat mini-program friendly)  
> **Request approach:** Generate 3 sprite sheets in one ChatCanvas session

---

## Shared Style Parameters

**Construction:** 2D digital illustration with low-poly / geometric faceted aesthetic  
**Size:** Small icons at 48–80px, readable at mini-program scale  
**Color mode:** Flat color fills with subtle facet shading (not line art)  
**Background:** Transparent (PNG alpha)  
**Anti-generic rule:** Must feel JoyJoin-native — rounded, warm, slightly playful

---

## Sprite Sheet 1: Auction Currency Icons

**File:** `lovart-icons-auction-coins-20260427-v1.png`  
**Layout:** 3 icons in a horizontal strip, each 64×64px, total 192×64px  
**Platform:** Mini-program (PNG, transparent)

| Position | Icon Name | Description | Color |
|----------|-----------|-------------|-------|
| 1 (left) | **Coin Stack** | 3–4 gold coins stacked in a small pile, slight overlap, geometric faceted surfaces catching light | Gold `#D4A017` |
| 2 (center) | **Single Coin** | One prominent gold coin standing upright at a slight angle, showing thickness/edge, star sparkle accent | Gold `#D4A017` + sparkle `#FFFFFF` |
| 3 (right) | **Empty Purse** | A sad/deflated coin pouch with a tiny single coin peeking out, droopy shape conveying "insufficient balance" | Warm gray `#9CA3AF` with gold `#D4A017` accent |

**Usage in code:**
```tsx
// Sprite sheet usage with background-position
<View className='coin-icon coin-icon--stack' />
<View className='coin-icon coin-icon--single' />
<View className='coin-icon coin-icon--empty' />
```

```scss
.coin-icon {
  width: 64rpx;
  height: 64rpx;
  background: url('.../lovart-icons-auction-coins.png') no-repeat;
  background-size: 192rpx 64rpx;
  &--stack { background-position: 0 0; }
  &--single { background-position: -64rpx 0; }
  &--empty { background-position: -128rpx 0; }
}
```

### Prompt Draft
> Create a set of 3 small currency icons for a social auction game mini-program. Low-poly geometric faceted style, warm and playful.
>
> Icon 1 — Coin Stack: 3–4 gold coins stacked with slight overlap, geometric faceted surfaces, warm gold #D4A017.
>
> Icon 2 — Single Coin: One prominent gold coin standing at a slight angle showing thickness, with a tiny sparkle accent.
>
> Icon 3 — Empty Purse: A sad deflated coin pouch with one tiny coin peeking out, droopy shape, warm gray #9CA3AF with gold accent.
>
> All 3 icons arranged horizontally in one image: each 64×64px, total 192×64px. Transparent background. No text. Cute but not childish.

---

## Sprite Sheet 2: Personality Dice Pass/Accept Icons

**File:** `lovart-icons-dice-passaccept-20260427-v1.png`  
**Layout:** 2 icons in a horizontal strip, each 80×80px, total 160×80px  
**Platform:** Mini-program (PNG, transparent)

| Position | Icon Name | Description | Color |
|----------|-----------|-------------|-------|
| 1 (left) | **Accept Flame** | A bold flame burst / fireball shape, dynamic upward motion, suggesting courage and commitment | Amber `#F59E0B` + red-orange `#EF4444` core |
| 2 (right) | **Pass Retreat** | A playful "white flag" or retreat gesture — maybe a cute sweat-drop with a small backward arrow, or a tiny shield with a gentle "nope" wave | Sky Blue `#A8C5DD` + soft gray `#9CA3AF` |

**Usage in code:**
```tsx
<Button variant='primary' icon={<View className='dice-icon dice-icon--accept' />}>
  接受挑战
</Button>
<Button variant='secondary' icon={<View className='dice-icon dice-icon--pass' />}>
  认怂
</Button>
```

### Prompt Draft
> Create 2 small action icons for a social dare/challenge game mini-program. Low-poly geometric faceted style.
>
> Icon 1 — Accept Flame: A bold flame burst shape with dynamic upward motion, warm amber #F59E0B with red-orange #EF4444 core. Suggests courage and commitment.
>
> Icon 2 — Pass Retreat: A playful retreat gesture — a cute sweat-drop with a tiny backward arrow, or a small white-flag wave. Soft sky blue #A8C5DD with gray #9CA3AF. Not sad, just gently opting out.
>
> Arranged horizontally: each 80×80px, total 160×80px. Transparent background. No text. Warm and playful mood.

---

## Sprite Sheet 3: Undercover Word Role Icons

**File:** `lovart-icons-undercover-roles-20260427-v1.png`  
**Layout:** 2 icons in a horizontal strip, each 64×64px, total 128×64px  
**Platform:** Mini-program (PNG, transparent)

| Position | Icon Name | Description | Color |
|----------|-----------|-------------|-------|
| 1 (left) | **Detective Badge** | A small shield or star badge with a checkmark, indicating "civilian / correct / verified" | Fresh Green `#9ACD32` + gold `#D4A017` border |
| 2 (right) | **Shadow Mask** | A mysterious half-mask or silhouette with a subtle question mark, indicating "undercover / hidden / suspect" | Indigo `#312E81` + violet `#7C3AED` glow |

**Usage in code:**
```tsx
// Next to player names during voting or reveal
<View className='role-icon role-icon--civilian' />
<View className='role-icon role-icon--undercover' />
```

```scss
.role-icon {
  width: 64rpx;
  height: 64rpx;
  background: url('.../lovart-icons-undercover-roles.png') no-repeat;
  background-size: 128rpx 64rpx;
  &--civilian { background-position: 0 0; }
  &--undercover { background-position: -64rpx 0; }
}
```

### Prompt Draft
> Create 2 small role icons for a social word-guessing deduction game mini-program. Low-poly geometric faceted style.
>
> Icon 1 — Detective Badge: A small shield badge with a checkmark, indicating "civilian / verified". Fresh green #9ACD32 with gold #D4A017 border.
>
> Icon 2 — Shadow Mask: A mysterious half-mask silhouette with a subtle question mark glow, indicating "undercover / hidden". Deep indigo #312E81 with violet #7C3AED glow.
>
> Arranged horizontally: each 64×64px, total 128×64px. Transparent background. No text. Mystery/deduction mood.

---

## Set Cohesion Checklist

Before approving all 3 sprite sheets:
- [ ] All icons share the same low-poly geometric faceted construction style
- [ ] All icons have consistent visual weight (not one thick, one thin)
- [ ] Colors come from the JoyJoin brand palette (no neon, no pure black)
- [ ] Icons are readable at 64rpx–80rpx display size
- [ ] Transparent backgrounds are clean (no stray pixels)
- [ ] Each icon passes the anti-generic test

## Storage

```
apps/mini-program/src/assets/lovart/icebreaker/icons/
├── lovart-icons-auction-coins-20260427-v1.png
├── lovart-icons-dice-passaccept-20260427-v1.png
└── lovart-icons-undercover-roles-20260427-v1.png
```

## Engineering Notes

- Sprite sheets save HTTP requests vs individual files
- Each icon displayed via `background-image` + `background-position` (CSS sprite technique)
- For accessibility, wrap icon-only elements with `aria-label`
- If sprite sheets feel too complex, individual PNGs work too — just 3 extra files

## Bottom Line

> **3 sprite sheets, 7 total icons.** Auction currency (3), dice actions (2), undercover roles (2). All small, transparent, brand-colored, low-poly geometric style. Estimated total: ~30–50KB.
