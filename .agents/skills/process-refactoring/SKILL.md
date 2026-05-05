# Skill: Refactoring Discipline

Apply safe, incremental refactoring patterns when restructuring code without changing behavior.

## When to Use

- Extracting functions, modules, or services from monolithic files
- Renaming identifiers across multiple files
- Replacing legacy patterns with modern equivalents (e.g., callback → async/await)
- Splitting a large component into smaller ones
- Migrating imports from one package to another

## Core Principles

1. **Behavior preservation**: The public contract must not change unless explicitly required.
2. **Incremental commits**: Each step should be independently reviewable and reversible.
3. **Type safety**: TypeScript must pass after each increment. Do not accumulate type errors.
4. **Test safety**: Existing tests must pass. Add characterization tests before refactoring if coverage is thin.
5. **One concern at a time**: Do not mix refactoring with feature work in the same commit.

## Protocol

### Step 1: Establish a Safety Net
- Run existing tests and note baseline.
- If coverage is thin for the code being refactored, add characterization tests first.
- For purely mechanical refactors (rename, move), tests may suffice as the safety net.

### Step 2: Plan the Refactor
- State the current state, desired state, and the minimal sequence of steps.
- Identify all files that will change.
- Identify callers that will need import updates.
- If cross-workspace, flag for `platform-coordination-protocol` review.

### Step 3: Execute Incrementally
- Make one logical change at a time.
- Run typecheck after each file group.
- Run tests after each significant boundary.
- If a step breaks tests, revert and reconsider.

### Step 4: Verify No Regression
- Run full test suite for affected workspaces.
- Run guardrails (`npm run guardrails`) to catch cross-workspace import violations.
- Verify no dead code was left behind.

### Step 5: Document the Change
- Update `AGENTS.md` or relevant docs if architectural conventions changed.
- Update orchestration or skill files if agent/skill contracts changed.
- Add a note to the turn summary about the refactoring scope.

## Anti-Patterns to Avoid

- **Big-bang rewrite**: Do not refactor an entire module in one shot without intermediate green states.
- **Refactor + feature mixing**: Never add behavior during a refactor pass. If you find a bug, note it and fix separately.
- **Type error accumulation**: Do not proceed to the next file while the previous file has type errors.
- **Undeclared breaking changes**: If a public interface must change, document it and update all callers in the same PR.
- **Leaving dead code**: Remove the old implementation after the new one is verified. Do not leave commented-out legacy blocks.

## Output Format

End your turn with:
- What was refactored and why
- Files changed
- Whether tests pass
- Whether typecheck passes
- Any remaining technical debt or follow-up

## Related Files

- `.github/skills/process-test-first/SKILL.md` — when adding characterization tests before refactoring
- `.github/skills/process-systematic-debugging/SKILL.md` — if the refactor exposes unexpected behavior
- `.github/skills/monorepo-workspace-governance/SKILL.md` — when moving code between workspaces
