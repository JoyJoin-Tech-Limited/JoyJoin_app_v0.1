/**
 * FU-03 — one anchor derivation shared by the on-demand group_mirror route and
 * the pre-generation worker.
 *
 * Before this module the two paths duplicated the same three lines
 * (`deriveTablePersona` → `resolveTableAnchorsForPrompt` → "no anchors when the
 * list is empty") with different error handling. The worker's copy was dead
 * code in practice (`startPreGenerationWorker()` has no caller), so the
 * duplication was latent rather than visible — and the pre-generated deck's
 * anchors were therefore never provably the same as the on-demand deck's.
 *
 * Keeping the derivation here means:
 * - the route and the worker cannot drift (one implementation, two callers);
 * - `deriveTablePersona` stays pure and still has exactly one anchor policy;
 * - the helper is total: it never throws, so no caller needs its own try/catch
 *   to keep a session playable.
 *
 * Authority (feature flag, host check, roster load) stays with the callers —
 * this module only answers "what anchors does this roster support?".
 */

import {
  deriveTablePersona,
  resolveTableAnchorsForPrompt,
  type TablePersona,
  type TablePersonaRoleResults,
  type TablePersonaRosterMember,
} from './tablePersona';

export interface TableAnchorResolution {
  /** Prompt-facing labels, at most `limit` (default 2). Empty when none. */
  anchors: string[];
  /** The full aggregate persona, or `null` when derivation failed. */
  persona: TablePersona | null;
  /** Derivation failure, or `null`. Callers log it with their own prefix. */
  error: Error | null;
}

/**
 * Derive prompt-facing table anchors from a roster projection.
 *
 * `roleResults` is optional ACOEXP enrichment: absent, empty, or thin coverage
 * falls back to the archetype composition inside `deriveTablePersona`. The
 * pre-generation worker never has trait rows (they are not in the enqueue
 * payload), so it passes none — that is a property of the seam, not a
 * behavioural difference, and the parity test asserts the anchors still match.
 */
export function deriveTableAnchorsForGeneration(params: {
  roster: ReadonlyArray<TablePersonaRosterMember>;
  roleResults?: TablePersonaRoleResults | null;
  limit?: number;
}): TableAnchorResolution {
  try {
    const persona = deriveTablePersona({
      roster: params.roster,
      roleResults: params.roleResults,
    });
    return {
      anchors: resolveTableAnchorsForPrompt(persona, params.limit),
      persona,
      error: null,
    };
  } catch (error) {
    return {
      anchors: [],
      persona: null,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
