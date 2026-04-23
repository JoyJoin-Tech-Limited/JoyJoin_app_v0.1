# Stitch Brief: Invite Page Redesign

> **Screen:** `apps/mini-program/src/pages/invite/index.tsx`  
> **Priority:** P2 — Growth feature  
> **Current Grade:** C (28/50)  
> **Goal:** B (35+)

---

## Current Problems

1. Hero is just an emoji (`🎉`) — no illustration
2. Reward tiers are plain text
3. No visual share card preview
4. Copy buttons are functional but uninspiring
5. No Xiaoyue presence

---

## Brand System (LOCK)

Same as 01-landing-page.md.

---

## Design Requirements

### Layout
- Scrollable page
- Background: subtle warm gradient with celebratory feel

### Hero Section
- **Xiaoyue holding a gift box** illustration (center, 200rpx)
- Confetti particles (CSS animation, 5–8 small squares falling)
- Headline: "邀请好友，一起悦聚" — 44rpx, bold
- Subtitle: "每邀请一位好友，双方都有奖励" — 28rpx, gray

### Share Card Preview
- Rounded card with share preview:
  - User's invite code in large monospace font
  - QR code placeholder (square with border pattern)
  - "和我一起加入 JoyJoin" tagline
- Looks like something you'd want to screenshot and share

### Reward Ladder
- Visual ladder with 3 rungs:
  - **Rung 1 (bronze):** 1 invite → 7折优惠券 ×1
  - **Rung 2 (silver):** 3 invites → 5折优惠券 ×2
  - **Rung 3 (gold):** 5 invites → 免费月卡 ×1
- Connected by a vertical progress line
- Current progress highlighted (e.g., "已邀请 2/3" on rung 2)
- Locked rungs shown as muted/gray

### Quick Actions
- 3 buttons in a row:
  - "复制文案" — secondary
  - "保存海报" — secondary
  - "分享给好友" — primary (purple)

### Stats
- "已成功邀请 X 人" / "平台累计 Y 人"
- Small text, bottom of page

---

## Technical Constraints

- HTML/CSS mockup, mobile-first (375px)
- WXSS-safe
- Confetti animation must use `transform` only

---

## Stitch Prompt (Copy-Paste Ready)

```
Design a WeChat Mini Program "Invite Friends" page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Accent: Gold #FFD166
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, celebratory and gift-like

DESIGN REQUIREMENTS:
- Hero: Xiaoyue holding a gift box with confetti animation, headline "邀请好友，一起悦聚"
- Share card preview: rounded card with invite code in large font, QR placeholder, "和我一起加入 JoyJoin"
- Reward ladder visual:
  - 1 invite → 7折券 (bronze)
  - 3 invites → 5折券×2 (silver)
  - 5 invites → 免费月卡 (gold)
  - Connected by vertical progress line, current progress highlighted
- Quick actions: "复制文案", "保存海报", "分享给好友"
- Stats: "已成功邀请 X 人" / "平台累计 Y 人"
- Celebratory, gift-like, viral-worthy design

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe, confetti uses transform only.
```
