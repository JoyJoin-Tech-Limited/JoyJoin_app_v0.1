# JoyJoin City GO — Simulated Research Synthesis

**Date:** 2026-07-07  
**Scope:** 5 parallel simulated user-research concepts, n=200 each, pessimistic calibration  
**Goal:** Validate whether City GO (or any of its variants) should be built, pivoted, or dropped.

---

## 1. Executive Summary

**None of the five concepts passed all must-pass thresholds.** The strongest evidence points to a narrow opportunity: a **free, structured, location-based group experience** for non-paying users. The weakest evidence is for the **game layer** (pixel map, turn-based battles, energy, NPCs), which users consistently saw as irrelevant or even distracting.

**Recommendation:** Do **not** build the full City GO game layer. Strip down to a **structured free event format** (raid / flash task) that either replaces or integrates into 闪现, then redesign the conversion bridge before committing engineering resources.

---

## 2. Concept Comparison

| Concept | Raid/Flash Participation | Paid Conversion | 7-Day Retention Lift | Task Completion | Non-Paying Share | Verdict |
|---|---|---|---|---|---|---|
| **A. Full City GO** | 30.0% ✅ | 13.9% ❌ | +6.1 pp ❌ | 39.3% ❌ | 69.9% ✅ | **PIVOT** — raid works, game layer fails |
| **B. City GO Lite** | 13.1% ❌ | 13.6% ❌ | +9 pp ❌ | N/A | 81% ✅ | **PIVOT** — too thin, offer is premature |
| **C. City GO Replaces 闪现** | 20.1% ✅ | 10.7% ❌ | +10 pp ✅ | 64.3% ✅ | 63.2% ✅ | **PIVOT** — engagement works, conversion bridge weak |
| **D. City GO Integrates Into 闪现** | 35.6% ✅ (but only +1.8pp uplift) | 8.2% ❌ | +7 pp ❌ | 54.9% ❌ | 57.4% ❌ | **DROP** — cosmetic wrapper adds no value |
| **E. Optimized 闪现 / No City GO** | 19% ❌ | 14% ❌ | +6 pp ❌ | 58% ❌ | 73% ✅ | **DROP** — incremental UX fixes are not enough |

### Key Observations
- **Paid conversion (H3) fails across all five concepts.** The best results are ~14%, below the 15% threshold. This is the central risk of the entire project.
- **Participation is possible but fragile.** Only Concept A and C cleared the 20% bar, and Concept C only marginally.
- **Game layers do not help conversion.** Battles, energy, and NPCs were repeatedly described as “a different app inside JoyJoin” or “decoration.”
- **Cosmetic integration is the worst.** Gamifying 闪现 without changing the value exchange produced flat participation and lower conversion.
- **Optimized 闪现 alone is insufficient.** Shorter events and better UX lowered friction but did not create habit or identity.

---

## 3. Common Reasons Users Engaged

Across the better-performing concepts (A and C), the top motivators were:

1. **Free, low-commitment trial of a paid social format.**
   - “先免费试试 vibe，再决定要不要花钱。”
   - Users wanted to know what a Blind Box feels like before paying ¥68.

2. **Real-world landmark anchor made joining a platform-organized small interest group feel safer.**
   - “地点就在商场门口，不用找半天。”
   - Familiar public places reduced the anxiety of joining a 同好小组 / 线下兴趣局.

3. **Serendipity and spontaneity.**
   - “像开盲盒一样，不知道会遇到谁。”
   - The hourly refresh / map element created a sense of live opportunity.

4. **Mascot / Xiaoyue as a guide.**
   - “悦仔带着做任务，比干聊自然。”
   - A light facilitator role reduced awkwardness, especially for first-timers.

---

## 4. Common Reasons Users Rejected

1. **Solo game loop conflicts with social intent.**
   - “我打开 JoyJoin 是想认识人，不是打怪。”
   - The turn-based battle and energy system felt like a separate game, not a social product.

2. **Time-effort ratio is poor.**
   - “走过去可能都要 10 分钟，玩 15 分钟，不值。”
   - Short formats made travel feel disproportionate.

3. **Paid offer is too abrupt.**
   - “刚见完一面就让我花 68，太早了吧。”
   - A one-time coupon after a single free encounter eroded trust rather than building it.

4. **Safety and no-show anxiety.**
   - “到了没人怎么办？白跑一趟。”
   - Real-time matching and public landmark check-ins created fear of ghosting or exposure.

5. **Game systems felt like paywall teases.**
   - “刚玩两下就没电了，跟看广告一样烦。”
   - Energy caps and NPC quests were read as monetization hooks, not retention hooks.

---

## 5. Synthesis of the Critical Assumptions

| Assumption | Verdict | Evidence |
|---|---|---|
| Users want a location-based game layer | **WEAK** | Battle completion 39–55%, frequent rejection of “打怪” framing. |
| Users will walk to landmarks for short tasks | **MARGINAL** | Task completion 58–64%, but participation heavily filtered by travel effort. |
| Free raids convert to paid Blind Box | **UNPROVEN** | Best result ~14%, below 15% threshold. Conversion bridge is too abrupt. |
| Game layer increases retention | **NO** | Retention lift was highest in concepts with simpler, not richer, experiences. |
| Replacing 闪现 with a structured format is viable | **MAYBE** | Concept C showed participation and retention, but conversion still failed. |

---

## 6. Recommended Path Forward

### 6.1 Do Not Build
- **Full City GO** (pixel map + battles + energy + NPCs).
- **Gamification wrapper** over 闪现.
- **Optimized 闪现 alone** without a durable retention mechanic.

### 6.2 Test Next: Structured Free Event Format

Build a **minimal, hosted, location-based free event** with the following properties:

- **Duration:** 30–45 minutes (not 15, not 60).
- **Group size:** 3–4 people.
- **Target:** users who have never joined a paid event.
- **Host / facilitator:** a light script or Xiaoyue-guided task, not open-ended chat.
- **Location:** fixed, well-known public landmark or partner venue.
- **Conversion bridge:** not a single coupon, but a **“连续 2 次参与后解锁首单 ¥68 券”** model. Let trust build before the ask.
- **Safety:** show real-time headcount, require check-in, and limit first-time visibility.

This is essentially a **hardened City GO Lite** or a **structured replacement for 闪现**.

### 6.3 Revised Must-Pass Thresholds for the Next Test

| Metric | Threshold | Rationale |
|---|---|---|
| Free event sign-up rate | ≥ 20% | Same as before. |
| Attendance rate (of sign-ups) | ≥ 65% | New metric to catch no-show anxiety. |
| Second-event return rate | ≥ 30% | Tests whether the format builds habit, not just novelty. |
| Paid conversion (after 2+ free events) | ≥ 15% | Move the coupon gate to after trust is established. |
| Non-paying participant share | ≥ 60% | Confirms the target segment is being reached. |

### 6.4 我的伙伴：只做视觉包装，合并进「我的故事」

The screenshot-style companion raising system (trend value, outfit sets, monthly rewards, levels) is **out of scope** for Phase 0. It is a high-cost, high-complexity game system that does not address the core conversion goal and risks turning JoyJoin into a pet-raising app.

However, its visual asset direction can be salvaged:

- Merge the avatar / outfit display into **「我的故事」**.
- Each visual item represents a real memory (e.g., completed raid, first Blind Box, landmark visit).
- No stats, no levels, no set bonuses, no gacha, no monthly reward pressure.
- The Mascot / pixel avatar can appear on the City GO map and in the structured free event as the user's identity marker.

This keeps the emotional value of the character without adding a parallel economy or progression system. It also reinforces the strategic positioning: **Mascot is a long-term identity, not a grindable skin.**

---

## 7. Final Recommendation

**City GO as a game layer should be dropped.**

The only viable opportunity is the **free structured event** underneath it. If you must keep the “City GO” brand, reframe it as:

> “City GO = a free, city-anchored social trial for users who have never paid.”

Everything else—pixel map, battles, energy, NPCs, companion raising—is a feature, not the strategy. Remove it for Phase 0. If the structured free event proves conversion after 2–3 visits, you can add light gamification (badges, Mascot animation, visual cosmetics) later. But do not start with the game layer.

**Next step:** update the PRD to reflect this stripped scope, or proceed directly to a Sprint Contract for a **“City GO Lite: Structured Free Event”** MVP.

---

*This synthesis is based on simulated data and pessimistic calibration. It is meant to de-risk the engineering commitment, not to replace real user research. If real-world research contradicts these findings, reassess after collecting live data.*
