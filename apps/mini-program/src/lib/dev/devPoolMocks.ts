/**
 * Dev-only mock event pool data.
 *
 * Used as a last-resort fallback when:
 *   1. The composite `/api/shell/discover` endpoint fails
 *   2. The legacy `getEventPools` request fails
 *   3. The app is running in development mode
 *
 * Production NEVER reaches this code path — guarded by `NODE_ENV === 'development'`
 * in the consumer (see `pages/discover/index.tsx`).
 *
 * Extracted from the discover page to keep the page file focused on
 * composition and to make the mock surface easy to expand / audit.
 */

import type { EventPoolSummary } from '@shared/api'

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export function getDevMockPools(): EventPoolSummary[] {
  return [
    {
      id: 'mock-pool-1',
      title: '周五微醺夜 · 破冰局',
      eventType: 'dinner',
      city: '深圳',
      district: '南山区',
      dateTime: isoIn(24),
      status: 'open',
      description: '轻松小酌，认识新朋友',
      maxParticipants: 8,
      currentParticipants: 5,
      registrationCount: 5,
      spotsLeft: 3,
      sampleArchetypes: ['corgi', 'rooster', 'fox'],
      topArchetypes: [
        { archetype: 'corgi', count: 2 },
        { archetype: 'rooster', count: 2 },
        { archetype: 'fox', count: 1 },
      ],
      accentFamily: 'warm',
      aiHeadline: '5 人已在局，氛围轻松',
      hasUserArchetypeMatch: true,
      price: 168,
      userTypeCount: 2,
      userTypeRarity: 'present',
      highChemistryCount: 3,
      topComplementaryType: 'rooster',
      narrativePivot: 'present',
      hoursUntilDeadline: 18,
    },
    {
      id: 'mock-pool-2',
      title: '周日户外徒步 · 畅聊局',
      eventType: 'outdoor',
      city: '深圳',
      district: '福田区',
      dateTime: isoIn(7 * 24),
      status: 'open',
      description: '梅林山郊野径，新手友好',
      maxParticipants: 12,
      currentParticipants: 2,
      registrationCount: 2,
      spotsLeft: 10,
      sampleArchetypes: ['fox', 'dolphin_calm'],
      topArchetypes: [
        { archetype: 'fox', count: 1 },
        { archetype: 'dolphin_calm', count: 1 },
      ],
      accentFamily: 'cool',
      aiHeadline: '2 人报名，山野清新',
      hasUserArchetypeMatch: false,
      price: 0,
      userTypeCount: 0,
      userTypeRarity: 'rare',
      highChemistryCount: 1,
      topComplementaryType: null,
      narrativePivot: 'rare',
      hoursUntilDeadline: 120,
    },
    {
      id: 'mock-pool-3',
      title: '全新开局 · 等你点亮',
      eventType: 'coffee',
      city: '深圳',
      district: '南山区',
      dateTime: isoIn(24),
      status: 'open',
      description: '首场咖啡局，期待你的加入',
      maxParticipants: 6,
      currentParticipants: 0,
      registrationCount: 0,
      spotsLeft: 6,
      sampleArchetypes: [],
      topArchetypes: [],
      accentFamily: 'calm',
      aiHeadline: null,
      hasUserArchetypeMatch: false,
      price: 88,
      userTypeCount: 0,
      userTypeRarity: 'rare',
      highChemistryCount: 0,
      topComplementaryType: null,
      narrativePivot: 'empty',
      hoursUntilDeadline: 48,
    },
    {
      id: 'mock-pool-4',
      title: '桌游狂欢夜 · 狂欢局',
      eventType: 'boardgame',
      city: '深圳',
      district: '宝安区',
      dateTime: isoIn(24),
      status: 'filling_fast',
      description: '狼人杀 + 阿瓦隆，高能烧脑',
      maxParticipants: 10,
      currentParticipants: 9,
      registrationCount: 9,
      spotsLeft: 1,
      sampleArchetypes: ['fox', 'spider', 'rooster', 'octopus', 'corgi', 'owl'],
      topArchetypes: [
        { archetype: 'fox', count: 3 },
        { archetype: 'spider', count: 2 },
        { archetype: 'rooster', count: 2 },
        { archetype: 'octopus', count: 1 },
        { archetype: 'corgi', count: 1 },
      ],
      accentFamily: 'fire',
      aiHeadline: '9 人集结，最后 1 席',
      hasUserArchetypeMatch: true,
      price: 128,
      userTypeCount: 1,
      userTypeRarity: 'present',
      highChemistryCount: 7,
      topComplementaryType: 'fox',
      narrativePivot: 'present',
      hoursUntilDeadline: 6,
    },
  ]
}
