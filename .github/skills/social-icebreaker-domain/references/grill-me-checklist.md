# Grill-Me — Social Icebreaker Domain

> Stress-test session state machine assumptions. One question per turn.
> Combinatorial state space is enormous — every edge must be defended.

## Session Lifecycle

Ask when touching session creation or join:

**Q1:** Walk me through: create → join → advance phases → bonus gate → recap → TTL expiry. Where's the rejoin path?
- Recommended: Rejoin uses `upsertParticipant`. Returns current session state. Idempotent — repeated rejoin is safe.

**Q2:** What happens if two users call `POST /start` simultaneously for the same group? Who becomes host?
- Recommended: Unique-constraint catch-and-resolve. First caller wins host. Second caller gets existing session with "already started" status.

**Q3:** Session expired (6h TTL). User tries to rejoin. What response do they get?
- Recommended: 410 SESSION_EXPIRED. Clear error message. No stale state returned.

## Host Authority

Ask when modifying phase control:

**Q4:** List every action the host can do that players cannot. Is host authority checked on every protected route?
- Recommended: Host: advance phase, generate content. Route checks `userId === state.hostUserId`. Fail-close: unauthorized → 403.

**Q5:** What happens if the host disconnects mid-session? Can anyone else advance? Is there host transfer?
- Recommended: Host transfer or auto-advance after timeout. Session doesn't deadlock. Documented host-recovery path.

**Q6:** Can the host advance past a phase that hasn't met its completion guard? What's the guard check?
- Recommended: Advance guard checks phase completion (all turns revealed, all statements generated, all lots closed). Guard rejected → 400 with reason.

## Phase State Machine

Ask when adding or reordering phases:

**Q7:** What's the full phase order? Are there any conditional phases (skipped for roster < 3, gated by feature flag)?
- Recommended: `PHASE_ORDER` defines linear sequence. `getNextEligiblePhase` skips ineligible phases (roster too small, flag off).

**Q8:** When leaving a phase, what ephemeral state gets cleaned up? What persists across phases?
- Recommended: `cleanupPhaseStateForNextPhase` scrubs phase-specific state (votes, bids, temporary selections). Session-level state persists.

**Q9:** What happens if the host rapidly advances through all phases? Is there rate limiting or cooldown?
- Recommended: Phase dwell time enforced (minimum time per phase). Rapid advance prevented.

## Bonus Gate

Ask when bonus gate is active:

**Q10:** Walk me through the bonus gate flow: eligible → offered → host responds → players vote → enter or skip. What if host declines?
- Recommended: Host declines → session proceeds to recap. No bonus phase. Players' sentiment votes logged but gate state is authoritative.

**Q11:** What if host accepts but 0 players vote "want"? Does the bonus still run?
- Recommended: Threshold check: majority want or host override. Documented quorum rules. Empty vote result → skip.

## AI Integration

Ask when AI generates content:

**Q12:** If the AI call times out (3s), what's the fallback? Empty state? Canned content?
- Recommended: Curated fallback content. `logAITrace` with `fallbackUsed: true`. User never sees empty/loading indefinitely.

**Q13:** Is any internal DB ID, `isLie` truth, or player secret leaked to the AI prompt or client state?
- Recommended: `sanitizeStateForClient` strips internal IDs and secrets. AI prompt uses archetype labels, not raw trait scores.

## Cross-Platform

Ask when changing session logic:

**Q14:** Is the mini-program `phaseViews.tsx` updated alongside any web registry changes?
- Recommended: Both registries updated. Mini-program is launch-primary — must not lag behind web.
