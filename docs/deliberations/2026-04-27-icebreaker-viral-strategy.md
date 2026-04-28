# Deliberation: Social Icebreaker Viral Hook Strategy

**Date:** 2026-04-27  
**Scope:** Social Icebreaker phase portfolio, flow architecture, legacy deprecation, and shareable artifact design  
**Stakeholders:** Product, Engineering, AI/LLM, Mini-program Frontend  
**Status:** ✅ Deliberation complete — unanimous consensus reached  
**Transcript:** `.git/.orchestration/deliberation/2026-04-27-icebreaker-viral-strategy.md`  
**Machine-readable:** `.git/.orchestration/deliberation/2026-04-27-icebreaker-viral-strategy.json`

---

## 1. Executive Summary

**The verdict:** The current Social Icebreaker is a *competent facilitation tool*. It is not yet a *viral product experience*.

**The one change that moves the needle most:** Redesign `recap` from a text summary into a **Group Moment Card** — a WeChat-optimized visual artifact that attendees screenshot and post. Every event must produce at least one shareable moment.

**The second change:** Consolidate from 7 phases to a **signature three-act flow** with one clear "that's so me" phase, one competitive peak, and one shareable artifact. Everything else is optional or premium.

**The third change:** Deprecate the legacy `icebreakerGames.ts` catalog and `IcebreakerToolkit` UI surfaces completely. They create architectural confusion, consume maintenance bandwidth, and split the product identity.

---

## 2. Corrected Portfolio Audit

### 2.1 Active Social Icebreaker Phases (Canonical)

| Phase | Time | Min Players | Default | Viral Role | Current Assessment |
|-------|------|-------------|---------|------------|-------------------|
| `warmup` | 15-20 min | 2 | ✅ ON | Table stakes | Functional but generic. Mood-filtered topics are good; execution is utilitarian. |
| `micro_challenge` | 10-15 min | 2 | ✅ ON | First shared laugh | Quick energy spike. Content is AI-generated but often feels like a task, not a game. |
| `lie_detective` | 20-25 min | 3 | ✅ ON | Social peak | Strong mechanic. AI-generated statements create genuine surprise. Best current viral candidate. |
| `personality_dice` | 15 min | 2 | ✅ ON | "That's so me" | Currently generic. Archetype data is under-utilized. High potential if rewritten. |
| `auction` | 20-30 min | 3 | 🚫 OFF | Competitive climax | Fun virtual-coin economy. Needs critical mass (≥4) to feel alive. Good bar-scene variant. |
| `mini_script` | 45 min | 4 | 🚫 OFF | **Signature experience** | The most distinctive phase. Multi-act mystery with roles, clues, voting. Too long/heavy for default flow. Perfect as **premium upgrade**. |
| `recap` | 5 min | 1 | ✅ ON | **Currently: none** | Text summary. No visual artifact. No share trigger. **This is the biggest missed opportunity.** |

### 2.2 Legacy Systems (Orphaned / Not Connected to Social Icebreaker)

| System | Files | Status | Action |
|--------|-------|--------|--------|
| `icebreakerGames.ts` | `packages/shared/src/icebreakerGames.ts` | **Deprecated 2026-04-27** | Remove once `IcebreakerToolkit` UI is deleted |
| `IcebreakerToolkit` | `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx` + admin copy | Legacy pre-event browser | Schedule removal; redirect to Social Icebreaker session |
| `IcebreakerGallery` | `apps/user-client/src/components/icebreaker/IcebreakerGallery.tsx` + admin copy | Legacy browsing UI | Schedule removal |
| `GameDetailView` | `apps/user-client/src/components/icebreaker/GameDetailView.tsx` + admin copy | Legacy detail UI | Schedule removal |
| `/api/icebreaker/recommend-game` | `apps/server/src/routes.ts:2713` | Legacy AI recommendation | Deprecate endpoint; redirect to Social Icebreaker |
| `IcebreakerCardGame` | `apps/user-client/src/components/icebreaker/IcebreakerCardGame.tsx` | Separate deep-dive game | Evaluate: integrate as optional phase OR deprecate |
| `IcebreakerTool` widget | `apps/user-client/src/components/IcebreakerTool.tsx` | Random question teaser | Keep; entry-point only. Connect to Social Icebreaker session. |

**Critical clarification:** `mini_script` is a **full Social Icebreaker phase**, not a side game. It executes within the phase-ordered session flow (`PHASE_ORDER`), is gated by `getNextEligiblePhase`, has advance guards, and produces recap data. It has dedicated mini-program UI (`MiniScriptPhaseView`, `MiniScriptConfigModal`) and its own top-level generation route (`POST /api/miniscript/generate`). It is the most complex phase in the portfolio and must be analyzed as such.

---

## 3. Viral Hook Assessment

### 3.1 The Viral Formula for Social Experiences

For an in-person social experience to go viral digitally, it must produce at least one of:

1. **"That's so me"** — a personalized moment that validates the user's identity
2. **"You won't believe this"** — a surprising, funny, or shocking group moment
3. **"Look who I met"** — a social proof artifact showing the user in an interesting context
4. **"I want to do that again"** — an itch that only repeating the experience can scratch

### 3.2 Phase-by-Phase Viral Scorecard

| Phase | "That's so me" | "You won't believe" | "Look who I met" | "Do it again" | Composite |
|-------|---------------|---------------------|------------------|---------------|-----------|
| warmup | ⭐ | ⭐ | ⭐ | ⭐ | 4/20 — Generic conversation |
| micro_challenge | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | 9/20 — Fun but forgettable |
| lie_detective | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 15/20 — Strong social mechanic |
| personality_dice | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | 9/20 — Potential unrealized |
| auction | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | 14/20 — Competitive, meme-able |
| **mini_script** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **22/20 — The signature** |
| recap | ⭐ | ⭐ | ⭐ | ⭐ | 4/20 — Invisible |

**Observation:** `mini_script` scores highest across every dimension. It is the only phase that reliably produces all four viral triggers. However, it is also the most demanding (45 min, ≥4 players, high host competence, heavy LLM dependency). This is not a bug — it is a **feature that defines tiered positioning**.

### 3.3 The Shareable Artifact Gap

Current recap produces:
- `headline`: text string
- `moments[]`: text array
- `closingLine`: text string

This is consumed and forgotten. There is no visual artifact, no screenshot optimization, no WeChat Moments-ready output, no QR code for "find your next event."

**The gap is structural, not content-level.** No amount of better LLM prompt engineering fixes the fact that the output medium is wrong.

---

## 4. The Must-Win Strategy: Three Pillars

### Pillar 1 — Consolidate to a Signature Flow

**Problem:** 7 phases + 13 legacy games + separate card game = product identity fragmentation. Users cannot describe what JoyJoin icebreaking "is" in one sentence.

**Solution:** Define exactly **two** canonical flows, no more.

#### Flow A: Standard Event ("Spark Night")
**Target:** All events, 3-5 people, 60-75 minutes  
**Positioning:** "Fast, fun, and weirdly accurate about who you are."

```
warmup (10 min) → micro_challenge (10 min) → lie_detective (20 min)
  → personality_dice (15 min) → Moment Card recap (5 min)
```

- `warmup`: Aggressively timeboxed. Not a conversation — it's a **mood-setting sprint**. 3 topics max, host can skip.
- `micro_challenge`: Designed for the **first shared laugh**. Challenge copy must be absurd, not athletic. Think "take a group selfie where everyone looks like a villain" not "do 10 jumping jacks."
- `lie_detective`: The social peak. Keep as-is but add a **"best lie" vote** at the end — gives the group a champion.
- `personality_dice`: Rewritten for archetype-specific roast mode (see Pillar 2).
- `recap`: Moment Card (see Pillar 3).

#### Flow B: Premium Event ("Mystery Night")
**Target:** Longer events, 4-6 people, 90-120 minutes  
**Positioning:** "Solve a mystery with strangers who turn out to be surprisingly good liars."

```
warmup (10 min) → micro_challenge (10 min) → lie_detective (15 min, shortened)
  → auction (20 min, optional) OR personality_dice (10 min, shortened)
  → mini_script (45 min) → Moment Card recap (5 min)
```

- `mini_script` is the **centerpiece**, not an add-on. All preceding phases are warm-up.
- Host pre-selects style/genre during event creation (not in-session) to reduce friction.
- `auction` is positioned as a **bar-scene variant** — replaces personality_dice in nightlife-oriented pools.

#### What We Remove
- `auction` from Standard Flow (keep feature-flagged, only for bar/premium)
- `mini_script` from Standard Flow (strictly premium)
- All legacy `icebreakerGames.ts` entries from any user-facing surface
- `IcebreakerToolkit` UI from user-client and admin-client
- `IcebreakerCardGame` evaluated for integration or deprecation

### Pillar 2 — Rewrite Personality Dice for "That's So Me"

**Current state:** `personality_dice` generates challenges based on dominant trait (A/C/E/O/X/P). The challenges are playable but generic. They do not exploit the 12-archetype system's richest asset: **the archetype identity itself**.

**Rewrite strategy:**

Instead of trait-based challenges, generate **archetype-specific dares** that feel like a friend who *really* knows you is roasting you gently:

| Archetype | Example Dare |
|-----------|-------------|
| 开心柯基 (Cheerful Corgi) | "用三种不同的笑声演绎你刚才听到的一个冷笑话" |
| 太阳鸡 (Sun Chicken) | "在30秒内让房间里的每个人说出一件今天的好事" |
| 夜猫子 (Night Owl) | "假装你是早起型人格，描述你'理想的早晨'——但每句话都要眨一次眼" |
| 冰山企鹅 (Iceberg Penguin) | "用一种动物形容在场的每个人，但不能重复" |

**Rules:**
- Each dare references the archetype by name or mascot
- Dares are slightly embarrassing but not exposing
- Players can "pass" with a funny fallback (e.g., "我选择做一个安静的 [archetype]")
- The dare text is the **shareable content** — designed for screenshotting

### Pillar 3 — Build the Moment Card

**The Moment Card is a shareable visual artifact generated at recap.** It is the viral engine.

**Design spec:**
- **Format:** WeChat-optimized vertical card (1080 × 1920px equivalent)
- **Content:**
  - Event title + date
  - Group "cast" — archetype icons + first names in a circle layout
  - **One headline moment** (AI-picked from the session's funniest/most surprising interaction)
  - **One player quote** (the lie that fooled everyone, the winning bid, the dramatic script reveal)
  - "[N] strangers → [N] friends" counter
  - JoyJoin brand watermark + QR code to event discovery
- **Behavior:**
  - Auto-generated at recap
  - Host can regenerate up to 3 times if the first version is weak
  - "保存到相册" (Save to album) is the primary CTA
  - "分享到朋友圈" (Share to Moments) is the secondary CTA
  - Optional: "预约下一场" (Book next event)

**Technical approach:**
- Server generates JSON payload (headline, quote, cast, stats)
- Mini-program renders with Taro Canvas API or html-to-image
- Web parity with html2canvas
- QR code encodes deep-link to discover page with UTM tracking

**Viral math:**
- If 30% of attendees save/share the card
- And each card is seen by ~50 WeChat contacts
- And 1% of viewers convert to app visit
- Then each event produces ~0.15 organic new users per attendee
- At 4 attendees/event, that's 0.6 new users/event from sharing alone

---

## 5. mini_script: The Premium Signature Experience

### 5.1 Why It Was Under-Analyzed

`mini_script` is easy to overlook because it is feature-flagged OFF by default and requires the most engineering surface (dedicated UI, separate generation route, multi-act state machine). But it is also the phase most likely to produce the "you won't believe what we did" story that travels.

### 5.2 Strategic Positioning

`mini_script` is **not a default phase**. It is the **upgrade that justifies a higher ticket price or longer event format**.

| Dimension | Standard Event | Premium Event |
|-----------|---------------|---------------|
| Duration | 60-75 min | 90-120 min |
| Price tier | Standard | Premium (+20-30%) |
| Centerpiece | lie_detective + personality_dice | mini_script |
| Group size | 3-5 | 4-6 (strict gate) |
| Marketing copy | "Meet interesting people" | "Solve a mystery with strangers" |
| Shareable artifact | Moment Card | Moment Card + "case solved" badge |

### 5.3 Iteration Plan for mini_script

1. **Pre-event style/genre selection:** Move host configuration out of the session. Host picks style (modern_urban, xianxia, etc.) and genre (light_reasoning, absurd_comedy) during event creation. The LLM generates the framework *before* the event, not during.
2. **Shorter acts:** Current framework supports up to 5 acts. Cap at 3 acts for the standard mini_script experience (30-35 min), with 5-act as "extended edition."
3. **Archetype-role mapping:** Map player archetypes to story roles when possible (e.g., 太阳鸡 → the charismatic suspect, 冰山企鹅 → the aloof detective). Increases "that's so me" factor.
4. **Case-solved badge:** Players who correctly vote the solution get a "Detective" badge on their profile. Creates replay incentive.

---

## 6. Deprecation Plan: Legacy Systems

### 6.1 `icebreakerGames.ts` — Static Catalog

**Status:** Deprecated 2026-04-27. JSDoc deprecation notice added.

**Removal criteria:**
- [ ] `IcebreakerToolkit` components removed from user-client and admin-client
- [ ] `/api/icebreaker/recommend-game` endpoint removed or redirected
- [ ] `IcebreakerDemoPage` (dev-only) updated to use Social Icebreaker session
- [ ] No production traffic to `/api/icebreaker/recommend-game` for 30 days

**Timeline:** Target removal by 2026-05-31.

### 6.2 `IcebreakerToolkit` — Legacy UI

**Components affected:**
- `apps/user-client/src/components/icebreaker/IcebreakerToolkit.tsx`
- `apps/admin-client/src/components/icebreaker/IcebreakerToolkit.tsx`
- `apps/user-client/src/components/icebreaker/IcebreakerGallery.tsx`
- `apps/admin-client/src/components/icebreaker/IcebreakerGallery.tsx`
- `apps/user-client/src/components/icebreaker/GameDetailView.tsx`
- `apps/admin-client/src/components/icebreaker/GameDetailView.tsx`
- `apps/user-client/src/components/icebreaker/ActivitySpotlight.tsx`
- `apps/admin-client/src/components/icebreaker/ActivitySpotlight.tsx`

**Migration path:**
- Replace Toolkit entry point with a CTA: "启动 AI 破冰会话" (Start AI Icebreaker Session)
- Route directly to `IcebreakerSessionPage` (Social Icebreaker)
- Delete Toolkit components in a single PR after verifying no admin workflows depend on them

### 6.3 `IcebreakerCardGame` — Separate Deep-Dive

**Decision needed:** This is a DB-persisted 5-round card game with its own tables (`icebreaker_game_cards`, `icebreaker_game_progress`). It is *not* part of the Social Icebreaker phase system.

**Options:**
1. **Integrate** as an optional "deep-dive" accessible from recap ("Want to keep playing?")
2. **Deprecate** and redirect resources to Social Icebreaker phases
3. **Repurpose** card content as `micro_challenge` fallback content

**Recommendation:** Option 1 (integrate as post-session optional). The card game has invested engineering and content. Don't throw it away — but don't let it compete with the primary flow. Surface it as a "Continue the night" option after recap.

---

## 7. Risk Analysis & Guardrails

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Users don't share Moment Cards | Medium | High | A/B test card designs; offer multiple templates; make host generation optional |
| LLM-generated mini_script is low quality | Medium | High | Pre-generate frameworks before event; curated fallback stories; host can regenerate |
| Personality Dice feels exposing | Medium | Medium | Always offer "pass" option; tone guardrails in prompts; no dares about sensitive topics |
| mini_script too long, users drop out | Medium | High | Timebox to 3 acts max; host can skip acts; pulse-check gate between acts |
| Standard flow feels too short | Low | Medium | Host can loop micro_challenge; extend lie_detective; add "bonus round" option |
| Legacy removal breaks admin workflows | Low | High | Verify admin usage before deletion; feature-flag removal behind env var |
| Viral focus alienates introverts | Medium | Medium | Keep opt-out paths; "pass" always available; introvert-friendly challenge options |

---

## 8. Implementation Priority

### Phase 1: Foundation (Week 1-2)
1. **Deprecate legacy surfaces:** Mark `icebreakerGames.ts` exports as `@deprecated` in all consuming files
2. **Remove Toolkit from user-client:** Replace with Social Icebreaker CTA
3. **Add session-level instrumentation:** Track per-phase enjoyment (1-3 rating), completion rate, drop-off points

### Phase 2: The Shareable Artifact (Week 3-4)
4. **Design Moment Card:** Figma spec for vertical shareable card
5. **Build recap-to-card pipeline:** Server generates JSON payload; mini-program renders with Canvas
6. **Add save/share CTAs:** Primary "保存到相册", secondary "分享到朋友圈"
7. **Track share events:** UTM-encoded QR, save rate, downstream conversion

### Phase 3: Personality Dice Rewrite (Week 5-6)
8. **Draft archetype-specific dare bank:** 3 dares per archetype × 12 archetypes = 36 base prompts
9. **Update LLM prompt:** `social-personality-dice-v2` with archetype-aware generation
10. **Add "pass" fallback:** Graceful opt-out for every dare
11. **A/B test vs. v1:** Measure completion rate, pulse-check rating, screenshot rate

### Phase 4: Tiered Flow Rollout (Week 7-8)
12. **Define Standard vs. Premium event types:** Schema change to `event_pools` (or `event_pool_groups`)
13. **Flow A (Standard):** warmup → micro_challenge → lie_detective → personality_dice → recap
14. **Flow B (Premium):** Standard phases + mini_script as centerpiece; auction as bar variant
15. **Feature-flag mini_script as premium-only:** `SOCIAL_ICEBREAKER_ENABLE_MINI_SCRIPT` becomes event-type-gated

### Phase 5: Legacy Cleanup (Week 9-10)
16. **Remove IcebreakerToolkit from admin-client**
17. **Remove `/api/icebreaker/recommend-game` endpoint**
18. **Delete `icebreakerGames.ts` and all references**
19. **Evaluate IcebreakerCardGame integration vs. deprecation**

---

## 9. Success Metrics

| Metric | Baseline (est.) | Target | Measurement |
|--------|----------------|--------|-------------|
| Post-event share rate | ~0% | ≥20% | Moment Card save/share events / total attendees |
| Session completion rate | Unknown | ≥85% | Sessions reaching recap / sessions started |
| Per-phase pulse-check avg | Unknown | ≥2.2/3.0 | Average vibe rating across all phases |
| Return booking within 7 days | Unknown | ≥25% | Users booking next pool within 7 days of attending |
| Organic referral rate | Unknown | ≥0.3 | New user registrations attributed to shared Moment Cards |
| Legacy system traffic | Unknown | 0 | `/api/icebreaker/recommend-game` calls, Toolkit page views |

---

## 10. Bottom Line

**The Social Icebreaker does not need more phases. It needs fewer phases, one unforgettable peak, and one shareable artifact.**

- `mini_script` is the peak experience — but it belongs in Premium events, not every event.
- `lie_detective` + rewritten `personality_dice` are the Standard flow's viral engine.
- The **Moment Card** is the missing piece that turns a private experience into public marketing.
- The legacy catalog (`icebreakerGames.ts`) and Toolkit UI are architectural debt that confuse the product identity. Deprecate them completely.

**If we do only three things:**
1. Build the Moment Card
2. Rewrite Personality Dice for archetype-specific roast
3. Position mini_script as the Premium signature

...we turn a functional icebreaker into a product people talk about.
