import { describe, expect, it } from 'vitest';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { mapBotUserIdsToBotIds } from './socialIcebreakerClientIdMapper';

describe('mapBotUserIdsToBotIds', () => {
  it('maps bot user IDs in record keys and values so Mini Script votes match assignments', () => {
    const state = {
      socialSessionId: 'social-test',
      icebreakerSessionId: 'icebreaker-test',
      currentPhase: 'mini_script',
      hostUserId: 'host-user',
      hostDisplayName: 'Host',
      playerCount: 2,
      phaseStartedAt: 1,
      sessionStartedAt: 1,
      completedPhases: [],
      miniScriptRoleAssignments: {
        'host-user': 0,
        'bot-user-1': 1,
      },
      miniScriptPlayerReady: {
        'host-user': true,
        'bot-user-1': true,
      },
      miniScriptVotes: [
        { userId: 'host-user', who: 'A', what: 'B', why: 'C', votedAt: 1 },
        { userId: 'bot-user-1', who: 'D', what: 'E', why: 'F', votedAt: 2 },
      ],
    } satisfies SocialSessionState;

    const mapped = mapBotUserIdsToBotIds(
      state,
      new Map([['bot-user-1', 'bot-1']]),
    );

    expect(mapped.miniScriptRoleAssignments).toEqual({
      'host-user': 0,
      'bot-1': 1,
    });
    expect(mapped.miniScriptPlayerReady).toEqual({
      'host-user': true,
      'bot-1': true,
    });
    expect(mapped.miniScriptVotes?.map((vote) => vote.userId)).toEqual([
      'host-user',
      'bot-1',
    ]);

    const voterIds = new Set(mapped.miniScriptVotes?.map((vote) => vote.userId));
    expect(Object.keys(mapped.miniScriptRoleAssignments ?? {}).every((id) => voterIds.has(id))).toBe(true);
  });
});
