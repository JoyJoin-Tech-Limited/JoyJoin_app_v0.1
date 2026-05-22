# JoyJoin Participation Framework v2 — Strategic Proposal

**Author:** Engineering / Product Architecture  
**Date:** April 7, 2026  
**Status:** Proposal for review  
**Scope:** Rethink the core user participation flow to create a category-defining experience

---

## Table of Contents

1. [Repo-Informed Diagnosis](#1-repo-informed-diagnosis)
2. [Strategic Critique of the Current Mechanism](#2-strategic-critique-of-the-current-mechanism)
3. [New UI/UX Framework Principles](#3-new-uiux-framework-principles)
4. [Legendary Mechanism Concepts](#4-legendary-mechanism-concepts)
5. [Recommended North-Star Direction](#5-recommended-north-star-direction)
6. [MVP Product Spec](#6-mvp-product-spec)
7. [Engineering Mapping](#7-engineering-mapping)
8. [Experimentation Plan](#8-experimentation-plan)
9. [Design Guardrails](#9-design-guardrails)
10. [Fastest Path to Prototype](#10-fastest-path-to-prototype)

---

## 1. Repo-Informed Diagnosis

### Current Participation Flow (End-to-End)

> **Terminology note:** 盲盒社交 (blind-box social) refers to the category of social apps in China where users are randomly matched into small-group events — similar to mystery-box mechanics applied to social participation. 饭局 (dinner gathering) and 酒局 (bar/drinks gathering) are the two primary event types in JoyJoin.

Based on analysis of the full codebase, JoyJoin's current participation model is a **seven-stage linear pipeline**:

```
Discover → Browse Pools → Register (Preferences) → Wait/Queue → Match Reveal → Icebreaker Session → Feedback
```

**Concrete implementation mapping:**

| Stage | Screen / Component | Route | Key Files |
|-------|-------------------|-------|-----------|
| **Discovery** | `DiscoverPage.tsx` + `BlindBoxEventCard.tsx` | `/` or `/discover` | Server-side `city` filtering via `GET /api/event-pools`; client-side `area`/district filtering |
| **Pool Detail** | `EventPoolDetailDrawer.tsx` + drawer sections | Bottom sheet over Discover | `PoolVibePanel`, `TopicHeatStrip`, `ArchetypeCompositionPanel`, `EmergingGroupsPanel`, `ConnectionCuePanel` |
| **Registration** | `JoinEventPoolSheet.tsx` (multi-step sheet) | In-page sheet from Discover | Steps: `SmartDefaultsStep` → `BudgetSelectionStep` → `SocialGoalsStep` → `DinnerPreferencesStep` / `BarPreferencesStep` → `SuccessCelebration` |
| **Queue / Wait** | `MatchingStatusPage.tsx` + `MatchingWaitingScreen.tsx` | `/pool-matching/:registrationId` | WebSocket subscription for `POOL_MATCHED` and `EVENT_THEME_TITLE_REVEALED`; fill-state tracking (`waiting` → `can_form` → `full`) |
| **Match Reveal** | `MatchCelebrationOverlay.tsx` → `MatchSuccessSheet.tsx` | Overlay, then `/pool-groups/:groupId`; `/squad-unboxing` and `/squad-unboxing/:groupId` for `SquadUnboxingFlow.tsx` | `MatchSuccessSheet` contains `CardDeckReveal` with haptic/confetti effects; separate `SquadUnboxingFlow.tsx` |
| **Icebreaker** | `SocialIcebreakerOrchestrator.tsx` | `/icebreaker/:sessionId` | 4-phase flow: 话题卡 → 挑战 → 侦探 → 回顾 |
| **Feedback** | `EventFeedbackFlow.tsx` / `DeepFeedbackFlow.tsx` | `/events/:eventId/feedback` | Atmosphere score, connection radar, match point validation |

### Where It Feels Commoditized

1. **Discovery is catalog-browsing.** `DiscoverPage` fetches `event-pools`, renders them as `BlindBoxEventCard` items in a vertical list. Despite rich drawer panels (vibe, archetype composition, topic heat), the mental model is: scroll → find something interesting → tap → read details. This is the same pattern as every 盲盒社交 competitor.

2. **Registration is a form.** `JoinEventPoolSheet` walks users through preference steps (budget, social goals, cuisine). This is practical but emotionally flat — the user is filling out fields, not expressing social energy.

3. **The queue is the weakest link.** `MatchingWaitingScreen` shows a fill-state progress bar (`3/6 seats filled`), an auto-refresh countdown, and CTAs to invite friends or browse while waiting. This is a **passive wait state** — the user has no agency, no interaction, no rising tension. It's the most commoditized moment in the entire flow.

4. **Match reveal is good but isolated.** `SquadUnboxingFlow` with `CardDeckReveal` (haptic + card deck + confetti) is the most emotionally designed moment. But it arrives *after* a dead period of passive waiting, which undermines its impact. The emotional arc has a valley right before the peak.

5. **Social energy starts too late.** The first time users interact with their group members is at the icebreaker session — hours or days after matching. The social momentum from matching is lost.

### What Can Be Reused vs. Must Be Rethought

**Strong foundation to preserve:**
- 12-archetype personality system (`personality/`) — deeply integrated, well-calibrated
- 6/7-dimensional matching algorithm (`poolMatchingService.ts`) — sophisticated and battle-tested
- WebSocket real-time infrastructure (`useWebSocket.ts`, `wsEvents.ts`) — ready for richer real-time interaction
- Matching state layout system (`MatchingStateLayout`) — composable dark-mode canvas
- `CardDeckReveal` / `SquadUnboxingFlow` — the reveal mechanic is emotionally strong
- Social Icebreaker multi-phase system — well-architected phase state machine
- Framer Motion + Radix UI component primitives — flexible animation/interaction layer
- `BlindPoolTrustExplainer` + `WhyThisFitsCard` — trust-building components
- `PreJoinVibeBriefSheet` — early signal of vibe-forward design thinking
- Gamification system (10 levels, XP, JoyCoins) — can support new reward mechanics

**Must be fundamentally rethought:**
- Discovery model — from static pool catalog to living social pulse
- Registration flow — from form submission to social activation gesture
- Queue/waiting — from passive fill-tracking to interactive anticipation
- The gap between match reveal and icebreaker — social energy must start earlier
- The overall emotional arc — needs intentional pacing, not pipeline stages

---

## 2. Strategic Critique of the Current Mechanism

### 2.1 Low Distinctiveness

The current flow follows the exact competitive template:

```
Card catalog → Tap → Form → Queue → Wait → Result
```

Every 盲盒社交 product on the market uses this pattern. The only differentiation comes from the *quality* of matching (which is invisible to users before they experience it) and the *visual design* of the reveal moment. Neither is defensible at the product-language level.

JoyJoin's actual competitive moat — its 12-archetype system, 6D matching, empirical chemistry calibration, and AI-powered group composition — is buried behind a generic participation interface. The sophistication is backend-only; the user experience pattern is indistinguishable from simpler competitors.

### 2.2 Passive User Role

After tapping "Join," the user becomes a **spectator in their own social experience.** They:
- Submit preferences (passive data entry)
- Watch a fill counter increment (passive observation)
- Receive a match notification (passive consumption)

The user never *does* anything that signals their social energy, adjusts their intent in real-time, or co-creates the conditions for their match. They are a row in a matching matrix, not an active participant in a social formation.

### 2.3 Weak Anticipation Design

The `MatchingWaitingScreen` treats anticipation as an engineering problem (show progress, auto-refresh) rather than a design opportunity. The three fill states — `waiting`, `can_form`, `full` — are status indicators, not emotional beats.

Good anticipation design makes the wait *part of the experience.* Current implementation makes it an obstacle between the user and the experience.

### 2.4 Poor Emotional Pacing

The emotional arc of the current flow:

```
Curiosity (Discovery) → Mild Engagement (Registration) → DEAD ZONE (Queue) → Spike (Reveal) → Drop → Re-engagement (Icebreaker)
```

The dead zone between registration and reveal can last hours or days. No emotional scaffolding exists in this period. The `MatchCelebrationOverlay` tries to compensate with a single spike, but one moment cannot recover from prolonged emptiness.

### 2.5 Overreliance on Conventional Queue Mechanics

The queue model assumes that the path to participation is:
1. Express desire to participate
2. Wait until conditions are met
3. Receive outcome

This is a **transactional model** borrowed from e-commerce (add to cart → checkout → delivery). Social participation should feel more like entering a party — you don't submit a form and wait; you walk in, feel the energy, and start interacting.

### 2.6 Insufficient "JoyJoin Signature Moment"

The `SquadUnboxingFlow` card deck reveal is the closest thing to a signature moment, but it is:
- **Isolated** — disconnected from the rest of the experience
- **Passive** — the user watches cards flip, doesn't co-create the reveal
- **One-shot** — happens once, no compounding effect over repeated uses
- **Late** — arrives after the most emotionally dead part of the flow

A category-defining product needs a **participation language** — a recurring pattern that users identify with the brand. Think: Tinder's swipe, Wordle's color grid, BeReal's notification. JoyJoin doesn't have this yet.

---

## 3. New UI/UX Framework Principles

### Principle 1: Participation Is a Social Gesture, Not a Form Submission

Joining should feel like an expressive act — choosing a vibe, sending energy, making a micro-commitment that says something about who you are. The act of joining *itself* should be interesting, not just the result.

### Principle 2: Discovery Should Feel Alive, Not Catalog-Based

Instead of browsing a list of pools, users should encounter social energy in motion — pulses of activity, forming groups, shifting vibes. The discovery surface should communicate "something is happening right now" rather than "here are your options."

### Principle 3: Anticipation Should Be Interactive, Not Idle

The period between joining and matching should involve lightweight, low-stakes interactions that build excitement and preview social compatibility. Users should feel their investment growing, not their patience depleting.

### Principle 4: Uncertainty Should Create Excitement While Preserving Trust

The blind-box element is valuable — but randomness alone creates anxiety, not excitement. The system should give users *just enough* signal to feel safe while preserving *just enough* mystery to feel thrilling. The `BlindPoolTrustExplainer` and `WhyThisFitsCard` already point toward this balance.

### Principle 5: Users Should Have Lightweight Agency Before Commitment

Before fully committing, users should be able to express preferences through *interaction* (not forms) and see how those preferences influence outcomes. This makes the matching algorithm visible and builds trust in the system.

### Principle 6: Social Energy Should Start Before Full Match Confirmation

The icebreaker shouldn't be the first social moment. Social chemistry should begin percolating during the anticipation phase — through anonymous hints, shared signals, or collaborative micro-activities — so that by the time the group is revealed, there's already a foundation.

### Principle 7: Every Participation Should Create a Micro-Story

Each time a user participates, the experience should have a narrative arc — setup, rising action, climax, resolution — not just a state transition. Over time, these micro-stories compound into a personal social journey that only JoyJoin provides.

---

## 4. Legendary Mechanism Concepts

### Concept A: "Vibe Pulse" — Wave-Based Social Activation

**One-sentence thesis:** Instead of registering for a pool, users *send a vibe pulse* that joins a living wave of social energy, and the group crystallizes when the wave reaches resonance.

**Core interaction model:**
- The discovery screen shows a **living pulse visualization** — an abstract, breathing representation of current social energy in the user's city/area (derived from real pool registration data and archetype composition)
- Users don't "join a pool." They tap-and-hold to **charge a vibe pulse** — the longer/stronger the hold, the more social intent they express (mapped to archetype energy bands). The gesture produces a satisfying haptic crescendo
- The pulse enters the wave. Users see their energy merge with others in real-time (anonymized) — the wave visualization shifts as new pulses arrive
- When the wave reaches "resonance" (enough compatible participants), it **crystallizes** — the amorphous wave solidifies into group formations with a dramatic visual/haptic moment

**End-to-end user flow:**
1. Open app → see the city's current social pulse (ambient awareness)
2. Tap event type filter (饭局/酒局) → wave refines to that vibe
3. Tap-and-hold the pulse → charge your energy → release to join
4. Your avatar/archetype icon merges into the wave
5. See the wave grow as others join (real-time via WebSocket)
6. Optional: answer 1-2 quick vibe questions (replaces preference form) via tap/swipe micro-interactions
7. Wave reaches resonance → crystallization animation → group revealed
8. Post-crystallization: mini-chat / reaction exchange before the icebreaker session

**What replaces the queue:** The wave IS the queue, but it doesn't feel like one. Users watch their energy mix with others, see the wave evolve, and experience the crystallization as a collective moment rather than a notification received in isolation.

**Why differentiated:** No 盲盒社交 competitor treats participation as an energy contribution. The wave metaphor shifts the mental model from "submit form, receive result" to "contribute energy, co-create an experience."

**Emotional arc:**
```
Ambient curiosity → Intentional activation (hold gesture) → Social immersion (wave) → Building anticipation (resonance approaching) → Collective climax (crystallization) → Warm anticipation (pre-icebreaker)
```

**Trust/safety considerations:**
- Vibe pulse carries no personal data — only archetype energy and intent signals
- Wave visualization is anonymized until crystallization
- All existing hard constraints (gender, age, industry) still enforced server-side
- Tap-and-hold gesture requires intentional action — prevents accidental joins
- Cancel option available while in the wave (pull-to-exit gesture)

**Technical feasibility in this repo:**
- WebSocket infrastructure (`useWebSocket.ts`) supports real-time wave updates
- Archetype system provides energy-band data for pulse visualization
- `MatchingStateLayout` provides the dark canvas for wave visualization
- Framer Motion supports the gesture (tap-and-hold) and animation (wave/crystallization)
- Matching algorithm runs identically — only the *presentation* of the queue changes
- New components needed: `VibePulseScreen`, `WaveVisualization`, `CrystallizationReveal`

**Implementation complexity:** Medium-High  
**MVP viability:** Medium — the wave visualization can be simplified to a particle system for MVP; full fluid dynamics can come later

---

### Concept B: "Social Constellation" — Mutual Signal Discovery

**One-sentence thesis:** Users discover and join events by placing themselves on a living constellation map where proximity to others reveals compatibility signals, and groups form when enough stars align.

**Core interaction model:**
- The discovery screen is a **constellation view** — an abstract star field where each point represents an anonymized user with registered intent for upcoming events
- The user positions themselves on the constellation by answering 2-3 fast swipe questions (like the existing `SwipeCardStack` but for event-specific preferences)
- As they answer, their "star" drifts toward compatible clusters. They can see (anonymized) other stars nearby — with archetype colors and heat indicators
- The user taps to "land" on a cluster, expressing intent to participate with nearby stars
- When a cluster has enough stars in sufficient proximity (matching threshold), it becomes a **named constellation** — the group is formed with a celestial reveal animation

**End-to-end user flow:**
1. Open app → see the social constellation for this week's events
2. Stars pulse with different colors (archetype-based) and sizes (intent intensity)
3. Swipe through 2-3 preference cards → your star appears and drifts into position
4. See anonymized nearby stars — "A 社牛柯基 who loves 川菜 is 3 seats away"
5. Tap to anchor in this region of the constellation
6. Watch more stars gather → constellation lines begin connecting compatible pairs
7. Threshold reached → constellation crystallizes with name and theme
8. Group members revealed with pair-by-pair connection reasons

**What replaces the queue:** The constellation IS the queue, but users have spatial agency — they can see where they are relative to others, understand why they're grouped, and experience the formation as a visual story. The "wait" becomes exploration and anticipation.

**Why differentiated:** No competitor uses a spatial/relational mental model for event discovery. Instead of "pick from a list," users navigate a social space. This mirrors how real social dynamics work — proximity, energy, and gradually forming clusters.

**Emotional arc:**
```
Wonder (constellation view) → Self-expression (swipe positioning) → Discovery (seeing nearby stars) → Agency (choosing where to anchor) → Growing connection (constellation lines) → Collective reveal (named constellation)
```

**Trust/safety considerations:**
- Stars are fully anonymized until group formation
- Proximity on the constellation is based on preference alignment, not real location
- Users can reposition (re-answer questions) before anchoring
- Existing hard constraints still enforced — incompatible users are never shown as "nearby"
- No direct messaging or interaction before group formation

**Technical feasibility in this repo:**
- `SwipeCardStack` component already supports swipe-based preference expression
- Canvas or SVG-based constellation can use Framer Motion for animations
- `ArchetypeOrbit` component already renders circular spatial visualizations — adaptable to constellation
- Matching algorithm provides compatibility scores for proximity calculations
- `wsEvents.ts` can carry anonymized star-position updates
- `CardDeckReveal` can be adapted for constellation crystallization moment

**Implementation complexity:** High  
**MVP viability:** Medium-Low — the spatial visualization is complex; could be simplified to a 2D cluster view for MVP

---

### Concept C: "The Spark Ritual" — Ritualized Three-Beat Entry

**One-sentence thesis:** Participation follows a three-beat ritual — Intention, Attunement, Ignition — that transforms joining from a transaction into a personal micro-ceremony.

**Core interaction model:**
- **Beat 1: Intention** — The user selects an event type and makes a single, meaningful declaration: "This week, I want to..." with 3-4 visually rich, emotionally evocative options (not form labels). Each option has a distinct visual identity, animation, and archetype mapping.
- **Beat 2: Attunement** — A 30-second interactive micro-experience where the user's archetype "tunes" to the event context. This could be a mini personality vibe-check (2-3 quick reactions to scenario cards), a mood-ring visualization that responds to touch, or a sound/haptic pattern the user co-creates. The system uses this to refine matching preferences without a form.
- **Beat 3: Ignition** — The user performs a deliberate gesture to "ignite" their participation: a charged upward swipe, a shake gesture, or a long-press that builds to release. This replaces the "Submit" button with something that feels consequential.

**End-to-end user flow:**
1. Open app → see upcoming event vibes (not pool listings) as 3-4 large, atmospheric cards
2. Tap one → enter the Intention screen: "这周末，我想..."
3. Choose one of 4 intent cards with immersive micro-animations
4. Attunement begins: 30-second interactive vibe calibration (swipe/tap reactions to social scenarios)
5. System shows your "vibe reading" — a visual summary of your social energy for this event
6. Ignition: charge-and-release gesture → your participation is live
7. Transition to "Your spark is in the mix" — a warm, ambient waiting state with micro-reveals every few hours (anonymous archetype hints about forming groups)
8. Full group reveal with the existing unboxing flow

**What replaces the queue:** The wait period becomes "Your spark is in the mix" — a named, story-driven state where the system periodically drops micro-reveals: "A 小太阳鸡 just joined your potential group," "Your compatibility wave is at 78%." The user receives these as gentle push moments, not a progress bar to stare at.

**Why differentiated:** No competitor treats the act of joining as a ritual. The three-beat structure creates memorable muscle memory — users come to identify the "Intention → Attunement → Ignition" pattern with JoyJoin specifically. It becomes the brand's participation language.

**Emotional arc:**
```
Aspiration (intent selection) → Self-discovery (attunement) → Commitment (ignition) → Simmering anticipation (micro-reveals) → Crescendo (group reveal) → Connection (icebreaker)
```

**Trust/safety considerations:**
- Attunement scenarios use neutral social situations, never personal or invasive
- The "vibe reading" is positive-framed — it's about compatibility style, not judgment
- Ignition gesture requires deliberate action — no accidental registrations
- Micro-reveals during wait are anonymized (archetype + interest, never identity)
- All existing trust explainers (`BlindPoolTrustExplainer`) can be woven into Beat 1

**Technical feasibility in this repo:**
- Intent cards can reuse `BlindBoxEventCard` layout with richer animations
- Attunement can adapt the `SwipeCardStack` for scenario-reaction cards
- "Vibe reading" visualization can extend `ArchetypeOrbit` or `PersonalityProfile` components
- Ignition gesture: Framer Motion `useDragControls` or touch events with haptic feedback
- Micro-reveals in wait state: scheduled WebSocket events or push notifications
- `MatchingWaitingScreen` can be replaced with a story-driven "spark in the mix" component
- Gamification system (XP/JoyCoins) naturally maps to ritual completion rewards

**Implementation complexity:** Medium  
**MVP viability:** High — each beat can be built independently; the simplest MVP is beat 1 (intent cards) + beat 3 (ignition gesture) with the existing wait screen

---

### Concept D: "Ambient Drift" — Passive-First Social Matchmaking

**One-sentence thesis:** Instead of actively searching for events, users set a persistent social availability signal and get matched into micro-events as they happen, with just-in-time participation that feels like serendipity rather than scheduling.

**Core interaction model:**
- Users set a **weekly social availability** — a lightweight toggle with vibe preference (not a specific event)
- The system continuously runs ambient matching in the background
- When a high-quality group can be formed, the user receives a **"Drift notification"** — a beautifully designed, time-limited invitation that feels like a chance encounter
- The notification includes: event vibe, one anonymous compatibility hint, and a simple accept/pass gesture
- Users who accept within the time window are instantly grouped

**End-to-end user flow:**
1. Once per week: set your "drift mode" — available this weekend? Prefer 饭局 or 酒局? (2 taps)
2. Go about your life
3. Thursday evening: receive a Drift notification — "A 🔥 warm dinner is forming near 南山. A 脑洞章鱼 who shares 3 interests with you is already in. Join? (expires in 2 hours)"
4. Tap to accept → instant group formation → proceed to existing reveal + icebreaker flow
5. Or pass → another Drift may come if conditions allow

**What replaces the queue:** There IS no queue. The system matches in the background and only surfaces opportunities when they're ready. The user never waits — they either receive an invitation or they don't. The waiting happens server-side, invisibly.

**Why differentiated:** This inverts the entire participation model. Competitors require users to *seek* events. Ambient Drift brings events to users. It transforms matching from a deliberate action to a curated serendipity — much closer to how organic social invitations work in real life ("Hey, we're going to dinner Friday, want to come?").

**Emotional arc:**
```
Low-effort intent setting → Normal life → Surprise delight (Drift arrives) → Quick decision (urgency but not pressure) → Instant gratification (group formed) → Social experience
```

**Trust/safety considerations:**
- Drift notifications are opt-in via weekly availability toggle
- Time-limited window prevents pressure while creating urgency
- Pass option has no penalty — users can always decline
- Notification includes compatibility hint for informed consent
- All hard constraints still enforced; only high-quality matches surface as Drifts
- Rate-limited: max 2-3 Drifts per week to prevent notification fatigue

**Technical feasibility in this repo:**
- `poolRealtimeMatchingService.ts` already runs continuous matching scans — can be adapted to trigger Drift notifications
- WeChat push notification infrastructure needed (WeChat template messages or service notifications)
- New UI needed is minimal: availability toggle on profile/home, and a Drift notification card
- Existing `SquadUnboxingFlow` handles the reveal once accepted
- Matching thresholds (`matching_thresholds` table) already support configurable quality gates

**Implementation complexity:** Low-Medium  
**MVP viability:** Very High — simplest concept to build; mainly requires a notification trigger layer on top of existing matching

---

### Concept E: "The Gathering" — Collaborative Group Formation

**One-sentence thesis:** Instead of the system forming groups entirely, users collaboratively build their own group through a structured sequence of anonymous mutual selections, creating co-ownership of the social experience.

**Core interaction model:**
- After expressing intent to participate, users enter **"The Gathering"** — a multi-round anonymous selection process:
  - **Round 1: Seed** — System shows 3 anonymized archetype profiles (with compatibility hints). User picks 1 they'd most like to meet. Mutual picks are paired as seeds.
  - **Round 2: Grow** — Seed pairs see 3 more candidates (pre-filtered by system for compatibility). Each seed member votes. Agreement adds the person.
  - **Round 3: Complete** — System fills remaining slots with optimal matches
- Each round has a time window (hours, not minutes) and lightweight interaction

**End-to-end user flow:**
1. Express intent for this week's event (similar to existing registration)
2. 2-3 hours later: receive Round 1 notification — "Choose someone to start your table with"
3. View 3 anonymized profiles (archetype, top interests, compatibility %) → tap to choose
4. If mutual: "You and a 寻宝狐 chose each other! Your table seed is planted 🌱"
5. 6 hours later: Round 2 — "Pick someone to grow your table"
6. Seed partner also picks → shared choice adds a member
7. System completes the group → full reveal with enhanced meaning ("You helped build this table")

**What replaces the queue:** The selection rounds ARE the anticipation. Instead of waiting for an algorithm, users participate in forming their own group. The queue becomes a game with stakes and agency.

**Why differentiated:** No competitor gives users *co-authorship* of their group. This creates emotional investment before the event even happens. Users feel "I chose these people" rather than "I was assigned to a group." The mutual selection creates social chemistry before anyone meets in person.

**Emotional arc:**
```
Intent → Anticipation (will they choose me back?) → Validation (mutual selection!) → Growing investment (building the table) → Ownership (this is MY table) → Deep engagement (icebreaker with people I chose)
```

**Trust/safety considerations:**
- All profiles anonymized until final reveal — no identity exposure during selection
- Compatibility pre-filtering by system ensures only good matches are shown
- Mutual selection means no one-sided choices — both parties agree
- System still fills remaining slots to ensure group quality
- Users can't game the system — candidate pools are curated by the matching algorithm
- Time windows prevent overthinking; constraints create healthy urgency

**Technical feasibility in this repo:**
- Matching algorithm already computes pair scores — can generate the candidate pools
- WebSocket supports the notification + response model
- New components: `GatheringRound`, `AnonymousProfileCard`, `MutualReveal`
- Existing `ArchetypeOrbit` can visualize group formation across rounds
- Gamification (XP) can reward mutual selections
- `eventPoolRegistrations.matchStatus` can track gathering-round progress

**Implementation complexity:** High  
**MVP viability:** Medium — Round 1 alone (mutual selection of one seed partner) is buildable as an MVP; Rounds 2-3 can follow

---

## 5. Recommended North-Star Direction

### Recommendation: Concept C — "The Spark Ritual" as primary direction, with elements of Concept D ("Ambient Drift") as a future evolution layer

### Why "The Spark Ritual" Best Fits JoyJoin

**1. It aligns with the brand's personality system.** JoyJoin already has the richest personality architecture in the 盲盒社交 category — 12 archetypes, trait dimensions, energy levels, compatibility matrices. The Spark Ritual's Attunement beat makes this system *visible and interactive* to users for the first time. Instead of personality being an invisible backend factor, it becomes the centerpiece of the participation experience.

**2. It creates a repeatable brand language.** "Intention → Attunement → Ignition" is a three-word framework that becomes muscle memory. Users will describe the experience to friends as "you do the spark ritual" — this is the kind of phrase that creates organic word-of-mouth. No competitor has a named participation pattern.

**3. It addresses the weakest point without destroying what works.** The current match reveal (SquadUnboxingFlow) and icebreaker are strong. The Spark Ritual replaces only the weak parts (discovery browsing, form registration, passive queue) while preserving and enhancing the strong parts. It's surgery, not demolition.

**4. It's the most implementable of the ambitious concepts.** Unlike the Constellation (complex spatial visualization) or The Gathering (multi-round coordination), the Spark Ritual's three beats are independently buildable and independently testable. Each beat adds value on its own.

**5. It creates emotional investment before matching.** The 30-second Attunement creates a personal moment. Users who complete it feel they've invested something of themselves — making the subsequent match more meaningful and the no-match scenario less likely to cause churn.

### How It Becomes Category-Defining

The 盲盒社交 category currently competes on:
- Match quality (invisible until experienced)
- Visual design (easy to copy)
- Event variety (operational, not product-defensible)

The Spark Ritual shifts competition to:
- **Participation experience quality** — how the act of joining feels
- **Self-discovery integration** — learning about yourself while participating
- **Ritual recognition** — users identify the product by its participation pattern

This is category-defining because competitors would have to copy the *entire ritual framework* — not just a feature, but a philosophy of participation.

### Infrastructure and UI Layers Required

1. **Intent Expression Layer** — atmospheric event-type cards with rich animations (replaces `BlindBoxEventCard` grid)
2. **Attunement Engine** — scenario-card micro-experience (extends `SwipeCardStack` pattern)
3. **Vibe Reading Renderer** — visual summary of user's social energy profile for this event
4. **Ignition Gesture Handler** — charged gesture with haptic + visual crescendo
5. **Micro-Reveal System** — scheduled anonymous hints during wait period (WebSocket or push)
6. **Story-Driven Wait State** — replaces `MatchingWaitingScreen` with narrative progression

### Three-Stage Product Evolution

**Stage 1: Signature Entry (2-3 sprints)**
- Intent cards replace pool listing
- Ignition gesture replaces "Join" button
- Micro-reveal waiting state replaces passive fill-bar
- Existing matching, reveal, and icebreaker untouched

**Stage 2: Full Ritual (2-3 sprints)**
- Attunement beat added between Intent and Ignition
- Vibe Reading visualization after Attunement
- Richer micro-reveals with archetype hints
- Attunement data fed into matching preferences (replaces form-based preferences)

**Stage 3: Ambient Evolution (3-4 sprints)**
- Add "Ambient Drift" as a parallel entry point for returning users
- Weekly availability toggle on profile
- Just-in-time Drift notifications for pre-qualified groups
- Users choose: active Spark Ritual or passive Ambient Drift
- Both paths converge at the same reveal + icebreaker flow

---

## 6. MVP Product Spec

### Target: Stage 1 — "Signature Entry"

The goal is the smallest change that makes participation *feel* fundamentally different.

### 6.1 Entry Screen Changes

**Current:** `DiscoverPage` → vertical list of `BlindBoxEventCard` items → tap → `EventPoolDetailDrawer` → `JoinEventPoolSheet` → multi-step form → submit

**Proposed MVP:**

Replace the pool listing section of `DiscoverPage` with a **"This Week's Spark"** section containing 2-4 large, atmospheric intent cards:

| Card | Vibe | Maps To |
|------|------|---------|
| 🍜 "一场好饭" | Warm, intimate dinner energy | `eventType: "饭局"` |
| 🍸 "微醺之夜" | Evening bar social energy | `eventType: "酒局"` |

Each card:
- Full-width, ~60% screen height
- Animated ambient background (particle system or gradient shift)
- Shows live participant count and archetype heat badges
- Tap → opens **Spark Entry Sheet** (replaces `JoinEventPoolSheet`)

### 6.2 New Components / Modules

| Component | Purpose | Complexity |
|-----------|---------|------------|
| `SparkIntentCard` | Atmospheric event-type card with live stats | Low |
| `SparkEntrySheet` | Replaces `JoinEventPoolSheet` — simplified to intent + ignition | Medium |
| `IgnitionGesture` | Tap-and-hold → charge → release interaction | Medium |
| `SparkWaitingScreen` | Replaces `MatchingWaitingScreen` — story-driven with micro-reveals | Medium |
| `MicroRevealNotification` | Anonymous hint card for waiting state ("A 小太阳鸡 joined your mix") | Low |

### 6.3 Route / Screen Changes

| Current Route | Change |
|---------------|--------|
| `/` (DiscoverPage) | Add `SparkIntentCard` section above or replacing pool listing |
| `/pool-matching/:registrationId` | Replace `MatchingWaitingScreen` with `SparkWaitingScreen` |
| No new routes needed | The Spark Entry Sheet is an overlay on Discover, like current `JoinEventPoolSheet` |

### 6.4 State Machine Changes

**Current registration states:**
```
idle → (user taps join) → form_filling → (submits) → pending → matched/unmatched
```

**Proposed MVP states:**
```
idle → (user taps intent card) → spark_entry → (ignition gesture) → sparking → micro_reveal_1 → micro_reveal_2 → ... → matched/unmatched
```

New states for the `SparkWaitingScreen`:
- `sparking` — just joined, initial animation
- `mixing` — participating in the wave with others
- `approaching` — group formation approaching (replaces `can_form`)
- `crystallized` — matched (triggers existing reveal flow)

### 6.5 Backend / API Assumptions

**No matching algorithm changes needed.** The Spark Ritual changes the *presentation layer* of participation. The backend registration and matching flow remain identical:

| Endpoint | Change |
|----------|--------|
| `POST /api/event-pools/:id/register` | No change — called after ignition gesture with minimal preferences |
| `GET /api/event-pools` | Minor change: add aggregated vibe stats per event type for intent cards |
| `GET /api/my-pool-registrations` | No change |
| **New:** `GET /api/spark/micro-reveals/:registrationId` | Returns privacy-safe, anonymized hints about forming groups (for example, broad archetype or interest-overlap categories) |

The micro-reveals endpoint queries existing matching data (pair scores, archetype compositions) and returns anonymized snippets. This must be enforced as an authenticated, server-side authorized read: only the user who owns the referenced pool registration may access its micro-reveals, and requests for any other user's `registrationId` should fail closed.

Privacy constraints should be explicit in the payload contract. Responses should contain only coarse-grained, non-unique hints and should not expose raw pair scores, exact rankings, direct identifiers, or combinations of attributes that could reasonably re-identify another participant. In particular, avoid low-cardinality or uniquely identifying details (for example exact niche interests, precise demographics, or rare archetype combinations) even if presented as "anonymized" hints.

This remains a read-only view over existing matching data, but it should be treated as derived sensitive data because it reveals information about other participants and match quality.

### 6.6 Analytics Instrumentation

| Event | When | Properties |
|-------|------|------------|
| `spark_intent_viewed` | User sees intent cards | `eventType`, `participantCount` |
| `spark_intent_tapped` | User taps an intent card | `eventType`, `holdDuration` |
| `spark_ignition_started` | User begins ignition gesture | `eventType`, `timeInSheet` |
| `spark_ignition_completed` | User completes ignition gesture | `eventType`, `chargeDuration` |
| `spark_ignition_abandoned` | User releases before threshold | `eventType`, `chargeDuration` |
| `spark_micro_reveal_viewed` | User sees a micro-reveal | `revealType`, `registrationId` |
| `spark_waiting_exit` | User leaves waiting screen | `exitReason`, `waitDuration` |

### 6.7 Empty / Loading / Failure States

| State | Handling |
|-------|----------|
| **No active pools** | Intent cards show "Coming soon" with a soft CTA to set notification preference |
| **Loading pools** | Skeleton intent cards with pulsing gradient animation |
| **Registration failure** | Reuse existing `JoinErrorScreen` from `matching/` — triggered after failed ignition |
| **Personality test incomplete** | Reuse existing `TestIncompleteScreen` — shown before ignition is available |
| **Extended data incomplete** | Reuse existing `ExtendedDataEmptyScreen` — shown as gentle nudge in spark entry |
| **No micro-reveals yet** | Waiting screen shows atmospheric animation with "Your spark is mixing..." copy |
| **Match timeout** | Adapt existing `NoMatchScreen` with spark-themed messaging |

### 6.8 Fallback for Users Who Don't Understand the New Model

1. **First-time users:** A one-time coach mark overlay on the intent cards: "Tap to start your spark → Complete the ritual → Get matched with your perfect table" (extends existing `CoachMarkBanner` system)
2. **Confused users:** The `XiaoyueFAB` (小悦 floating action button) provides contextual help throughout the flow
3. **Users who abandon:** If a user taps an intent card but doesn't ignite, show a gentle tooltip on next visit: "Ready to light your spark?"
4. **Graceful degradation:** If the user somehow reaches the old `JoinEventPoolSheet` path (deep link, cache), it still works — the old flow is deprecated, not removed

---

## 7. Engineering Mapping

### 7.1 Files / Modules Likely Involved

**New files to create:**

```
apps/user-client/src/components/spark/
├── SparkIntentCard.tsx          # Atmospheric event-type card
├── SparkEntrySheet.tsx          # Simplified join sheet with ignition
├── IgnitionGesture.tsx          # Tap-hold-charge-release interaction
├── SparkWaitingScreen.tsx       # Story-driven waiting state
├── MicroRevealCard.tsx          # Anonymous hint notification card
├── SparkCoachMark.tsx           # First-time tutorial overlay
└── shared/
    ├── sparkAnimations.ts       # Framer Motion animation configs
    └── sparkConstants.ts        # Thresholds, timing, copy
```

**Existing files to modify:**

| File | Change |
|------|--------|
| `pages/DiscoverPage.tsx` | Add `SparkIntentCard` section; conditionally replace pool listing for experiment |
| `pages/MatchingStatusPage.tsx` | Conditionally render `SparkWaitingScreen` instead of `MatchingWaitingScreen` for spark-flow users |
| `components/MatchingWaitingScreen.tsx` | No change (preserved for control group / fallback) |
| `components/event-pool-registration/JoinEventPoolSheet.tsx` | No change (preserved for fallback) |
| `hooks/useEventPoolRegistration.ts` | Minor extension: accept `sparkMode` flag to skip preference steps |
| `hooks/useWebSocket.ts` | Add handler for new `SPARK_MICRO_REVEAL` event type |
| `lib/queryClient.ts` | Add query key for micro-reveals endpoint |
| `routes.ts` | No route changes needed (sheet-based flow) |

**Server-side changes:**

| File | Change |
|------|--------|
| `routes.ts` or `routes/domains/` | Add `GET /api/spark/micro-reveals/:registrationId` endpoint |
| `routes/domains/eventPools.ts` | Add aggregated vibe-stats to pool listing response |
| `wsEvents.ts` (shared) | Add `SPARK_MICRO_REVEAL` event type |

### 7.2 State and Data-Flow Impact

**Client state additions:**

```typescript
// New state in MatchingStatusPage or SparkWaitingScreen
interface SparkWaitingState {
  phase: 'sparking' | 'mixing' | 'approaching' | 'crystallized';
  microReveals: MicroReveal[];
  sparkStartedAt: string;
}

interface MicroReveal {
  type: 'archetype_hint' | 'interest_overlap' | 'compatibility_wave';
  content: string;      // "A 小太阳鸡 joined your mix"
  emoji: string;
  timestamp: string;
}
```

**React Query additions:**

```typescript
// Micro-reveals polling (or WebSocket-driven invalidation)
queryKey: ['/api/spark/micro-reveals', registrationId]
```

**WebSocket event addition:**

```typescript
// In shared/wsEvents.ts
SPARK_MICRO_REVEAL = 'spark_micro_reveal'

interface SparkMicroRevealData {
  registrationId: string;
  reveal: MicroReveal;
}
```

### 7.3 Overlay vs. Parallel Experiment

**Recommendation: Build as a parallel experiment (feature flag gated), not an overlay.**

Reasoning:
- The Spark flow replaces the *entry point* to the same backend registration — it's a different presentation of the same action
- Feature flag: `ENABLE_SPARK_RITUAL` constant (same pattern as existing `ENABLE_LIMITED_BROWSE_MODE` in `FinalProfileReviewPage.tsx`)
- Users in control group see existing `BlindBoxEventCard` listing + `JoinEventPoolSheet`
- Users in treatment group see `SparkIntentCard` + `SparkEntrySheet` + `SparkWaitingScreen`
- Both groups converge at `SquadUnboxingFlow` (reveal) and `IcebreakerSessionPage` (icebreaker)

### 7.4 Recommended Implementation Sequence

```
Sprint 1 (Week 1-2):
1. SparkIntentCard component (static, no live data)
2. IgnitionGesture component (gesture + haptic + animation)
3. SparkEntrySheet (simplified join flow: intent → ignition, no multi-step form)
4. Feature flag and conditional rendering in DiscoverPage

Sprint 2 (Week 3-4):
5. SparkWaitingScreen (story-driven, replaces fill-bar)
6. MicroRevealCard + backend endpoint for micro-reveals
7. WebSocket integration for real-time micro-reveals
8. Analytics instrumentation
9. Coach mark for first-time users
10. QA, edge cases, empty/error states
```

---

## 8. Experimentation Plan

### 8.1 MVP Hypothesis

> **H1:** Replacing the pool-listing → form → passive-queue entry flow with the Spark Ritual (intent card → ignition gesture → story-driven wait) will increase registration-to-attendance conversion by ≥15% and reduce queue-stage abandonment by ≥20%, without decreasing registration volume.

> **H2:** Users who participate via the Spark Ritual will report higher pre-event excitement (measured via a 1-question pulse survey after ignition) compared to control users, indicating stronger emotional investment.

### 8.2 A/B Test Design

**Allocation:** 50/50 split at user level (consistent assignment via user ID hash)

**Treatment:** Spark Ritual flow (intent cards → ignition → spark waiting)  
**Control:** Current flow (pool listing → join sheet → matching waiting screen)

**Duration:** 4 weeks minimum (2 full event cycles)

**Assignment persistence:** Once assigned, users stay in their group for the experiment duration

### 8.3 Success Metrics (Primary)

| Metric | Definition | Target |
|--------|-----------|--------|
| **Registration conversion** | % of users who view discovery and complete registration | ≥ parity with control |
| **Queue abandonment** | % of registered users who cancel before matching | ≤ 80% of control rate |
| **Registration-to-attendance** | % of registered users who attend the event | ≥ 115% of control rate |
| **Time-to-registration** | Seconds from first discovery view to completed registration | Directional (faster is better, but not at cost of quality) |

### 8.4 Guardrail Metrics

| Metric | Guardrail |
|--------|-----------|
| **Registration volume** | Must not drop >10% vs. control |
| **Match quality** | Average match score must not decrease (matching algorithm unchanged) |
| **Support tickets** | Confusion-related tickets must not increase >20% |
| **Crash rate** | Must not increase on spark flow screens |
| **Cancel rate (post-ignition)** | Must not exceed 150% of current post-registration cancel rate |

### 8.5 Qualitative Research Questions

1. "How did the process of joining feel different from other social apps you've used?"
2. "What did the ignition gesture mean to you? Did it feel like a commitment?"
3. "During the waiting period, did the hints about your forming group change how you felt about the upcoming event?"
4. "Would you describe the process of joining to a friend? How?"
5. "Did anything confuse you about the new joining experience?"

**Method:** Post-event 5-minute interviews with 8-10 users from treatment group after their first Spark Ritual event

---

## 9. Design Guardrails

### What to Explicitly Avoid

| Anti-pattern | Why it's dangerous | How to prevent |
|-------------|-------------------|----------------|
| **Visual reskin disguised as innovation** | Changing cards to be prettier doesn't change the participation model | Validate: does the user DO something fundamentally different, or just see something different? |
| **Excessive interaction complexity** | Users should complete the spark ritual in <60 seconds, not 5 minutes | Strict time budget: Intent (10s) + Ignition (5s) = 15s for Stage 1; add Attunement (30s) in Stage 2 for a total of ~45s |
| **Dark patterns around urgency** | "Only 2 spots left!" / "Join NOW or miss out!" creates anxiety, not excitement | No scarcity messaging. Urgency comes from ritual pacing, not FOMO pressure |
| **Fake randomness** | If the system is matching deterministically, don't pretend it's random discovery | Be transparent: "Our AI matched you" not "You randomly found each other" |
| **Trust-damaging ambiguity** | Users must understand what happens after ignition — where their data goes, what happens next | Reuse `BlindPoolTrustExplainer` logic; add clear "What happens next" state in SparkWaitingScreen |
| **Novelty that lowers conversion** | If the ignition gesture is too weird, users won't complete it | Always offer a text-button fallback beneath the gesture for accessibility |
| **Ritual fatigue** | If the ritual feels like a chore on the 5th use, it failed | Stage 3's Ambient Drift provides an express lane for returning users |
| **Over-designed empty states** | If no events are available, don't show a beautiful dead ritual | Fallback to simple "No sparks this week" with notification opt-in |

### Accessibility Requirements

- Ignition gesture MUST have a button alternative for users who can't perform tap-and-hold
- All animations respect `prefers-reduced-motion` (already checked via `useReducedMotion` hook in codebase)
- Micro-reveal cards must be screen-reader accessible
- Color contrast ratios must meet WCAG AA on all spark flow screens

### Copy Guardrails

- Never use "queue" or "waiting" in user-facing copy — use "mixing," "forming," "sparking"
- Never frame the process as transactional — no "submitted," "processing," "pending"
- Vibe language should be warm and energetic, not corporate or gamified
- All copy in Mandarin Chinese (consistent with existing `constants.ts` patterns)

---

## 10. Fastest Path to Prototype

### Goal: Smallest believable prototype in 1-2 sprints

**What to build:**

1. **SparkIntentCard** (2-3 days) — Two full-width atmospheric cards on `DiscoverPage` for 饭局 and 酒局, with live participant count badges. Tapping opens the existing `JoinEventPoolSheet` (no new sheet yet). This alone changes the discovery feeling from "browse a list" to "choose your energy."

2. **IgnitionGesture** (2-3 days) — Replace the final "确认报名" button in `JoinEventPoolSheet` (or in a new minimal `SparkEntrySheet`) with a tap-and-hold circle that fills with a gradient + haptic feedback. On release after threshold: registration fires. Under threshold: springs back. This changes the *commitment moment* from a tap to a ritual.

3. **SparkWaitingScreen** (3-4 days) — Replace `MatchingWaitingScreen` content with:
   - "Your spark is in the mix 🔥" headline instead of fill-bar
   - Subtle particle/orb animation (extend existing `FloatingOrbs` component from `event-pool-registration/`)
   - 1-2 static micro-reveal cards (hardcoded: "People with similar vibes are joining..." → "A forming group matches your energy by 78%")
   - Existing cancel/browse CTAs

4. **Feature flag** (0.5 day) — `ENABLE_SPARK_RITUAL` constant. When on, `DiscoverPage` renders intent cards + ignition gesture. When off, current flow.

**Total estimate: 8-11 engineering days = 1.5-2 sprints**

**What this proves:**
- Whether atmospheric intent cards increase engagement vs. pool listing (measurable)
- Whether an ignition gesture feels meaningful or annoying (qualitative)
- Whether story-driven waiting reduces abandonment vs. fill-bar (measurable)

**What it deliberately doesn't include (for later):**
- Attunement beat (Stage 2)
- Real-time micro-reveals from backend (Stage 2)
- Ambient Drift mode (Stage 3)
- Vibe Reading visualization (Stage 2)

This prototype changes the *feeling* of participation with minimal backend changes and no matching algorithm modifications — a pure presentation-layer experiment that tests the core thesis: **participation should feel like a ritual, not a transaction.**

---

*End of proposal. This document should be reviewed by Product, Design, and Engineering leads before proceeding to prototyping.*
