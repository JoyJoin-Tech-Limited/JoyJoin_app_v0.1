# Supervisor Smart Suggested Actions

**Author:** Workflow / Product Ops  
**Date:** April 20, 2026  
**Status:** Proposal for staged execution  
**Scope:** Define a runtime-scored next-action engine for Supervisor, a live signal matrix, and a future companion surface for dynamic clickable actions

> **Proposal only.** This document does not describe live Copilot behavior today.

## Relationship to earlier work

This builds on [`supervisor-turn-report-usability-bundle.md`](./supervisor-turn-report-usability-bundle.md). That proposal reduced noise in the visible note. This proposal focuses on choosing the right next action from live session evidence.

## First-principles frame

- **Mission:** make Supervisor recommend the smallest correct next move for the current session without flooding the VS Code action row.
- **Failure mode:** we reduce button count but still surface the wrong next action because changed files, failed checks, or stale planning context are ignored.
- **Critical path:** separate the decision engine from the transport. Copilot native handoff buttons are static; the runtime scorer must decide what matters and then project that into text now and a companion surface later.

## Hard constraints

1. Native Copilot handoff buttons come from static frontmatter and cannot be recomputed per turn.
2. Supervisor must not replace Auto-Eval, git hooks, or GitHub workflows.
3. Recommendations must prefer the narrowest truthful specialist and must not reopen kickoff unless ambiguity is real.
4. Operational truth stays in `.git/.orchestration/` and must be derived from persisted summaries, changed files, and cheap runtime evidence.
5. The worktree can contain multiple concurrent tracks; the engine must cluster them rather than flatten them into one noisy list.

## Decision

Keep the static native handoff row small. Move smartness into a runtime-scored `suggestNextActions(context)` engine. Surface the ranked results in three layers:

1. **Native buttons:** fixed small escape hatches only.
2. **Supervisor visible note:** dynamic `Routing (pick one)` list driven by the scorer.
3. **Future companion surface:** dynamic clickable actions grouped by track.

## 1. Proposed `suggestNextActions(context)` contract

### Context input

~~~ts
type TurnStatus = 'ready' | 'blocked' | 'done' | null;

type ActionTrackId =
  | 'orchestration'
  | 'mini-program-ui'
  | 'mini-program-docs'
  | 'backend'
  | 'product'
  | 'general';

interface MemoryLifecycleSummary {
  status: 'fresh' | 'caution' | 'stale' | 'conflicted' | string;
  cautionHitCount: number;
  staleHitCount: number;
  conflictHitCount: number;
  warningHitIds: string[];
}

interface SummaryStub {
  summaryId: string;
  agentName?: string;
  turnStatus: TurnStatus;
  done: string[];
  keyBullets?: string[];
  nextSteps?: {
    bugFix: string[];
    enhancement: string[];
    validation: string[];
  };
  utilization?: Array<{
    task: string;
    agents: string[];
    skills: string[];
  }>;
}

interface CheckSignal {
  id: string;
  label: string;
  status: 'passed' | 'failed' | 'blocked' | 'unknown';
  source: 'terminal' | 'artifact' | 'runtime';
  evidence: string[];
  relatedPaths: string[];
}

interface SuggestedActionContext {
  promptText: string | null;
  changedFiles: string[];
  recommendedNextAgents: string[];
  kickoff: {
    status: string;
    approvalMode: string | null;
    lastReason: string | null;
    recommendationIssued: boolean;
  };
  turnSummaryState: {
    recentAgentSummaries: Record<string, SummaryStub[]>;
    recentSupervisorReports: SummaryStub[];
  };
  memoryContext: {
    summary: string | null;
    lifecycle: MemoryLifecycleSummary | null;
  };
  checks: CheckSignal[];
}
~~~

### Candidate action output

~~~ts
type AgentName =
  | 'Researcher'
  | 'Planner'
  | 'Auto-Eval'
  | 'QA Agent'
  | 'debug'
  | 'Backend Engineer'
  | 'Product Manager'
  | 'Expert React Frontend Engineer'
  | 'Taro Mini-Program Frontend Engineer'
  | 'Verifier';

type ActionTransport = 'native-button' | 'routing-text' | 'companion-surface';

interface SuggestedAction {
  id: string;
  trackId: ActionTrackId;
  trackLabel: string;
  agent: AgentName | null;
  label: string;
  transport: ActionTransport;
  kind: 'route-agent' | 'rerun-check' | 'ask-user' | 'hold';
  score: number;
  confidence: number;
  rationale: string[];
  evidence: string[];
  sourceSignals: string[];
  modelHint: string | null;
  hiddenBecause: string[];
  blockedBy: string[];
}
~~~

### Required rules

1. The scorer must produce actions per track first, then rank globally. This stops orchestration work and app-debug work from collapsing into one misleading queue.
2. No transport may show more than the following defaults:
   - native buttons: 5 fixed actions max
   - routing text: 3 primary actions, 2 overflow actions max
   - companion surface: unlimited, but grouped by track
3. Actions with hard evidence beat actions based only on intent. A failing smoke result outranks a generic verification suggestion.
4. `Researcher` and `Planner` only score if the current context is ambiguous, stale, or contradicted by new findings.
5. `Auto-Eval` only outranks `QA Agent` when the next move is a deterministic local gate rather than flow validation.
6. `debug` only appears near the top when there is explicit failure evidence.
7. The scorer must deduplicate native-button labels from dynamic routing text. If the same action appears in both, routing text should explain why it is first, not restate the button.

### Scoring model

Use additive scoring with hard gates and penalties.

~~~text
finalScore =
  domainMatch
  + explicitFailureEvidence
  + explicitNextStepEvidence
  + changedFileConcentration
  + recentMomentum
  + promptIntentMatch
  + riskAdjustment
  - ambiguityPenalty
  - staleKnowledgePenalty
  - duplicateActionPenalty
  - missingPrerequisitePenalty
~~~

Recommended default weights:

| Signal | Default weight | Notes |
| --- | ---: | --- |
| Explicit failure evidence | +40 | Failed terminal, artifact, or runtime checks |
| Domain match to changed files | +30 | Matching path prefixes or owned surfaces |
| Explicit next step from recent summary | +25 | Pull from `nextSteps` or ready supervisor report |
| Prompt intent match | +15 | User asks for debug, verify, or plan |
| Recent momentum | +10 | Same track active in the last 1-2 summaries |
| Risk adjustment | +10 | Payments, auth, orchestration contract, release-risk |
| Memory caution or conflict | -10 | Penalize overconfidence, not the track itself |
| Duplicate native action | -8 | Prevent repeated clutter |
| Missing prerequisite | -25 | Example: verification before any implementation |
| Kickoff not warranted | -30 | Suppress Researcher or Planner when `lastReason` says narrow or already routed |

### Gating rules

| Action | Must be true | Must not be true |
| --- | --- | --- |
| `Route bug investigation` | There is failed evidence tied to a concrete surface | Only vague discomfort or style complaints |
| `Request focused verification` | A meaningful implementation exists and the next question is correctness | The main issue is still reproduction or root cause |
| `Route local quality gate` | Work is in a validate-now state or doc-only state with deterministic checks available | The main blocker is ambiguous scope |
| `Re-open discovery` | New evidence conflicts with the current understanding | The task is still bounded and already routed |
| `Re-plan execution` | Findings changed sequencing or ownership | The current plan remains valid and specific |

### Pseudocode

~~~ts
function suggestNextActions(context: SuggestedActionContext): SuggestedAction[] {
  const tracks = clusterChangedFiles(context.changedFiles, context.turnSummaryState, context.checks);
  const candidates = seedCandidatesPerTrack(tracks);

  for (const candidate of candidates) {
    candidate.score += scoreDomainMatch(candidate, context);
    candidate.score += scoreFailures(candidate, context.checks);
    candidate.score += scoreNextSteps(candidate, context.turnSummaryState);
    candidate.score += scorePromptIntent(candidate, context.promptText);
    candidate.score += scoreRisk(candidate, context.changedFiles);
    candidate.score -= scoreKickoffPenalty(candidate, context.kickoff);
    candidate.score -= scoreMemoryPenalty(candidate, context.memoryContext);
    candidate.score -= scoreDuplicatePenalty(candidate, candidates);
    candidate.score -= scorePrerequisitePenalty(candidate, context);
  }

  return candidates
    .filter(passHardGates)
    .sort(byScoreThenEvidenceThenTrackPriority)
    .map(addTransportHints);
}
~~~

## 2. Current session signal matrix

The live workspace shows three concurrent tracks. That is exactly the kind of session where naive global buttons become noisy.

### Track A: orchestration contract and Supervisor UX

Evidence from the current runtime context:

- changed files include `.github/ORCHESTRATION.md`, `.github/agents/README.md`, `.github/agents/manifest.json`, `.github/agents/supervisor.agent.md`, `.github/orchestration.yaml`, and `.github/skills/orchestration-turn-reporting/SKILL.md`
- `memoryContext.lifecycle.status` is `caution`
- `warningHitIds` includes `repo.orchestration.runtime-state-truthfulness`
- the caution exists because a changed authoritative path overlaps `.github/ORCHESTRATION.md`

Implication:

- This track is real and active.
- The engine should prefer truth-preserving verification before reopening discovery.
- Any recommendation that quotes repo memory should visibly note the conflict.

Suggested action impact:

| Signal | Action boost |
| --- | --- |
| Orchestration files changed | `Auto-Eval` +30, `QA Agent` +10, `Researcher` -20 |
| Memory conflict on authority path | `Re-open discovery` +5, `Auto-Eval` +5, overconfident text-only recommendations -10 |
| Previous work already reduced static buttons | `Re-plan execution` -15 unless fresh findings contradict that plan |

### Track B: mini-program matching-status regression investigation

Evidence from the current worktree and session artifacts:

- changed files include `apps/mini-program/src/pages/matching-status/index.tsx`, `matchingStatusViewModels.ts`, `useMatchingStatusController.ts`, related tests, `authState.ts`, and `api.ts`
- `tmp/mini_runtime/matching_reveal_smoke.result.5001.json` and `.5002.json` show `Connection.onMessage` failures
- `tmp/mini_runtime/matching_reveal_smoke.result.5003.json` gets past login and registration discovery, but times out waiting for pending matching-status selectors
- the latest terminal diagnostics therefore show reproduction evidence, not just suspected UI drift

Implication:

- The top action on this track should be `debug`, not `QA Agent`.
- `QA Agent` becomes correct only after the route or selector logic is fixed.
- `Researcher` and `Planner` should be heavily suppressed for this track because the issue is concrete and reproducible.

Suggested action impact:

| Signal | Action boost |
| --- | --- |
| Matching-status files changed | `debug` +30, `Taro Mini-Program Frontend Engineer` +20, `QA Agent` +10 |
| Failed smoke artifact | `debug` +40 |
| Selector timeout after successful auth | `debug` +15, `QA Agent` +5 |
| Reproduction already exists | `Researcher` -30, `Planner` -25 |

### Track C: mini-program documentation plan

Evidence from recent supervisor reports:

- `supervisor-report-mini-program-prd-plan-20260420` is `ready`
- the report already says the next enhancement is to author the new mini-program reference doc and then run verification
- the user's present ask is not about that document

Implication:

- This track should be visible as secondary momentum, not as the first suggested action.
- A good companion surface should still keep it available so it is not lost.

Suggested action impact:

| Signal | Action boost |
| --- | --- |
| Ready supervisor report with explicit enhancement | direct doc-delivery lane +25 |
| Present user intent unrelated to docs | direct doc-delivery lane -15 |
| Validation step already known | `Verifier` +10 for that track only |

### Suppressed actions from the current session

| Action | Why it should be suppressed now |
| --- | --- |
| `Re-open discovery` | kickoff state says `narrow-or-already-routed` |
| `Re-plan execution` | there is no fresh ambiguity in the smart-actions work itself |
| `Request focused verification` | verification is premature on the matching-status track because the failure is still live |

### Recommended ranked output for the current session

This is the kind of ranking the engine should produce now:

1. `debug — investigate pending matching-status selector timeout and automator instability`
   - score driver: direct failure evidence plus strong path ownership match
   - transport: routing text now, companion surface later
   - model hint: `GPT-5.4 xhigh`
2. `Auto-Eval — re-run local quality gate on orchestration surfaces once the current design pass settles`
   - score driver: authoritative orchestration paths are dirty and memory has a conflict warning
   - transport: native button remains valid, routing text should explain why it matters
   - model hint: `GPT-5.4 mini`
3. `Direct delivery — author the mini-program product reference doc from the approved plan`
   - score driver: recent `ready` supervisor report with explicit next step
   - transport: companion surface or overflow routing only
   - model hint: `GPT-5.4 xhigh`
4. `QA Agent — validate matching-status flow after the fix lands`
   - score driver: high value but blocked by current failure
   - transport: hidden until Track B stops failing
5. `Researcher` and `Planner`
   - hidden because there is no new ambiguity on the active tracks

### Key design consequence

The engine must show one lead action per track, not one flat list for the whole session. In the current session that means:

- Track A lead: validate orchestration truth
- Track B lead: debug matching-status failure
- Track C lead: execute the ready mini-program doc plan later

## 3. Companion surface design

### Near-term: no new UI, better dynamic routing text

Do first:

1. Add `suggestNextActions(context)` as a pure runtime function.
2. Feed its top 3 results into Supervisor `Routing (pick one)`.
3. Keep native buttons static and minimal.

Why this is the smallest proof:

- no new VS Code surface required
- no fight with the static handoff limitation
- immediately improves recommendation quality

### Mid-term: derived artifact for tooling

Write a derived advisory artifact under `.git/.orchestration/next-actions.json`.

Proposed shape:

~~~json
{
  "generatedAt": "2026-04-20T08:00:00.000Z",
  "sourceTurnId": "session:turn:2",
  "nativeButtonHints": [
    {
      "label": "Route bug investigation",
      "why": [
        "pending selector timeout reproduced",
        "matching-status files are dirty"
      ]
    }
  ],
  "tracks": [
    {
      "trackId": "mini-program-ui",
      "trackLabel": "Mini-program matching-status",
      "primaryActionId": "mini-program-ui.debug",
      "actions": []
    }
  ]
}
~~~

Reason for a separate file:

- it keeps derived recommendations separate from canonical turn summaries
- it can be regenerated cheaply
- future UI surfaces can consume it without mutating the stored operational truth

### Long-term: dynamic clickable companion surface

If truly dynamic buttons are required, build outside custom-agent frontmatter.

Recommended concept:

- a small companion surface that reads `.git/.orchestration/next-actions.json`
- group actions by track
- expose one primary button per track plus expandable secondary actions
- show evidence snippets and blockers inline
- launch the chosen agent or command with the generated brief

Good candidates:

1. VS Code webview or sidebar tree view
2. lightweight command palette entry that previews ranked next actions
3. dedicated orchestration output pane with action commands

Not recommended:

- exploding the Supervisor frontmatter handoff list again
- encoding dynamic state in static button labels
- replacing deterministic checks with chat-only advice

## Transport strategy

| Layer | Purpose | Limit |
| --- | --- | --- |
| Native buttons | fixed escape hatches | stay static, max 5 |
| Routing text | dynamic, high-signal ranked next actions | top 3 primary, 2 overflow |
| Companion surface | fully dynamic grouped actions | per track, expandable |

## Acceptance criteria

1. The same dirty session can produce separate primary actions for orchestration, app-debug, and docs tracks.
2. A reproducible failure always beats a generic verification suggestion.
3. `Researcher` and `Planner` do not resurface when kickoff is already settled.
4. Memory conflicts reduce confidence and add warnings; they do not silently disappear.
5. The native button row remains small even when the session contains many possible next actions.

## Smallest rollout

1. Implement a pure scorer and keep it read-only.
2. Render top results into Supervisor routing text.
3. Emit `.git/.orchestration/next-actions.json`.
4. Only then consider a true companion UI.

## Likely change areas

- `scripts/orchestration-supervisor.mjs`
- new runtime helper module under `scripts/`
- `.github/agents/supervisor.agent.md`
- `.github/skills/orchestration-turn-reporting/SKILL.md`
- a derived advisory artifact under `.git/.orchestration/`

## Open questions

1. Should the scorer read terminal evidence directly, or should failing checks first be normalized into a small `checks` ledger artifact?
2. Should the companion surface support manual dismissal per track, or should dismissal only happen through state changes such as a passing validation?
3. Should the dynamic routing list include model hints by default, or only for implementation-heavy actions?

## Recommendation

Treat smart suggested actions as a runtime scoring problem, not a frontmatter problem. The current static button reduction was necessary, but the next material gain comes from track-aware scoring backed by the live orchestration state and failure evidence.
