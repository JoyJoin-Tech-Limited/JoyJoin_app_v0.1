/**
 * Page/flow × primary tier × optional secondary tag → canonical expression id.
 * Secondary tags document loading.system vs social vs reveal without extra top-level buckets.
 */

import type { XiaoyueExpressionId } from './xiaoyueExpressions'

export type XiaoyuePrimaryTier =
  | 'homeWelcome'
  | 'matchWaiting'
  | 'matchSuccess'
  | 'loading'
  | 'actionSuccess'
  | 'actionFailure'
  | 'thanksFeedback'

export type XiaoyueLoadingSecondaryTag = 'system' | 'social' | 'reveal'

export interface XiaoyueExpressionMatrixRow {
  flow: string
  surface: string
  primaryTier: XiaoyuePrimaryTier | 'supplement'
  secondaryTag?: string
  expressionId: XiaoyueExpressionId
}

export const XIAOYUE_EXPRESSION_MATRIX: XiaoyueExpressionMatrixRow[] = [
  {
    flow: '获客与合规',
    surface: 'pages/index/index 落地页',
    primaryTier: 'homeWelcome',
    expressionId: 'homeWelcome',
  },
  {
    flow: '账号',
    surface: 'pages/login/index',
    primaryTier: 'loading',
    secondaryTag: 'neutral.calm',
    expressionId: 'neutralInformation',
  },
  {
    flow: 'Onboarding',
    surface: 'OnboardingLoadingShell',
    primaryTier: 'loading',
    secondaryTag: 'loading.system',
    expressionId: 'loadingSystem',
  },
  {
    flow: '氛围测试',
    surface: 'personality-test intro',
    primaryTier: 'loading',
    secondaryTag: 'onboarding.calm-intro',
    expressionId: 'neutralInformation',
  },
  {
    flow: '氛围测试',
    surface: 'personality-test completing',
    primaryTier: 'loading',
    secondaryTag: 'loading.system',
    expressionId: 'loadingSystem',
  },
  {
    flow: '资料',
    surface: 'essential-data / extended-data / profile-review 教练条',
    primaryTier: 'supplement',
    secondaryTag: 'coach.inline',
    expressionId: 'coachGuide',
  },
  {
    flow: '结果页',
    surface: 'personality-test/results slot / celebrate',
    primaryTier: 'matchSuccess',
    expressionId: 'matchSuccess',
  },
  {
    flow: '匹配',
    surface: 'matching-status pending',
    primaryTier: 'matchWaiting',
    secondaryTag: 'loading.social',
    expressionId: 'matchWaiting',
  },
  {
    flow: '匹配',
    surface: 'matching-status 取消报名',
    primaryTier: 'supplement',
    secondaryTag: 'opt-out.reassure',
    expressionId: 'optOutReassure',
  },
  {
    flow: '匹配',
    surface: 'matching-status matched overlay',
    primaryTier: 'matchSuccess',
    expressionId: 'matchSuccess',
  },
  {
    flow: '开盒',
    surface: 'squad-unboxing shaking',
    primaryTier: 'loading',
    secondaryTag: 'loading.reveal',
    expressionId: 'loadingReveal',
  },
  {
    flow: '支付',
    surface: 'blind-box-payment 头部',
    primaryTier: 'supplement',
    secondaryTag: 'payment.trust',
    expressionId: 'paymentTrust',
  },
  {
    flow: '支付',
    surface: 'payment-verification polling',
    primaryTier: 'loading',
    secondaryTag: 'loading.system',
    expressionId: 'paymentTrust',
  },
  {
    flow: '支付',
    surface: 'payment-verification paid',
    primaryTier: 'actionSuccess',
    expressionId: 'actionSuccess',
  },
  {
    flow: '支付',
    surface: 'payment-verification failed',
    primaryTier: 'actionFailure',
    expressionId: 'actionFailure',
  },
  {
    flow: '闭环',
    surface: 'event-feedback submitted',
    primaryTier: 'thanksFeedback',
    expressionId: 'thanksFeedback',
  },
  {
    flow: '信息',
    surface: 'pages/terms/index',
    primaryTier: 'supplement',
    secondaryTag: 'legal.neutral',
    expressionId: 'neutralInformation',
  },
]
