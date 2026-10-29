import type { HostTableBrief } from '@shared/socialIcebreaker';
import { buildSharedInterestHooks } from './icebreakerRosterSignals';
import {
  deriveTablePersona,
  type TableDepthAppetite,
  type TableEnergy,
  type TablePersonaRoleResults,
  type TablePersonaRosterMember,
} from './tablePersona';

export const HOST_TABLE_BRIEF_PACE_SHORT = '先聊具体小事，顺畅就不必换';

/** Curated, aggregate-only pace lines. No counts, names, traits, or scores. */
export const HOST_TABLE_BRIEF_PACE_BY_PERSONA: Record<
  TableDepthAppetite,
  Record<TableEnergy, string>
> = {
  deep: {
    low: '这桌慢热但愿意深聊，先用一件具体小事把人接进来',
    mid: '这桌愿意深聊，顺着一个具体故事往下问',
    high: '这桌聊得开，也不用急着换题，往具体处多走一层',
  },
  mixed: {
    low: '这桌偏慢热，先聊具体小事，不用急着深聊',
    mid: HOST_TABLE_BRIEF_PACE_SHORT,
    high: '这桌热得快，先聊具体小事，顺畅就不必换',
  },
  light: {
    low: '先聊轻松的小事，不想答就跳过，别急着上深题',
    mid: '先聊具体小事，顺畅就不必换',
    high: '这桌热得快，可以先玩起来，不必等话题聊干',
  },
};

export function selectHostTableBriefPace(energy: TableEnergy, depth: TableDepthAppetite): string {
  return HOST_TABLE_BRIEF_PACE_BY_PERSONA[depth][energy];
}

export async function buildHostTableBrief(params: {
  joinedParticipants: ReadonlyArray<TablePersonaRosterMember>;
  phaseStartedAt: number;
  /**
   * FU-02: optional lazy ACOEXP lookup. Deliberately a thunk, not a value — it
   * is invoked only after a shared-interest anchor exists, so a table that
   * would receive no brief at all never pays for the `role_results` read.
   * The caller owns the host/warmup/flag guard and the memoization
   * (`hostBriefRoleResultsMemo`).
   */
  resolveRoleResults?: () => Promise<TablePersonaRoleResults>;
}): Promise<HostTableBrief | null> {
  const { joinedParticipants, phaseStartedAt, resolveRoleResults } = params;
  const rosterSize = joinedParticipants.length;
  const anchorLabel = buildSharedInterestHooks(joinedParticipants, {
    minMembers: Math.max(2, Math.ceil(rosterSize / 2)),
    limit: 1,
  })[0];
  if (!anchorLabel) return null;

  // TablePersona is aggregate-only and in-memory. When the host/warmup/flag
  // guard held, `roleResults` is the memoized roster ACOEXP slice and the
  // energy band comes from the real roster average; otherwise (or when the
  // slice is thin) `deriveTablePersona` falls back to the archetype
  // composition. Depth always reads the approved tableVibePreference field
  // already in the loaded roster.
  const roleResults = resolveRoleResults ? await resolveRoleResults() : undefined;
  const persona = deriveTablePersona({ roster: joinedParticipants, roleResults });
  const paceShort = selectHostTableBriefPace(persona.energy, persona.depthAppetite);
  const phaseKey = `warmup:${phaseStartedAt}:${persona.energy}:${persona.depthAppetite}`;
  return {
    paceShort,
    anchorLabel,
    phaseKey,
  };
}
