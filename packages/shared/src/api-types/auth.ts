export const NEXT_STEP_VALUES = [
  'onboarding',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
  'guide',
  'discover',
] as const;

export type NextStepType = (typeof NEXT_STEP_VALUES)[number];

export interface AuthUser {
  id: string;
  [key: string]: any;
  primaryInterests?: string[] | null;
  interestsTop?: string[] | null;
  interestFavorite?: string | null;
  topicAvoidances?: string[] | null;
  topicsAvoid?: string[] | null;
  topicsHappy?: string[] | null;
  nextStep?: NextStepType;
  profileEssentialComplete?: boolean;
  profileExtendedComplete?: boolean;
  activeAssessmentSessionId?: string | null;
  paymentsEnabled?: boolean;
}

export interface WechatMiniProgramUser extends AuthUser {
  wechatOpenId: string;
}

export interface WechatMiniProgramLoginResponse {
  success?: boolean;
  user?: WechatMiniProgramUser;
  error?: string;
}

export interface MiniProgramAuthSession {
  user: WechatMiniProgramUser;
  openid: string;
}
