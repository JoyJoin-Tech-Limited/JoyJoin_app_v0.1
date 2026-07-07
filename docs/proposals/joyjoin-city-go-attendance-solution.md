# JoyJoin City GO — No-Show Attendance Solution

**Date:** 2026-07-07  
**Status:** Product proposal — Phase 0 MVP  
**Owner:** Product Manager, JoyJoin  
**Target:** Push City GO free-event attendance from 63% to ≥70% without heavy operations or paid-funnel compromise.

---

## 1. First-Principles Frame

**Mission in one sentence:** Ensure ≥65% of users who sign up for a free City GO event physically show up at the landmark.

**Inversion:** What makes no-show the rational choice even if the product is good?  
- The event is free, so the sunk cost is zero.  
- The group is only 3–4 people, so if one other person ghosts, the remaining 2–3 are stranded.  
- WeChat mini-programs cannot reliably nudge users in the background, so the event slips off their mental stack.  
- There is no pre-event ritual or social contract, so canceling feels costless.

**Critical path:** The no-show spiral is driven by **uncertainty about whether others will show up**. One person expects others to flake, so they flake too. The group that does arrive has a damaged experience, which lowers return and conversion.

**Constraints:** Free event; WeChat mini-program (no background location, limited push); small ops team; no on-site host at every event; no open chat or real-time location sharing for compliance/safety reasons.

**Single next action:** Run a 1-week A/B test of a lightweight **Buddy + Confirmation Lock + Soft Cooldown** system.

---

## 2. No-Show Root-Cause Diagnosis (Top 3)

| Rank | Cause | Why it dominates | Evidence from synthesis |
|------|-------|------------------|------------------------|
| **1** | **Zero sunk cost + no social contract** | Free sign-up is frictionless. Users book without mentally committing. | Sign-up rate is healthy (22.4%), but 37% of sign-ups do not attend. |
| **2** | **Small-group uncertainty** | In a 3–4 person group, one no-show ruins the event. Users fear making the trip only to be stranded. | Synthesis quote: *“到了没人怎么办？白跑一趟。”* |
| **3** | **Weak pre-event commitment** | Sign-up happens days in advance. There is no mid-week ritual, no accountability partner, and limited reminder channels. | Attendance is below threshold despite a free, low-effort offer. |

These three causes are interconnected: **the free price creates sign-up volume, but the lack of a commitment device and the fear of others flaking converts that volume into no-shows.**

---

## 3. Proposed Smartest Solution: City GO Buddy Lock

### 3.1 Core Mechanism

Introduce a **Buddy Lock** before every City GO event:

1. **Buddy Match (24 hours before event):** Each participant is anonymously matched with one other attendee from the same group. They see a fun archetype-based nickname (e.g., “柯基探险家”) and a shared micro-mission, delivered by Xiaoyue. No real names, no open chat.
2. **Confirmation Lock (2–4 hours before event):** Each participant must tap “I’m still in” to keep their spot. If they do not confirm, their spot is released to the waitlist or the event shrinks to a confirmed group.
3. **Soft Cooldown for Broken Commitment:** If a user confirms but does not check in, they cannot sign up for the next City GO for 14 days. They keep the WELCOME50 coupon if they already earned it, but they lose fast re-entry to the free channel.
4. **Self-Serve Check-In:** At the landmark, the user taps a check-in button and answers one trivial landmark question (e.g., “图片里的雕塑是什么颜色？”). This records attendance without background location or staff verification.

### 3.2 User Flow

```
Sign-up → 24h: “你的 City GO 伙伴已就位” (buddy card + micro-mission)
        → 2-4h: “确认出发？一键锁定席位” (confirmation lock)
        → Arrival: 签到 + 1 trivial landmark question
        → Post-event: WELCOME50 unlocked + attendance token earned
        → No-show after confirmation: 14-day City GO cooldown
```

### 3.3 Why This Is the Smartest Fit

- **No cost to the user:** The event remains free. No deposit, no penalty, no payment friction.
- **Addresses the real fear:** Knowing at least one other person is committed reduces the “stranded” anxiety that drives the no-show spiral.
- **Lightweight ops:** No host, no payment reconciliation, no venue check-in desk. The buddy match and confirmation are fully automated.
- **Compliance-safe:** Anonymous archetype nicknames, no 1:1 chat, no real-time location sharing, no PII exposure beyond the existing profile.
- **Reinforces the paid funnel rather than cheapening it:** Users still experience the paid Blind Box format for free. The WELCOME50 coupon remains the bridge, and a better free experience increases trust before the ask.

---

## 4. Why It Beats Alternatives

| Alternative | Why we reject it | Hidden cost or risk |
|-------------|------------------|---------------------|
| **Refundable deposit (e.g., ¥20)** | Net-zero cost, but it still requires payment upfront. For a segment that has never paid, this is a funnel cliff. | Payment friction, refund disputes, reconciliation ops, feels like “not really free.” |
| **Overbooking (sign 5–6 for 3–4 slots)** | May fill the room, but it does not fix the fear of being stranded. If everyone shows up, the experience degrades. | Operational chaos, worse first impression, no trust-building. |
| **On-site host for every event** | Operationally heavy and violates the small-team constraint. | Host scheduling, training, cost, and scalability collapse. |
| **Pure penalty system (charge no-shows / ban)** | Hostile for a free trial. Reduces sign-up rate and damages brand. | Compliance risk, chargeback/dispute overhead, negative word-of-mouth. |
| **Buddy system alone** | Better than nothing, but without a confirmation lock and a consequence, the social contract is too weak to move the metric. | Buddy might still flake; no mechanism to release abandoned spots. |

The Buddy Lock is the only option that combines **social accountability** (the buddy), **pre-commitment** (the lock), and **consequence** (the cooldown) while keeping the event free and the operations light.

---

## 5. Estimated Impact on Metrics

All estimates are **pessimistically calibrated** against the simulated research baseline.

| Metric | Current | Estimated with Buddy Lock | Rationale |
|--------|---------|--------------------------|-----------|
| **Attendance rate** | 63% | **70–72%** | Confirmation lock filters out passive sign-ups; social accountability and cooldown reduce intentional no-shows. Historical event-platform data suggests 15–30% relative reduction in no-shows from pre-event confirmation + 10–20% from accountability. |
| **Second-event return** | 26% | **32–36%** | Better-attended events create a better first impression. The buddy creates a positive memory and a reason to return. Selective sign-up via the lock also raises intent quality. |
| **Paid conversion** | 11.2% | **13–15%** | A better free experience builds trust, but a single free meeting is still early for a ¥68 ask. The WELCOME50 coupon makes the out-of-pocket cost ¥34, which is attractive. We expect a modest lift; hitting the 15% threshold may require further funnel work (e.g., a second free event or a stronger post-event ceremony). |
| **Sign-up rate** | 22.4% | **20–22%** | Slight friction from explaining the lock and cooldown. The event remains free, so the drop should be minimal. |

**Calibration note:** The attendance estimate is the most confident because the mechanism directly targets the three root causes. Conversion is the least confident because the research synthesis consistently shows the paid bridge is too abrupt after one encounter; attendance alone may not be enough to fix it.

---

## 6. Smallest Validating Experiment (1 Week, ≤200 Users)

### 6.1 Design

- **Sample:** ~200 City GO sign-ups across 2–4 events in one week.
- **Randomization:** At sign-up, split users 50/50 into:
  - **Control:** Current flow (sign-up → reminder → show up).
  - **Treatment:** Buddy Lock flow (buddy match → confirmation lock → cooldown).
- **Event size:** 3–4 people per group, consistent with the MVP.
- **Waitlist:** Treatment groups maintain a 1-person waitlist so released spots can be backfilled quickly.

### 6.2 What We Measure

| Signal | Definition | Primary / Secondary |
|--------|------------|---------------------|
| Attendance rate | % of sign-ups who check in | **Primary** |
| Sign-up rate | % of eligible users who sign up | Primary guardrail |
| Confirmation rate | % of treatment users who tap “I’m still in” | Secondary |
| Confirmed no-show rate | % of treatment users who confirmed but did not check in | Secondary |
| Post-event satisfaction | 1–5 rating + “would you return?” | Secondary |
| 7-day return rate | % of attendees who sign up for a second City GO within 7 days | Secondary |
| 7-day paid conversion | % of attendees who use WELCOME50 on a paid event within 7 days | Secondary |

### 6.3 Execution Notes

- Use the existing mini-program notification channel (WeChat service message + in-app message) for the 24-hour buddy reveal and the 2–4 hour confirmation prompt.
- The buddy card is rendered via Xiaoyue with a warm, non-clinical micro-mission (e.g., *“你们今天的暗号是：各自带一句最近听过的歌词。”*).
- The confirmation lock is a single tap; no forms, no payment, no location permission.
- Cooldown enforcement is server-side: `users.city_go_cooldown_until` is set if `confirmed === true` and `checked_in === false`.

---

## 7. Go / No-Go Rule

### GO — Scale the Buddy Lock

Approve rollout if **all** of the following are true after the 1-week experiment:

- Treatment attendance rate is **≥70%**.
- Sign-up rate in treatment does not fall below **20%** (no meaningful funnel collapse).
- Confirmed no-show rate (users who confirmed but did not check in) is **≤10%** (the lock is working as a filter).
- Post-event satisfaction score is **≥4.0/5** in treatment (the buddy experience does not feel creepy or forced).

### NO-GO — Kill or Redesign

Stop the experiment if **any** of the following are true:

- Treatment attendance rate is **<65%** (the mechanism failed to move the core metric).
- Sign-up rate in treatment drops below **15%** (the lock creates too much friction).
- More than **25%** of confirmed users no-show (the lock is not a credible filter).
- Post-event satisfaction is **<3.5/5** in treatment, with “felt like a chore” or “privacy concern” as top complaints.

If NO-GO, the next hypothesis is that the **landmark + travel time itself** is the real bottleneck, not commitment. In that case, we should test shorter travel-radius events or a different value exchange (e.g., partner venue with free drink) rather than layering more commitment mechanisms on a broken format.

---

## 8. Open Questions

1. Do we have enough City GO event density in the next week to recruit ~200 sign-ups? If not, extend recruitment to 10 days or lower the per-arm sample to 60.
2. Can the existing WeChat service-message channel reliably deliver the 24-hour and 2-hour prompts? If not, we may need an in-app-only fallback.
3. Should the buddy match be based on archetype complementarity or purely random? This affects the emotional quality but not the attendance mechanism.
4. How do we handle the 14-day cooldown for users who legitimately had an emergency? Consider a one-time “forgive” token per user to avoid brand damage.

---

## 9. Summary

The smartest first-principles solution to City GO no-shows is a **Buddy Lock**: a free, lightweight commitment device that pairs anonymous buddies 24 hours before the event, requires a one-tap confirmation 2–4 hours before, and applies a 14-day cooldown to users who confirm but do not show. It directly attacks the root cause — small-group uncertainty and weak commitment — while keeping the event free, the ops team small, and the paid funnel intact. We can validate it with a 1-week, ≤200-user A/B test and a clear go/no-go rule centered on attendance rate and sign-up friction.
