# MiniScript (迷你剧本杀) — Interactive Gameplay UX v1 PRD

> Product Manager deliverable for Phase C/D/E implementation handoff.  
> Author: Product Manager (JoyJoin)  
> Date: 2026-04-24  
> Status: Review-ready → Harness Runtime Controller deliberation

---

## 1. Problem Statement

The current `MiniScriptPhaseView` (mini-program + web) is a **static script reader**. It dumps the entire v2 story framework — premise, all characters with secrets exposed, all act beats, all clues, and the ending — onto every player's screen simultaneously. There is no gameplay loop.

**Why this fails:**
- **Zero dramatic tension.** Every player knows every character's secret, every clue, and the resolution before anyone speaks.
- **No structured play.** The group has no guidance on how to progress through the story together.
- **Wasted v2 framework.** `clues[]` with `revealedInAct`, `playerKnowledge[]`, `solution`, and `gameModeConfig` exist in the data model but are ignored by the UI.
- **Anti-social UX.** Players stare at long scrollable text instead of looking at each other and role-playing.
- **Host has no tools.** The host can only click "进入回顾" (Go to Recap). There is no way to pace the experience.

**The fix:** Transform MiniScript from a static reader into a **host-driven, act-based interactive storytelling engine** where each player holds a private role card, clues reveal progressively, and the solution remains a server-secret until the host chooses to unveil it.

---

## 2. Goals and Non-Goals

### Goals
| # | Goal | Priority |
|---|------|----------|
| G1 | Each player sees **only their own role card** (not others' secrets) | P0 |
| G2 | Clues reveal **progressively per act**, tied to host-driven act advancement | P0 |
| G3 | The **solution remains server-secret** until host explicitly reveals it | P0 |
| G4 | Host controls **act-by-act pacing** with clear CTA states | P0 |
| G5 | Support **light_reasoning** and **absurd_comedy** genres in v1 with a unified engine | P0 |
| G6 | Recap phase captures MiniScript participation for AI summary | P1 |
| G7 | Web parity maintained (registries stay in sync) | P1 |

### Non-Goals
| # | Non-Goal | Rationale |
|---|----------|-----------|
| NG1 | Automatic/timer-based act advancement | Too stressful for a social icebreaker; host-driven keeps it conversational |
| NG2 | Complex scoring, competitive leaderboards, or "winner takes all" | Icebreakers are cooperative; competitive mechanics create social friction |
| NG3 | In-app note-taking, deduction boards, or chat threads | Out of scope; players talk face-to-face |
| NG4 | Audio, video, AR, or animated cutscenes | Massive scope expansion; text + static assets only |
| NG5 | Cross-session persistence of frameworks | Frameworks are ephemeral per event session |
| NG6 | Player-initiated re-rolls or role trades after assignment | Adds complexity; host can regenerate the entire framework if needed |

### Non-Negotiable Constraints
1. **Mini-program first.** Taro `phaseViews.tsx` owns the canonical UX; web registry mirrors it.
2. **Host owns transitions; players own self-state.** Consistent with warmup, lie_detective, auction, and personality_dice.
3. **Server owns all secrets.** `solution`, `playerKnowledge[].secretAgenda`, and `redHerrings` truth status never leak to clients.
4. **4–6 player roster gate.** Enforced at generation (`POST /api/miniscript/generate`) and at game start.
5. **JSONB state storage.** All gameplay state lives in `social_icebreaker_sessions.state_json` (no new tables for v1).
6. **3-second poll sync.** Clients poll `GET /api/social-icebreaker/:id`; no WebSocket rewrite.
7. **Maximum 4 acts, target 10–15 minutes.** The engine must not drag.

---

## 3. User Stories / Main Flow

### Story Map

```
SETUP → ROLE_ASSIGNMENT → PREMISE → ACT_1 → ACT_2 → ... → ACT_N → RESOLUTION → RECAP
```

### US-1: Host generates and starts the game
> As a host, I want to generate a script and then start the game so that players receive role assignments and we can play through acts together.

**Flow:**
1. Host opens `MiniScriptConfigModal`, selects style + genre(s), clicks **生成剧本**.
2. Server calls `POST /api/miniscript/generate`. Framework stored in `miniScriptFramework`.
3. Host sees a **"开始游戏"** (Start Game) CTA in the phase view.
4. Host clicks **"开始游戏"**. Server:
   - Validates `playerCount >= 4` and `playerCount === framework.characters.length`.
   - Shuffles participant `userId`s and assigns each to a `slotIndex` (0..playerCount-1).
   - Stores `miniScriptPlayerAssignments: Record<string, number>` (userId → slotIndex).
   - Sets `miniScriptCurrentAct: 0` (premise view).
   - Sets `miniScriptGameState: 'playing'`.
   - Sets `miniScriptActsCompleted: 0`.
5. All clients see the updated state on next poll.

**Edge case:** If a player joins after step 4, they become an **observer** (no role card, can see premise + current act publicly). Observers do not block advancement.

### US-2: Player discovers their role
> As a player, I want to see only my character's information so that I can role-play without knowing others' secrets.

**Flow:**
1. Player opens MiniScript phase. Since `miniScriptCurrentAct === 0`, they see:
   - **Public panel:** Premise, style/genre badges, group roster with role labels (but NOT secrets).
   - **My Role Card** (collapsible or tab):
     - `roleLabel` (from `characters[slotIndex]`)
     - `sinHook`
     - `alibi`
     - `knownFacts` (from `playerKnowledge[slotIndex]`)
2. The role card does NOT show:
   - Other players' `secret`, `alibi`, or `sinHook`
   - `solution`
   - `deductionChain`
   - `secretAgenda` (v1: hidden agendas out of scope)

**Server contract:** `buildClientState` must filter the framework so each participant receives only:
- Public: `premise`, `style`, `genres`, `act_flow[].title` (titles only, no beats yet), `characters[].roleLabel` (names only, no secrets), `clues[]` filtered by `revealedInAct <= miniScriptCurrentAct`
- Private: `playerKnowledge` entry matching their assigned `slotIndex` (minus `secretAgenda` for v1)

### US-3: Host advances through acts
> As a host, I want to open acts at our group's pace so that we can spend more time on interesting moments.

**Flow:**
1. When `miniScriptCurrentAct === 0`, host sees **"开启第一幕"** (Open Act 1).
2. Host clicks. Server:
   - Increments `miniScriptCurrentAct` to `1`.
   - Reveals clues where `clue.revealedInAct === 1`.
3. All players see:
   - **Act panel:** `act_flow[0].title` + beats.
   - **Clue panel:** Newly revealed clues for this act.
   - **My Role Card:** Still accessible (unchanged).
4. Group role-plays and discusses face-to-face.
5. When ready, host sees **"进入下一幕"** (Next Act) or, if last act, **"揭晓真相"** (Reveal Truth).
6. Repeat until all acts complete.

**Act boundary UX:**
- Between acts, there is no mandatory timer or vote. The host decides when the group is ready.
- A subtle helper text shows: "主持人可随时推进下一幕" (Host can advance anytime).

### US-4: Player experiences progressive clue reveals
> As a player, I want to see newly revealed clues when an act starts so that the mystery unfolds progressively.

**Flow:**
1. When an act advances, the clue panel updates with clues whose `revealedInAct === miniScriptCurrentAct`.
2. Previously revealed clues remain visible (cumulative).
3. Each clue shows:
   - `text`
   - A "新线索" badge if revealed in this act
4. `redHerrings` are treated as ordinary clues in v1 (their "misleading" nature is narrative, not mechanical).

### US-5: Host reveals the solution
> As a host, I want to reveal the solution when we're ready so that we get the dramatic payoff.

**Flow:**
1. After the final act (`miniScriptCurrentAct === act_flow.length`), the host sees **"揭晓真相"** (Reveal Truth).
2. Host clicks. Server:
   - Sets `miniScriptSolutionRevealed: true`.
   - Sets `miniScriptGameState: 'resolved'`.
3. All players see:
   - **Solution card:** `solution.who`, `solution.what`, `solution.why`
   - **Resolution summary:** `ending.resolutionSummary`
   - **Confession mechanic:** `ending.confessionMechanic`
4. Host then sees **"进入回顾"** (Go to Recap) to advance the session to `recap` phase.

**Fail-open:** If the host wants to skip to recap before revealing, they can. The recap will note that the solution was not revealed.

### US-6: Player sees the recap
> As a player, I want to see a recap of what happened so that we can laugh about it together.

**Flow:**
1. Session advances to `recap` phase.
2. Recap includes:
   - Premise one-liner (from `buildMiniScriptRecapLine`, already exists)
   - Which roles each player played (from `miniScriptPlayerAssignments`)
   - Whether the solution was revealed
3. If solution was revealed, AI recap can mention the twist.

---

## 4. Gameplay State Machine (Detailed)

```
                    +------------------+
                    |      SETUP       |
                    | (framework null) |
                    +--------+---------+
                             | Host generates
                             v
              +--------------+-------------+
              |     FRAMEWORK_READY        |
              | (framework exists,         |
              |  gameState === 'setup')    |
              +--------------+-------------+
                             | Host clicks "开始游戏"
                             v
         +-------------------+-------------------+
         |            ROLE_ASSIGNMENT            |
         |  (assignments created, currentAct=0)  |
         +-------------------+-------------------+
                             |
                             v
+----------------------------------------------------------+
|                      PLAYING (act-based)                 |
|  currentAct = 1..N                                       |
|  For each act:                                           |
|    - Show act beats                                      |
|    - Reveal clues where revealedInAct == currentAct      |
|    - Host CTA: "Next Act" or "Reveal Truth" (final)      |
+----------------------------------------------------------+
                             |
              +--------------+--------------+
              |                             |
              v                             v
    +-------------------+       +-------------------+
    |     RESOLVED      |       |   SKIPPED_TO_RECAP|
    |solutionRevealed=true|      | (host bypassed)   |
    +--------+----------+       +--------+----------+
             |                           |
             +------------+--------------+
                          v
                   +------------+
                   |   RECAP    |
                   +------------+
```

### State Fields (new, to add to `SocialSessionState`)

```typescript
// MiniScript gameplay state (v1)
miniScriptPlayerAssignments?: Record<string, number>; // userId -> slotIndex
miniScriptCurrentAct?: number; // 0 = premise, 1..N = acts
miniScriptGameState?: 'setup' | 'playing' | 'resolved';
miniScriptSolutionRevealed?: boolean;
miniScriptActsCompleted?: number; // how many acts were actually opened
```

### Genre Behavior in v1

| Genre | `gameModeConfig.votingStyle` | Hidden Agendas Shown? | Resolution Mechanics (v1) |
|-------|------------------------------|----------------------|---------------------------|
| `light_reasoning` | `consensus` | No | Host clicks "揭晓真相" → solution revealed to all. No formal vote. Group discusses and host decides when to reveal. |
| `absurd_comedy` | `none` | No | Host clicks "故事讲完了" (Story Complete) → no solution reveal. Session ends cooperatively. |
| `thriller_mystery` | `accusation` | **No (v2)** | **Out of v1 scope.** Config modal should show a "即将上线" badge or be filtered out. |
| `romance` | `consensus` | **No (v2)** | **Out of v1 scope.** Config modal should show a "即将上线" badge or be filtered out. |

**Product decision:** For v1, the config modal should **allow selecting all genres** (the generation pipeline already supports them), but the gameplay engine treats `thriller_mystery` and `romance` the same as `light_reasoning` for resolution. The genre primarily affects the **generated content tone**, not the engine mechanics. However, to set correct user expectations, we should either:
- **Option A:** Filter the genre picker to `light_reasoning` + `absurd_comedy` only for v1.
- **Option B:** Allow all 4 but show "Beta — 简化版" badge on `thriller_mystery` and `romance`.

**Recommendation: Option A** — filter the picker. This prevents disappointed users who expect a traitor mechanic and don't get one. We add the other genres back when v2 hidden-agenda mechanics ship.

### Role Assignment Algorithm

```typescript
function assignRoles(participants: string[], characterCount: number): Record<string, number> {
  if (participants.length !== characterCount) {
    throw new Error('Roster size must match character count');
  }
  // Fisher-Yates shuffle of slot indices
  const slots = Array.from({ length: characterCount }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const assignments: Record<string, number> = {};
  participants.forEach((userId, idx) => {
    assignments[userId] = slots[idx]!;
  });
  return assignments;
}
```

### Per-Player State Filtering (Server)

In `buildClientState` or a new `buildMiniScriptClientState` helper:

```typescript
function filterFrameworkForPlayer(
  framework: MiniScriptStoryFramework,
  assignments: Record<string, number>,
  currentAct: number,
  viewerUserId: string,
): PlayerVisibleFramework {
  const mySlot = assignments[viewerUserId];
  const isObserver = mySlot === undefined;

  return {
    // Public
    schemaVersion: framework.schemaVersion,
    style: framework.style,
    genres: framework.genres,
    premise: framework.premise,
    gameModeConfig: framework.gameModeConfig,
    characters: framework.characters.map((c) => ({
      slotIndex: c.slotIndex,
      roleLabel: c.roleLabel,
      // Secrets stripped
    })),
    act_flow: framework.act_flow
      .filter((a) => a.actNumber <= currentAct)
      .map((a) => ({
        actNumber: a.actNumber,
        title: a.title,
        beats: a.beats, // beats revealed for current/past acts
      })),
    clues: framework.clues.filter((c) => c.revealedInAct <= currentAct),
    // Player-private
    myRole: isObserver ? null : {
      slotIndex: mySlot,
      roleLabel: framework.characters[mySlot]!.roleLabel,
      sinHook: framework.characters[mySlot]!.sinHook,
      alibi: framework.characters[mySlot]!.alibi,
      knownFacts: framework.playerKnowledge[mySlot]?.knownFacts ?? [],
      // secretAgenda intentionally omitted for v1
    },
    // Secrets never sent
    solution: undefined,
    playerKnowledge: undefined,
    redHerrings: undefined,
    deductionChain: undefined,
    ending: undefined, // only revealed in resolution
  };
}
```

---

5. Acceptance Criteria for Minimum Shippable Slice

### A. Setup & Generation
- [ ] Host can open `MiniScriptConfigModal` and select style + genre(s).
- [ ] `POST /api/miniscript/generate` succeeds and stores v2 framework.
- [ ] Config modal genre picker shows only `light_reasoning` and `absurd_comedy` in v1.
- [ ] Idempotent: regenerating returns cached framework.

### B. Role Assignment
- [ ] After generation, host sees **"开始游戏"** CTA.
- [ ] Clicking **"开始游戏"** assigns every participant a unique `slotIndex`.
- [ ] Each player sees their own role card with `roleLabel`, `sinHook`, `alibi`, `knownFacts`.
- [ ] No player sees another player's `sinHook`, `alibi`, `secret`, or `knownFacts`.
- [ ] Observer players (joined after start) see premise + acts but no role card.

### C. Act Progression
- [ ] Host sees act-advance CTA appropriate to current state:
  - `currentAct === 0`: **"开启第一幕"**
  - `currentAct < actCount`: **"进入下一幕"**
  - `currentAct === actCount`: **"揭晓真相"** (light_reasoning) or **"故事讲完了"** (absurd_comedy)
- [ ] Clicking advance increments `miniScriptCurrentAct`.
- [ ] Players see beats for the newly opened act.
- [ ] Players see clues where `revealedInAct === miniScriptCurrentAct`.
- [ ] Previously revealed clues remain visible.

### D. Resolution
- [ ] For `light_reasoning`: host clicks **"揭晓真相"** → all players see `solution` + `ending`.
- [ ] For `absurd_comedy`: host clicks **"故事讲完了"** → session ends without solution reveal.
- [ ] After resolution, host sees **"进入回顾"** to advance to recap.
- [ ] `sanitizeStateForClient` never leaks `solution`, `playerKnowledge`, `deductionChain`.

### E. Advance Guard
- [ ] Session can advance from `mini_script` to `recap` only if `miniScriptFramework` exists (current rule).
- [ ] If `miniScriptCurrentAct === 0` (game never started), host sees a Xiaoyue nudge: "你们还没开始剧本，确定要跳过吗？"
- [ ] Host can still force-advance (fail-open).

### F. Cleanup
- [ ] `cleanupPhaseStateForNextPhase` scrubs `miniScriptPlayerAssignments`, `miniScriptCurrentAct`, `miniScriptGameState`, `miniScriptSolutionRevealed`, `miniScriptActsCompleted` when leaving `mini_script`.
- [ ] `miniScriptFramework` is also scrubbed (existing behavior).

### G. Cross-Platform
- [ ] Mini-program `phaseViews.tsx` `MiniScriptPhaseView` implements the new interactive flow.
- [ ] Web `socialIcebreakerPhaseRegistry.tsx` `MiniScriptPhasePanel` implements parity.
- [ ] Both surfaces use the same state contract.

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Phase completion rate** | ≥ 70% of MiniScript sessions reach `recap` | `completedPhases.includes('mini_script')` in session DB |
| **Average acts opened** | ≥ 2.5 acts per session | `miniScriptActsCompleted` field |
| **Time-in-phase** | 10–20 min median | `phaseStartedAt` → advance timestamp |
| **Role card view rate** | ≥ 85% of players open their role card | Client-side analytics event `miniscript_role_card_viewed` |
| **Host starts game rate** | ≥ 80% of generated frameworks lead to "开始游戏" | `miniScriptCurrentAct > 0` after generation |
| **Qualitative: "just a reader" complaints** | Zero in first 2 weeks of ship | Support tickets / user feedback |
| **Recap quality score** | MiniScript mentioned in ≥ 60% of recaps where played | AI recap output analysis |

---

## 7. Dependencies, Open Questions, and Risks

### Dependencies
| # | Dependency | Owner | Blocking? |
|---|-----------|-------|-----------|
| D1 | Add 4 new fields to `SocialSessionState` + Zod/TS types | Backend | Yes |
| D2 | New routes: `POST .../miniscript/start`, `POST .../miniscript/next-act`, `POST .../miniscript/reveal` (or generic act-advance route) | Backend | Yes |
| D3 | Update `buildClientState` / `sanitizeStateForClient` to per-player framework filtering | Backend | Yes |
| D4 | Update `MiniScriptPhaseView` (Taro) with role card, act panel, clue panel, host CTAs | Mini-program FE | Yes |
| D5 | Update `MiniScriptPhasePanel` (Web) with parity | Web FE | Yes |
| D6 | Update `cleanupPhaseStateForNextPhase` to scrub new fields | Backend | Yes |
| D7 | Add `miniScriptActsCompleted` and `miniScriptSolutionRevealed` to recap data passed to AI summarizer | Backend | No |
| D8 | UX copy review for role card, act transitions, and resolution screens | Product/Design | No |

### Open Questions
1. **Q: Should the config modal allow multi-genre selection in v1?**  
   - Current behavior: multi-select with config merging.  
   - **Recommendation:** Keep multi-select but if any selected genre is `thriller_mystery` or `romance`, show a warning: "惊悚悬疑/浪漫爱情题材目前为轻量版，不含隐藏身份机制。" This lets us use the generation pipeline as-is while setting expectations.

2. **Q: What happens if the host leaves mid-game?**  
   - **Recommendation:** No host-transfer in v1. If host is inactive for > 5 min, Xiaoyue suggests creating a new session. (Consistent with other phases.)

3. **Q: Should acts have suggested time budgets shown to the host?**  
   - **Recommendation:** Yes. Show a subtle timer badge: "建议 3–4 分钟" per act, based on `targetPlayMinutes / actCount`. Host can ignore it.

4. **Q: Do we show `redHerrings` differently from real clues?**  
   - **Recommendation:** No in v1. Both render as "线索". The misdirection is narrative (the text itself is misleading), not UI-flagged. Flagging it would defeat the purpose.

5. **Q: How do we handle the `characters.length !== playerCount` edge case?**  
   - **Recommendation:** The generation API already validates `playerCount`. At `start`, re-validate. If mismatch, show host an error: "玩家人数与剧本角色数不匹配，请重新生成。"

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **R1: Per-player state filtering is complex and may leak secrets if bugged** | Medium | Critical | Code review with `lie-detective-icebreaker` secrecy patterns as reference. Add invariant test: `solution` and `playerKnowledge` must never appear in client state JSON. |
| **R2: Screen real estate on mini-program is too small for role card + act + clues** | Medium | High | Design role card as a bottom-sheet or collapsible panel. Keep act beats ≤ 3 per act visible at once. |
| **R3: Players find phone-reading anti-social** | Medium | Medium | Keep text bites small (< 120 chars per beat). Encourage players to put phones down after reading. Use "朗读完请抬头看大家" micro-copy. |
| **R4: Host doesn't understand when to advance** | Low | Medium | Add Xiaoyue adaptive coaching for mini_script: "大家讨论得差不多了，可以开启下一幕" |
| **R5: v1 scope creep into hidden-agenda mechanics** | High | High | Explicitly gate `thriller_mystery` and `romance` in config UI. Document v2 plan. |

---

## 8. Comparison to Existing Phases

| Phase | Core Pattern | MiniScript Parallel |
|-------|-------------|---------------------|
| **Lie Detective** | Turn-based per player; host advances `currentLieDetectivePlayerIndex`; auto-reveal when all votes in | Act-based; host advances `miniScriptCurrentAct`; clues auto-reveal per act |
| **Personality Dice** | Host generates roster-sized challenges; players complete sequentially; auto-advance index | Host generates framework; all players participate simultaneously in each act |
| **Auction** | Host generates lots; host closes each lot one-by-one; advance guard = all lots closed | Host generates script; host advances acts one-by-one; advance guard = lenient (framework exists) |
| **Topic Cards** | Host picks mood; topic cards generate; players ready-up; host next-topic | Host picks style/genre; framework generates; host starts game; host next-act |

**Key insight:** MiniScript v1 is structurally closest to **Auction** (host closes lots one by one → host opens acts one by one) combined with **Lie Detective** secrecy (server hides truth until reveal moment).

---

## 9. v2 Roadmap (Out of Scope, Documented)

| Feature | Genre | Description |
|---------|-------|-------------|
| Hidden agendas | `thriller_mystery`, `romance` | `secretAgenda` delivered per-player. Requires `playerKnowledge` secrecy layer. |
| Accusation voting | `thriller_mystery` | Players vote on who they think the traitor is. Server tallies votes before solution reveal. |
| Pair matching | `romance` | Players submit which two characters they think should be paired. Server reveals true pairings. |
| Score keeping | All | Track "closest guess" or "best actor". Add medals in recap. |
| Player notes | All | Optional private notepad per player to track clues (stored in state_json). |

---

## 10. Implementation Handoff Checklist

For the Harness Runtime Controller deliberation, the following are **decision-ready**:

- [x] Gameplay state machine defined (SETUP → ROLE_ASSIGNMENT → ACT_1..N → RESOLUTION → RECAP)
- [x] Host vs player authority boundaries specified
- [x] Server secrecy contract specified (what gets filtered in `buildClientState`)
- [x] New session state fields listed (`miniScriptPlayerAssignments`, `miniScriptCurrentAct`, `miniScriptGameState`, `miniScriptSolutionRevealed`, `miniScriptActsCompleted`)
- [x] New API routes identified (`/miniscript/start`, `/miniscript/next-act`, `/miniscript/reveal`)
- [x] Genre scope for v1 decided (`light_reasoning` + `absurd_comedy`)
- [x] Advance guard rules specified
- [x] Cleanup rules specified
- [x] Mini-program first, web parity required
- [x] Acceptance criteria are testable
- [x] Risks and mitigations documented

**What the deliberation should resolve:**
1. Exact REST route naming and payload shapes.
2. Whether to reuse `POST /advance` for act transitions or create dedicated routes.
3. UI component architecture for the role card (bottom sheet vs inline tab).
4. Whether to add a new `miniscript_player_secrets` DB table (like `social_icebreaker_lie_truths`) or keep secrets in `state_json` with server-side filtering.
5. Test strategy for secrecy invariants.

---

*End of PRD.*
