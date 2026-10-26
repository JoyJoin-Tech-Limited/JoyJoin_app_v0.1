# Profile 「我的」Tab — Full-Marks (24/24) PM Plan

- **Date:** 2026-10-23
- **Author:** Product Manager (autonomous sprint decision authority)
- **Mission:** push the 「我的」tab user-satisfaction audit from its current score to **24/24**, holding share/return/recommend = YES and pay = indirect-yes (by design — see §7).
- **Named sources (Step-1 evidence trail):**
  1. User-satisfaction audit 2026-10-22 (score **19/24** 愿意回来; share/return/recommend = YES, pay = indirect yes) — session record referenced in `.sisyphus/plans/profile-tab-polish-2026-10-22.progress.md` §验收; two caps named there: C2 geometry (streak ~1rpx slack, card/avatar overlap → F3 human pass) and C3 badge art (Lovart Batch-D2 external dependency).
  2. Post-audit fix round (commits `46ff25369`, `883faef97`): 社交原型→氛围原型 ×4, poster mid-card gap closed, bell cap 9+, entrance budget exactly 600ms. **True current score unknown (est. 21–22); a re-audit is running in parallel — this plan is written to be correct at either value.**
  3. Predecessor memos (built on, not contradicted; overrides are flagged inline): `docs/deliberations/2026-10-22-profile-tab-polish-product-decisions.md` (+ addendum), `docs/deliberations/2026-10-22-profile-tab-polish-uiux-decisions.md`.
  4. Rubrics: `.agents/skills/user-satisfaction-audit/references/angle-rubric.md`; `docs/reference/emotional-value-rubric.md` (Angle-4 composite source).
  5. Live code re-verified 2026-10-23: `apps/mini-program/src/pages/profile/index.tsx`, `profileConstants.ts`, `apps/server/src/gamificationService.ts:330-450`, `packages/shared/src/api/user.ts:19-29`, `packages/shared/src/api/eventPools.ts:122-160`, `apps/mini-program/src/lib/profile/useProfileCardShare.ts`, `profileCardPoster.ts`.
- **Scope:** plan only — no application code modified. Copy governance per `docs/copy/brand-copy-strategy.md` §2 🔴 / §3: no 匹配/社交/灵魂/撮合/AI, no 会员/VIP, no emoji in primary copy, no fabricated social proof, no 诱导分享 mechanics.

---

## 0. Score model — what 24/24 actually requires

Six angles, 0–4 each. The two rubric anchors that matter most for this plan:

- **Angle 4 (emotional resonance)** is a *composite*: the six 情绪价值 sub-dimensions (归属感/成就感/身份认同/惊喜感/被理解感/仪式感) must sum ≥ 20/24. Badge art is the known cap, but composite math means we also need +1–2 elsewhere.
- **Angle 5 (return hooks)** demands *"visible progress at stake, a reveal scheduled, identity invested — leaving feels like abandoning something."* This is our weakest structural angle: today, for an established user with no pending claim and no pending registration, **nothing on this tab changes from one day to the next except a greeting line that repeats every 3 days.**

Per-angle current state below is my **inference** (the 19/24 per-angle breakdown was not persisted; the parallel re-audit will confirm). Every proposed action is justified against rubric text, not against my guess of the number.

---

## 1. Angle 1 — 3-second clarity (秒懂) · est. 4/4, hold

**(a) Post-fix state.** P2-1 three-act restructure shipped: 我是谁 (identity stage, dominant focal) → 我有什么 (entitlement strip → data band → badge wall) → 我能干嘛 (story → duo → quest → settings). One hero, clear chrome hierarchy, large title + condensing nav.

**(b) Residual deduction risk.** Squint-test risk on short devices: the fold lands mid-Act-2 (UIUX memo §2 risk-a, accepted), and Act 2 stacks three chrome-family rows (pills / band / badge entry) that could blur. No evidence this actually deducts — the re-audit will say.

**(c) Changes to secure 4/4.** None structural. The only action is *verification*: the F3 device-matrix pass (§4 bucket C) must include the squint test at 320/375/414px. If — and only if — Act-2 rows blur, the remedy is rhythm tokens (already shipped: 40rpx inter-act vs 24rpx intra-act), not new modules. **Pre-emptively "fixing" this without render evidence would be thrash; deliberately not planned.**

**(d)** Effort: verification only (folded into F3). Dependency: human + WeChat DevTools. Wave D.

---

## 2. Angle 2 — Cognitive smoothness (顺滑) · est. 4/4 post copy-fix; two XS finds remove the doubt

**(a) Post-fix state.** 氛围原型 copy-law sweep done (4 visible strings + quest step 1 canonical 完成氛围测试/去测试). All server enums stay off-screen.

**(b) Most likely remaining deductions (all verified in code this morning):**

| # | Finding | Evidence |
|---|---------|----------|
| B1 | Streak hint 「再坚持 1 周领 +200」 — **+200 what?** The unit (潮流值) is missing; the user must infer it from the card above. Rubric Angle-2: "no mental math, no decoding." | `index.tsx:1086` |
| B2 | **Bio nudge × quest step 2 duplication.** A post-onboarding user with empty bio and no registration sees BOTH the identity-card strip 「写一句聚会签名」 AND quest step 2 「写一句聚会签名 / 去写一句」 — the same ask rendered twice on one screen. Rubric: "one or two spots require a second glance" → caps at 3. | `index.tsx:801-805` (`showBioPrompt`) vs `:465-482` (`quest`) — conditions co-occur freely |
| B3 | Story card never shows the chapter date. PM memo §6 specced 「date = latest chapter occurredAt, M月D日」; it silently did not ship. The card's only freshness signal is the title; a real date makes the serialization factual. | memo §6 vs `index.tsx:1595-1605` (no `occurredAt` render) |

**(c) Shippable changes:**
- **A2-1 (XS):** streak hint → 「再坚持 1 周，潮流值 +200」. 13 chars at 20rpx fits the hint line (and the ≤340px variant already hides the hint — no geometry risk).
- **A2-2 (S):** arbitrate the duplicate ask — when the quest card renders, suppress the identity-card bio nudge (`showBioPrompt && !quest`). The quest owns the ask pre-成行; the nudge keeps its job for post-成行 users who still lack a bio. One ask per screen; zero users lose a path.
- **A2-3 (XS):** render the memo-specced chapter date beside the title: 「第 3 章 · 那晚的天台 · 10月18日写下」(data already in the teaser response; `occurredAt` formatted M月D日 per memo §6).

**(d)** All client-only, zero deps, Wave A. A2-2 needs one render test (quest visible ⇒ nudge hidden).

---

## 3. Angle 3 — Holistic cleanliness (干净) · est. 3/4, capped by the F3 human gate

**(a) Post-fix state.** Bell cap 9+, entrance settle exactly 600ms, stage-glass material family unified, three-act rhythm (40/24rpx), settings row static chrome.

**(b) Remaining deduction — the two named caps from the audit record:** (i) streak capsule ~1rpx slack in the near-milestone two-line state (UIUX memo §8 measured "fits by ~1rpx" — render truth needed); (ii) card/avatar overlap zone on the identity stage. **Both are render-layer defects that code review cannot catch; guessing pixel fixes without the device render is the exact anti-pattern the render-integrity checklist (R1–R8) exists to prevent.**

**(c) Shippable changes:**
- **A3-1:** run the **F3 WeChat DevTools device matrix** (plan §F3 checklist: 320/375/414px × loading/empty/error/happy × RM/degradation × 0-event/multi-event/claim-pending/streak-near-milestone) and fix both geometry items *from render evidence*. Wave A adds new states to the same checklist (streak-continuation line, next-event row, badge-glow pill) so one human pass covers everything.
- **Considered and rejected:** pre-emptively capping the identity tag row (archetype + family + lifeStage + gender = up to 4 pills). The row already wraps by design; wrapping is not a defect. Without render evidence this is a guess — F3 watch item instead.

**(d)** Human gate (blocking for merge anyway): S calendar time to schedule, XS–S code fixes once evidence exists. Wave D.

---

## 4. Angle 4 — Emotional resonance (心动) · est. 3/4 → path to composite ≥ 20/24

**(a) Post-fix state (sub-dimension map):** 归属感 — family pill on identity card + poster ✓; 成就感 — 5-tier wall with unlock ring + haptic, but only 2/5 medallions are real art; 身份认同 — archetype foil frame, count-up, gold rim ✓; 惊喜感 — foil sweep, Ken Burns, avatar squash&stretch ✓; 被理解感 — daily greeting keyed to archetype… but only 3 lines, repeating every 3 days; 仪式感 — entrance choreography exactly on-budget, badge unlock = passive ring on tab return.

**(b) Most likely remaining deductions:**
1. **C3 (named cap):** 渐入佳境/悦聚常客/城市传说 render as CSS medallions. The wall's three most prestigious tiers are visibly unfinished — 成就感 is capped exactly where aspiration should peak. External dependency: Lovart Batch-D2 (brief + landing checklist ready at `docs/design/lovart-brief-milestone-batch-d2-20261022.md`).
2. **被理解感 leak:** the greeting pool is 3 lines per archetype (`ARCHETYPE_GREETINGS`). Day-of-year % 3 = the same line every third day. "Tailored" decays into "templated" within one week.
3. **No context awareness:** a user whose 局 is *tonight* sees the identical card as an idle Tuesday. The tab knows (registrations cache carries `poolDateTime`/`finalDateTime`) but never says so.
4. **Badge-unlock 仪式感 is thin:** fresh unlocks are detected on tab return (ledger diff) and get a ring + haptic — but only if the user happens to open the accordion. The achievement moment has no artifact beat.

**(c) Shippable changes:**
- **A4-1 (M, EXTERNAL):** Lovart Batch-D2 art → wire 3 badges (manifest → CDN upload → `milestoneBadges.ts` keys → `MILESTONES.badge` fields). ⚠ **Hard pre-generation gate (carried from PM memo §3 待验证 #1, now promoted to decision D-4):** query prod `eventsJoined` p95 with the canonical counting SQL (`shellRepository.ts:434-464`); if p95 < 12, re-scope tier 5 → 15场 in the same PR as asset wiring — assets are the irreversible cost.
- **A4-2 (S, copy):** expand `ARCHETYPE_GREETINGS` 3 → 7 lines per archetype (day-of-year % 7 = true weekly freshness). 84 lines of brand-voice copy — decision D-1.
- **A4-3 (S):** **event-day greeting variant.** When the registrations cache holds a registration whose event is today, the greeting slot renders a context line instead of the rotation — proposed copy (through brand review): 「今晚 19:00 有局 · 南山见」 (falls back to the rotation; never renders twice per the existing dedupe rule). Pure client derivation from `poolDateTime`/`finalDateTime`. 被理解感 and Angle 5 lift in the same line.
- **A4-4 (S):** **badge-unlock artifact beat.** When `justUnlockedKeys` is non-empty on tab return (already computed), auto-expand the badge accordion once to the new badge (ring + haptic already exist). No modal, no overlay — a tab-return modal is hostile; an opened wall with a ringing badge is a gift.

**(d)** A4-3/A4-4: Wave A (client-only, S). A4-2: Wave A after D-1 sign-off. A4-1: Wave C (blocked on Lovart; code-side wiring is S once art exists).

---

## 5. Angle 5 — Return hooks (想念) · est. 3/4 — the weakest structural angle; the core of this plan

**(a) Live hooks today:** daily greeting (3-day repeat), streak capsule (static between events), quest line (newbie-only), badge wall progress, story pending badge (event-driven), duo card (contextual), tab dot (claim-pending only), bell (notification-driven).

**(b) The structural gap.** Take the established user: 3+ events, equipment claimed, no pending registration. **What changes on this tab tomorrow?** Only the greeting line — and it repeats every 3 days. The rubric's 4-point bar is *"visible progress at stake … a reveal scheduled … leaving feels like abandoning something."* Today: progress exists but nothing is at stake, and no reveal is scheduled *on this surface*. Everything below is built from real, already-on-device facts — zero fabricated urgency (hard constraint).

**(c) Shippable changes:**
- **A5-1 (S, client-only): streak-continuation state.** `lastActivityDate` + ISO-week math (both already in the gamification response — `user.ts:25-27`; mechanic verified at `gamificationService.ts:343-379`): when the user has a streak > 0 and has NOT yet attended in the current ISO week, the capsule gains a second line 「本周再参加 1 场，连击续到 {N+1} 周」 and the capsule becomes tappable → Discover (`hoverClass` + `haptics('light')`). This is opportunity-framed (never loss-shaming), always true (attending this week always increments), and makes the capsule *change weekly between events*. Deliberately NOT mentioned: the freeze card (`streakFreezeAvailable`) — the continuation line is true with or without it, and 「冻结卡」has no canonical user-facing name yet; introducing vocabulary is a copy decision we don't need to take.
- **A5-2 (S, client-only): next-event row — a scheduled reveal, one line.** Act 2, between the data band and the badge row (this amends PM memo §5's pinned Act-2 order — rationale: 「我有什么」 semantically includes a seat you hold, and Angle 5 is the weakest angle; flagged here as the override trail). Slim chrome row from the registrations cache: 「下一场局 · 周六 19:00 · 南山 · 排桌中」 / matched: 「… · 已排进 6 人桌」 + chevron → events tab (matching-status for pending). Hidden when no upcoming registration. It changes daily, costs zero new fetches, and stays a ONE-LINE pointer — the events tab owns the full countdown clock (`EventCountdownClock`); we point, we don't duplicate. Date formatting reuses the existing client formatter from the events surfaces (no new date code).
- **A5-3 (XS): badge proximity in the entry-row summary.** 「已点亮 2/5 枚 · 再 3 场点亮渐入佳境」 when within 3 of the next threshold (otherwise unchanged). Progress-at-stake visible *without* opening the accordion; all data already computed inline.
- **A5-4 (M, Wave B, decision D-2): weekly growth pulse.** Server adds `weeklyXp` (ISO-week sum from `xpTransactions`, one indexed aggregate on `userId + createdAt`) to `getUserGamificationInfo`; growth card sub-line 「本周 +320 潮流值」 when > 0. **待验证 before building:** query p50/p75 weekly XP per active user — if p50 ≈ 0, the line rarely renders and is dead weight; build only if the data says otherwise.
- **Considered and rejected (delete discipline):** daily check-in / lottery / streak-shop mechanics (fabricated engagement, off-brand, WeChat-hostile); story chapter anniversaries (needs ≥1 year of chapters — dead for 99% of users); profile-comeback subscribe push (the 3 subscribe templates are event-lifecycle-only by design; a "come look at your profile" push is marketing copy in a service channel = WeChat-banned); greeting-only-rotation without context (A4-3 subsumes it).

**(d)** A5-1/A5-2/A5-3: Wave A, client-only, S/XS. A5-4: Wave B, gated on D-2's data query (backend consult for the aggregate; DTO + client line + tests = M).

---

## 6. Angle 6 — Share-worthiness (炫耀) · est. 3–4/4

**(a) Post-fix state.** Compliant poster pipeline live: pixel avatar + displayName + 家族名 + 潮流值 + tagline + QR 「微信扫一扫，来悦聚认识我」 (1080×1560, privacy fields structurally excluded, zero incentive wording, action-sheet 保存/分享/预览, mid-card gap closed). Entry: quiet text-pill 「存下这张卡」 under the story card.

**(b) Most likely remaining deductions:**
1. **Discoverability.** The entry is a text-only pill *and* is coupled to `personalStoryEnabled` (`index.tsx:1621`) — an incidental coupling (the poster contains zero story content), so story-flag-off users never learn the card exists. The rubric's 4-point bar requires the user to *imagine the exact friend they'd send it to*; they can't imagine what they've never seen.
2. **No moment-based entry.** The natural share moments — badge just unlocked, fresh outfit claimed — don't surface the poster. The pill waits to be remembered.
3. **Poster flattery at thumbnail scale (watch item).** A raw 潮流值 number can read small for new users. 「已点亮 N 枚徽章」 is a more flattering identity fact — but canvas revisions are M-effort and re-render-gated; bundled into decision D-3, sequenced after Batch-D2 so the canvas is revised once.
4. **Considered and rejected:** a share glyph on the pill — the only mapped share emoji (📤) deliberately reuses `icon-people`, which the Duo card already wears; icon collision on one screen. Text-pill + glow (below) wins. Also rejected: a persistent 「已保存」 state on the pill after saving — fabricated engagement; the action-sheet + toast + haptic is the honest completion.

**(c) Shippable changes:**
- **A6-1 (XS): decouple the entry from the story flag.** Render the poster pill whenever an archetype exists (`!!archetype`), independent of `personalStoryEnabled`. Placement stays under the story card; when the story card is absent the pill attaches under Act 3's last rendered module (conditional, no placeholder).
- **A6-2 (S): moment-based one-shot glow.** When a badge is freshly unlocked (`justUnlockedKeys` non-empty — already computed), the pill gains a one-time gold-edge pulse and copy swap 「新徽章到手，存下这张卡」 until tapped or session end. No modal, no auto-open, zero incentive wording — this is the 仪式感 rubric's "sharing as a natural next step, not a nudge." Share rate lever that stays WeChat-compliant: *the moment, not the mechanic.*
- **A6-3 (M, decision D-3): poster v2** — add badge-count line (and optionally the latest medallion once Batch-D2 lands). Sequenced after Wave C to revise the canvas once.
- **A6-4 (not built):** 转发得券/奖励 mechanics — banned （诱导分享）. Weekly-recap share card — Wave-3 candidate, only if A5-4 ships *and* its render rate justifies a second artifact.

**(d)** A6-1/A6-2: Wave A (XS/S, client-only). A6-3: Wave C-after (M, art-gated + decision).

---

## 7. Consolidated plan table

| # | Action | Angle gained | Effort | Dependency | Wave |
|---|--------|--------------|--------|-----------|------|
| A2-1 | Streak hint gains unit: 「再坚持 1 周，潮流值 +200」 | 2 (4) | XS | — | A |
| A2-2 | Bio nudge suppressed while quest renders (one ask per screen) | 2 (4) | S | — | A |
| A2-3 | Story card renders memo-specced chapter date 「…·10月18日写下」 | 2, 5 | XS | — | A |
| A4-3 | Event-day context greeting 「今晚 19:00 有局 · 南山见」 (from registrations cache) | 4, 5 | S | copy review | A |
| A4-4 | Fresh badge auto-expands wall once on tab return (ring+haptic exist) | 4 | S | — | A |
| A5-1 | Streak-continuation line + tappable capsule → Discover | **5 (4)** | S | — | A |
| A5-2 | Next-event one-line row in Act 2 (pointer to events tab) | **5 (4)** | S | amends memo §5 Act-2 order (flagged §5) | A |
| A5-3 | Badge entry-row proximity: 「…再 3 场点亮渐入佳境」 | 5 | XS | — | A |
| A6-1 | Poster entry decoupled from `personalStoryEnabled` | 6 | XS | — | A |
| A6-2 | Badge-unlock poster glow: 「新徽章到手，存下这张卡」 (one-shot) | 6, 4 | S | — | A |
| A4-2 | Greeting pool 3→7 per archetype (84 lines) | 4, 5 | S | **D-1 copy sign-off** | A (after D-1) |
| A5-4 | Weekly XP pulse 「本周 +320 潮流值」 (server aggregate + DTO + client) | 5 | M | **D-2 p50 query 待验证** | B |
| A4-1 | Lovart Batch-D2 3 badges → CDN → wire `MILESTONES.badge` | **4 (→4)** | M (art) / S (wire) | **D-4 p95 gate + external art** | C |
| A6-3 | Poster v2: badge-count line (+ medallion) | 6 | M | D-3 + Wave C art | C-after |
| A3-1 | F3 device-matrix pass → fix streak ~1rpx slack + card/avatar overlap from render evidence | **3 (→4)** | S (human) + XS–S (fixes) | human + WeChat DevTools | D |
| DEL-1 | Delete dead `getXiaoyueGreeting` + its test block | hygiene | XS | — | A |

**Wave definitions.** A = ship now, client-only, zero new server data / zero new assets / zero new flags (one sprint contract for the wave per P0 precedent; one PR per cluster: copy-cluster A2-1/A2-3 · hooks-cluster A5-1/A5-2/A5-3/A4-3/A4-4 · share-cluster A6-1/A6-2 · arbitration A2-2 · cleanup DEL-1). B = decision-gated server-light. C = blocked on Lovart art. D = blocked on the F3 human pass.

**Sequencing.** A starts immediately (target: this week) → D's human session is scheduled *now* so it runs against the Wave-A build (one pass covers old + new states) → B starts only after D-2's query returns → C starts the day Batch-D2 art lands (D-4 query runs *before* art generation). Re-audit after A + D → expect 23–24; after C → 24 sustained.

---

## 8. The four buckets (explicit)

**① Ship now in code (Wave A, no blockers):** A2-1, A2-2, A2-3, A4-3, A4-4, A5-1, A5-2, A5-3, A6-1, A6-2, DEL-1. All client-only; every datum already on-device (`lastActivityDate`, `streakFreezeAvailable` on the gamification type; `poolDateTime`/`finalDateTime` on `PoolRegistrationSummary`; `occurredAt` in the story teaser; `justUnlockedKeys` already computed).

**② Blocked on Lovart art (Wave C):** A4-1 (badge medallions 5/10/20场 — brief ready, p95 gate D-4 first). A6-3 rides the same art to avoid two canvas revisions.

**③ Blocked on the F3 human pass (Wave D):** A3-1 streak-capsule ~1rpx slack + card/avatar overlap zone. Also closes Angle 1's squint-test verification. This is the pre-merge gate regardless — schedule the session now, run it against the Wave-A build.

**④ Needs a decision (this memo's register):**

| # | Decision | Recommendation | Owner |
|---|----------|----------------|-------|
| D-1 | Greeting pool 3→7 (84 lines of archetype-voice copy) | YES — cheapest dual-angle (4+5) freshness in the plan; copy through brand review before merge | PM + brand copy |
| D-2 | Weekly XP pulse: run p50/p75 weekly-XP query on `xpTransactions` first; build only if p50 > 0 | 待验证 — run the query this week; kill silently if the number says the line rarely renders | backend consult → PM |
| D-3 | Poster v2 badge-count content | Bundle with Batch-D2 (one canvas revision); approve in principle, spec after art | PM |
| D-4 | `eventsJoined` p95 query BEFORE generating Batch-D2; p95 < 12 ⇒ tier 5 becomes 15场 (PM memo §3 待验证 #1, promoted to hard gate) | Run before art commission — assets are the irreversible cost | backend consult → visual-designer |

**Out of scope (explicit):** the pay verdict. No cash shop on this tab — ruled in the 2026-10-22 PM memo and being re-examined by the parallel commercialization memo; this plan does not duplicate that analysis. Pay stays indirect-yes: the tab earns willingness-to-pay through identity investment (badges, streak, avatar, story), not through a storefront.

---

## 9. Five-step algorithm anchors

**Step 1 — 质疑需求.** Every action above carries its source: the 2026-10-22 audit record (caps C2/C3), the angle rubric text (quoted per section), or a verified code finding (B1/B2/B3 with file:line). Items without evidence were rejected at intake (check-in mechanics, anniversary hooks, comeback push — §5). The only `待证伪` item is A5-4, and it is explicitly quarantined behind D-2's data query — it cannot enter scope on assumption.

**Step 2 — 删除 (what this plan retires/merges, not just adds):**

| Item | Who uses it | Loss if deleted | Rollback |
|------|------------|-----------------|----------|
| **DEL-1** `getXiaoyueGreeting` + test block (`profileConstants.ts:224-242`) | Nobody — zero production imports (verified 2026-10-23; superseded by the P2-5 large-title date line + `getDailyGreeting`). The fix round updated its copy but nothing consumes it. | None — unreferenced. | git revert |
| **DEL-2** Bio-nudge × quest duplication (A2-2) | New users see the nudge post-成行 too — kept for that case. | Pre-成行 users lose the duplicate ask — that's the point; the quest owns it. | one-condition revert |
| Rejected deletions | The 3-line greeting rotation (kept — context greeting subsumes event days, rotation still serves the no-event majority); the text-only poster pill (kept — share glyph would collide with Duo's `icon-people`; glow solves discoverability without an asset). | — | — |

Hard zones untouched: no payment/refund, audit-logging, compliance/AIGC-label, auth/privacy, or data-retention path is modified by any action in this plan.

**Step 3 — 简化.** Net moving-part count goes *down*: one dead function deleted; one duplicated ask arbitrated away; the next-event row reuses the events tab's formatter and the registrations cache (no new fetch, no new endpoint, no new flag); the poster glow reuses the existing `justUnlockedKeys` ledger. New states introduced: exactly 3 (streak-continuation, next-event row, poster glow) — each removes a rubric deduction.

**Step 4 — 提速.** Wave A is 11 actions × XS–S, all client-only → first verifiable output (A2 cluster) within 1 day of kickoff; full Wave A inside 1 week. The F3 human session is the long pole — scheduling it today (against the Wave-A build) collapses what would have been two render passes into one. No baseline exists for "audit points per engineering day" — `待验证`, measured by the post-Wave-A re-audit.

**Step 5 — 自动化.** 锁定 — steps 1–3 *just* landed for this surface; nothing here repeats weekly at a frequency that justifies automation. The F3 geometry check is render-truth human work by definition. Existing guards carry the load (screenshot generators, class-coverage, guardrails chain, contract tests).

---

## 10. Metrics & instrumentation (observational only — none may incentivize fabrication)

| Signal | Mechanism |
|--------|-----------|
| Poster loop: glow → tap → generate | `profile_share_card_generated` gains `source: 'default' \| 'badge_glow'`; new `profile_poster_glow_tap` (client enum + server whitelist parity — the contract-test pattern) |
| Next-event row tap-through | new `profile_next_event_tap { matchStatus }` |
| Streak-continuation tap | new `profile_streak_capsule_tap { streakWeeks }` |
| Badge wall engagement | existing `profile_milestone_tap` (expand/collapse) + ledger-diff rate |
| North-star guard | every hook traces to a real server fact; re-audit angles 4/5 after Wave A + F3 |

**Success criteria:** (1) re-audit after Wave A + F3 ≥ 23/24 with Angles 2/5 at 4; (2) re-audit after Wave C = 24/24 with share/return/recommend = YES held; (3) zero banned copy tokens; (4) zero fabricated urgency (every hook demonstrably data-backed); (5) F3 render pass green on all §F3 states including Wave-A additions.

## 11. Risks & guardrails

1. **Copy law:** all new strings (streak continuation, next-event row, event-day greeting, poster glow, proximity line) go through brand-copy review before merge; event-day greeting copy is a proposal, not final.
2. **Duplication creep:** A5-2 must stay a one-line pointer — if it grows a clock, a card, or a venue line, it's re-scoped (events tab owns those).
3. **F3 scope growth:** Wave A adds 3 new states to the §F3 checklist; the human pass must be re-booked against the Wave-A build, not the current branch tip.
4. **Act-order amendment:** A5-2 amends PM memo §5's pinned Act-2 order (data band → **next-event row** → badge row). Rationale on record in §5; if the re-audit shows Angle 3 dropping, the row folds into the data band as a 4th cell (fallback pre-planned).
5. **Art gate discipline:** D-4's p95 query runs *before* Lovart generation; tier re-scoping after art exists is the expensive mistake this gate prevents.
6. **No tab-return modals:** A4-4/A6-2 use in-place expansion/glow only — modals on tab return are hostile to a tab users open reflexively.

---

*Plan ends. Execution starts with Wave A cluster PRs and booking the F3 session today; D-2 and D-4 queries dispatched to backend consult in parallel.*
