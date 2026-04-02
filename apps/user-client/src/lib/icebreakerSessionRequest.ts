export interface IcebreakerSessionParticipant {
  userId: string;
  displayName: string;
  archetype: string | null;
  interests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
}

/**
 * Canonical session-details payload for `IcebreakerSessionPage`.
 *
 * `eventSource` distinguishes blind-box sessions from pool-group sessions.
 * `eventId` is null for pool-group sessions because there is no blind-box event
 * record to fetch by id in that path.
 */
export interface IcebreakerSessionDetails {
  id: string;
  eventId: string | null;
  eventSource: "blind_box" | "pool_group";
  eventTitle?: string;
  eventType?: string;
  expectedAttendees: number;
  atmosphereType: string;
  participants: IcebreakerSessionParticipant[];
}

export class IcebreakerSessionRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchIcebreakerSessionDetails(
  sessionId: string,
): Promise<IcebreakerSessionDetails> {
  const response = await fetch(`/api/icebreaker/session/${sessionId}`, {
    credentials: "include",
  });

  if (response.ok) {
    return response.json();
  }

  const message = (await response.text()) || "Failed to load icebreaker session";
  throw new IcebreakerSessionRequestError(response.status, message);
}

export function getIcebreakerSessionErrorCopy(error: unknown): {
  title: string;
  description: string;
} {
  if (error instanceof IcebreakerSessionRequestError) {
    if (error.status === 401) {
      return {
        title: "请先登录",
        description: "登录后才能进入这场破冰体验。",
      };
    }

    if (error.status === 403) {
      return {
        title: "你还不在这场活动中",
        description: "只有本场活动的参与者才能进入破冰会话。",
      };
    }

    if (error.status === 404) {
      return {
        title: "会话不存在",
        description: "这场破冰会话可能还没开始，或已被移除。",
      };
    }

    if (error.status === 410) {
      return {
        title: "会话已结束",
        description: "这场破冰会话已经结束，请返回活动页查看最新状态。",
      };
    }
  }

  return {
    title: "加载会话失败",
    description: "请稍后重试，或先返回活动列表。",
  };
}
