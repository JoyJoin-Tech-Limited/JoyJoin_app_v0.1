# JoyJoin City GO — Stripped MVP Simulated Research Report

**Date:** 2026-07-07  
**Sample:** n=1,000 simulated JoyJoin users, pessimistic calibration  
**Concept:** City GO Stripped MVP — a single free, 30–45 min, landmark-hosted group event for users who have never joined a paid event.

---

## 1. Concept Overview

A lightweight, Xiaoyue-hosted free trial of JoyJoin’s matched social format at a fixed public landmark, designed to convert never-paid users into Blind Box customers after two completed free events.

---

## 2. Simulated Metrics Table

| Metric | Threshold | Result | Status |
|---|---|---|---|
| Free event sign-up rate (of exposed users) | ≥ 20% | 22.4% | ✅ **Pass** |
| Attendance rate (of sign-ups) | ≥ 65% | 63.0% | ❌ **Fail** |
| Second-event return rate (of attendees) | ≥ 30% | 26.0% | ❌ **Fail** |
| Paid conversion (after 2+ free events) | ≥ 15% | 11.2% | ❌ **Fail** |
| Non-paying participant share | ≥ 60% | 72.8% | ✅ **Pass** |
| Visual packaging engagement (Mascot / cosmetics) | ≥ 40% | 38.0% | ❌ **Fail** |
| 7-day retention lift vs. holdout | ≥ 10 pp | +7.3 pp | ❌ **Fail** |

**Summary:** 2 of 7 thresholds pass. The free offer attracts the right non-paying segment, but it does not create attendance discipline, repeat habit, or paid conversion.

---

## 3. Segment Breakdown

| Segment | n | Sign-up | Attendance | 2nd-event return | Paid conversion after 2 free | Notes |
|---|---|---|---|---|---|---|
| **A. Non-paying active** | 450 | 28.0% | 64.0% | 27.5% | 12.0% | Largest addressable pool; sign-up is strongest but return and conversion are soft. |
| **B. Non-paying dormant** | 150 | 12.0% | 68.0% | 29.0% | 9.5% | Low top-of-funnel; those who show up are committed, but the offer alone does not reactivate most. |
| **C. Paid benchmark** | 200 | 18.0% | 62.0% | 24.0% | 16.5% | Some conversion, but they are not the target; risk of cannibalizing the paid base for free participation. |
| **D. Pre-archetype** | 100 | 8.0% | 55.0% | 18.0% | 5.0% | Confused by the archetype / Mascot packaging; they need onboarding first, not City GO. |
| **E. High-engagement power users** | 100 | 22.0% | 58.0% | 22.0% | 14.5% | Curious but not incremental; they already pay and attend. |

**Best performing:** Segment A (non-paying active). They understand the product, see the free event as a low-risk trial, and have the highest sign-up rate.  
**Worst performing:** Segment D (pre-archetype). The concept assumes archetype identity and Mascot ownership; without these, users do not understand the value proposition.

---

## 4. Top 3 Reasons Users Liked It

1. **Free trial of a paid social format.**
   > “先不花钱体验一次盲盒的氛围，再决定要不要买，比较安心。”
   > — Segment A, 25, Shenzhen

2. **Landmark anchor made meeting strangers safer.**
   > “在海岸城门口集合，至少我知道那是哪里，找不到也能问人。”
   > — Segment B, 28, Shenzhen

3. **Xiaoyue hosting reduced awkwardness.**
   > “悦仔带着流程走，不用自己尬聊，社恐友好一点。”
   > — Segment A, 24, Shenzhen

---

## 5. Top 3 Reasons Users Rejected It

1. **Time and travel cost felt too high for a short free event.**
   > “30分钟活动，过去要20分钟，还得等人，不如下班直接回家。”
   > — Segment A, 27, Shenzhen

2. **Conversion bridge felt transactional and premature.**
   > “去了两次就让我花68，像完成KPI才能领优惠券。”
   > — Segment A, 26, Shenzhen

3. **No-show and mismatch anxiety persisted.**
   > “万一到了只有我一个人，或者另外三个人很无聊，我凭什么再相信一次？”
   > — Segment B, 29, Shenzhen

---

## 6. Critical Assessment

**What passed:**

- **Sign-up rate (22.4%)** passes because the free offer is well-targeted and clearly positioned. The 73% non-paying share confirms we are reaching the intended audience, not cannibalizing paid users.
- **Non-paying share (72.8%)** is the strongest signal. The feature is correctly reaching the never-paid population.

**What failed:**

- **Attendance (63.0%)** misses by 2 percentage points. Under pessimistic calibration this is operationally fragile. Even with a public landmark and check-in QR, the time-to-value ratio keeps some users at home. A 2 pp miss is small but dangerous when the downstream funnel depends on it.
- **Second-event return (26.0%)** misses by 4 pp. The free event does not yet generate enough positive memory or social obligation to bring users back. This is the strongest evidence that the format is a novelty, not a habit.
- **Paid conversion (11.2%)** misses by 3.8 pp. The “two free events unlock a ¥68 coupon” bridge does not build enough trust to justify the ask. Users see the coupon as a trap, not a reward.
- **Retention lift (+7.3 pp)** misses the 10 pp bar. The experience is not sticky enough to change weekly behavior.
- **Visual packaging engagement (38.0%)** is close but below threshold. The Mascot and cosmetics are noticed, but they are not a driver of participation.

**The core insight:** The free event is a good **lead magnet** but a weak **conversion engine**. It solves the problem of “I don’t know what a Blind Box feels like” but does not solve the harder problem of “I am willing to pay for this repeatedly.”

---

## 7. Final Recommendation

**PIVOT — do not ship this MVP as a conversion feature.**

The stripped-down City GO is directionally better than the game-heavy variants, but it still fails on the metrics that matter for the business: attendance, repeat behavior, and paid conversion. The concept is not strong enough to justify its operational and product-engineering cost in its current form.

**Specific next steps:**

1. **Fix the attendance problem before the conversion problem.** Experiment with a guaranteed minimum group (e.g., “3 people confirmed before you leave home”), real-time waitlist transparency, or a ¥10 refundable deposit for the free event. A 63% attendance rate destroys the funnel.
2. **Redesign the conversion bridge.** Drop the “2 events → coupon” mechanic. Test instead: a first-time paid event at a steep discount (e.g., ¥29), a buddy-discount if they bring a friend, or a post-event “next event in 48h” limited offer. The coupon feels transactional; the goal is to make the first paid event feel like a natural next step.
3. **Run a 200-user, 4-week real pilot in Shenzhen.** The simulated data has told us what the likely failure modes are. A real pilot should test only attendance and second-event return, with paid conversion measured but not optimized for yet. Do not build broader Mascot cosmetics or visual packaging until the core event-conversion loop works.
4. **Kill the remaining game-layer ideas.** No pixel map, no energy, no NPCs, no companion raising. Keep only the Mascot as a visual identity marker and event host.

If the real pilot cannot push attendance above 70% and second-event return above 35% after two iterations, **DROP** the concept entirely.

---

## 8. Biggest Remaining Risk

**The operational reality of a free event is a no-show spiral.**

A 63% attendance rate on a free event means roughly 1 in 3 registered users do not show up. In a 3–4 person group, a single no-show can ruin the experience for the remaining attendees. Those attendees are less likely to return, which pushes the second-event return rate down, which shrinks the pool of users who ever reach the conversion bridge. The free event risks entering a self-reinforcing cycle where poor attendance → bad experience → no return → no conversion. Until attendance is mechanically protected (e.g., deposits, guaranteed group thresholds, or late-cancellation penalties), the feature cannot succeed regardless of how appealing the concept is in a survey.

---

*Report generated from simulated user research. Calibrated to pessimistic intent-halving, novelty decay, and worst-case non-payer conversion baselines.*
