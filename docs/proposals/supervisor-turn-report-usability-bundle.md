# Supervisor Turn Report Usability Bundle

**Author:** Workflow / Product Ops  
**Date:** April 17, 2026  
**Status:** Proposal for later bundled execution  
**Scope:** Make Supervisor turn reports shorter, clearer, and less repetitive without weakening auditability

> **Proposal only.** This document saves a future bundled improvement pass. It does not describe live behavior today.

## Problem statement

Supervisor turn reports currently do two jobs at once: they summarize what happened and they try to guide the next step. That often makes completed turns still feel like they are asking to continue, which creates noise and makes it harder to tell whether anything is actually waiting on the user.

## Current pain points

1. There is no strong, obvious Done ending.
2. Proceed-style guidance can appear even when no real decision is needed.
3. The next step does not always say who acts next.
4. Too many small internal hops can create too many visible notes.
5. Plain-language wording is not consistent enough for non-technical readers.

## Proposed bundle

### 1. Add a clear status at the top

Every visible Supervisor note should start with one simple state:

- Done
- Waiting on you
- Blocked

This should make it obvious whether the workflow has finished, needs user input, or is stalled.

### 2. Only ask to continue when it matters

Proceed or similar continue guidance should appear only when:

- the user needs to answer something
- the next agent choice needs approval
- a real blocker changed the route

If the work is complete, the note should end with Done and stop there.

### 3. Make the next step owned and concrete

When work is not complete, the note should say who acts next and what they do in one short sentence.

Good example:

- Next: QA Agent runs the smoke checklist.

Avoid vague endings that sound like general momentum instead of a real next move.

### 4. Save helper completion before Supervisor responds

If a helper agent finishes work, its final summary should be stored before Supervisor writes the visible note. That reduces repeated handoff prompts caused by missing completion state.

### 5. Merge tiny internal hops into one visible note

If several small routing or validation steps happen without needing a user decision, bundle them into one visible update instead of showing each hop as a separate turn report.

### 6. Keep the visible note plain and short

The visible note should stay readable in one screen and avoid workflow jargon. The stored JSON can remain detailed, but the human-facing note should stay simple.

### 7. Use three short templates

Create and standardize these visible-note templates:

1. Done
2. Needs your input
3. Blocked

That will keep wording more consistent and easier to scan.

## Non-goals

1. Replacing Auto-Eval, hooks, or other deterministic checks.
2. Changing the stored JSON facts for turn summaries.
3. Hiding blockers or reducing auditability.
4. Turning Supervisor into an implementation agent by default.

## Acceptance criteria for later implementation

1. Completed turns show Done and do not ask the user to proceed.
2. Continue guidance appears only when user input or a real routing choice is needed.
3. Every unfinished note names the next owner.
4. Visible notes fit on one laptop screen without scrolling.
5. Stored summaries stay truthful to the current turn.

## Likely change areas

- .github/skills/orchestration-turn-reporting/SKILL.md
- .github/agents/supervisor.agent.md
- .github/orchestration.yaml
- scripts/orchestration-supervisor.mjs

## Suggested rollout order

1. Add the clear status marker and the three short templates.
2. Suppress unnecessary Proceed wording after completed turns.
3. Require saved helper completion before Supervisor responds.
4. Batch small internal hops into one visible note.
