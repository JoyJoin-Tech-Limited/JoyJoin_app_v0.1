import type { User } from '../schema';

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

export interface AuthUser extends User {
  nextStep?: NextStepType;
  profileEssentialComplete?: boolean;
  profileExtendedComplete?: boolean;
  activeAssessmentSessionId?: string | null;
  paymentsEnabled?: boolean;
}

export interface WechatMiniProgramUser extends Record<string, unknown> {
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
