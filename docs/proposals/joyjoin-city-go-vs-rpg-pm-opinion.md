# JoyJoin City GO vs. Lightweight RPG — PM Opinion

> First-principles review of the City GO MVP direction.  
> Date: 2026-07-07  
> Owner: Product Manager, JoyJoin

---

## 1. Core Question: Is a bad first experience worse than a no-show?

**Answer: Conditional — yes, when the bad experience is below a quality threshold.**

A no-show is an operational failure. It wastes a slot, annoys the host, and deprives the user of a chance to convert. But it is **recoverable**: we can re-target the user, offer another event, or use the Buddy Lock to increase commitment next time. The user has no new negative belief about JoyJoin’s core promise.

A bad first experience is a **brand failure**. It gives the user a concrete story: “I met the wrong people / the task was lame / the group had no chemistry.” That story becomes the product identity for that user and is shared socially. In a WeChat-native ecosystem, negative word-of-mouth is fast and hard to reverse. **One bad match can permanently convert a potential advocate into a non-returner.**

The condition is: a no-show is worse only if the alternative event would actually have been good. If the event would have been mediocre either way, a no-show is cheaper. Therefore the real question is not “lock vs. no-lock” — it is **whether we can reliably deliver a good enough first experience.**

---

## 2. Path Comparison

### Path A: Keep City GO physical event + Buddy Lock + invest in matching / tasks

| Dimension | Assessment |
|-----------|------------|
| **Pros** | • Directly aligned with the business model: free taste → paid Blind Box event.  <br>• Leverages existing matching, venue, and archetype infrastructure.  <br>• Real-world social interaction creates emotional peaks that an RPG cannot replicate.  <br>• Generates conversion data (paid event sign-up) that a pure retention feature cannot.  <br>• Differentiates JoyJoin from generic social/gaming mini-programs. |
| **Cons** | • Operational risk: no-shows, host quality, weather, venue availability.  <br>• Requires upfront investment in experience design, not just feature code.  <br>• Quality is hard to control at scale with a small team.  <br>• Free users may have lower intent and lower tolerance for friction. |
| **Biggest risk** | A poorly matched or boring group permanently damages the brand for a cohort of users. This is the “bad first experience” risk the user identified. |
| **DAU impact** | **+15–25%** during Phase 0 (free events drive app opens and registration). |
| **Paid conversion impact** | **8–12%** if experience quality is held high; could drop to **5–7%** if matching or tasks are generic. The simulated 11.2% is achievable only if the first experience is genuinely good. |

### Path B: Drop physical event. Keep only a lightweight 我的故事/我的伙伴 visual RPG system

| Dimension | Assessment |
|-----------|------------|
| **Pros** | • Zero operational risk: no venues, hosts, no-shows, or weather dependencies.  <br>• Pure software, easier to iterate with a small team.  <br>• Visual packaging is acceptable and can create short-term novelty.  <br>• Could drive a small daily habit if the loop is tight. |
| **Cons** | • Previous research already showed the **game layer did not help conversion**. Visual-only packaging is not a driver.  <br>• No direct path to paid offline events — the core business model is disconnected.  <br>• Competes with actual mobile games and RPGs; JoyJoin has no gameplay depth advantage.  <br>• Easy to build a feature that is “nice to have” but moves no metric.  <br>• Risk of becoming a retention gimmick without substance. |
| **Biggest risk** | It becomes a **dead-end feature**: some users open it, none convert, and the team spends 3 months perfecting a side quest instead of the main funnel. |
| **DAU impact** | **+5–10% short-term** from novelty, then **flat or declining** without meaningful gameplay or social utility. |
| **Paid conversion impact** | **1–3% at best**, and likely indistinguishable from noise. There is no commercial intent in an RPG profile page. |

---

## 3. Final Recommendation

**Take Path A. Do not drop the physical event.**

The mission is to increase DAU and convert non-paying users to paid offline events in 3 months. Path A is the only path that directly serves that mission. Path B is a retention side-quest that previous evidence already suggests does not drive conversion.

However, **Path A is only acceptable if we can hold the first-experience quality above a hard threshold.** If we cannot guarantee that, we should not ship City GO at all. A mediocre free event is worse than no free event.

---

## 4. Minimum Viable Experience Design (Path A)

To avoid the “bad first experience” risk, the City GO MVP must be radically constrained around quality, not scale.

### 4.1 Matching quality gates
- **Use the real V4 archetype engine.** Do not treat free users as “practice data.” Match by chemistry + interest + intent, identical to paid events.
- **No filler groups.** If a group cannot be formed with at least 3 mutually compatible members, cancel the event and notify users with a warm explanation + re-invite. Do not force a group.
- **Buddy Lock as a commitment device, not a trap.** Pair users before the event with a lightweight task they complete together in the app (e.g., “Choose your team’s opening question”). The lock is a shared social obligation, not a penalty.

### 4.2 Task design
- **One curated task, not a scavenger hunt.** A 30–45 minute event should have a single, high-quality interaction structure (e.g., “Find the group’s shared answer” or “Tell one true story inspired by the landmark”).
- **No monotonous loops.** Avoid checklists, point collection, or generic “take a photo” prompts. The task must create conversation, not busyness.
- **Archetype-aware prompts.** The task should change slightly based on the group’s archetype mix so the conversation feels personalized.

### 4.3 Human presence
- **Host or host-lite.** Every event needs a real person (staff or trained volunteer) who greets the group, gives the prompt, and de-briefs. This is non-negotiable for a first experience.
- **Real-time feedback channel.** Users can flag a problem during the event via a discreet “Need help” button.

### 4.4 Escape and recovery
- **Easy, blame-free cancellation.** If a user cancels >24h before the event, no penalty. Buddy Lock only applies to last-minute no-shows.
- **Post-event micro-survey.** One question: “How was your group?” (😍 / 🙂 / 😐 / 😞). Users who rate 😞 or 😐 get a personal follow-up from the team and are not invited to the next free event until we understand what went wrong.
- **Ban bad hosts / bad combos.** If a user reports a poor match, block that pairing for future events.

### 4.5 Scope guardrails
- **One city, one landmark, one time slot per week.** Do not expand until the single cohort’s NPS is ≥ 40 and second-event return is ≥ 30%.
- **Cap at 3–4 people per group.** Intimacy is the only defense against bad matching.
- **Free, but application-based.** Users must answer two questions about why they want to join. This filters curiosity seekers and increases psychological commitment without charging money.

---

## 5. What Path B Would Actually Need to Do

If the team were forced to take Path B (not recommended), the lightweight RPG would need to do the following to avoid being a dead-end:

1. **Serve as a conversion bridge, not a retention toy.** The “story” and “companion” must explicitly reference the paid offline experience: e.g., the companion unlocks an invitation to a real event after 3 interactions.
2. **Use real profile data.** The RPG must be populated by the user’s archetype, interests, and profession — not generic fantasy content. The payoff is self-discovery, not XP.
3. **Create a social proof loop.** Show that other users’ companions are “going to real events” and that the user can join them.
4. **Limit to 2–3 screens and one loop.** No battles, energy systems, or maps. The previous research showed these do not help conversion. Keep it to a daily companion check-in that surfaces one paid event recommendation.

Even then, the expected paid conversion would remain low because the commercial intent is absent. Path B is not a substitute for a real funnel.

---

## 6. Suggested Next Experiment (1–2 weeks, ≤200 users)

**Experiment: “City GO Quality Gate”**

- **Hypothesis:** A tightly constrained free event with high matching quality and human hosting produces better NPS and paid conversion than a broader, lower-touch free event.
- **Design:**
  - Recruit 100–200 non-paying users in Shenzhen.
  - Run a single City GO event at one landmark, one time slot, with 3–4 person groups.
  - Apply all MVP quality gates: real archetype matching, application question, host presence, single curated task, Buddy Lock, post-event survey.
  - Control for the experience: do not test multiple tasks or locations. Test only whether the *minimum quality bar* works.
- **Metrics:**
  - Primary: post-event NPS ≥ 40 and 7-day paid event conversion.
  - Secondary: attendance rate, second-event return intent, and “would recommend” rate.
- **Kill criteria:**
  - NPS < 20, or attendance < 60%, or any safety/host incident → stop City GO and reassess.
  - Paid conversion < 5% with NPS ≥ 40 → experience is liked but not commercially compelling; consider pricing/packaging before expanding.
- **Decision:** If the experiment passes, expand to two time slots and one additional landmark. If it fails, do not scale. Fix the experience or kill the feature.

---

## 7. Summary

- **A bad first experience is worse than a no-show** when it falls below a quality threshold, because it creates permanent negative brand equity.
- **Path A (City GO physical event)** is the only option that serves the 3-month mission. Path B (RPG) is a distraction with weak conversion evidence.
- **Recommendation:** Keep City GO, but constrain it ruthlessly: one city, one landmark, one task, human host, real matching, application filter, and hard kill criteria.
- **Next step:** Run the “City GO Quality Gate” experiment with ≤200 users to validate that the first experience is good enough before any expansion.

