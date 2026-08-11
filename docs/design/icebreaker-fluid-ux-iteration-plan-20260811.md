# Social Icebreaker Fluid-UX Uplift — Iteration Plan

**Date:** 2026-08-11 · **Status:** Review-ready plan (no code) · **Spec of record:** `docs/design/icebreaker-fluid-ux-playbook-20260811.md` ("the playbook") · **Surface:** `/icebreaker/:sessionId`, WeChat mini-program only

> **2026-08-11 grill-me update:** the three blocked items in §6 are now resolved by locked strategy rulings — see playbook §10 (Locked Rulings). (a) quip_battle → flexible hybrid: synchronized draft beat as spine + host-selectable verbal mode + private optional AI rescue; (b) gyro parallax → spike proceeds with numeric pass/fail floors, any WARN = drop; (c) group-beat boundary → confirmed state-free beats with poll as sole state truth. The POCKET screen-on addendum below is accepted and playbook §2 is amended accordingly.

---

## 1. Problem Statement

The Social Icebreaker is functionally complete (14 phases, host-paced, `PhaseHeroCard` visual system, reliable LLM fallbacks) but **screen-centric**: it is built as a sequence of pages to be read, not a conductor to be glanced at. Verified gaps against the playbook's dual mandate:

| Playbook mandate | Current shipped behavior (verified in code) | Gap |
|---|---|---|
| Eyes-up ≥90%; POCKET default state | All state arrives via a 3s poll (`POLL_SOCIAL_SESSION_MS = 3000`) rendered as full cards; nothing reaches a user whose eyes are off the screen. No haptic signal exists for any *social* event (phase change, your turn, reveal) | The loop `POCKET → buzz → GLANCE → ACT → POCKET` cannot start: there is no buzz |
| Haptic grammar as primary channel (5 social patterns) | `lib/utils/haptics.ts` has 8 **UI-event** types (tap confirmations, slot ticks); phases fire them on button taps only. No Nudge / Your-turn / Reveal / Celebration social mapping | Primary channel unbuilt |
| GLANCE answers "what now?" in ≤1s via color field + one pictogram | `PhaseHeroCard` is a 4-zone card (header rail / hero / status / action) with title + prompt + status text + dots all visible at once; background is flat `page-warm-bg` beige | Fails the One-Glance Rule; nothing decodable from silhouette |
| Mood-anchored color fields (3.4) | Per-phase foil accents exist (`phases/phaseAccents.ts`) but are static identity, not state-reactive; no waiting/connection mood shift, no progress tightening, no reveal bloom | Pillar absent |
| Composition without keyboards (§6) | **Five in-session text inputs ship today:** `QuipBattleHeroView.tsx` (answer `Input`), `UndercoverWordHeroView.tsx` (describe `Input`), `AuctionHeroView.tsx` (custom bid `Input`), `LieDetectiveHeroView.tsx` (3× `Textarea` + tag `Input`s), `MiniScriptHeroView.tsx` (who/what/why `Input`s); `group_mirror` carries a nominate+**reason** payload | Direct playbook conflict — each forces sustained heads-down typing while five people wait |
| Group-synchronized beats (six pockets buzz together) | WS event types `SOCIAL_PHASE_CHANGED` / `SOCIAL_LIE_VOTE_UPDATE` / `SOCIAL_PULSE_UPDATE` are **defined in `packages/shared/src/wsEvents.ts` but never emitted by any server code** (grep: zero matches); the icebreaker page does not use `useWebSocket` at all | Requires new server emission + client wiring |
| Audio seasoning (optional) | Zero `createInnerAudioContext` usage in `apps/mini-program/src` | Greenfield, explicitly optional |
| Silence Rescue (zone 6) | Partial: server stall nudge (`stallNudgeAt`, ~75s grace) + host-only Xiaoyue adaptive suggestion exist; delivered as an on-screen banner, not a host-only haptic nudge | Exists but screen-bound |

**Quantified framing:** every one of the ~10 playable phases currently demands screen attention for 100% of its interaction; the playbook's behavioral gate demands the phone be look-at-able in ≤1s glances for everything except one ACT touch. The uplift is therefore not polish — it is a second interaction model (sensory + glanceable) layered over the existing phase machinery, exactly as playbook §9 prescribes ("a sensory and behavioral layer over current phases, not a new surface").

---

## 2. Goals, Non-Goals, Non-Negotiable Constraints

### Goals
- G1. Ship the playbook's three-state behavioral model (POCKET / GLANCE / ACT) on the existing session page, haptics-first.
- G2. Bring all seven aesthetic pillars (§3) to the in-event surface, brand-true and platform-true, passing the Aesthetic Gate.
- G3. Eliminate in-session typing per playbook §6, with explicitly scoped exceptions.
- G4. Add group-synchronized sensory beats for reveals and host-driven transitions.
- G5. Every slice ships dark behind DB-backed flags and passes both §8 gates before flag-on.

### Non-goals (explicit)
- No new phases, no phase-mechanic redesigns beyond keyboard removal, no run-plan/tier/vibe changes, no host-pacing authority changes (host remains sole pacing authority).
- No web-client work (`apps/user-client` is archived; playbook §9 bounds this to the mini-program).
- No new surfaces outside `pages/icebreaker-session/` in this iteration. The playbook's "move lie-detective drafting pre-event (registration / gathering room)" is **cross-surface** and is deferred to a follow-up iteration (see S5d).
- No ambient-light-sensor behavior, no spatial audio, no elastic/spring bounce, no CJK variable font (playbook §9 platform truths).
- No prescription of gestures, timings, bezier curves, haptic waveforms, or pixel dims — playbook §9 reserves these for engineering.
- No changes to the LLM runtime-safety posture (6s `raceWithTimeout` bounds stay exactly as-is).

### Non-negotiable constraints
- **Playbook hard constraints:** dual mandate (neither half traded for the other); three-state model inviolable; haptic grammar complete without screen or audio; zero typing except §6 exceptions; both §8 gates per iteration — "behavioral done, aesthetics later is not shippable."
- **Repo guardrails (AGENTS.md §7):** BEM class-coverage gate (every new `__` class ships CSS in the same PR); subpackage style-splitting gate (`pages/icebreaker-session` is a subpackage — new component SCSS must be `@use`d into the page SCSS so it lands in the page WXSS chunk; `verify-subpackage-styles.mjs` runs on `build:weapp`); no inline emoji in mini-program TS/TSX (JoyJoinIcon/CSS only); solid-purple CTA rule; full-screen centering rules; reduced-motion collapse discipline (one RM block → 150ms opacity crossfade is the existing pattern).
- **Copy 🔴 rules (`docs/copy/brand-copy-strategy.md`):** no mechanism explanation, mandatory warmth, canonical terminology (局/桌友/悦仔 etc.); all new L1 words and micro-fragments are copy and must pass review.
- **Flag discipline:** DB-backed `feature_flags` + `FLAG_ENV_MAP` env fallback + auth-response `features`, ship dark (default `false`), per `apps/server/src/lib/featureFlags.ts` precedent (`gatheringRoomEnabled`).
- **Analytics discipline:** new client event types must be whitelisted in `ALLOWED_SOCIAL_ICEBREAKER_EVENT_TYPES` (`apps/server/src/routes/domains/analytics.ts`) or they are silently dropped.
- **Bot/test parity:** any phase-mechanic change must update `apps/server/src/services/socialIcebreakerBotService.ts` (bots cover quip_battle, undercover_word, group_mirror, etc.) so single-test sessions still work.

---

## 3. Iteration Slices

Slices are smallest-shippable, ROI-ranked (§4 gives sequencing rationale). Each maps to playbook pillars/zones. **Ownership key:** MP = mini-program, SRV = server, AI = AI/LLM, DES = design.

---

### S1 — Haptic Grammar Foundation (playbook §4 primary channel; zones 2/3/4 enabler)

**User story:** As a player holding my drink, I feel distinct buzzes for "something new," "my turn," "confirmed," "reveal," and "celebration," so I keep my eyes on the circle and only glance when the phone asks me to.

**Current state (shipped):** `haptics()` (light/medium/heavy/success/warning/slotTick/slotLand/cardReveal) fires only on local tap confirmations inside some phase views. **Proposed:** a five-pattern social-event grammar (Nudge / Your turn / Confirm / Reveal / Celebration) built on `vibrateShort` types + `vibrateLong` + rhythm gaps (rhythm precedent exists: squad-unboxing's two-pulse heartbeat with ≥80ms spacing in `squadDeckCollapseState.ts`); patterns fire from **detected session-state transitions**, not button handlers.

**Scope boundary:** Client-only. No server work, no visual change. In-scope: grammar module, a state-diff event detector hook on the session page (compares successive `SocialSessionState` snapshots → emits sensory events: phase entered, reveal appeared (`currentLieDetectiveReveal`, `groupMirrorRevealed`, `quipBattleRevealed`), own-turn conditions, all-ready, recap), wiring Confirm onto the existing `performSocialAction` success path. Out-of-scope: group synchronization (S6), audio (S9), POCKET/screen-dim behaviors (S2).

**Ownership:** MP.

**Key files:**
- `apps/mini-program/src/lib/utils/haptics.ts` (extend — new grammar map; existing call sites untouched)
- new `apps/mini-program/src/pages/icebreaker-session/hooks/useSessionSensoryEvents.ts` (state-diff detector; this detector is reused by S2/S4 and is S6's poll-fallback)
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` (mount detector; Confirm on action success)
- tests alongside (repo pattern: `__tests__/`), e.g. detector transition matrix

**Acceptance criteria — Behavioral Gate:**
- All five patterns fire from state transitions in a live (or single-test + bots) session; patterns are pairwise distinguishable through fabric in a pocket-style field check (protocol in §5).
- Session remains fully playable on haptics + glances for the MVP chain (warmup → micro_challenge → lie_detective): every "your input is needed" moment has a haptic antecedent.
- Confirm fires at touch instant on every mutating action (already-routed via `performSocialAction`).
- Learnability: a first-time group correctly names ≥ the agreed share of pattern meanings by session end (field protocol, §5).

**Acceptance criteria — Aesthetic Gate:** No visual delta ⇒ brand checklist trivially clean; performance-audit must show no added render cost (detector is memoized diffing, no new subscriptions; subpackage size delta ≈ 0).

**Flag:** `icebreakerHapticGrammarEnabled` / env `ICEBREAKER_HAPTIC_GRAMMAR_ENABLED` (default `false`; client gate via auth `features`).

**Dependencies:** none. **De-risks:** proves the behavioral core loop before any visual refactor; the detector is infrastructure for S2/S4/S6-fallback.

---

### S2 — Mood-Anchored Color Fields + Budgeted Ambient Backdrop (pillars 3.4 + 3.1; zone 2/5)

**User story:** As a player, the whole screen quietly shifts from cool violet while we wait to warm coral as we connect, so I know the room's emotional beat from the corner of my eye without reading anything.

**Current state:** flat `page-warm-bg` shell (`index.scss`), static per-phase foil accents. **Proposed:** a page-shell ambient field — pre-rendered/static gradient layers (budgeted glass per §3.1: blur confined to small hero surfaces, transform/opacity-only drift) keyed off *context* (phase, waiting vs active vs reveal, vote/completion progress derived client-side from `votes`, `challengeCompletedBy`, etc. — no server change). Waiting = cool violet-indigo derivative (Primary Purple `#8B5CF6` + Sky Blue `#A8C5DD`); connection/matched = Warm Coral `#FF9B85` family; field tightens with accumulating votes, blooms on reveal. Phase accents remain as identity *within* the field. **Per grill-me ruling 4, the ambient field is also the POCKET-state signal surface (screen-on, face-down).**

**Scope boundary:** Shell + hero-surface treatment only; no card restructuring (that's S3). No gyro (S10). No ambient-light adaptation (impossible, §3.4). Must respect: solid-purple CTA rule (CTAs stay `$color-primary` regardless of field), contrast locks in `phaseAccents.test.ts` (≥4.5:1 deep-on-tint), RM collapse.

**Ownership:** MP + DES (field token spec per state; engineering owns exact stops/opacities within brand tokens).

**Key files:**
- `apps/mini-program/src/pages/icebreaker-session/index.scss` + new `styles/_ambient-field.scss`
- `apps/mini-program/src/pages/icebreaker-session/index.tsx` (field state class on the root)
- possibly `phases/phaseAccents.ts` (field tokens ride the same rgba-inline pattern — WeChat drops `hsla()`)
- `styles/_phase-motion.scss` (drift keyframes, transform/opacity only, RM-covered)

**Acceptance criteria — Behavioral Gate:** field state changes arrive with the state transitions S1 detects (no extra polling); waiting/active/reveal moods distinguishable at arm's-length edge-of-vision in dim light (squint protocol, §5); zero added interaction cost.

**Acceptance criteria — Aesthetic Gate:** brand-token-only palette; 60fps on the Gen-Z 8GB baseline (performance-audit; static/pre-rendered layers, no live large blurs); squint-test: a reviewer names "waiting vs active vs reveal" from the field alone; `joyjoin-brand-guidelines` checklist clean (purple anchor, warm never cold-corporate); subpackage style gate + class-coverage gate green.

**Flag:** `icebreakerMoodFieldEnabled` / `ICEBREAKER_MOOD_FIELD_ENABLED` (default `false`).

**Dependencies:** soft dependency on S1's detector for reveal-bloom timing (can key off raw state without it).

---

### S3 — Three-Layer Glance Stack (pillars 3.7 + 3.3 + 3.5; the GLANCE state made visual)

**User story:** As a player raising my phone for one heartbeat, I see one huge pictogram-or-word telling me the beat's kind; if I'm the reader-aloud, the prompt is comfortably there for me; everything else (counts, timers) is hidden until I deliberately peek.

**Current state:** `PhaseHeroCard` 4-zone card with title + prompt + status + dots + actions co-visible. **Proposed:** re-zone into the L1/L2/L3 stack — L1 Signal (one massive pictogram or single display word; `PhaseHeaderIcon` / `ICEBREAKER_PHASE_EMBLEM_ASSETS` / JoyJoinIcon phase emblems are the existing asset base), L2 Script (prompt for the one reader-aloud, quiet contrast), L3 Context (counts/timers/labels as hairline micro-fragments behind hold-to-peek progressive disclosure; gesture choice is engineering's). Typography within the three brand roles (`font-cn-display` / `font-en-brand` / `font-ui`; weight contrast via loaded faces + `wx.loadFontFace` subsets — no CJK variable font).

**Scope boundary:** refactor `PhaseHeroCard` + all phase hero views; ship as **pilot wave (2 phases: `micro_challenge` + `warmup`) → migration waves** rather than a 14-phase big-bang. Warmup's wave bundles S8 (Handshake Bridge) design. Each phase's wave bundles its S5 keyboard conversion where applicable (same files — avoids double-touching views). Out-of-scope: mechanic changes themselves (S5), reveal choreography polish (S4).

**Ownership:** MP + DES (per-phase L1 pictogram/word spec + L2 copy fragments — all L1/L2 strings are copy, 🔴 rules apply); no SRV.

**Key files:**
- `components/PhaseHeroCard.tsx` + `components/PhaseHeroCard.scss` (new layer zones)
- `phases/*HeroView.tsx` + per-phase SCSS, `phases/WarmupPhaseView.tsx` and warmup components (`WarmupCardSlot`, `WarmupActionBar`, `WarmupPresenceStrip`) for the pilot
- `styles/_phase-hero-card.scss`, `styles/_phase-motion.scss`
- `phaseUtils.tsx` (icon mapping), `usePreloadCdnIcons` asset lists if new L1 pictograms land (CDN manifest discipline applies)
- contract tests to update: `__tests__/phaseViews.test.tsx`, `warmupAndPhaseLogic.test.ts`, `phaseAccents.test.ts` if accents shift

**Acceptance criteria — Behavioral Gate:** GLANCE decodability — a cold viewer answers "what now / what kind of beat" in a one-heartbeat look, per phase (squint protocol §5); exactly one obvious ACT target per state; L3 info never required to act; zero-scroll discipline preserved (warmup's 4-band zero-scroll layout is existing law).

**Acceptance criteria — Aesthetic Gate:** 0.5s squint test at arm's length in dim light: L1/L2/L3 tiers separate cleanly, no fourth layer; brand-role typography only, no mixed display fonts; one visual anchor per card rule preserved (art band XOR emblem); 60fps baseline; class-coverage + subpackage-style gates green; `frontend-design-audit` ≥ last recorded baseline (82/100, 2026-07-19 round) with no pillar-3.7 findings open.

**Flag:** `icebreakerGlanceStackEnabled` / `ICEBREAKER_GLANCE_STACK_ENABLED` (default `false`; per-phase rollout possible within the flag).

**Dependencies:** S2 recommended first (field is the canvas L1 sits against); DES spec for L1 pictograms is the long-lead item — start during S1.

---

### S4 — Weighted Motion + Reveal/Transition Choreography (pillar 3.2; zones 4 + 5)

**User story:** As a player, phase changes feel like the room turning a page beneath our conversation — the field cross-fades to the next identity, entries land with weight, and a reveal blooms for everyone at once; nothing bounces, nothing shouts.

**Current state:** `_phase-motion.scss` already enforces transform/opacity-only, entrance `cubic-bezier(0.22,1,0.36,1)`, one RM block → 150ms crossfade; phase changes today swap content with a `PhaseIntroOverlay` + toast. **Proposed:** extend the shared vocabulary: fast-attack/long-settle entries, a physical "land" on confirmations, field cross-fade transitions *underneath* conversation (replacing "screens" thinking — zone 5), and the two-second group reveal bloom (zone 4, timed with S1's Reveal haptic; synchronized across devices only when S6 lands). No elastic overshoot (brand referee ruling §3.2).

**Scope boundary:** motion only; no layout/mechanic changes. All keyframes RM-collapsed. Engineering owns beziers/durations within the no-bounce bound.

**Ownership:** MP (+DES review against brand motion rules).

**Key files:** `styles/_phase-motion.scss`, `styles/_phase-hero-card.scss`, `overlays/PhaseIntroOverlay.tsx` (evolve or retire into field cross-fade), per-phase hero SCSS.

**Acceptance — Behavioral Gate:** transitions never block or delay the ACT input; reveal beat is one group moment, not a per-user animation storm.
**Acceptance — Aesthetic Gate:** brand "gentle, premium, no loud/bouncy" checklist line clean; 60fps baseline during transition + reveal; RM collapse verified per surface.

**Flag:** rides S2/S3 flags (no independent flag — motion is inseparable from the surfaces it animates); RM path is the built-in degradation.

**Dependencies:** S2 + S3 pilot surfaces.

---

### S5 — Composition Without Keyboards (playbook §6) — per-phase sub-slices

**User story:** As a player, I never open a keyboard mid-session; every contribution is a tap, a spoken word to the circle, or something I prepared before the event.

**Verified conflicts with playbook §6 (all shipped today):** quip_battle answers, undercover_word descriptions, auction custom amounts, lie_detective V1 statement authoring (3 textareas) + V2 tag inputs, mini_script who/what/why votes, group_mirror free-text reason.

Each sub-slice is independently shippable and is scheduled inside its phase's S3 migration wave:

- **S5a · Auction preset increments** (MP only): replace custom-amount `Input` with preset increment chips. Server `/auction/bid` accepts arbitrary amounts today — constrain at client; server-side validation tightening is optional hardening, not required. Files: `phases/AuctionHeroView.tsx`; bots unaffected (bots bid fixed amounts).
- **S5b · Undercover_word goes verbal** (MP + SRV): descriptions are spoken to the co-present circle; the phone keeps score — turn tracking + vote only. Server `/undercover-word/describe` semantics change (description payload becomes optional/vestigial; turn bookkeeping retained). Files: `phases/UndercoverWordHeroView.tsx`, `apps/server/src/routes/socialIcebreakerGameplayExtra.ts`, shared state types in `packages/shared/src/socialIcebreaker.ts`, `socialIcebreakerBotService.ts` (bot describe steps become turn-advances). **Careful:** preserve the only-loser-adjacent reveal framing noted in the 2026-08-03 phase-curve audit.
- **S5c · Mini_script accusation → avatar-pick + option chips** (MP + SRV + shared types): `MiniScriptVoteInput` currently free-text who/what/why (`packages/shared/src/miniscriptStoryFramework.ts`); becomes structured picks (avatar for who; curated/AI-generated option chips for what/why). Content-filter path for free text shrinks accordingly. Files: `phases/MiniScriptHeroView.tsx`, shared framework types, `apps/server/src/routes/domains/miniscript.ts`, bot service, `miniscript*` contract tests.
- **S5d · Lie_detective authoring without composition** (two stages): *Stage 1 (this iteration, MP):* default to the V2 pipeline (`LIE_DETECTIVE_MODE=v2`: 2 tags → AI expands + inserts fake — already built) and make tag entry tap-first via suggested tag chips (curated or AI-ghostwritten candidates — the playbook's ghostwriter+curator pattern), keeping free-tag input as fallback. *Stage 2 (next iteration, cross-surface — **not in scope here**):* pre-event drafting at registration / in the gathering room. Files (stage 1): `phases/LieDetectiveHeroView.tsx`, possibly server tag-suggestion endpoint reuse.
- **S5e · Quip_battle** — **RESOLVED 2026-08-11 (playbook §10 ruling 5):** flexible hybrid — synchronized group draft beat (≤20s haptic countdown, max once/session) as the spine; host-selectable verbal mode; AI ghostwriter demoted to private optional player-only rescue (AIGC labeling semantics decided at spec). No longer blocked.
- **S5f · Group_mirror reason** (MP, small): free-text reason becomes optional preset chips or is dropped; must not regress the open anonymity backlog item from the 2026-08-03 audit (voter→target attribution in broadcast state is already flagged there — do not widen it).

**Acceptance — Behavioral Gate (applies to each):** zero keyboard appearances in the converted phase (instrumented, §5); every input ≤1 touch; mechanic semantics unchanged except input channel; single-test bot flow still completes the phase end-to-end.
**Acceptance — Aesthetic Gate:** converted inputs adopt the S3 layer treatment (chips live in ACT zone); no guardrail regressions.

**Flags:** parent `icebreakerZeroTypingEnabled` / `ICEBREAKER_ZERO_TYPING_ENABLED` (default `false`); server-semantic sub-slices (S5b, S5c) get child kill switches (`…_UNDERCOVER_VERBAL_ENABLED`, `…_MINISCRIPT_STRUCTURED_VOTE_ENABLED`) so a bad conversion can be reverted without touching the others.

**Dependencies:** S3 wave for the same phase (bundle); S5c AI chip generation reuses existing `raceWithTimeout`-wrapped infrastructure if AI-generated options are chosen (AI ownership in that case; `llm-runtime-safety` skill mandatory).

---

### S6 — Group-Synchronized Beats (zones 4 + 5 group moment; playbook §4 "six pockets buzzing together")

**User story:** As a player, when the host moves us on or a reveal lands, every phone at the table buzzes in the same instant — the whole circle looks up together.

**Current state (verified):** server `wsService.ts` already runs authenticated event rooms with `broadcastToEvent`; client `useWebSocket` + `lib/api/websocket.ts` are production-proven by gathering-room and matching-status; social WS event types exist in `packages/shared/src/wsEvents.ts` but **nothing emits them**; the icebreaker page is poll-only. **Proposed:** (1) server emits lightweight beat triggers from the existing transition/reveal choke points — `transitionPhase()` in `apps/server/src/routes/socialIcebreakerHelpers.ts` (host advance, early-end), reveal completions in `socialIcebreakerGameplayCore.ts` / `socialIcebreakerGameplayExtra.ts` (all-votes-in reveal, group-mirror reveal, quip results, dice reveal countdown) — via `wsService.broadcastToEvent`, reusing or extending the dormant `SOCIAL_*` types; (2) the session page joins the event room (route already carries `eventId`) and fires the S1 pattern on beat receipt. **Boundary CONFIRMED (playbook §10 ruling 6): beats carry no state — only "fire pattern X now" + a dedupe nonce + server timestamp.** State truth remains the 3s poll; degradation is automatic (WS down → S1's detector fires the same patterns on poll arrival, just late); buzz-before-picture skew is intended (feel first, glance second).

**Scope boundary:** no replacement of polling; no presence UI; no new room semantics beyond event-room reuse. Mini-program backgrounding kills sockets (gathering-room already lives with this: 5s leave grace + reconnect on show) — beats are best-effort sensory triggers, never correctness. Flag-on precondition: venue WS reliability field test.

**Ownership:** SRV + MP.

**Key files:**
- SRV: `apps/server/src/wsService.ts` (only if new message plumbing needed), emission call sites in `routes/socialIcebreakerHelpers.ts`, `socialIcebreakerGameplayCore.ts`, `socialIcebreakerGameplayExtra.ts`; `packages/shared/src/wsEvents.ts` (wire dormant types or add `SOCIAL_GROUP_BEAT`)
- MP: `pages/icebreaker-session/index.tsx` (`useWebSocket` join + beat→haptic dispatch + dedupe), `hooks/useWebSocket.ts` (reuse as-is)

**Acceptance — Behavioral Gate:** beat skew across 6 staging test devices within the budget engineering sets, measured from server timestamp vs client receipt logs (§5); WS-less devices still receive every beat via the S1 poll-fallback detector (late is acceptable, never missing); beats never double-fire (nonce dedupe); host advance produces a group beat, not just a local one.
**Acceptance — Aesthetic Gate:** none visual; performance-audit confirms the added socket doesn't regress the page (gathering-room precedent suggests it doesn't).

**Flag:** `icebreakerGroupBeatsEnabled` / `ICEBREAKER_GROUP_BEATS_ENABLED` (default `false`; gates both server emission and client join).

**Dependencies:** S1 (patterns to fire).

---

### S7 — Silence Rescue: host-only haptic nudge + ready move (zone 6)

**User story:** As the host, when the table goes quiet, my phone gives me a private nudge and a ready-made conversational move; the group experiences a save and never sees a notification.

**Current state (verified):** server stall detection exists (`stallNudgeAt` + grace in the transition pipeline, tests in `socialIcebreakerTransitions.test.ts`) plus host-only Xiaoyue adaptive suggestions (`socialIcebreakerXiaoyue.ts`, stripped for non-host by `sanitizeStateForClient`); both surface as on-screen UI (banner / session-shell card). **Proposed:** route the existing signals through the S1 grammar (host-only Nudge variant that must never be mistakable for a group beat) + a GLANCE-grade move card (L1/L2 stack); group-facing surfaces unchanged.

**Ownership:** MP (primary); SRV only if trigger tuning is needed (dwell data from `social_icebreaker_phase_metrics` informs this).

**Key files:** `index.tsx`, `sessionShellLogic.ts`, `XiaoyueSessionShell` (host affordance), possibly `apps/server/src/routes/socialIcebreakerHelpers.ts` (trigger thresholds).

**Acceptance — Behavioral Gate:** nudge reaches host-only (verified by role); never fires for non-hosts; suggestion actionable in one touch; stall_nudge analytics (`stall_nudge_shown/advance/dismiss`) already exist and must keep populating.
**Acceptance — Aesthetic Gate:** suggestion card passes the squint test as an L1/L2 object.

**Flag:** rides `icebreakerHapticGrammarEnabled`.

**Dependencies:** S1; S6 optional upgrade (push instead of poll-discovered).

---

### S8 — Handshake Bridge (zone 1): arrival ritual redesign

**User story:** As a player arriving at the table, the session opens with something we *say* to each other, and the first card appears only once we're already talking — the phone never opens the evening.

**Current state:** `waiting` phase (tier/vibe selection, `WaitingPhase`) → host mood-pick → topic deal-flip. **Proposed:** a spoken-ritual opening beat in waiting→warmup (design-led; exact ritual is a design spec, not this plan); first content gated on group-started signal (simplest honest proxy: all-joined + host single touch; engineering/product refine in spec).

**Ownership:** DES + MP; no SRV anticipated (state machine already supports waiting→warmup gating).

**Key files:** `components/WaitingPhase.tsx`, `phases/WarmupPhaseView.tsx`, `components/WarmupWelcomeBand.tsx`.

**Acceptance — Behavioral Gate:** session's first screen never demands reading before the group has spoken (field-observed); single-touch host start; tier/vibe selection (host admin) remains available but out of the ritual path.
**Acceptance — Aesthetic Gate:** opening beat passes brand checklist (one mascot max, warm, uncluttered) and the S3 stack. (Per grill-me ruling 1, the opening stays in the behavioral cell — aesthetic license applies only to reveal/celebration beats.)

**Flag:** rides `icebreakerGlanceStackEnabled` (it is warmup's S3 wave).

**Dependencies:** S3 warmup wave; DES spec is a long-lead — start with S3's pictogram spec.

---

### S9 — Audio Seasoning (playbook §4, strictly optional)

**User story:** As a player with sound on, delicate sub-1s ticks layer under the room's ambience, mirroring the buzzes — and if I'm on silent, I lose nothing.

**Scope:** greenfield `createInnerAudioContext` tick/pop set, preloaded, mirroring the S1 grammar; session must remain fully playable on haptics alone (playbook hard line; grill-me ruling 3: audio never substitutes for a haptic pattern); no spatial audio (impossible, §4). Ships only after S1's grammar is field-validated so audio mirrors a proven mapping.

**Ownership:** MP + DES (sound design within brand "warm, not flashy").

**Key files:** new `lib/utils/sessionAudio.ts`, asset hosting per CDN manifest discipline (`cdn-asset-manifest.json` — every localPath must exist; manifest counts verified on upload).

**Acceptance — Behavioral Gate:** silent-mode playthrough loses zero meaning (field check); audio never masks table conversation (sub-1s, delicate — exact levels engineering's).
**Acceptance — Aesthetic Gate:** brand checklist; assets through the CDN pipeline with upload verification.

**Flag:** `icebreakerAudioEnabled` / `ICEBREAKER_AUDIO_ENABLED` (default `false`). **Dependencies:** S1. Lowest priority of the program (first on the grill-me ruling 9 cut line).

---

### S10 — Gyro Parallax Spike → Decision (pillar 3.1 optional flourish)

**Scope:** time-boxed engineering spike: `wx.onGyroscopeData` parallax on one hero surface (e.g., warmup card), flag-gated, off in POCKET, on the Gen-Z 8GB baseline device. **Pass/fail floors LOCKED (playbook §10 ruling 7):** sustained 60fps with no new jank over budget, zero new crashes, session battery within normal envelope; any WARN = drop, no negotiation; performance-audit verdict is final. Ship (behind `icebreakerGyroParallaxEnabled`, default `false`) or drop at zero product cost.

---

## 4. Sequencing (recommended order + rationale)

```
Wave 0 (parallel, no code):  DES spec — L1 pictogram set + L2 copy fragments (S3/S8 long-lead)
                             S10 gyro spike (cheap, settles its ship/drop by locked floors)
Wave 1:  S1 Haptic Grammar          → primary channel, cheapest, client-only, field-testable
                                      immediately; builds the detector everything else reuses
                                      [eyes-up checkpoint 1: pre-uplift baseline]
Wave 2:  S2 Mood Fields             → first user-visible aesthetic win; the canvas for L1
Wave 3:  S3 pilot (micro_challenge + warmup, warmup bundles S8) + S4 on pilot surfaces
                                      [eyes-up checkpoint 2: pilot field test]
Wave 4:  S6 Group Beats (server stream can start in Wave 2 in parallel; needs S1 to land)
         + S7 Silence Rescue (small; rides S1, upgraded by S6)
Wave 5:  S3 migration waves remaining phases, each bundling its S5 conversion
         (S5a auction, S5b undercover, S5c mini_script, S5d-stage1 lie, S5f group_mirror,
          S5e quip per locked hybrid ruling)
Wave 6:  S9 Audio (optional, last)  → S10 ship/drop per spike
         [eyes-up checkpoint 3: final migration field test]
```

Rationale: S1 first because haptics *are* the behavioral gate's backbone and it carries zero visual risk; S2/S3 deliver the earliest visible transformation on the surfaces users already know; S6 is the only server-heavy item and is decoupled by design (beats are state-free triggers), so it can parallel-run; keyboard conversions ride the S3 waves deliberately — touching each phase view once, not twice; audio and gyro are explicitly last/optional per the playbook's own priority order (haptics → visuals → audio). **Cut line under schedule pressure (playbook §10 ruling 9):** S9 → S10 → S6 → S7; the untouchable core is S1 + S2 + S3 pilot.

---

## 5. Success Metrics (observable only)

**Behavioral Gate protocols (field tests on staging 体验版 sessions, real matched groups):**
- **Eyes-up sampling:** observer samples each participant's gaze at fixed intervals; ≥90% target. Runs at exactly 3 checkpoints (Wave 1 baseline, Wave 3 pilot, final migration wave) per playbook §10 ruling 2; all other waves gate on the instrumented proxies below. Screen-on time is rejected as a proxy.
- **Haptic learnability check:** first-time group; at 3 random points the facilitator asks "what did that buzz mean"; correct-identification share meets the bar set at spec. Fallback per §10 ruling 3: degradation ladder to 3 patterns (attention / your-turn / group-reveal), escalate below 3.
- **GLANCE decodability:** "what now?" answered in a one-heartbeat look without scrolling/reading; facilitator-verified per phase.
- **Keyboards per session (instrumented):** client logs a whitelisted analytics event on any `Input`/`Textarea` focus in-session; target 0 for converted phases (the quip_battle synchronized draft beat is the only allowed nonzero).
- **One-touch compliance:** every mutating in-session input completable in ≤1 touch — design review checklist + field verification.

**Aesthetic Gate protocols:**
- **Squint test:** 0.5s at arm's length in dim light; reviewer separates L1/L2/L3 and names the beat kind per screen (playbook §3.7 protocol).
- **Audit scores:** `frontend-design-audit` (last recorded icebreaker baseline: 82/100, 2026-07-19 round) must not regress and pillar findings must close; `user-satisfaction-audit` verdict per wave; `performance-audit` PASS (60fps on the Gen-Z baseline device; subpackage budget respected) — the playbook §8 enforcement path, run per wave. **Gate teeth (§10 ruling 8):** gates bind flag-on, not merge; hard blockers are perf non-PASS, copy 🔴 violations, behavioral proxy failures, design-audit regression/open pillar findings, and class-coverage/subpackage-style red; everything else becomes tracked follow-ups.

**System metrics (existing infrastructure):**
- **Phase-advance latency:** action POST → state visible ≤ poll interval + render budget (measurable via existing analytics + `social_icebreaker_phase_metrics` dwell data).
- **Group-beat skew:** server-timestamp vs client-receipt logs across 6 staging devices; within engineering's budget (S6 acceptance).
- **Session completion rate:** sessions reaching `recap` / sessions started, tracked per wave for regression, not as an uplift promise — this iteration must not *harm* completion.
- **Stall-nudge funnel:** existing `stall_nudge_shown → advance/dismiss` events continue populating; S7 success = nudges resolve stalls at equal-or-better rate with less screen time.

---

## 6. Dependencies, Open Questions, Risks

### Previously blocked items — resolved 2026-08-11 (playbook §10)
- **(a) quip_battle →** ruling 5: flexible hybrid (draft-beat spine + host verbal mode + private AI rescue).
- **(b) gyro parallax →** ruling 7: spike proceeds under numeric floors; WARN = drop.
- **(c) group-beat delivery →** ruling 6: state-free beats confirmed; poll remains truth; venue WS field test is the flag-on precondition.

### Platform-truth addendum — accepted (playbook §10 ruling 4)
Playbook §2's POCKET state assumed "screen dark," but WeChat mini-programs cannot vibrate, play audio, or receive sockets when backgrounded or screen-locked. POCKET is amended to **screen-on, face-down or held low, app foreground**, with `Taro.setKeepScreenOn` held for session duration; the ambient field is the POCKET signal surface.

### Dependencies
- DES long-leads: L1 pictogram set + L2/L3 micro-copy (S3/S8); mood-field token spec (S2). All strings pass copy 🔴 review.
- CDN pipeline discipline for any new pictogram/audio assets (manifest localPath existence + count verification; 404s must stay non-cacheable per the 2026-08-01 nginx lesson).
- Skill loads at implementation time per AGENTS.md §0: `social-icebreaker-domain`, `joyjoin-brand-guidelines`, `feature-flags-launch-config`, `llm-runtime-safety-and-integration` (S5c/S5d/S5e-rescue), plus `performance-audit` / `completeness-audit` gates per wave.
- Contract/regression suites to keep green or update per wave: `phaseViews.test.tsx`, `warmupAndPhaseLogic.test.ts`, `phaseAccents.test.ts`, `hostActionFlowContract.test.ts`, `miniscriptClientPathContract.test.ts`, `socialIcebreakerTransitions.test.ts`, bot-service tests, and both build-time guardrails (class coverage, subpackage styles).

### Risks
- **Per-phase wave churn (S3+S5):** mitigated by bundling conversions into the same wave per phase; each wave ships behind its flag and passes both gates independently.
- **Haptic fatigue / over-signaling:** grammar is deliberately sparse (Celebration "rare by design"); the field protocol includes annoyance observation; engineering owns minimum re-fire intervals.
- **Mid-iteration flag sprawl:** mitigated by the parent/child flag scheme and §10 ruling 10 — every flag registers a cleanup task at creation; flags are removed at full migration (`socialIcebreakerPhaseHeroEnabled` precedent).
- **Baseline-device regression:** every wave's Aesthetic Gate includes the 60fps Gen-Z-baseline check; the 2026-07-19 round's perf WARN (42/60) must be closed, not deepened — budgeted-glass discipline (static layers, transform/opacity-only) is the standing mitigation.
- **Venue WS reliability (S6):** unverified for this surface; staging field test before flag-on; graceful degradation to poll-fallback beats is automatic by design (ruling 6).

---

*Prepared per the Product Manager agent workflow; smallest-shippable scoping, explicit non-goals, and blocked-item labeling applied throughout. Slice 1 (S1) is approval-ready as written. Strategy rulings locked via grill-me session 2026-08-11 — see playbook §10.*

---

## 7. Flag Ledger (playbook §10 ruling 10 — cleanup tasks registered at creation)

Every uplift flag is born with its removal obligation. Cleanup = remove flag checks, delete dead pre-flag code paths, drop env entries, close the ledger row. Timing: at full migration of the flag's scope, following the `socialIcebreakerPhaseHeroEnabled` add-then-remove precedent.

| Flag | Env fallback | Default | Slice | Registered | Cleanup trigger | Cleanup task |
|------|-------------|---------|-------|-----------|-----------------|--------------|
| `icebreakerHapticGrammarEnabled` | `ICEBREAKER_HAPTIC_GRAMMAR_ENABLED` | `false` | S1 (+S7 rides it) | 2026-08-11 (sprint_20260811_ycr3ib) | Haptic grammar flag-on in production + stable through one full session cohort | Remove gate in `index.tsx` + `haptics.ts` social dispatch; drop `DEFAULT_FLAG_VALUES`/`FLAG_ENV_MAP`/`.env.example`/auth-features entries |
| `icebreakerMoodFieldEnabled` | `ICEBREAKER_MOOD_FIELD_ENABLED` | `false` | S2 | 2026-08-11 (sprint contract `s2-mood-fields`) | Mood field flag-on in production + Wave-3 squint protocol passed | Remove flag-off `page-warm-bg` fallback path + field gating in `index.tsx`; drop server/env/shared-type entries |
| `icebreakerGlanceStackEnabled` | `ICEBREAKER_GLANCE_STACK_ENABLED` | `false` | S3 (+S8 rides it) | not yet created | Full phase migration to L1/L2/L3 stack | Remove legacy 4-zone PhaseHeroCard path |
| `icebreakerZeroTypingEnabled` | `ICEBREAKER_ZERO_TYPING_ENABLED` | `false` | S5 parent (child kill switches for S5b/S5c) | not yet created | All keyboard conversions migrated | Remove legacy input paths per phase |
| `icebreakerGroupBeatsEnabled` | `ICEBREAKER_GROUP_BEATS_ENABLED` | `false` | S6 | not yet created | Beats flag-on + venue WS reliability proven | Keep poll fallback (it is the degradation path, not legacy); remove only the flag gate |
| `icebreakerAudioEnabled` | `ICEBREAKER_AUDIO_ENABLED` | `false` | S9 | not yet created | Audio flag-on (if S9 survives the cut line) | Remove flag gate; keep assets |
| `icebreakerGyroParallaxEnabled` | n/a (spike uses module-local constant) | `false` | S10 | not yet created — only register if spike ships | Spike ship decision (ruling 7 floors) | Strip dev jank harness, replace local constant with DB flag |
