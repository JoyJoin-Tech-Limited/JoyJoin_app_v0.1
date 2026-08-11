# Icebreaker Fluid UX Playbook — The Invisible Conductor (V2)

**Date:** 2026-08-11 · **Status:** Strategic vision (pre-spec), supersedes V1 same-day draft · **Scope:** Social Icebreaker in-event flow (`/icebreaker/:sessionId`), WeChat mini-program

> **Dual mandate.** (1) *Behavioral:* the phone is an invisible conductor — eyes up ≥90%. (2) *Aesthetic:* the phone is a **premium interactive prop** — luxury you feel in the hand, not read on the screen. Neither may be traded for the other. The engineering lead owns gestures, timings, densities, and curves; this document owns the *why*, the behavioral model, the sensory logic, and the iteration gates. Brand guidelines (`joyjoin-brand-guidelines`) are the referee when the two mandates collide.

---

## 1. North Star

Six people in a venue, drinks in hand. The phone keeps the social energy flowing *between them* — it is never the most interesting thing in the room. Success is measured in eye contact: the screen is consulted the way a musician glances at a conductor — one beat, never a stare. When it is touched, it must feel like a crafted object: weighted, silky, alive. **A premium prop you barely look at.**

Today the phone is a pause button. We redesign it as a **volume knob**: every touch raises the energy in the physical circle, and the device gets out of the way within one heartbeat.

---

## 2. Behavioral Model — Three Engagement States

| State | Posture | Screen's role | Time budget |
|-------|---------|---------------|-------------|
| **POCKET** | Phone face-down on the table or held low, eyes on people; **screen on, app foreground** (platform truth: a backgrounded/locked mini-program cannot vibrate, play audio, or receive beats) | Ambient only: haptics + optional audio ticks; the ambient mood field (§3.4) is the POCKET-state signal surface. Session holds the screen awake (`Taro.setKeepScreenOn`) for event duration | Default; most of the session |
| **GLANCE** | Raised briefly, one hand, minimal tilt | Answer "what now?" in ≤1s via color field + one oversized pictogram | One heartbeat |
| **ACT** | Same posture | Exactly one large unambiguous input, confirmed by feel | One touch, return to POCKET |

**The loop is the product:** `POCKET → (buzz) → GLANCE → ACT → POCKET` — as natural as checking a watch. Any phase forcing sustained reading, typing, or two-handed play has failed the model.

**Host asymmetry:** the host's device carries pacing authority, but host actions are also single-touch, and each fires a *group-facing* sensory beat, so pacing reads as ritual, not admin work.

---

## 3. Aesthetic Framework — Five Pillars, Brand-Mapped, Platform-True

Each pillar: the V2 mandate → how it lands on JoyJoin brand tokens and the WeChat/Taro platform. **Translation notes are binding constraints, not suggestions.**

### 3.1 Atmospheric Material — "deep glass / matte silk"
Layered depth: a softly blurred ambient backdrop, floating action surfaces, generative soft shadows. The background is never flat — an ambient gradient that drifts almost imperceptibly, optionally reacting to device tilt so the phone feels alive in the hand.
- **Brand mapping:** gradients built from Primary Purple `#8B5CF6` + Warm Beige `#F5F1E8` families; Warm Coral `#FF9B85` reserved for connection moments. Warm, never cold-corporate.
- **Platform truth:** large live blurs tax mid-tier Android. Ship *budgeted glass*: pre-rendered/static gradient layers, blur confined to small hero surfaces, transform/opacity-only motion. Gyro parallax (`wx.onGyroscopeData`) is an optional flourish on hero surfaces only, off in POCKET.

### 3.2 Cinematic Motion — weight without bounce
Ban linear easing. Entries arrive with fast attack and long soft settle; confirmations carry a subtle physical "land." Every element behaves as if it has mass.
- **Brand mapping (referee ruling):** brand motion bans loud/bouncy animation — so **no elastic overshoot**; achieve weight through deceleration curves and settle, not springiness. Engineering picks exact beziers within that bound.
- **Platform truth:** CSS transitions on transform/opacity only; no layout-thrashing keyframes; 60fps on the Gen-Z 8GB baseline is the gate.

### 3.3 Radical Decluttering — the One-Glance Rule
Default state looks like minimalist album art: one massive pictogram **or** one oversized typographic word carries the entire message. All secondary info (counts, timers, labels) hides behind blurred progressive disclosure (hold to peek).
- **Synthesis note:** this *is* the GLANCE state made visual. Text remains the third layer — the reader-aloud reads it; everyone else never needs it.

### 3.4 Adaptive Sensory Atmosphere — Mood Anchoring
Color signals emotional progress without a single spinner: **cool, serene violet-indigo for waiting** (derivative of Primary Purple + Sky Blue `#A8C5DD`), **warm amber / rose-coral for connection and matched states** (Warm Coral `#FF9B85` family). The field tightens as votes accumulate, blooms on reveal — group energy readable at the edge of vision.
- **Platform truth (hard):** WeChat mini-programs have **no ambient-light sensor API**. Auto-adaptation comes from *context*, not hardware: session phase, venue/time-of-day metadata, and event tier drive the contrast/saturation theme. Do not spec light-sensor behavior.

### 3.5 Typographic Rhythm — editorial, micro-sized
Extreme hierarchy: ultra-bold for the single primary word, hairline for secondary fragments. Copy is punchy human fragments, never sentences.
- **Brand mapping:** within the three brand roles — `font-cn-display` (short emotional Chinese), `font-en-brand` (English brand moments), `font-ui` (everything else). Never mix display fonts on one screen. Copy must additionally pass the 🔴 hard rules in `docs/copy/brand-copy-strategy.md`.
- **Platform truth:** CJK variable fonts are too heavy to ship; achieve weight contrast with the loaded brand faces via `wx.loadFontFace` subsets, size, and letter-spacing.

### 3.6 Playful Premium — the Duolingo Calibration
Duolingo's genius is making a utility feel like a toy: chunky clarity, one character with personality, celebration that feels earned. Adopt the *clarity and charm*, not the juvenilia — JoyJoin's user is holding a cocktail at a night venue, not sitting in a classroom. Playfulness arrives through **character moments** (小悦 cameos at genuine peaks), **tactile surprise** (haptic and audio flourishes that land faster than the eye), and the **delight of synchronized group beats** — never stickers, streaks, or cartoon bounce (brand motion rules still bind, §3.2). Minimalist canvas, premium materials, playful *behavior*. The litmus test: premium enough to sit beside a cocktail glass, playful enough to earn a smile mid-conversation.

### 3.7 The Three-Layer Visual Stack
Hierarchy must be decodable from silhouette alone. Font size, weight, and visual element *are* the layering system — no boxes, dividers, or section headers needed. Each screen carries at most three layers, each serving a different reader:

| Layer | Serves | Content | Treatment |
|-------|--------|---------|-----------|
| **L1 · Signal** | GLANCE — everyone | One massive pictogram *or* a single word | Max display size, heaviest weight, full saturation against the color field |
| **L2 · Script** | The one reader-aloud | Prompt content (topic, dare, statement) | Comfortable reading size, regular weight, quiet contrast — must not pull the listeners' eyes down |
| **L3 · Context** | Nobody by default | Counts, timers, labels | Hairline micro-fragments, dimmed, hidden behind hold-to-peek blur |

A screen that seems to need a fourth layer gets split into two beats. Engineering owns exact scale ratios, but the tier separation must survive a **0.5-second squint test** at arm's length in dim light.

---

## 4. Sensory Framework

Priority order: **haptics carry meaning → visuals are glanceable backup → audio is seasoning.**

**Haptic grammar (primary).** Five learnable patterns mapped to *social* events, never UI events: **Nudge** (something new; glance when ready), **Your turn** (personal; must never be mistakable), **Confirm** (felt in the instant of touch, so eyes never verify), **Reveal** (fired for the whole group at once — six pockets buzzing together *is* the product moment), **Celebration** (rare by design). Must be distinguishable in a pocket, through fabric. WeChat gives `vibrateShort` (heavy/medium/light) + `vibrateLong`; rhythm patterns fill the gaps.

**Audio logic (strictly optional).** Delicate sub-1s ticks and pops, preloaded, layered *under* the room's ambience. Mirrors the haptic grammar so meaning survives silent mode. The session must be fully playable on haptics alone. ("Spatial" audio is not a mini-program capability — the intent is *delicate and tactile*, not positional.)

---

## 5. Micro-Interaction Zones

1. **Handshake Bridge (arrival → first prompt):** the session opens with a *spoken* ritual, not a screen. First content appears only after the group is already talking.
2. **Prompt Delivery:** Nudge + color-field shift; one person reads aloud; the pictogram tells everyone else the beat's *kind*. The next conversational move is always already loaded — the silence window shrinks toward zero.
3. **Silent Input:** votes, bids, picks, done-taps — single-touch, zero typing; haptic confirm; screen immediately invites pocketing.
4. **The Reveal:** synchronized group beat + color bloom. The one moment screens may command the room — two seconds, because the whole circle looks together.
5. **Phase Transition:** no "screens." Host's single tap fires the group beat; the field cross-fades to the next phase's identity *underneath* the conversation.
6. **Silence Rescue:** energy dip → Nudge to the *host only* with a ready-made conversational move. The group experiences a save; nobody sees a notification.

---

## 6. Composition Without Keyboards

Zero-typing survives contact with the phase catalog. Incidental typing becomes taps: `undercover_word` descriptions go **verbal** (the group is co-present; the phone keeps score), `auction` custom amounts become preset increments, `mini_script` accusations become avatar-pick + option chips. Genuine composition is handled by **AI ghostwriter + human curator** (Lie Detective V2 already proves it: 2 tags → AI expands; extend to quip candidates) or **moved pre-event** (draft lie-detective material at registration / in the gathering room). The one designed exception is `quip_battle`, resolved as a **flexible hybrid** (locked 2026-08-11, §10 ruling 5): the **synchronized group draft beat** (haptic countdown, everyone heads-down together, ≤20s, max once per session) is the spine, preserving anonymous written wit and recap material; a **host-selectable verbal mode** covers venues and tables where keyboards are wrong; the **AI ghostwriter is demoted to a private, optional, player-only rescue** for stuck players (AIGC labeling semantics resolved at spec via `llm-runtime-safety` + copy 🔴 review). Underlying principle: **the conductor adapts to the table** — every live-fragile moment ships a designed degradation path. A unilateral "one person types while five wait" moment remains never acceptable.

---

## 7. Core User Journey

```
Arrival          Warmup              Challenges & Games              Recap
   │                │                       │                          │
 pocket ──▶ buzz ──▶ glance ──▶ talk ──▶ buzz ──▶ glance ──▶ act ──▶ talk ──▶ … ──▶ shared bloom
(handshake    (one reader     (loop repeats per phase:           (celebration,
 bridge)       speaks; others  nudge → glance → one touch →      eyes already
               stay eyes-up)   back to people)                   on each other)
```

One unbroken conversation the phone periodically conducts. Phases are movements in a single piece of music.

---

## 8. Iteration Governance — Uplift Is a Gate, Not a Polish Pass

**Every icebreaker iteration must pass both gates before ship; "behavioral done, aesthetics later" is not shippable.**

- **Behavioral Gate:** eyes-up ≥90%; every input ≤1 touch; zero typing in-session (§6 exceptions only); three-state model inviolable; haptic grammar learnable in one session and complete without screen or audio; group beats synchronized; pocket+silent degradation still playable.
- **Aesthetic Gate:** the seven pillars (§3) present and brand-true — budgeted glass depth, non-linear weighted motion, One-Glance decluttering, mood-anchored color, brand-role typography, Duolingo-calibrated playful premium, and a clean three-layer stack that passes the squint test; 60fps on the Gen-Z baseline device; `joyjoin-brand-guidelines` review checklist clean.
- **Enforcement path:** run the existing repo pipeline on every iteration — `frontend-design-audit` → `user-satisfaction-audit` → `performance-audit` (PASS/WARN/BLOCK). This playbook's two gates are the rubric those audits score against for the icebreaker surface.

---

## 9. Engineering Freedom & Platform Notes

**Not prescribed here:** gesture choice (tap / hold / tilt), haptic waveforms, timing budgets, bezier curves, densities, pixel dims, state-sync mechanism for group beats, phase-view refactors.

**Platform corrections to the V2 brief (binding):** the shipping client is the **WeChat mini-program (Taro)** — there is no Compose/SwiftUI/Flutter surface; realize the premium feel within Taro + WXSS + the budgets above. No ambient-light sensor (§3.4), no spatial audio (§4), no elastic bounce (§3.2), no shipped CJK variable font (§3.5). Everything ships inside the existing Social Icebreaker architecture (`apps/mini-program/src/pages/icebreaker-session/`) — a sensory and behavioral layer over current phases, not a new surface.

---

## 10. Locked Rulings — grill-me session (2026-08-11)

Strategy decisions locked by interview with the product owner. Each is binding until explicitly re-opened by the owner; spec and engineering work resolves against these, not around them.

1. **Collision ruling — case-by-case, via fixed matrix.** Behavioral-vs-aesthetic disputes resolve by lookup, not taste: (1) ACT inputs + host tools → behavioral always; (2) ambient/GLANCE surfaces → behavioral-leaning, aesthetic capped at zero attention cost; (3) the 2-second reveal/celebration beat → aesthetic licensed to peak; (4) anything unlisted defaults to behavioral. The Handshake Bridge opening stays behavioral — first impressions are made by faces, not screens.
2. **Eyes-up enforcement.** The ≥90% North Star is measured by formal observer-sampled field protocol at exactly **3 checkpoints**: Wave 1 (pre-uplift baseline), Wave 3 (pilot), final migration wave. All other waves gate on instrumented proxies: keyboards-per-session = 0, one-touch compliance, haptic learnability, squint tests. Screen-on time is rejected as a proxy.
3. **Haptic degradation ladder.** If fewer than 5 patterns survive field testing: merge, never complicate — Your-turn stays sacred and unique, Nudge absorbs lesser attention events, Celebration folds into Reveal. Floor = 3 patterns (attention / your-turn / group-reveal). Below 3 → escalate to product owner before shipping; a buzz users can't decode is noise, and noise is worse than silence. Audio never substitutes for a haptic pattern (haptics-alone completeness is inviolable); longer rhythm-morse is rejected (fails the one-heartbeat rule).
4. **POCKET redefined (platform truth).** Screen-on, face-down or held low, app foreground; the session holds the screen awake (`Taro.setKeepScreenOn`) for event duration; the ambient mood field (§3.4) is the POCKET-state signal surface. The Behavioral Gate measures this attainable state, not the impossible "screen dark" one. §2 amended accordingly.
5. **quip_battle — flexible hybrid.** Spine: synchronized group draft beat (≤20s, haptic countdown, max once per session) — preserves anonymous written wit and recap material. Valve 1: host-selectable verbal mode for venues/tables where keyboards are wrong. Valve 2: AI ghostwriter demoted to private, optional, player-only rescue for stuck players (AIGC labeling semantics decided at spec via `llm-runtime-safety` + copy 🔴 review). General principle locked: **the conductor adapts to the table** — every live-fragile moment ships a designed degradation path.
6. **Group-beat boundary (S6).** Beats are state-free (pattern + dedupe nonce + server timestamp); the 3s poll remains the sole state truth; WS failure degrades automatically to poll-detected beats (late, never missing); buzz-before-picture skew is intended — feel first, glance second. Flag-on precondition: venue WS reliability field test.
7. **Gyro parallax (S10).** Pass/fail floors set in advance: sustained 60fps on the Gen-Z 8GB baseline (no new jank over budget), zero new crashes, session battery within normal envelope. Ships flag-gated default-off; **any WARN = drop, no negotiation**; `performance-audit` verdict is final.
8. **Gate teeth.** Gates bind **flag-on, not merge**. Hard blockers: performance-audit non-PASS; copy 🔴 violations; behavioral proxy failures (keyboards = 0, one-touch); design-audit below the 82/100 baseline or open pillar findings; class-coverage / subpackage-style guardrail red. Everything else → tracked follow-ups. Each wave passes both gates independently; all flags default-off.
9. **Cut line under schedule pressure.** From the tail inward: S9 audio → S10 gyro → S6 group beats → S7 silence rescue. Untouchable core: S1 + S2 + S3 pilot — the minimal loop (buzz → glance → act) on the mood-field canvas must ship whole or the program doesn't ship.
10. **Flag hygiene.** Every flag registers a cleanup task at creation; flags are removed at full migration (precedent: `socialIcebreakerPhaseHeroEnabled`, removed 2026-07-17).
