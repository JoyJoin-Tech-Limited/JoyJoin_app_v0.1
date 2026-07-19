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
import type { SocialTopicDepthLevel } from './socialIcebreaker.js';

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

// ─── 悦仔说 Permission Lines (Campfire Vault Card PR1) ───────────────────────
//
// Xiaoyue-voiced psychological-permission whispers attached to warmup topic
// cards as `SocialTopic.permissionLine`. The SERVER selects one line per topic
// at generation time so every table member sees the identical whisper for the
// same topic; the client renders it under the 「悦仔说」 prefix (the prefix is
// NOT part of the stored line — it is a styled client element).
//
// Register keying design: pools are keyed by `SocialTopicDepthLevel` (1/2/3),
// not by mood. The whisper's job is to grant permission proportional to the
// emotional exposure a question asks for — light casualness for L1 openers,
// warm partialness for L2 sharing, held safety for L3 reflection. Mood
// (funny/life/relaxed/emotional) changes topic flavor, not how much
// permission a reader needs, so depth is the honest register axis.
//
// Copy rules (contract A3): zero emoji, ≤20 chars, never names or pressures
// an individual, second-person-plural-safe, no demand to answer.

export const YUEZAI_PERMISSION_LINES: Record<SocialTopicDepthLevel, readonly string[]> = {
  /** L1 轻松开场 — permission to be casual. */
  1: [
    '这题没有标准答案，说一半也算数',
    '想到什么说什么，都很有意思',
    '第一反应就很好，不用打草稿',
    '随便聊聊，没人记笔记',
    '答案没有对错，你的版本最好',
    '说个大概就行，细节随意',
    '好玩比正确重要，放心说',
  ],
  /** L2 体验分享 — permission to be partial. */
  2: [
    '想到多少说多少，听的人也很珍贵',
    '说给自己听也行，这里没人打分',
    '讲一半也很好，剩下的留给我猜',
    '不用讲完，有感觉的那段就够',
    '慢慢来，这道题不赶时间',
    '说得乱也没关系，我们都听得懂',
    '你可以只说今天想说的部分',
  ],
  /** L3 温和反思 — permission to be vulnerable. */
  3: [
    '这里没人打分，只说给自己听也行',
    '不想说的部分，可以留在心里',
    '沉默也算回答，我们都在听',
    '能说多少是多少，已经很勇敢',
    '不用坚强，想到什么说什么',
    '这题可以跳过，也可以只说一半',
    '你的感受不用漂亮，真实就好',
  ],
} as const;

/**
 * djb2 string hash — deterministic across Node and browser runtimes.
 * Used so the same topic always yields the same permission line.
 */
function hashPermissionLineKey(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) + hash + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministically select the 悦仔说 permission line for a topic.
 * Same question text + depthLevel always yields the same line, so all table
 * members (and re-rendered / persisted state) stay consistent.
 */
export function selectPermissionLineForTopic(topic: {
  question: string;
  depthLevel?: SocialTopicDepthLevel;
}): string {
  const depthLevel: SocialTopicDepthLevel =
    topic.depthLevel === 2 || topic.depthLevel === 3 ? topic.depthLevel : 1;
  const pool = YUEZAI_PERMISSION_LINES[depthLevel];
  const index = hashPermissionLineKey(topic.question.trim()) % pool.length;
  return pool[index];
}
