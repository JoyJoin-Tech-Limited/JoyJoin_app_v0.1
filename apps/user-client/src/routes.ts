/**
 * 路由配置
 * 
 * 集中定义所有路由，便于管理和维护
 */

/**
 * 公开路由 (无需登录)
 */
export const publicRoutes = {
  login: '/',
  previewLogin: '/preview-login',
  inviteCode: '/invite/:code',
  icebreakerDemo: '/icebreaker-demo',
  adminLogin: '/admin/login',
} as const;

/**
 * 注册流程路由
 */
export const onboardingRoutes = {
  onboarding: '/onboarding',
  registration: '/registration',
  registrationChat: '/registration/chat',
  registrationForm: '/registration/form',
  personalityTest: '/personality-test',
  personalityTestComplete: '/personality-test/complete',
  personalityTestResults: '/personality-test/results',
  essentialData: '/onboarding/setup',
  extendedData: '/onboarding/extended',
  guide: '/guide',
} as const;

/**
 * 主应用路由 (需登录)
 */
export const appRoutes = {
  // 首页
  home: '/',
  discover: '/discover',
  
  // 活动相关
  events: '/events',
  eventDetail: '/event/:id',
  eventFeedback: '/events/:eventId/feedback',
  eventDeepFeedback: '/events/:eventId/deep-feedback',
  
  // 盲盒相关
  eventPoolRegister: '/event-pool/:id/register',
  poolGroupDetail: '/pool-groups/:groupId',
  blindBoxPayment: '/blindbox/payment',
  blindBoxConfirmation: '/blindbox/confirmation',
  blindBoxEventDetail: '/blind-box-events/:eventId',
  
  // 聊天相关
  chats: '/chats',
  eventChat: '/chats/:eventId',
  directChat: '/direct-chat/:threadId',
  chatRegistration: '/chat-registration',
  
  // 破冰游戏
  icebreaker: '/icebreaker/:sessionId',
  
  // 个人中心
  profile: '/profile',
  rewards: '/rewards',
  profileEdit: '/profile/edit',
  profileEditBasic: '/profile/edit/basic',
  profileEditEducation: '/profile/edit/education',
  profileEditWork: '/profile/edit/work',
  profileEditPersonal: '/profile/edit/personal',
  profileEditIntent: '/profile/edit/intent',
  profileEditInterests: '/profile/edit/interests',
  profileEditSocial: '/profile/edit/social',
  
  // 邀请
  invite: '/invite',
} as const;

/**
 * 管理员路由
 */
export const adminRoutes = {
  login: '/admin/login',
  dashboard: '/admin',
  users: '/admin/users',
  events: '/admin/events',
  analytics: '/admin/analytics',
} as const;

/**
 * 路由类型定义
 */
export type PublicRoute = (typeof publicRoutes)[keyof typeof publicRoutes];
export type OnboardingRoute = (typeof onboardingRoutes)[keyof typeof onboardingRoutes];
export type AppRoute = (typeof appRoutes)[keyof typeof appRoutes];
export type AdminRoute = (typeof adminRoutes)[keyof typeof adminRoutes];

/**
 * 检查路由是否为公开路由
 */
export function isPublicRoute(path: string): boolean {
  return Object.values(publicRoutes).some(route => 
    path === route || (route.includes(':') && matchRoute(path, route))
  );
}

/**
 * 检查路由是否为注册流程路由
 */
export function isOnboardingRoute(path: string): boolean {
  return Object.values(onboardingRoutes).some(route =>
    path === route || path.startsWith(route.split('/')[1] || route)
  );
}

/**
 * 简单的路由匹配 (支持 :param 参数)
 */
function matchRoute(path: string, pattern: string): boolean {
  const pathParts = path.split('/');
  const patternParts = pattern.split('/');
  
  if (pathParts.length !== patternParts.length) return false;
  
  return patternParts.every((part, i) => 
    part.startsWith(':') || part === pathParts[i]
  );
}
