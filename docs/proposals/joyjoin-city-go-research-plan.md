# JoyJoin City GO — Simulated User Research Plan (Phase 0)

**Status:** Research brief — ready for review before engineering commitment  
**Scope:** Validate the City GO proposal with 1,000 simulated users  
**Owner:** Product Management  
**Research window:** 4–6 weeks (simulated)  
**Team footprint:** 1 PM, 1 designer (prototypes), 1 data analyst, no dedicated research vendor

---

## 0. Executive Summary

City GO is not a feature. It is a **mini-game product** disguised as a conversion funnel. The PRD bundles three distinct bets:

1. A location-based solo game layer (pixel map + turn-based battles + energy economy).
2. A free event format (newbie raids) to convert non-paying users into paid Blind Box.
3. An AI NPC narrative system for retention and personalization.

All three are expensive, and the most critical one — converting solo-game players into paid social-event participants — is the least supported by user behavior in JoyJoin’s current product.

This research plan is designed to **kill the project early** if the core assumptions do not hold. It is not a plan to validate enthusiasm.

---

## 1. Research Objectives & Hypotheses

### 1.1 Primary Objectives

| # | Objective | Why it matters |
|---|---|---|
| O1 | Determine whether City GO changes the behavior of **never-paid users** in a way that leads to first paid event registration. | This is the stated strategic purpose of the project. |
| O2 | Determine whether the game mechanics (pixel map, battles, energy) are attractive enough to create a **repeat habit**, not just a one-time novelty. | If not, the product cannot sustain the cost of content and LLM NPCs. |
| O3 | Determine whether users will **physically travel to landmarks** for short tasks. | Location is the core constraint; failure here collapses the design. |
| O4 | Resolve the strategic ambiguity with **闪现**. | The PRD treats 闪现 as an existing free layer, but it is not visible in the active product canon. |

### 1.2 Hypotheses

| ID | Hypothesis | Criticality | Prior confidence |
|---|---|---|---|
| H1 | City GO users have **7-day retention ≥10 percentage points higher** than a holdout group. | Must pass | Medium — novelty can fake this for 1–2 weeks. |
| H2 | **≥20%** of City GO-exposed users sign up for a free newbie raid within 7 days. | Must pass | Low — requires real-world effort and time commitment. |
| H3 | **≥15%** of raid participants register for a **first paid** Blind Box / paid event within 30 days. | Must pass | Very low — this is the central conversion bridge and the hardest to prove. |
| H4 | **≥60%** of users who start a landmark battle complete it. | Must pass | Medium — depends on game clarity and location friction. |
| H5 | **≥60%** of raid participants are users who have **never joined a paid event**. | Must pass | Medium — otherwise City GO is cannibalizing paid users, not expanding the funnel. |
| H6 | **≥30%** of users return to City GO the day after their energy is depleted. | Nice to have | Low — energy systems are easily ignored. |

**Priority statement:** H3 is the only hypothesis that justifies the project. If H3 fails, none of the other metrics matter for the stated goal.

---

## 2. User Segmentation & Sampling

### 2.1 Segmentation Rationale

City GO targets **game-first urban youth**, but JoyJoin’s current installed base is primarily relationship-first. The research must test whether the target audience exists inside the current user base, not whether a hypothetical audience would like it.

We will allocate 1,000 simulated users across five segments, deliberately over-indexing on the proposed conversion target.

### 2.2 Sample Allocation

| Segment | n | Definition | Research purpose |
|---|---|---|---|
| **A. Non-paying active** | 450 | Completed personality test, no paid event history, opened app in last 14 days. | Primary conversion target. This is the population City GO must move. |
| **B. Non-paying dormant** | 150 | Completed personality test, no paid event history, dormant 30–90 days. | Test reactivation and whether City GO re-engages churned users. |
| **C. Paid benchmark** | 200 | At least one paid Blind Box / event registration. | Test whether City GO is additive to existing payers or cannibalizes them. |
| **D. Pre-archetype** | 100 | Registered but not yet completed personality test. | Test whether City GO has a prerequisite problem (it assumes archetype identity). |
| **E. High-engagement power users** | 100 | Multiple paid events, high DAU. | Test depth and whether the game layer adds retention to the most valuable users. |
| **Total** | **1,000** | | |

### 2.3 Cross-Stratification

Within each segment, ensure representation across:

- **Archetype family** (group 12 archetypes into 4 families: Energizers, Thinkers, Connectors, Observers). Minimum 20% per family per segment.
- **City:** 70% Shenzhen (target market), 20% Hong Kong, 10% other.
- **Engagement frequency:** 40% DAU, 40% weekly, 20% monthly/dormant.
- **Age:** 60% 20–28, 30% 29–35, 10% 18–19 or 36+.

**Why this allocation:**
- Segment A gets the largest share because it is the only segment that maps to the stated goal. If City GO cannot convert these users, it fails.
- Segment C is included to detect cannibalization early. If paid users love City GO but it does not convert Segment A, the product is a retention layer, not a funnel expansion.
- Segment D tests a hidden assumption: the PRD assumes users already have an archetype and Mascot. If City GO is attractive to pre-archetype users, it may conflict with the onboarding flow.

---

## 3. Methodology

### 3.1 Approach Overview

This is a **simulated** study. We will not build the product. We will use a mix of:

1. **Concept survey** (n=1,000): Stated intent and preference.
2. **Simulated prototype tasks** (n=300): Behavioral walkthroughs with clickable mocks.
3. **Simulated in-depth interviews** (n=40): Qualitative exploration of barriers and emotional journey.
4. **Historical data calibration**: Anchor simulated responses to real JoyJoin conversion baselines.

### 3.2 Simulated Survey (n=1,000)

**Length:** 8–10 minutes, mobile-first.

**Sections:**

#### S1. Current behavior (baseline)
- How often did you open JoyJoin in the last 7 days?
- Have you ever registered for a paid Blind Box or paid event?
- What stopped you from joining a paid event? (select all)
- What made you join a paid event, if you did?

#### S2. Gaming and location behavior
- Which of these do you currently play? (Pokemon GO, Honor of Kings, Animal Crossing, party games, social deduction, none)
- How often do you play location-based or mobile games?
- In the last 30 days, how often have you gone to a specific public place just for an app or game?
- What is the maximum distance you would walk for a 5-minute in-app reward?

#### S3. Concept reaction
Shown a short description and 3 mock screenshots:
- Pixel map of a neighborhood with your Mascot.
- A “social困境怪” battle screen with archetype skills.
- A “newbie raid” card: free, 30 min, 2–4 people, tonight at 20:00 near 海岸城.

Questions:
- “How appealing is this overall idea?” (1–5)
- “How likely would you be to open this feature at least twice a week?” (1–5)
- “How likely would you be to walk to a nearby landmark for a 5-minute battle?” (1–5)
- “How likely would you be to sign up for a free 30-minute newbie raid?” (1–5)
- “If you enjoyed the free raid, how likely would you be to pay ¥68 for a matched Blind Box?” (1–5)
- “What is the main reason you might NOT use this?” (open)

#### S4. Price sensitivity
- If you ran out of free daily energy, would you: (a) wait until tomorrow, (b) pay ¥12 for a weekly pass, (c) quit using the feature, (d) other.
- What is the maximum you would pay per month for a “City Pass”?

### 3.3 Simulated Prototype Tasks (n=300, subset of survey respondents)

Participants complete 4 tasks on a clickable prototype. We record:

1. **Map exploration:** Where do they tap first? Can they find a landmark?
2. **Battle start:** Do they understand the battle rules without coaching? How long does it take?
3. **Raid sign-up:** Do they complete the registration flow? Where do they drop off?
4. **Post-raid coupon:** When shown a “first-time ¥10 coupon” for a Blind Box, do they claim it?

**Behavioral signals recorded:**
- Time-on-task.
- Tap path and back-outs.
- Verbalized confusion points.
- Self-reported likelihood vs. observed completion.

### 3.4 Simulated In-Depth Interviews (n=40)

10 participants per segment. 45 minutes each. Focus areas:

- “Walk me through the last time you felt bored and opened JoyJoin.”
- “Under what conditions would you actually walk to a landmark for a 5-minute task?”
- “Why would a free 30-minute raid feel safer or easier than a paid Blind Box?”
- “What would make you pay ¥68 after a free raid?”
- “If this feature disappeared tomorrow, would you care?”

### 3.5 Holdout Simulation

Because this is simulated, we cannot run a true A/B test. We will model a **simulated holdout** by:

- Asking the same retention and intent questions to a control group shown the *current* JoyJoin experience (no City GO).
- Applying a historical novelty discount to City GO responses.
- Calibrating uplift against real JoyJoin retention curves.

---

## 4. Critical Assumptions to Test

These are the assumptions that, if wrong, make the project unviable. We rank them by risk and likelihood of failure.

### 4.1 The Conversion Bridge (Risk: Critical — Likely to Fail)

**Assumption:** Users who play a solo location-based game will later pay for a structured, matched, multi-hour offline social event.

**Why it is risky:**
- The psychographic profile of a Pokemon GO player and a Blind Box participant may not overlap.
- Solo game rewards (points, skins, Mascot XP) can satisfy the user without ever needing paid social events.
- The free raid is the actual bridge; the pixel map and battles may be irrelevant to conversion.

**Evidence to collect:**
- H3: raid → paid conversion rate.
- Correlation between battle frequency and raid sign-up.
- Correlation between raid enjoyment and paid-event intent.

### 4.2 The Physical Location Assumption (Risk: High — Likely to Fail)

**Assumption:** Users will physically walk to landmarks in Shenzhen for 5-minute tasks.

**Why it is risky:**
- Shenzhen weather, work schedules, and mall density make short trips inconvenient.
- WeChat Mini Program only allows foreground location; users must already be in the app.
- Location spoofing and cheating are easy to simulate; trust in the system is low.

**Evidence to collect:**
- H4: battle completion rate.
- S3 survey: maximum distance users say they will walk.
- IDI probes: real-world friction and embarrassment barriers.

### 4.3 The 闪现 Assumption (Risk: Critical — Already Questionable)

**Assumption:** 闪现 is an existing, functioning free layer that City GO can replace or integrate with.

**Why it is risky:**
- A search of the active product canon (`PRODUCT_REQUIREMENTS.md`, `DEVELOPER_QUICK_REFERENCE.md`, and current codebase) does not show 闪现 as a shipped feature.
- The PRD frames City GO’s value relative to 闪现, but if 闪现 does not exist, the strategic comparison is invalid.
- If 闪现 is planned but unbuilt, City GO would double the free-layer investment.

**Evidence to collect:**
- Clarify product leadership: Is 闪现 shipped, planned, or aspirational?
- Survey: Have users ever heard of or used 闪现 in JoyJoin?
- If 闪现 is not real, reframe the research to test City GO against the *current* free layer (Discover, City Unlock, etc.).

### 4.4 The Game Quality Assumption (Risk: Medium)

**Assumption:** A pixel-map, turn-based battle system is compelling enough to open repeatedly.

**Why it is risky:**
- Mini Program constraints (2 MB package, no background location, Canvas performance) make rich games hard.
- The proposed battles are shallow (3 monster types, 3 skills). Content will exhaust quickly.
- The art style (pixel map) may not align with JoyJoin’s premium, emotional brand.

**Evidence to collect:**
- H1: 7-day retention lift.
- Prototype task: time-on-task and re-engagement intent.
- IDI: “Would you keep doing this after the first week?”

### 4.5 The Team Capacity Assumption (Risk: High — Not a User Assumption, but a Project Killer)

**Assumption:** A team of 1 frontend + 1 backend + 1 game/UX designer + 0.5 PM can deliver City GO in 3 months.

**Why it is risky:**
- The PRD requires: a new game client, a location/spawn system, a battle engine, energy economy, NPC dialogue, event-pool integration, analytics, and art assets.
- This is closer to a 6–9 month scope with a dedicated game team.
- If the team cannot ship, the research findings are irrelevant.

**Evidence to collect:**
- Engineering sizing before research begins.
- If the team cannot commit to a realistic scope, downgrade the research to a “narrow funnel test” only.

---

## 5. Success Thresholds & Go/No-Go Framework

### 5.1 Threshold Definitions

| Metric | Threshold | Type | If failed |
|---|---|---|---|
| Raid-to-paid conversion (H3) | **≥15%** | Must pass | **DROP or pivot** to standalone monetization. The project does not achieve its stated goal. |
| Free raid sign-up rate (H2) | **≥20%** | Must pass | **DROP or pivot to “City GO Lite”** (only raids, no game layer). |
| 7-day retention lift (H1) | **≥10 pp** | Must pass | **DROP.** If it cannot lift retention, it is not worth the content cost. |
| Battle completion rate (H4) | **≥60%** | Must pass | **DROP or pivot.** Location friction is too high. |
| Non-paying participant share (H5) | **≥60%** | Must pass | **PIVOT.** The feature is attracting paid users, not expanding the funnel. |
| Energy-depletion return rate (H6) | **≥30%** | Nice to have | Continue; optimize energy economy later. |
| NPC dialogue engagement | **≥40%** of active users | Nice to have | Defer NPC depth; use fallback templates. |
| Map open frequency | **≥2x/week** | Nice to have | Continue; content rotation is the issue, not the project. |

### 5.2 Decision Matrix

| Scenario | H2 | H3 | H1 | H4 | H5 | Decision |
|---|---|---|---|---|---|---|
| All pass | ≥20% | ≥15% | ≥10pp | ≥60% | ≥60% | **GO** — but extend timeline to 5–6 months and strip NPC depth. |
| H3 fails, others pass | ✓ | ✗ | ✓ | ✓ | ✓ | **PIVOT** to standalone retention/mini-game monetization. Do not position as Blind Box funnel. |
| H2 fails, H3 passes | ✗ | ✓ | ✓ | ✓ | ✓ | **PIVOT** to “City GO Lite” — skip the game layer, run free raids only. |
| H1 fails | — | — | ✗ | — | — | **DROP** unless a compelling niche segment (e.g., power users) shows strong retention. |
| H4 fails | — | — | — | ✗ | — | **PIVOT** to non-location format (e.g., virtual raids or check-in at home). |
| H5 fails | — | — | — | — | ✗ | **PIVOT** to paid-user retention or **DROP** if revenue does not justify cost. |

### 5.3 Anti-Enthusiasm Rule

A single “exciting” metric does not justify the project. The following combinations are **not enough** to proceed:
- High survey appeal but low raid sign-up.
- High raid sign-up but low paid conversion.
- High retention among paid users but no conversion among non-paying users.
- High prototype completion but low stated intent to pay.

---

## 6. Pivot Options

If the must-pass thresholds fail, the team should choose one of these pivots, ordered by reuse of existing assets and minimal new engineering.

### Pivot A: City GO Lite — Free Raid as a Feature (Lowest Risk)

**What it is:** Drop the pixel map, turn-based battles, energy system, and AI NPC. Keep only the “newbie raid” free event format, integrated into the existing event-pool and registration infrastructure.

**Reuses:** event_pools, pool_registrations, pool_checkins, matching engine, existing event-ticket payment flow.

**When to choose:** H2 fails but there is appetite for a free entry point; H3 shows promise only when the game layer is removed.

### Pivot B: Location Discovery Layer (Medium Risk)

**What it is:** Keep the pixel map but turn it into a **content discovery surface** for existing paid and free events. Landmarks show what is happening nearby; tapping leads to the existing event-pool card. No battles, no energy, no NPCs.

**Reuses:** Discover infrastructure, event cards, venue/location data from City Unlock.

**When to choose:** H1 passes (users like the map) but H2/H3 fail because battles/raids feel too heavy.

### Pivot C: Standalone Mini-Game with Own Monetization (Highest Risk, Highest Reward)

**What it is:** Build City GO as a separate retention product with its own energy pass or cosmetic monetization. Decouple it from Blind Box conversion entirely.

**Reuses:** Pixel art, Mascot assets, battle engine, energy system.

**When to choose:** H3 fails but H1 and H6 are strong, and survey respondents show willingness to pay for a City Pass.

**Warning:** This requires a dedicated game team and a longer timeline. It is not a 3-month project.

---

## 7. Integration with 闪现

### 7.1 Current State

The PRD describes City GO relative to a feature called **闪现** (instant, low-commitment, location-based flash events). However, a review of the active product canon and codebase does not show 闪现 as a shipped feature. It appears to be either:

1. **A planned but unbuilt feature** that the City GO team is assuming exists.
2. **An internal concept** that has not reached users.
3. **A legacy or aspirational label** with no current implementation.

This is a serious strategic gap. The entire framing of City GO — “replace 闪现, or integrate some elements from 闪现” — assumes a baseline that may not exist.

### 7.2 Decision Framework

| Situation | Recommended integration | User evidence needed |
|---|---|---|
| **闪现 is shipped and has active users** | City GO should **absorb** the low-commitment offline intent of 闪现, but not replace it immediately. Run City GO as a separate experiment before sunsetting 闪现. | Current 闪现 usage, retention, and conversion to paid events. |
| **闪现 is planned but not built** | **Do not build both.** Pick one: either ship 闪现 first, or skip it and build City GO. Parallel free layers will starve the paid funnel. | Survey evidence on which concept (simple flash events vs. game layer) has higher conversion potential. |
| **闪现 does not exist** | City GO must be evaluated **on its own merits**, not as a replacement. The PRD should be rewritten. | User evidence that City GO is compelling without any reference to 闪现. |

### 7.3 Recommendation

**Treat 闪现 as non-existent until proven otherwise.** The research should:

1. Remove references to 闪现 from user-facing materials.
2. Test City GO against the **current free layer**: Discover event list, City Unlock, and onboarding/profile engagement.
3. If users express desire for “quick, nearby, low-commitment hangouts,” that is evidence for **Pivot A (City GO Lite)** — not for the full City GO game layer.

---

## 8. Critical PM Assessment

### 8.1 The Biggest Flaw

**City GO is a product, not a feature, and its conversion thesis is weak.**

The PRD asks a small team to build a location-based game, a free event format, and an AI NPC system in 3 months, with the hope that solo game players will convert to paid social events. This is three risky bets stacked on top of each other.

The most dangerous flaw is the **conversion bridge**: the belief that a user who walks around catching “social困境怪” will later pay ¥68 for a matched dinner with strangers. There is no strong evidence in JoyJoin’s current data or in general mobile-game behavior that this happens at scale.

### 8.2 What Would I Change Before Shipping?

1. **Strip the game layer first.** Test the “free raid → paid event” funnel using existing event-pool infrastructure. If that works, add a light layer (location check-in, simple task). If it does not, the game layer will not save it.
2. **Remove AI NPCs from Phase 0.** NPCs are expensive, LLM-dependent, and unproven. Use static, rotating rumors until the core loop is validated.
3. **Fix the strategic premise.** Clarify whether 闪现 exists. If not, rewrite the PRD to position City GO independently.
4. **Extend the timeline or reduce scope.** With 3 months and a small team, ship only one of the three bets. The current scope is closer to 6–9 months.
5. **Define the “aha” moment.** The PRD does not specify what single user action predicts conversion to paid. Without that metric, optimization is impossible.

### 8.3 My Direct Recommendation

**Do not commit engineering resources to City GO as currently designed.**

Run this simulated research plan first. If the must-pass thresholds are met, proceed with **Pivot A (City GO Lite)** as the Phase 0 scope: a free raid format integrated into existing infrastructure, with no pixel map, no battles, and no energy economy. Add the game layer only after the conversion funnel is proven.

---

## 9. Simulated Response Modeling & Guardrails

### 9.1 How We Model Simulated Responses

Because this is a simulated study, we will not observe real user behavior. We must model responses explicitly and pessimistically.

**Modeling approach:**

1. **Base rates from JoyJoin data:** Use current conversion rates as priors:
   - Free-event-to-paid-event conversion baseline (if any free events exist).
   - Discover-to-registration conversion.
   - 7-day retention for active vs. dormant users.
   - Paid-event repeat rate.

2. **Stated-intent discount:** Survey respondents consistently overstate behavior. Apply a **50% discount** to stated intent for high-effort actions (walking to a landmark, signing up for a raid, paying ¥68).
   - Example: If 40% say they would sign up for a raid, model 20% actual sign-up.

3. **Novelty decay:** For retention metrics, apply a decay curve. Week-1 retention may be inflated by novelty; the stable rate is what matters.

4. **Segment-specific priors:** Non-paying active users are the hardest to convert. Do not assume they behave like power users.

### 9.2 Guardrails Against False Positives

| Guardrail | Implementation |
|---|---|
| **Multiple metrics must pass** | No single “exciting” metric justifies the project. All five must-pass metrics must pass. |
| **Pessimistic calibration** | Halve stated intent. Apply novelty decay to retention. Use worst-case conversion baselines. |
| **Holdout simulation** | Compare City GO responses to a control group shown the current JoyJoin experience. |
| **Segment-specific scrutiny** | If only paid users or power users engage, the project fails its core goal. |
| **Repeatability check** | Require metrics to hold across two simulated “weeks” or cohorts, not just one. |
| **Qualitative triangulation** | IDI and prototype data must support the survey numbers; if they contradict, trust the behavioral data. |
| **Engineering reality check** | Before final go/no-go, confirm that the engineering team can deliver the scope. If not, downgrade. |

### 9.3 Simulated Output Example

If the final report says:

> “25% of non-paying users said they would sign up for a free raid, and 18% of those said they would later pay.”

The modeled outcome should be reported as:

> “Applying a 50% stated-intent discount, the modeled raid sign-up rate is **12.5%**, which fails the 20% threshold. The modeled paid conversion is **9%**, which fails the 15% threshold.”

This prevents false optimism from driving a bad engineering commitment.

---

## 10. Next Steps

1. **Confirm product leadership’s view on 闪现.** If it is not real, rewrite the research materials without it.
2. **Engineering sizing:** Ask the team to estimate the minimum viable version of each City GO component. If the 3-month timeline is impossible, narrow the research scope.
3. **Prototype build:** Create clickable mocks for the map, battle, raid card, and coupon screen.
4. **Survey launch:** Field the 1,000-user simulated survey with the pessimistic calibration model.
5. **Synthesize and decide:** Run the go/no-go decision matrix and select a pivot or drop path.

---

*End of research plan.*
