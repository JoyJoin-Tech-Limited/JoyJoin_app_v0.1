/**
 * Social Icebreaker — 悦仔 Copy Manifest
 *
 * Conversational copy for the tier selection screen.
 * 悦仔 acts as a guide/host who recommends options based on the vibe.
 * All copy is in Chinese (Simplified) per JoyJoin user-facing copy rules.
 *
 * Copy principles:
 * - Use "你们" (plural) — host selects for the group, not just themselves
 * - Avoid specific game names ("拍卖", "人格骰子") — participants don't know these
 * - Describe social dynamics and feelings instead of mechanics
 * - Focus on what participants will experience, not how the system works
 */

import type { TierMachineId } from './socialIcebreakerTierManifest.js';

export interface YuezaiTierCopy {
  /** 悦仔 quote shown on the tier card — conversational, friendly, plural */
  quote: string;
  /** Duration display — already includes "~" prefix, rounded to nearest 10 */
  durationLabel: string;
  /** Phase count — e.g. "4个环节" */
  phaseCountLabel: string;
  /** "适合..." tagline explaining the social context, no game names */
  contextTagline: string;
  /** Vibe adjectives for accessibility/screen-reader */
  vibe: string;
  /** 悦仔 reaction quote when this tier is selected */
  selectionReaction: string;
}

export const YUEZAI_INTRO_COPY =
  '哈啰！我是悦仔，今晚的助手主持人。大家想玩什么样的局呢？';

export const YUEZAI_TIER_COPY: Record<TierMachineId, YuezaiTierCopy> = {
  breeze: {
    quote: '第一次见面的朋友选这个！轻松破冰，先混个脸熟~',
    durationLabel: '~40分钟',
    phaseCountLabel: '4个环节',
    contextTagline: '几道趣味问答 + 猜猜谁在说谎，节奏轻快不冷场',
    vibe: '轻快、安全、零压力',
    selectionReaction: '好，我们就玩破冰局！让我给大家把气氛先热起来~',
  },
  glow: {
    quote: '想聊得深一点、找到同频的人？这个适合你们！',
    durationLabel: '~60分钟',
    phaseCountLabel: '6个环节',
    contextTagline: '从趣味破冰到轮流挑战，再到大家互相投票，慢慢认识真实的彼此',
    vibe: '探索、共鸣、有温度',
    selectionReaction: '好，我们就玩畅聊局！准备好认识有趣的灵魂了吗？',
  },
  blaze: {
    quote: '今晚想玩尽兴、全程高能？选这个准没错！',
    durationLabel: '~90分钟',
    phaseCountLabel: '7个环节',
    contextTagline: '从轻松破冰到竞价抢答，再到即兴机智对决，层层升级不无聊',
    vibe: '刺激、尽兴、难忘',
    selectionReaction: '好，我们就玩狂欢局！今晚一起嗨到尽兴~',
  },
  custom: {
    quote: '想自己掌控节奏？自定义局交给你来导演！',
    durationLabel: '由你决定',
    phaseCountLabel: '自由组合',
    contextTagline: '从所有环节里挑喜欢的，想玩哪个就玩哪个',
    vibe: '自由、随心、主场感',
    selectionReaction: '好，自定义局开始！你来选，我来帮大家热场~',
  },
};

/** Returns copy for a given tier machine ID. */
export function getYuezaiCopyForTier(tier: TierMachineId): YuezaiTierCopy {
  return YUEZAI_TIER_COPY[tier];
}
