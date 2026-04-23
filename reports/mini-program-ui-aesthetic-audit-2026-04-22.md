# Mini-Program UI Aesthetic Audit & Stitch Gap Report

> **Date:** 2026-04-22  
> **Auditor:** Agent swarm (systematic code review)  
> **Scope:** `apps/mini-program/src/pages/*` — all 29 unique screens  
> **Framework:** 5-Pillar Aesthetic Scorecard (Brand Consistency 25%, Structural Quality 25%, Interaction Clarity 20%, Emotional Polish 20%, Performance Safety 10%)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Screens audited | 29 |
| Grade A (42–50) | 0 |
| Grade B (35–41) | 6 |
| Grade C (25–34) | 22 |
| Grade D/F (0–24) | 1 (Terms — intentionally plain) |
| **Auto-Stitch (D/F)** | 0 |
| **Candidate-Stitch** | 7 |
| **Immediate token fixes** | 4 (ad-hoc gradient colors) |

**Bottom line:** No screen is catastrophically broken, but the mini-program has a **systematic emotional-polish deficit**. 22 of 29 screens are Grade C — functional but forgettable. The highest-impact wins are: (1) replacing ad-hoc gradients with brand tokens, (2) adding Xiaoyue mascot moments to functional pages, and (3) Stitch-redesigning the 7 candidate screens where layout and emotional resonance need reinvention.

---

## 1. The 5-Pillar Scorecard

### Pillar Definitions

| # | Pillar | Weight | What we look for |
|---|--------|--------|------------------|
| 1 | **Brand Consistency** | 25% | Correct color tokens, typography roles, mascot usage, illustration style, no ad-hoc hexes |
| 2 | **Structural Quality** | 25% | Loading, empty, error, success, disabled, pressed states; safe areas; responsive layout |
| 3 | **Interaction Clarity** | 20% | One clear primary action, obvious purpose, readable hierarchy, purposeful transitions |
| 4 | **Emotional Polish** | 20% | Delight, completion celebration, mascot presence, micro-interactions, wow moments |
| 5 | **Performance Safety** | 10% | CSS transform/opacity animations, image dimensions, no layout thrash, VirtualList where needed |

### Grade Scale

| Grade | Score | Verdict |
|-------|-------|---------|
| A | 42–50 | Premium — no Stitch needed |
| B | 35–41 | Good — minor polish only |
| C | 25–34 | Acceptable — Stitch candidate if Brand < 5 or Emotional < 4 |
| D | 15–24 | Weak — auto-Stitch |
| F | 0–14 | Broken — auto-Stitch |

### Stitch Candidacy Rules

- **D/F grade** → Auto-Stitch redesign brief
- **C grade + (Brand < 5 OR Emotional < 4)** → Candidate-Stitch
- **A/B grade** → No Stitch; minor CSS/token fixes only

---

## 2. Screen-by-Screen Scorecard

### Onboarding Flow (8 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 1 | `LandingPage` | 4 | 7 | 7 | 4 | 8 | **30** | C | **Candidate** — Brand < 5 |
| 2 | `LoginPage` | 7 | 8 | 9 | 7 | 9 | **40** | B | No |
| 3 | `OnboardingEntry` | 5 | 7 | 7 | 5 | 9 | **33** | C | No — transitional |
| 4 | `EssentialData` | 6 | 8 | 7 | 6 | 8 | **35** | B | No |
| 5 | `ExtendedData` | 5 | 8 | 8 | 7 | 7 | **35** | B | No |
| 6 | `PersonalityTest` | 6 | 8 | 8 | 8 | 7 | **37** | B | No |
| 7 | `PersonalityResults` | 7 | 8 | 9 | 9 | 7 | **40** | B | No |
| 8 | `ProfileReview` | 5 | 7 | 7 | 5 | 8 | **32** | C | No — transitional |

### Core Product (6 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 9 | `Discover` | 4 | 7 | 7 | 4 | 7 | **29** | C | **Candidate** — Brand < 5 |
| 10 | `EventDetail` | 4 | 6 | 6 | 3 | 8 | **27** | C | **Candidate** — Brand < 5, Emotional < 4 |
| 11 | `Events` | 6 | 7 | 7 | 5 | 7 | **32** | C | No |
| 12 | `PoolRegistration` | 6 | 8 | 8 | 6 | 7 | **35** | B | No |
| 13 | `MatchingStatus` | 6 | 8 | 8 | 7 | 7 | **36** | B | No |
| 14 | `SquadUnboxing` | 7 | 8 | 8 | 8 | 7 | **38** | B | No |

### Social & Community (3 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 15 | `IcebreakerSession` | 6 | 7 | 7 | 6 | 6 | **32** | C | No — container for phase views |
| 16 | `PoolGroupDetail` | 6 | 7 | 6 | 5 | 7 | **31** | C | No |
| 17 | `Connections` | 4 | 6 | 6 | 4 | 8 | **28** | C | **Candidate** — Brand < 5 |

### User & Settings (4 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 18 | `Profile` | 5 | 7 | 6 | 4 | 8 | **30** | C | **Candidate** — Emotional < 4 |
| 19 | `EditProfile` | 4 | 6 | 6 | 3 | 7 | **26** | C | **Candidate** — Brand < 5, Emotional < 4 |
| 20 | `Rewards` | 5 | 7 | 6 | 4 | 7 | **29** | C | **Candidate** — Emotional < 4 |
| 21 | `CenterTabEmpty` | 6 | 6 | 6 | 6 | 8 | **32** | C | No — has custom illustration |

### Transactional (4 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 22 | `BlindBoxPayment` | 6 | 7 | 7 | 6 | 7 | **33** | C | No |
| 23 | `PaymentVerification` | 6 | 7 | 7 | 6 | 8 | **34** | C | No |
| 24 | `EventCoordination` | 4 | 6 | 6 | 3 | 8 | **27** | C | **Candidate** — Brand < 5, Emotional < 4 |
| 25 | `EventFeedback` | 6 | 7 | 7 | 7 | 8 | **35** | B | No |

### Utility (4 screens)

| # | Screen | Brand | Structural | Interaction | Emotional | Perf | **Total** | **Grade** | **Stitch?** |
|---|--------|-------|------------|-------------|-----------|------|-----------|-----------|-------------|
| 26 | `InvitePage` | 4 | 6 | 6 | 4 | 8 | **28** | C | **Candidate** — Brand < 5 |
| 27 | `Terms` | 5 | 5 | 5 | 3 | 9 | **27** | C | No — intentionally plain legal page |
| 28 | `Index` (redirect) | N/A | 8 | 7 | 4 | 9 | — | — | Not a user-facing screen |
| 29 | `PersonalityTest/AuthGate` | 5 | 6 | 6 | 4 | 8 | **29** | C | No — simple auth gate |

---

## 3. Top Issues by Category

### 3.1 Brand Consistency Gaps (Most Common)

| Issue | Affected Screens | Severity | Fix Type |
|-------|-----------------|----------|----------|
| Ad-hoc gradient backgrounds (`#FAFAFA` → `#FFF5F7` → `#FFE4E1`) | Discover, EventDetail, EventCoordination | Medium | Token swap — no Stitch |
| LandingPage hero card colors (`#E8A598`, `#C9A87C`, `#8FBFA3`) not in brand palette | LandingPage | High | Needs 插画风 illustration (Lovart) + color fix |
| Category dot colors in ExtendedData (`#E8A87C`, `#8FB8E8`, etc.) not in brand palette | ExtendedData | Medium | Token swap |
| Text colors (`#7B6A96`, `#8B7AAD`, `#6B5B8D`) not in brand palette | LandingPage, LoginPage | Low | Token swap |
| Connections page uses text initials instead of archetype avatars | Connections | Medium | Component swap — no Stitch |

### 3.2 Emotional Polish Gaps

| Issue | Affected Screens | Severity |
|-------|-----------------|----------|
| No Xiaoyue mascot on functional pages | Profile, EditProfile, Connections, Rewards, EventDetail | High |
| No completion celebration on form submits | EditProfile, EventFeedback (has it), Rewards | Medium |
| Generic loading states (LoadingScreen only) | Events, Connections, Profile | Medium |
| Empty states lack custom illustration | Events (no empty state), EditProfile | Medium |

### 3.3 Structural Quality Gaps

| Issue | Affected Screens | Severity |
|-------|-----------------|----------|
| Missing empty state | EventDetail, Events | Medium |
| No error retry pattern | EditProfile | Low |
| Simple loading (text only) | EventDetail, EventCoordination | Low |

---

## 4. Stitch Redesign Briefs (7 Candidates)

> **Priority order:** Impact × Frequency of use × Emotional opportunity

---

### Brief #1: LandingPage — "First Impression Glow-Up"

**Priority:** 🔴 P0 — Highest impact  
**Current Score:** 30/50 (C)  
**Why Stitch:** First impression screen. Hero cards use generic photos + ad-hoc colors. Needs 插画风 illustration system + layout reinvention.

**Current Pain Points:**
1. Hero card images (`match.webp`, `dinner.webp`, `continue.webp`) are generic photos, not 插画风 low-poly illustrations
2. Card border/background colors (`#E8A598`, `#C9A87C`, `#8FBFA3`) are not in the 8-color brand palette
3. Subtitle text (`#7B6A96`) and legal text (`#6B5B8D`) use ad-hoc colors
4. Two CTAs compete for attention (primary + login)
5. No scroll — all content crammed above fold on small screens

**Stitch Prompt:**

```
Design a WeChat Mini Program landing page for "JoyJoin" (悦聚), 
a social-matching app for urban Chinese youth (18-35).

BRAND SYSTEM (must follow exactly):
- Primary: Vibrant Purple #8B5CF6
- Secondary: Warm Coral #FF9B85
- Background: Soft Cream #FFF8F5
- Surface: Warm White #FFFCFA
- Text Primary: Deep Charcoal #2D213F
- Text Secondary: Muted Purple #6B5B8D
- Accent Mint: #7FD8BE, Accent Gold: #FFD166
- Font: AlimamaFangYuanTiVF (rounded, friendly Chinese display font)
- Mascot: Xiaoyue (小悦), a cute purple AI assistant character
- Illustration style: 插画风 low-poly, flat vector, vibrant colors

DESIGN REQUIREMENTS:
- Full-screen viewport, no page scroll (100dvh)
- Top: 3 overlapping hero cards showing "dinner gathering", 
  "drinks night", "outdoor activity" — each card uses 插画风 
  low-poly illustration (NOT photos)
- Cards use brand colors only: purple, coral, mint, gold
- Center: Large headline "让对的相遇不再错过" in brand font
- Below headline: 3 value-prop badges (pills)
- Bottom: Large primary CTA "看看我会遇见谁" (purple, rounded, 
  with shadow), secondary text link "已有账号？登录"
- Xiaoyue mascot peeking from bottom corner
- Warm, inviting, premium feel — like a high-end social app

TECHNICAL: HTML/CSS mockup, mobile-first (375px), WXSS-safe 
(no backdrop-filter), TaroJS-compatible.
```

**Alternative:** Instead of Stitch for hero illustrations, route to **Lovart** for 3 插画风 card illustrations, then use Stitch for layout composition.

**Effort:** Medium (layout + illustration coordination)  
**Expected Lift:** Brand 4→8, Emotional 4→7 → Overall 30→38 (C→B)

---

### Brief #2: Discover — "Blind Box Marketplace"

**Priority:** 🔴 P0 — Most visited screen  
**Current Score:** 29/50 (C)  
**Why Stitch:** Core product surface. Ad-hoc gradient, functional listing, no delight moments.

**Current Pain Points:**
1. Background gradient uses ad-hoc colors (`#FAFAFA` → `#FFF5F7` → `#FFE4E1`)
2. Pool cards are functional but generic
3. No Xiaoyue presence on the main discovery surface
4. Filter chips are plain
5. VirtualList is good for performance but cards lack visual punch

**Stitch Prompt:**

```
Design a WeChat Mini Program "Discover" feed for JoyJoin (悦聚), 
showing social event "pools" (盲盒活动) that users can join.

BRAND SYSTEM (must follow exactly):
- Primary: Vibrant Purple #8B5CF6, Secondary: Warm Coral #FF9B85
- Background: Soft Cream #FFF8F5, Surface: Warm White #FFFCFA
- Text: Deep Charcoal #2D213F, Muted Purple #6B5B8D
- Accent: Mint #7FD8BE, Gold #FFD166
- Font: AlimamaFangYuanTiVF
- Illustration: 插画风 low-poly flat vector

DESIGN REQUIREMENTS:
- Sticky top header with greeting "[Name]，今晚想怎么玩？"
- Horizontal scroll filter chips: "全部", "饭局", "酒局", "户外" 
  — active chip has purple background + white text
- Quick action row: 2 cards "AI 配桌" and "我的活动"
- Event pool cards in vertical feed, each card:
  - Top: event type badge (饭局/酒局) + status (报名中/即将满员)
  - Hero image area with gradient overlay
  - Title, date, location, price
  - "已报 X/Y 人" progress bar
  - "立即报名" CTA button
- Bottom tab bar (custom): 发现 / 活动 / 消息 / 我的
- One card should show a "盲盒" sealed visual before matching
- Warm, playful, premium — like a social marketplace

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Medium  
**Expected Lift:** Brand 4→7, Emotional 4→6 → Overall 29→35 (C→B)

---

### Brief #3: EventDetail — "Event Story Page"

**Priority:** 🟡 P1 — High intent page  
**Current Score:** 27/50 (C)  
**Why Stitch:** Users view this before registering. Currently plain info-dump with ad-hoc gradient.

**Current Pain Points:**
1. Ad-hoc gradient background (same as Discover)
2. Info rows are plain label-value pairs with emoji prefixes
3. No visual hierarchy — everything looks equally important
4. No Xiaoyue mascot
5. Support QR card is the most visually interesting element
6. No hero image or event atmosphere preview

**Stitch Prompt:**

```
Design a WeChat Mini Program event detail page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #FFF8F5
- Font: AlimamaFangYuanTiVF, Text: #2D213F / #6B5B8D
- Style: 插画风 low-poly flat vector, warm and inviting

DESIGN REQUIREMENTS:
- Hero section: large event image/illustration with gradient overlay,
  event title overlaid, type badge (饭局/酒局)
- Info card with: date (calendar icon), location (pin icon), 
  attendee count (people icon), status badge
- Description section with section header
- "活动氛围" preview card showing expected vibe (e.g., "轻松小酌" 
  with matching color accent)
- "报名须知" expandable section
- Fixed bottom CTA: "立即报名 ¥XXX" (large purple button)
- Xiaoyue tip bubble: "小悦提示：这场活动的氛围和你很搭哦~"
- Premium, magazine-like layout — not a form

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Low-Medium  
**Expected Lift:** Brand 4→7, Emotional 3→6 → Overall 27→33 (C→C, closer to B)

---

### Brief #4: Profile — "My JoyJoin Identity"

**Priority:** 🟡 P1 — Frequently visited  
**Current Score:** 30/50 (C)  
**Why Stitch:** Currently a flat settings list. Should celebrate the user's identity and archetype.

**Current Pain Points:**
1. Flat list of settings links
2. No archetype celebration (user's personality result is hidden)
3. No visual summary of interests, connections, or activity
4. No Xiaoyue presence
5. Coupons/rewards are buried in plain text
6. Logout button is visually prominent (should be de-emphasized)

**Stitch Prompt:**

```
Design a WeChat Mini Program profile page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #FFF8F5
- Font: AlimamaFangYuanTiVF, Archetype colors: 12 colors for 
  12 personality types
- Style: 插画风 low-poly, personal and celebratory

DESIGN REQUIREMENTS:
- Top: Profile header with avatar, display name, and archetype badge
  (e.g., "开心柯基" with archetype color background)
- Archetype card: small illustration of the user's archetype mascot,
  trait scores radar or tag cloud
- Stats row: "参加活动 X 次" / "连接 Y 人" / "获得 Z 赞"
- Menu cards (not plain list): 
  - "我的活动" with preview of next event
  - "我的连接" with count badge
  - "奖励中心" with coupon count
  - "编辑资料"
- Bottom: small "退出登录" text link (de-emphasized)
- Xiaoyue greeting: "[Name]，你今天想探索什么？"
- Personal, warm, identity-celebrating — like a social passport

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Medium  
**Expected Lift:** Brand 5→7, Emotional 4→7 → Overall 30→36 (C→B)

---

### Brief #5: Connections — "My JoyJoin Network"

**Priority:** 🟡 P1 — Social core  
**Current Score:** 28/50 (C)  
**Why Stitch:** Text-initial avatars and plain cards feel cheap. Should feel like a curated social network.

**Current Pain Points:**
1. Avatars are text initials (colored circle + first letter) — no archetype visuals
2. Cards are plain with minimal info
3. No grouping by event or archetype chemistry
4. No empty state illustration
5. No action beyond "copy WeChat ID"

**Stitch Prompt:**

```
Design a WeChat Mini Program "Connections" page for JoyJoin (悦聚),
showing people the user met at events.

BRAND SYSTEM:
- Primary: #8B5CF6, Background: #FFF8F5, Surface: #FFFCFA
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, social and warm

DESIGN REQUIREMENTS:
- Header: "我的连接" with subtitle "活动后建立的联系"
- Connection cards in vertical list, each card:
  - Archetype avatar (small mascot illustration, not text initial)
  - Name + archetype label (e.g., "小明 · 开心柯基")
  - "来自：周五饭局" event tag
  - Chemistry score badge (e.g., "默契度 85%")
  - "复制微信号" action button
- Group by event with section headers
- Empty state: Xiaoyue illustration + "参加活动后，这里会出现你的新朋友"
- Premium social network feel — not a contacts list

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Medium (needs archetype avatar assets)  
**Expected Lift:** Brand 4→7, Emotional 4→6 → Overall 28→34 (C→C, closer to B)

---

### Brief #6: EditProfile — "Profile Studio"

**Priority:** 🟢 P2 — Lower frequency but important  
**Current Score:** 26/50 (C)  
**Why Stitch:** Functional form without any emotional coaching or mascot presence.

**Current Pain Points:**
1. Form-only layout — no visual delight
2. No Xiaoyue coaching (unlike EssentialData which has it)
3. Interest selection is dense and overwhelming
4. No preview of how profile will look to others
5. Save button is the only visual anchor

**Stitch Prompt:**

```
Design a WeChat Mini Program "Edit Profile" page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Background: #FFF8F5
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, friendly and approachable

DESIGN REQUIREMENTS:
- Top: Profile preview card showing how others see the user
  (avatar, name, archetype, top interests)
- Xiaoyue coaching bubble: "随时更新你的资料，匹配会更精准哦~"
- Form sections in cards:
  - "基本信息" (nickname, gender, birth year)
  - "职业身份" (education, industry)
  - "兴趣标签" (category chips with heat levels)
  - "关系状态"
- Interest selection: category tabs + chip grid with visual heat 
  indicators (color intensity)
- Sticky bottom "保存" CTA
- Live preview updates as user edits
- Friendly studio feel — not a bureaucratic form

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Medium  
**Expected Lift:** Brand 4→6, Emotional 3→6 → Overall 26→33 (C→C, closer to B)

---

### Brief #7: InvitePage — "Share the Joy"

**Priority:** 🟢 P2 — Growth feature  
**Current Score:** 28/50 (C)  
**Why Stitch:** Simple page with emoji hero. Should be more shareable and delightful.

**Current Pain Points:**
1. Hero is just an emoji (`🎉`) — no illustration
2. Reward tiers are plain text
3. No visual share card preview
4. Copy buttons are functional but uninspiring
5. No Xiaoyue presence

**Stitch Prompt:**

```
Design a WeChat Mini Program "Invite Friends" page for JoyJoin (悦聚).

BRAND SYSTEM:
- Primary: #8B5CF6, Secondary: #FF9B85, Accent: Gold #FFD166
- Font: AlimamaFangYuanTiVF
- Style: 插画风 low-poly, celebratory and gift-like

DESIGN REQUIREMENTS:
- Hero: Xiaoyue holding a gift box with confetti, 
  headline "邀请好友，一起悦聚"
- Share card preview showing: user's invite code, QR code,
  "和我一起加入 JoyJoin" tagline
- Reward ladder visual:
  - 1 invite → 7折券 (bronze)
  - 3 invites → 5折券×2 (silver)
  - 5 invites → 免费月卡 (gold)
  - Connected by a progress line showing current count
- Quick share buttons: "复制文案", "保存海报", "分享给好友"
- Stats: "已成功邀请 X 人" / "平台累计 Y 人"
- Celebratory, gift-like, viral-worthy design

TECHNICAL: HTML/CSS mockup, mobile-first, WXSS-safe.
```

**Effort:** Low-Medium  
**Expected Lift:** Brand 4→7, Emotional 4→7 → Overall 28→35 (C→B)

---

## 5. Quick Wins (No Stitch Required)

These fixes can be done with token swaps and minor component additions:

| # | Fix | Affected Screens | Effort |
|---|-----|-----------------|--------|
| 1 | Replace ad-hoc gradient with brand token gradient | Discover, EventDetail, EventCoordination | 15 min |
| 2 | Add `XiaoyueChatBubble` to Profile, EditProfile, Rewards | Profile, EditProfile, Rewards | 30 min |
| 3 | Replace text-initial avatars with archetype-colored circles | Connections | 20 min |
| 4 | Use brand palette for LandingPage card borders | LandingPage | 15 min |
| 5 | Add empty state illustration to Events | Events | 20 min |
| 6 | Add `ArchetypeGlyph` to Profile header | Profile | 15 min |
| 7 | Use `$color-text-secondary` instead of `#6B7280` | Discover loading | 5 min |

---

## 6. Asset Dependencies

Some Stitch redesigns need illustration assets that should be generated via **Lovart** (not Stitch):

| Asset | For Screen | Tool | Priority |
|-------|-----------|------|----------|
| 3 hero card illustrations (dinner, drinks, outdoor) | LandingPage | Lovart | P0 |
| Xiaoyue "gift" pose illustration | InvitePage | Lovart | P1 |
| Xiaoyue "coaching" pose for Profile/EditProfile | Profile, EditProfile | Lovart | P1 |
| Archetype mini-avatars (12 types) | Connections, Profile | Lovart | P1 |
| Empty state illustrations (events, connections) | Events, Connections | Lovart | P2 |

---

## 7. Recommendations

### Immediate (This Week)
1. **Execute all 7 Quick Wins** — low effort, improves ~15 screens
2. **Run Stitch for LandingPage** — highest impact first impression
3. **Generate Lovart assets** for hero cards and Xiaoyue poses

### Short Term (Next 2 Weeks)
4. **Run Stitch for Discover** — most visited screen
5. **Run Stitch for EventDetail** — high conversion impact
6. **Run Stitch for Profile** — identity celebration

### Medium Term (Next Month)
7. **Run Stitch for Connections, EditProfile, InvitePage** — social and growth surfaces
8. **Audit icebreaker phase views** individually (they're sub-components with varying quality)
9. **Standardize gradient backgrounds** across all screens with a single brand token

---

## Appendix: Score Justification Notes

### LandingPage (30/50)
- **Brand 4:** Hero cards use 3 ad-hoc colors not in palette. Subtitle `#7B6A96`, legal `#6B5B8D` not tokens. Generic photos instead of 插画风.
- **Structural 7:** Has loading, disabled, pressed, error states. No empty state needed.
- **Interaction 7:** Two CTAs compete. Legal gate is clear.
- **Emotional 4:** Xiaoyue present but generic hero imagery kills the vibe.
- **Perf 8:** WebP, transforms, fixed dimensions.

### Discover (29/50)
- **Brand 4:** Gradient `#FAFAFA` → `#FFF5F7` → `#FFE4E1` is completely ad-hoc.
- **Structural 7:** Loading, VirtualList, filter chips, safe areas.
- **Interaction 7:** Filters work, quick actions clear.
- **Emotional 4:** Functional listing, no mascot, no delight.
- **Perf 7:** VirtualList good, but card heights may vary.

### EventDetail (27/50)
- **Brand 4:** Same ad-hoc gradient. Info rows use emoji prefixes (inconsistent).
- **Structural 6:** Loading, error, but no empty state. Simple structure.
- **Interaction 6:** Info display only. Support QR is nice but secondary.
- **Emotional 3:** No mascot, no atmosphere preview, purely informational.
- **Perf 8:** Minimal, fast.

### Connections (28/50)
- **Brand 4:** Text initials instead of archetype visuals. Plain cards.
- **Structural 6:** Loading, list, but no empty state illustration.
- **Interaction 6:** Copy WeChat ID is clear but limited.
- **Emotional 4:** Functional, no celebration of connections.
- **Perf 8:** Simple list.

### Profile (30/50)
- **Brand 5:** Uses Card, Button, but flat list. Archetype not celebrated.
- **Structural 7:** Auth gate, queries, logout. Missing empty states for sub-sections.
- **Interaction 6:** Settings links are clear but uninspiring.
- **Emotional 4:** No mascot, no identity celebration, no completion moments.
- **Perf 8:** Fast, minimal.

### EditProfile (26/50)
- **Brand 4:** Form UI without brand personality. No Xiaoyue.
- **Structural 6:** Form state, saving, but no error retry.
- **Interaction 6:** Dense form, no preview.
- **Emotional 3:** Purely functional, overwhelming interest selection.
- **Perf 7:** Interest grid may be heavy.

### Rewards (29/50)
- **Brand 5:** Card, Button, StatusCard used. Coupon display is plain.
- **Structural 7:** Loading, history, redeem. Good state coverage.
- **Interaction 6:** Redeem action is clear. History is buried.
- **Emotional 4:** No celebration of rewards earned.
- **Perf 7:** History list could be long.

---

*Report generated by systematic code audit of `apps/mini-program/src/pages/*`.*
