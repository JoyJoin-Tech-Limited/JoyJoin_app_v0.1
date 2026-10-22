/**
 * E9 UGC 举报闭环 (sprint e9-ugc-report, contract AC-01/AC-02/SEC-02) —
 * server-side snapshot of the reported user content, taken at report time
 * from the live session state / participants roster.
 *
 * Design constraints (locked by the sprint contract):
 *  - EVIDENCE IS NEVER FILTERED (G4): the snapshot text is copied verbatim
 *    into `reports.description`. Running it through the content filter would
 *    let the platform's own moderation reject the report and destroy the
 *    evidence. Only the reporter's free-text note is gated (route layer).
 *  - SEC-02: the snapshot extracts ONLY user-visible text fields. Server
 *    secrets (lieDetective isLie/is_ai/source_tag, miniscript evidence
 *    reactions/solutions, …) are never read here — `lieStatement` picks
 *    `.text` only, even if a legacy runtime row still carries `isLie`.
 *  - AC-02 degradation: when the content is gone (phase cleanup on advance,
 *    session TTL sweep) the caller stores metadata-only descriptions marked
 *    「内容已过期」 instead of failing the report.
 */
import type { SocialSessionState } from '@shared/socialIcebreaker';
import type { UgcContentRef } from '@shared/api';

export interface IcebreakerUgcSnapshot {
  found: boolean;
  /** Raw user-generated text — UNFILTERED by design (G4 evidence integrity). */
  text?: string;
  /** Locating context for the admin queue (promptId / round / statement index). */
  locator?: Record<string, string | number>;
}

export const ICEBREAKER_UGC_DESCRIPTION_MAX = 2000;

/** Machine-parseable description prefix (contract AC-09 / OBS-01). */
export const ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE = /^\[icebreaker:([a-z_]{1,32})\]/;

type ParticipantLike = { userId: string; displayName: string };

/**
 * Pick the entry the reporter most likely long-pressed: an explicit locator
 * (promptId/round/index) wins; otherwise the author's LATEST matching entry
 * (recency = the one still on screen).
 */
function pickLatest<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

export function snapshotIcebreakerUgc(
  state: SocialSessionState | null,
  participants: ReadonlyArray<ParticipantLike>,
  contentRef: UgcContentRef,
  targetUserId: string,
): IcebreakerUgcSnapshot {
  if (!state) return { found: false };

  switch (contentRef.kind) {
    case 'quipAnswer': {
      const answers = (state.quipBattleAnswers ?? []).filter(
        (a) => a.userId === targetUserId && (!contentRef.promptId || a.promptId === contentRef.promptId),
      );
      const picked =
        contentRef.index !== undefined && contentRef.index < answers.length
          ? answers[contentRef.index]
          : pickLatest(answers);
      if (!picked?.answerText) return { found: false };
      return {
        found: true,
        text: picked.answerText,
        locator: { promptId: picked.promptId },
      };
    }

    case 'undercoverDescription': {
      const rounds = state.undercoverWordRounds ?? [];
      const matches: Array<{ text: string; roundNumber: number }> = [];
      for (const round of rounds) {
        if (contentRef.round !== undefined && round.roundNumber !== contentRef.round) continue;
        for (const desc of round.descriptions ?? []) {
          if (desc.userId === targetUserId && desc.text) {
            matches.push({ text: desc.text, roundNumber: round.roundNumber });
          }
        }
      }
      const picked =
        contentRef.index !== undefined && contentRef.index < matches.length
          ? matches[contentRef.index]
          : pickLatest(matches);
      if (!picked) return { found: false };
      return { found: true, text: picked.text, locator: { round: picked.roundNumber } };
    }

    case 'lieStatement': {
      const player = (state.lieDetectivePlayers ?? []).find((p) => p.userId === targetUserId);
      const statements = player?.statements ?? [];
      const picked =
        contentRef.index !== undefined
          ? statements.find((s) => s.index === contentRef.index)
          : pickLatest(statements);
      // SEC-02: `.text` ONLY — never spread the statement object (a leaked
      // isLie/is_ai/source_tag must not reach the report row).
      if (!picked?.text) return { found: false };
      return { found: true, text: picked.text, locator: { statementIndex: picked.index } };
    }

    case 'groupMirrorReason': {
      const answers = (state.groupMirrorAnswers ?? []).filter(
        (a) => a.userId === targetUserId && (!contentRef.promptId || a.questionId === contentRef.promptId),
      );
      const picked = pickLatest(answers.filter((a) => typeof a.reasonText === 'string' && a.reasonText.length > 0));
      // Field name is `reasonText` per the shared GroupMirrorAnswer type
      // (verifier R1 correction — NOT `.reason`).
      if (!picked?.reasonText) return { found: false };
      return { found: true, text: picked.reasonText, locator: { questionId: picked.questionId } };
    }

    case 'miniscriptVoteNote': {
      const votes = (state.miniScriptVotes ?? []).filter(
        (v) => v.userId === targetUserId && typeof v.why === 'string' && v.why.length > 0,
      );
      const picked = pickLatest(votes);
      if (!picked?.why) return { found: false };
      return { found: true, text: picked.why };
    }

    case 'displayName': {
      const participant = participants.find((p) => p.userId === targetUserId);
      if (!participant?.displayName) return { found: false };
      return { found: true, text: participant.displayName };
    }

    default:
      return { found: false };
  }
}

/**
 * Compose the `reports.description` row. Format (contract §3 step 5, AC-09):
 *   `[icebreaker:<phase>] <原文快照或元数据> — 备注:<note>`  (≤2000 chars)
 *
 * The `[icebreaker:<phase>]` prefix is machine-parseable (see
 * ICEBREAKER_UGC_DESCRIPTION_PREFIX_RE) so the admin queue can group/filter
 * icebreaker reports without a schema change.
 */
export function buildIcebreakerUgcDescription(args: {
  phase: string;
  kind: UgcContentRef['kind'];
  targetUserId: string;
  snapshot: IcebreakerUgcSnapshot;
  note?: string;
  reportedAt?: Date;
}): string {
  const { phase, kind, targetUserId, snapshot, note, reportedAt = new Date() } = args;

  const locatorSuffix = snapshot.locator
    ? ' ' +
      Object.entries(snapshot.locator)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')
    : '';

  const core = snapshot.found
    ? `UGC举报 kind=${kind} 作者=${targetUserId} 原文:「${snapshot.text}」${locatorSuffix}`
    : // AC-02 degradation: phase cleanup / TTL expiry removed the original —
      // record metadata only and say so honestly (「内容已过期」).
      `UGC举报 kind=${kind} 作者=${targetUserId} 内容已过期（原文已清理或不可读；元数据: phase=${phase}, kind=${kind}, target=${targetUserId}, at=${reportedAt.toISOString()}）`;

  const noteSuffix = note ? ` — 备注:${note}` : '';
  return `[icebreaker:${phase}] ${core}${noteSuffix}`.slice(0, ICEBREAKER_UGC_DESCRIPTION_MAX);
}
