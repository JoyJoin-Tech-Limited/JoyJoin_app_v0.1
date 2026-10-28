import type { HostTableBrief } from '@shared/socialIcebreaker';
import { buildSharedInterestHooks } from './icebreakerRosterSignals';
import {
  deriveTablePersona,
  type TableDepthAppetite,
  type TableEnergy,
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

export function buildHostTableBrief(params: {
  joinedParticipants: ReadonlyArray<TablePersonaRosterMember>;
  phaseStartedAt: number;
}): HostTableBrief | null {
  const { joinedParticipants, phaseStartedAt } = params;
  const rosterSize = joinedParticipants.length;
  const anchorLabel = buildSharedInterestHooks(joinedParticipants, {
    minMembers: Math.max(2, Math.ceil(rosterSize / 2)),
    limit: 1,
  })[0];
  if (!anchorLabel) return null;

  // TablePersona is aggregate-only and in-memory. No role_results read here:
  // energy falls back to the archetype composition; depth reads the approved
  // tableVibePreference field already in the loaded roster.
  const persona = deriveTablePersona({ roster: joinedParticipants });
  const paceShort = selectHostTableBriefPace(persona.energy, persona.depthAppetite);
  const phaseKey = `warmup:${phaseStartedAt}:${persona.energy}:${persona.depthAppetite}`;
  return {
    paceShort,
    anchorLabel,
    phaseKey,
  };
}
