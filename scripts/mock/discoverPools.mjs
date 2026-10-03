#!/usr/bin/env node
// Discover feed pool fixtures (extracted from mock-h5-server.mjs 2026-09-30
// to keep the server under the harness file-size warn line).
// Districts are canonical 区-level names (南山区/福田区) matching production
// admin pool creation, so the Discover area-filter live counts exercise the
// real mapping path.

export function buildDiscoverPools(MOCK_POOL) {
  return [
    {
      ...MOCK_POOL,
      id: 'pool-screenshot-001',
      title: '周末松弛感饭局 · 科技园',
      district: '南山区',
      dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      registrationCount: 5,
      currentParticipants: 5,
      maxParticipants: 8,
      spotsLeft: 3,
      topArchetypes: [
        { archetype: 'corgi', count: 2 },
        { archetype: 'dolphin_calm', count: 1 },
      ],
      userTypeCount: 2,
      userTypeRarity: 'present',
      highChemistryCount: 3,
      topComplementaryType: 'dolphin_calm',
      narrativePivot: 'present',
      hoursUntilDeadline: 36,
    },
    {
      ...MOCK_POOL,
      id: 'pool-screenshot-002',
      title: '晚风里的深聊局 · 后海',
      eventType: '畅聊局',
      district: '南山区',
      dateTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      registrationCount: 4,
      currentParticipants: 4,
      maxParticipants: 6,
      spotsLeft: 2,
      sampleArchetypes: ['owl', 'koala', 'corgi'],
      topArchetypes: [
        { archetype: 'owl', count: 1 },
        { archetype: 'koala', count: 1 },
      ],
      accentFamily: 'cool',
      aiHeadline: '慢热也没关系，这里有人愿意认真听',
      userTypeCount: 1,
      userTypeRarity: 'rare',
      highChemistryCount: 2,
      topComplementaryType: 'owl',
      narrativePivot: 'rare',
      hoursUntilDeadline: 72,
      price: 108,
    },
    {
      ...MOCK_POOL,
      id: 'pool-screenshot-003',
      title: '周五微醺小局 · 车公庙',
      eventType: '酒局',
      district: '福田区',
      dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      registrationCount: 3,
      currentParticipants: 3,
      maxParticipants: 6,
      spotsLeft: 3,
      sampleArchetypes: ['fox', 'corgi'],
      topArchetypes: [
        { archetype: 'fox', count: 2 },
        { archetype: 'corgi', count: 1 },
      ],
      accentFamily: 'warm',
      userTypeCount: 1,
      userTypeRarity: 'present',
      highChemistryCount: 2,
      topComplementaryType: 'fox',
      narrativePivot: 'present',
      hoursUntilDeadline: 48,
      price: 128,
    },
  ]
}
