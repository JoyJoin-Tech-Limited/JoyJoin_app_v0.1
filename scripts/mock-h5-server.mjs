import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5001
const DIST_DIR = path.resolve(__dirname, '../apps/mini-program/dist')
const SOURCE_ASSET_DIR = path.resolve(__dirname, '../apps/mini-program/src/assets')

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

app.use(express.json())

// H5 visual verification resolves the mini-program's approved local fallbacks
// from source. The production mini-program build still owns its normal asset
// copy/CDN rules; this route exists only in the screenshot harness.
app.use('/assets', express.static(SOURCE_ASSET_DIR))

const MOCK_USER = {
  id: 'user-screenshot-001',
  displayName: '悦仔测试',
  nickname: '悦仔测试',
  appMode: 'production',
  archetype: 'corgi',
  primaryArchetype: 'corgi',
  bio: '喜欢晚风、深聊，也喜欢偶尔说走就走的城市漫步。',
  gender: 'female',
  lifeStage: '探索生活的新阶段',
  experiencePoints: 260,
  nextStep: 'discover',
  hasCompletedOnboarding: true,
  profileEssentialComplete: true,
  profileExtendedComplete: true,
  activeAssessmentSessionId: null,
  paymentsEnabled: true,
  intent: ['deep_chat', 'fun'],
  pendingReferralCode: '',
  features: {
    aigcLabelsEnabled: true,
    restartOnboarding: false,
    smartProfession: true,
    onboardingForceSkip: false,
    matchingLiveReveal: true,
    socialIcebreakerClientForceEnd: false,
    personalityDiceChooseMode: false,
    runPlanTemplatesEnabled: true,
    personalityShareEnabled: true,
    personalitySlotAnimationEnabled: true,
    personalitySlotCurvatureEnabled: true,
    promoBannerEnabled: true,
    personalityTestEchoEnabled: true,
    paymentsEnabled: true,
    squadUnboxingDragRevealEnabled: true,
    socialSquadComposedHeroEnabled: false,
    socialIcebreakerCustomModeEnabled: true,
    profileRedesignEnabled: true,
    matchingPuzzlePreludeEnabled: true,
    oracleCardCornerStatEnabled: true,
    alangEnabled: true,
    profilePixelAvatarEnabled: true,
    equipmentRewardsEnabled: true,
    personalStoryEnabled: true,
    aigcLabelsEnabled: true,
    gatheringRoomEnabled: true,
  },
}

const MOCK_POOL = {
  id: 'pool-screenshot-001',
  title: '周末松弛感饭局 · 南山',
  eventType: '饭局',
  city: '深圳',
  district: '南山',
  dateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  status: 'open',
  description: '一场轻松有料的周末饭局，悦仔会根据你的社交画像和预算偏好帮你匹配一桌合拍的人。',
  maxParticipants: 8,
  currentParticipants: 5,
  registrationCount: 5,
  spotsLeft: 3,
  sampleArchetypes: ['corgi', 'dolphin_calm', 'fox'],
  accentFamily: 'warm',
  aiHeadline: '这一桌的氛围，适合想认真聊聊的人',
  hasUserArchetypeMatch: true,
  price: 88,
}

const MOCK_COUPONS = {
  count: 1,
  availableCount: 1,
  coupons: [
    {
      id: 'coupon-welcome-001',
      couponId: 'coupon-welcome-001',
      code: 'WELCOME50',
      discountType: 'percentage',
      discountValue: 50,
      validFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isUsed: false,
      usedAt: null,
      source: 'welcome',
      status: 'available',
      createdAt: new Date().toISOString(),
    },
  ],
}

const MOCK_PRICING = {
  plans: [
    { planType: 'event_single', priceInCents: 8800 },
    { planType: 'pack_3', priceInCents: 21100, originalPriceInCents: 26400 },
    { planType: 'pack_6', priceInCents: 37000, originalPriceInCents: 52800 },
  ],
}

const MOCK_DISCOVER_POOLS = [
  {
    ...MOCK_POOL,
    id: 'pool-screenshot-001',
    title: '周末松弛感饭局 · 科技园',
    district: '科技园',
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
    district: '后海',
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
]

const MOCK_ALANG_SLUG = 'meet-alang'
const MOCK_ALANG_MISSION = {
  id: 'alang-mission-screenshot-001',
  slug: MOCK_ALANG_SLUG,
  title: '阿浪在晚风里等一个答案',
  description: '南头古城附近出现了一个独自徘徊的身影。',
  status: 'in_progress',
  stage: 'searching',
  currentNodeId: 'search-gate',
  progressPercent: 38,
  isDebugSession: false,
}

// Search-stage content intentionally contains no target coordinate. The mock
// GPS response below returns distance only, preserving the production privacy
// boundary while still making the H5 state deterministic.
const MOCK_ALANG_CONTENT = {
  version: '1.0',
  title: MOCK_ALANG_MISSION.title,
  description: MOCK_ALANG_MISSION.description,
  startNodeId: 'event-card',
  nodes: [
    {
      id: 'event-card',
      type: 'event_card',
      content: { title: '闪现任务', body: '阿浪在城市的晚风里等你。' },
      nextNodeId: 'event-detail',
    },
    {
      id: 'event-detail',
      type: 'event_detail',
      content: {
        title: '去找找阿浪',
        subtitle: '约 10 分钟',
        body: '先走进寻找区域，精确位置会保持神秘。',
        hints: ['建议在室外开启定位', '进度会从服务端恢复'],
      },
      nextNodeId: 'search-gate',
    },
    {
      id: 'search-gate',
      type: 'search_gate',
      content: { body: '朝着距离变小的方向慢慢走。' },
      nextNodeId: 'found-scene',
    },
    {
      id: 'found-scene',
      type: 'found_scene',
      content: { body: '路灯下，阿浪折着一张被风吹皱的纸。' },
      nextNodeId: 'dialogue-hello',
    },
    {
      id: 'dialogue-hello',
      type: 'dialogue',
      content: { speaker: '阿浪', body: '你也会在晚上想起没有说完的话吗？' },
      choices: [
        { label: '会，有些话需要多一点勇气', response: '阿浪轻轻点了点头。', nextNodeId: 'companion-start' },
        { label: '我可以陪你走一段', response: '他把纸收进口袋里。', nextNodeId: 'companion-start' },
      ],
    },
    {
      id: 'companion-start',
      type: 'companion_start',
      content: { body: '两个人沿着旧城的石板路往前走。' },
      nextNodeId: 'companion-move',
    },
    {
      id: 'companion-move',
      type: 'companion_move',
      content: { body: '晚风慢了下来，话也慢慢找到了出口。', companionLines: ['不用赶，我们慢慢走。'] },
      nextNodeId: 'arrival-gate',
    },
    {
      id: 'arrival-gate',
      type: 'arrival_gate',
      content: { body: '靠近终点并稳定停留片刻。' },
      nextNodeId: 'user-confirm',
    },
    {
      id: 'user-confirm',
      type: 'user_confirm',
      content: { body: '你们到了。', confirmLabel: '看看这段故事' },
      nextNodeId: 'closing',
    },
    {
      id: 'closing',
      type: 'closing',
      content: { body: '阿浪终于把没说完的话折成了一束光。' },
      nextNodeId: 'result-card',
    },
    {
      id: 'result-card',
      type: 'result_card',
      content: {
        body: '一段被晚风记住的同行。',
        finalMood: '释然',
        summaryLine: '有些答案，是在一起走过一段路后才出现的。',
      },
    },
  ],
  meta: {
    estimatedDurationMinutes: 10,
    difficulty: 'easy',
    tags: ['城市漫步', '夜晚', '陪伴'],
    npcName: '阿浪',
    searchRadiusMeters: 300,
  },
}

const MOCK_ALANG_ARCHIVES = [
  {
    id: 'alang-archive-screenshot-001',
    missionId: MOCK_ALANG_MISSION.id,
    title: '晚风里没说完的话',
    locationName: '南头古城',
    completedAt: '2026-07-12T20:42:00+08:00',
    finalMood: '释然',
    closingLine: '阿浪把那张纸收好，笑着说今晚可以睡个好觉了。',
    summaryLine: '有些答案，是在一起走过一段路后才出现的。',
    nodeHistory: ['event-card', 'event-detail', 'search-gate', 'found-scene', 'dialogue-hello', 'companion-start', 'companion-move', 'arrival-gate', 'user-confirm', 'closing', 'result-card'],
    choicesMade: [{ nodeId: 'dialogue-hello', choiceIndex: 1, label: '我可以陪你走一段' }],
    companionLines: ['不用赶，我们慢慢走。', '晚风会帮我们把话带到该去的地方。'],
    isDebugSession: false,
  },
  {
    id: 'alang-archive-screenshot-002',
    missionId: 'alang-mission-screenshot-002',
    title: '雨停以后，城市亮了一点',
    locationName: '华侨城创意园',
    completedAt: '2026-07-04T18:26:00+08:00',
    finalMood: '温暖',
    closingLine: '他们在屋檐下等到了雨停。',
    summaryLine: '一场阵雨，让两个陌生人有了同一段回忆。',
    nodeHistory: ['event-card', 'search-gate', 'found-scene', 'closing', 'result-card'],
    choicesMade: [],
    companionLines: ['再等一会吧，雨声挺好听的。'],
    isDebugSession: false,
  },
]

const MOCK_EQUIPMENT_ITEMS = [
  {
    id: 'equipment-top-violet',
    slug: 'violet-city-jacket',
    name: '紫色街头连帽衫',
    description: '人格形象的初始上装。',
    slot: 'top',
    rarity: 'common',
    assetKey: 'equipment/starter/corgi/top/v1',
    compatibleArchetypes: ['corgi'],
  },
  {
    id: 'equipment-bottom-indigo',
    slug: 'indigo-city-pants',
    name: '黑色工装裤',
    description: '人格形象的初始下装。',
    slot: 'bottom',
    rarity: 'common',
    assetKey: 'equipment/starter/corgi/bottom/v1',
    compatibleArchetypes: ['corgi'],
  },
  {
    id: 'equipment-shoes-white',
    slug: 'white-city-sneakers',
    name: '白紫高帮鞋',
    description: '人格形象的初始鞋子。',
    slot: 'shoes',
    rarity: 'common',
    assetKey: 'equipment/starter/corgi/shoes/v1',
    compatibleArchetypes: ['corgi'],
  },
  {
    id: 'equipment-accessory-star',
    slug: 'star-city-pin',
    name: '爪印吊坠',
    description: '人格形象的初始配饰。',
    slot: 'accessory',
    rarity: 'common',
    assetKey: 'equipment/starter/corgi/accessory/v1',
    compatibleArchetypes: ['corgi'],
  },
]

const MOCK_EQUIPMENT_INVENTORY = MOCK_EQUIPMENT_ITEMS.map((item, index) => ({
  id: `inventory-screenshot-${index + 1}`,
  itemId: item.id,
  sourceType: 'initial',
  sourceId: 'corgi',
  acquiredAt: `2026-07-${String(10 + index).padStart(2, '0')}T12:00:00+08:00`,
  item,
}))

let mockEquipmentOutfit = {
  topItemId: 'equipment-top-violet',
  bottomItemId: 'equipment-bottom-indigo',
  shoesItemId: 'equipment-shoes-white',
  accessoryItemId: 'equipment-accessory-star',
  version: 1,
}

// Joined events for 我的足迹
app.get('/api/events/joined', (req, res) => {
  res.json([
    {
      id: 'event-upcoming-001',
      title: '周末松弛感饭局 · 南山',
      dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
      status: 'upcoming',
      eventType: '饭局',
      city: '深圳',
      district: '南山',
      venueName: '悦聚小馆',
      price: 88,
    },
    {
      id: 'event-matched-001',
      title: '微醺夜话 · 福田',
      dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'matched',
      eventType: '酒局',
      city: '深圳',
      district: '福田',
      venueName: 'The Backroom',
      groupId: 'group-001',
      finalDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
      price: 128,
    },
    {
      id: 'event-urgent-001',
      title: '今晚即兴饭局 · 罗湖',
      dateTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
      status: 'confirmed',
      eventType: '饭局',
      city: '深圳',
      district: '罗湖',
      venueName: '老街大排档',
      price: 66,
    },
    {
      id: 'event-completed-001',
      title: '上周末天台烧烤 · 宝安',
      dateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'completed',
      eventType: '饭局',
      city: '深圳',
      district: '宝安',
      venueName: '天台烤场',
      price: 99,
    },
    {
      id: 'event-cancelled-001',
      title: '已取消的桌游局 · 龙岗',
      dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'cancelled',
      eventType: '桌游',
      city: '深圳',
      district: '龙岗',
      price: 49,
    },
  ])
})

// Events shell composite
app.get('/api/shell/events', (req, res) => {
  res.json({
    user: MOCK_USER,
    joinedEvents: [
      {
        id: 'event-upcoming-001',
        title: '周末松弛感饭局 · 南山',
        dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000).toISOString(),
        status: 'upcoming',
        eventType: '饭局',
        city: '深圳',
        district: '南山',
        venueName: '悦聚小馆',
        price: 88,
      },
      {
        id: 'event-matched-001',
        title: '微醺夜话 · 福田',
        dateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'matched',
        eventType: '酒局',
        city: '深圳',
        district: '福田',
        venueName: 'The Backroom',
        groupId: 'group-001',
        finalDateTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
        price: 128,
      },
      {
        id: 'event-urgent-001',
        title: '今晚即兴饭局 · 罗湖',
        dateTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        status: 'confirmed',
        eventType: '饭局',
        city: '深圳',
        district: '罗湖',
        venueName: '老街大排档',
        price: 66,
      },
      {
        id: 'event-completed-001',
        title: '上周末天台烧烤 · 宝安',
        dateTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        eventType: '饭局',
        city: '深圳',
        district: '宝安',
        venueName: '天台烤场',
        price: 99,
      },
      {
        id: 'event-cancelled-001',
        title: '已取消的桌游局 · 龙岗',
        dateTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'cancelled',
        eventType: '桌游',
        city: '深圳',
        district: '龙岗',
        price: 49,
      },
    ],
    notificationCounts: { discover: 0, activities: 0, chat: 0, total: 0 },
  })
})

// Notifications
app.get('/api/notifications/counts', (req, res) => {
  res.json({ discover: 0, activities: 0, chat: 0, total: 0 })
})

app.post('/api/notifications/mark-read', (req, res) => {
  res.json({ success: true })
})

// Auth
app.get('/api/auth/user', (req, res) => {
  res.json(MOCK_USER)
})

// Predictive shells used by the V1.7 Profile and Discover visual checks.
app.get('/api/shell/profile', (req, res) => {
  res.json({
    user: MOCK_USER,
    coupons: MOCK_COUPONS,
    stats: {
      eventsJoined: 4,
      connectionsCount: 11,
    },
    meta: {
      cacheKey: 'screenshot-profile-v17',
      serverTime: new Date().toISOString(),
    },
  })
})

app.get('/api/user/gamification', (req, res) => {
  res.json({
    experiencePoints: 260,
    joyCoins: 148,
    currentLevel: 2,
    levelConfig: {
      level: 2,
      name: 'Explorer',
      nameCn: '探索者',
      xpRequired: 100,
      icon: 'compass',
      benefits: ['View more match profiles'],
      benefitsCn: ['查看更多匹配档案'],
    },
    nextLevelInfo: {
      progress: 80,
      xpNeeded: 40,
    },
    activityStreak: 3,
    lastActivityDate: '2026-07-13T20:20:00+08:00',
    streakFreezeAvailable: true,
    eventsAttended: 4,
  })
})

app.get('/api/shell/discover', (req, res) => {
  res.json({
    user: {
      nextStep: 'discover',
      primaryArchetype: MOCK_USER.primaryArchetype,
    },
    pools: {
      items: MOCK_DISCOVER_POOLS,
      hasMore: false,
    },
    myRegistrations: {
      ids: ['pool-screenshot-001'],
      statuses: { 'pool-screenshot-001': 'confirmed' },
    },
    meta: {
      cacheKey: 'screenshot-discover-alang-v17',
      serverTime: new Date().toISOString(),
    },
  })
})

// Canonical pool-list fallback if the Discover shell is deliberately disabled
// while diagnosing the H5 harness.
app.get('/api/event-pools', (req, res) => {
  res.json(MOCK_DISCOVER_POOLS)
})

// Alang V1.7 visual fixtures. The searching detail never includes
// routeDestination or target coordinates; only the distance-only GPS response
// below is exposed to the client.
app.get('/api/alang/missions', (req, res) => {
  res.json([MOCK_ALANG_MISSION])
})

app.get('/api/alang/missions/:slug', (req, res) => {
  if (req.params.slug !== MOCK_ALANG_SLUG) {
    res.status(404).json({ error: '闪现故事不存在' })
    return
  }

  res.json({
    ...MOCK_ALANG_MISSION,
    content: MOCK_ALANG_CONTENT,
    myProgress: {
      progressId: 'alang-progress-screenshot-001',
      stage: 'searching',
      currentNodeId: 'search-gate',
      nodeHistory: ['event-card', 'event-detail', 'search-gate'],
      choicesMade: [],
      status: 'in_progress',
      isDebugSession: false,
    },
  })
})

app.post('/api/alang/missions/:slug/gps', (req, res) => {
  if (req.params.slug !== MOCK_ALANG_SLUG) {
    res.status(404).json({ error: '闪现故事不存在' })
    return
  }

  res.json({
    arrived: false,
    distanceMeters: 118,
    radiusMeters: 5,
    stableCount: 0,
  })
})

app.get('/api/alang/archives', (req, res) => {
  res.json(MOCK_ALANG_ARCHIVES)
})

app.get('/api/alang/archives/:archiveId', (req, res) => {
  const archive = MOCK_ALANG_ARCHIVES.find(({ id }) => id === req.params.archiveId)
  if (!archive) {
    res.status(404).json({ error: '故事档案不存在' })
    return
  }
  res.json(archive)
})

// Private continuous story: only verified experience facts are represented.
app.get('/api/personal-story', (req, res) => {
  res.json({
    story: {
      title: '你的故事，正在慢慢长大',
      subtitle: '每次真实出发，都会留在同一本故事里。',
      updatedAt: '2026-07-12T20:42:00+08:00',
      chapters: [
        {
          id: 'personal-story-chapter-001',
          title: '2026年06月03日 · 盲盒活动',
          body: '故事发生在2026年6月3日。这次真实经历属于盲盒活动。\n\n这一段发生在悦聚小馆。\n\n本次分组中的伙伴类型包括猫头鹰伙伴。',
          activityType: '盲盒活动',
          occurredAt: '2026-06-03T19:00:00+08:00',
          aigc: { aiGenerated: true, labelType: 'ai-generated' },
        },
        {
          id: 'personal-story-chapter-002',
          title: '2026年07月12日 · 闪现',
          body: '故事发生在2026年7月12日。这次真实经历属于闪现。\n\n这一段发生在深圳湾公园。这次经历中出现了阿浪。\n\n最后留下的心情是释然。',
          activityType: '闪现',
          occurredAt: '2026-07-12T20:42:00+08:00',
          aigc: { aiGenerated: true, labelType: 'ai-generated' },
        },
      ],
    },
    updateJob: null,
    aiEnabled: true,
    canUpdate: true,
  })
})

app.post('/api/personal-story/update', (req, res) => {
  res.json({ accepted: true, noNewExperiences: true, updateJob: null })
})

app.get('/api/equipment/me', (req, res) => {
  res.json({
    archetypeId: 'corgi',
    outfit: mockEquipmentOutfit,
    inventory: MOCK_EQUIPMENT_INVENTORY,
    recentItems: [...MOCK_EQUIPMENT_INVENTORY].reverse(),
    wallet: { fragmentBalance: 70, pityMisses: 2, pityTarget: 4 },
    pendingEntitlements: [
      {
        id: 'entitlement-screenshot-001',
        sourceType: 'blind_box',
        sourceRecordId: 'registration-screenshot-001',
        poolId: 'equipment-pool-screenshot-001',
        createdAt: '2026-07-13T20:00:00+08:00',
        pool: {
          id: 'equipment-pool-screenshot-001',
          slug: 'venue-yueju',
          name: '悦聚小馆装备池',
        },
      },
    ],
    rewardsEnabled: true,
  })
})

app.put('/api/equipment/me/outfit', (req, res) => {
  mockEquipmentOutfit = {
    topItemId: req.body?.topItemId ?? null,
    bottomItemId: req.body?.bottomItemId ?? null,
    shoesItemId: req.body?.shoesItemId ?? null,
    accessoryItemId: req.body?.accessoryItemId ?? null,
    version: mockEquipmentOutfit.version + 1,
  }
  res.json({ saved: true, outfit: mockEquipmentOutfit })
})

app.get('/api/equipment/shop', (req, res) => {
  res.json({
    fragmentBalance: 70,
    prices: { common: 40, rare: 120 },
    items: MOCK_EQUIPMENT_ITEMS.map((item) => ({
      ...item,
      price: item.rarity === 'rare' ? 120 : 40,
      owned: true,
    })),
  })
})

// Event pool
app.get('/api/event-pools/:id', (req, res) => {
  res.json({ ...MOCK_POOL, id: req.params.id })
})

// My registrations
app.get('/api/my-pool-registrations', (req, res) => {
  res.json([
    {
      id: 'reg-screenshot-001',
      poolId: 'pool-screenshot-001',
      matchStatus: 'matched',
      poolStatus: 'matched',
      assignedGroupId: 'group-screenshot-001',
      poolTitle: '周末松弛感饭局 · 南山',
      poolEventType: '饭局',
      poolCity: '深圳',
      poolDistrict: '南山',
      poolDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString(),
      finalDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString(),
      matchScore: 87,
      createdAt: new Date().toISOString(),
    },
  ])
})

// Pre-join vibe brief (fallback path)
app.get('/api/pre-join-vibe-brief/:type/:area', (req, res) => {
  res.json({
    insight: '这是一场轻松有料的饭局，适合想认真聊聊的人。',
    matchingPromise: '悦仔会优先匹配和你预算、期待接近的桌友。',
    reasons: ['氛围松弛', '话题有料', '匹配精准'],
  })
})

// Pre-join vibe brief (actual path used by pool-registration)
app.get('/api/ai/pre-join-vibe-brief', (req, res) => {
  res.json({
    insight: '这是一场轻松有料的饭局，适合想认真聊聊的人。',
    matchingPromise: '悦仔会优先匹配和你预算、期待接近的桌友。',
    reasons: ['氛围松弛', '话题有料', '匹配精准'],
  })
})

// User coupons
app.get('/api/user-coupons', (req, res) => {
  res.json(MOCK_COUPONS)
})

// Welcome coupon awarded on first 入场卡 view
app.get('/api/user/welcome-coupon', (req, res) => {
  res.json({
    id: 'user-coupon-welcome-001',
    code: 'WELCOME50',
    discountType: 'percentage',
    discountValue: 50,
    source: 'profile_review_first_view',
    isNewlyAwarded: true,
    createdAt: new Date().toISOString(),
  })
})

// Profile review tagline
app.get('/api/onboarding/profile-tagline', (req, res) => {
  res.json({
    tagline: '你身上有让人想靠近的松弛感，像周末午后的一杯热咖啡。',
  })
})

// User interests (read-only)
app.get('/api/user/interests', (req, res) => {
  res.json({
    topInterests: [
      { id: 'hiking', name: '徒步', level: 2 },
      { id: 'coffee', name: '咖啡', level: 3 },
      { id: 'movie', name: '电影', level: 2 },
      { id: 'standup', name: '脱口秀', level: 1 },
    ],
  })
})

// Complete profile review
app.post('/api/onboarding/profile-review/complete', (req, res) => {
  res.json({ success: true, nextStep: 'discover' })
})

// Active path used by packages/shared/src/api/profile.ts completeProfileReview
app.post('/api/profile-review/complete', (req, res) => {
  res.json({ success: true, nextStep: 'discover' })
})

// Pricing plans
app.get('/api/payments/ritual-context', (req, res) => {
  res.json(MOCK_PRICING)
})

// Payment status
app.get('/api/payments/status/:orderId', (req, res) => {
  res.json({ status: 'pending' })
})

// Pool group details (squad unboxing)
const MOCK_SQUAD_MEMBERS = [
  {
    userId: 'user-screenshot-001',
    displayName: '悦仔测试',
    archetype: 'corgi',
    topInterests: ['徒步', '咖啡', '电影'],
    ageLabel: '28',
    industryNicheLabel: '互联网产品',
    industryCategoryLabel: '互联网',
    ageVisible: true,
    industryVisible: true,
    gender: 'female',
    educationLevel: '本科',
    hometownRegionCity: '广东 · 广州',
    hometownAffinityOptin: true,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['discussion', 'fun'],
  },
  {
    userId: 'user-screenshot-002',
    displayName: '阿泽',
    archetype: 'fox',
    topInterests: ['脱口秀', '精酿', '旅行'],
    ageLabel: '30',
    industryNicheLabel: '品牌策划',
    industryCategoryLabel: '广告营销',
    ageVisible: true,
    industryVisible: true,
    gender: 'male',
    educationLevel: '硕士',
    hometownRegionCity: '湖南 · 长沙',
    hometownAffinityOptin: false,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['fun', 'networking'],
  },
  {
    userId: 'user-screenshot-003',
    displayName: '小鹿',
    archetype: 'dolphin_calm',
    topInterests: ['瑜伽', '阅读', '烘焙'],
    ageLabel: '27',
    industryNicheLabel: '心理咨询',
    industryCategoryLabel: '教育科研',
    ageVisible: true,
    industryVisible: true,
    gender: 'female',
    educationLevel: '硕士',
    hometownRegionCity: '四川 · 成都',
    hometownAffinityOptin: true,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['discussion', 'friends'],
  },
  {
    userId: 'user-screenshot-004',
    displayName: '大熊',
    archetype: 'elephant',
    topInterests: ['游戏', '火锅', '露营'],
    ageLabel: '29',
    industryNicheLabel: '后端开发',
    industryCategoryLabel: '互联网',
    ageVisible: true,
    industryVisible: true,
    gender: 'male',
    educationLevel: '本科',
    hometownRegionCity: '湖北 · 武汉',
    hometownAffinityOptin: false,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['fun', 'friends'],
  },
]

// Six-member variant for two-row fan visual verification (group-screenshot-006).
const MOCK_SQUAD_MEMBERS_6 = [
  ...MOCK_SQUAD_MEMBERS,
  {
    userId: 'user-screenshot-005',
    displayName: '小禾',
    archetype: 'koala',
    topInterests: ['插画', '咖啡', '猫'],
    ageLabel: '26',
    industryNicheLabel: '自由插画师',
    industryCategoryLabel: '设计创意',
    ageVisible: true,
    industryVisible: true,
    gender: 'female',
    educationLevel: '本科',
    hometownRegionCity: '浙江 · 杭州',
    hometownAffinityOptin: true,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['fun', 'friends'],
  },
  {
    userId: 'user-screenshot-006',
    displayName: '阿鸣',
    archetype: 'rooster',
    topInterests: ['创业', '跑步', '播客'],
    ageLabel: '31',
    industryNicheLabel: '连续创业者',
    industryCategoryLabel: '商业管理',
    ageVisible: false,
    industryVisible: true,
    gender: 'male',
    educationLevel: '硕士',
    hometownRegionCity: '福建 · 厦门',
    hometownAffinityOptin: false,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['networking', 'discussion'],
  },
]

// Nine-member variant for the +N overflow capture (group-screenshot-009).
// The fan caps at 8 visible cards (MAX_FAN_CARDS); the ninth member collapses
// into a "+1" chip on the last card — front AND back (AC-10).
const MOCK_SQUAD_MEMBERS_9 = [
  ...MOCK_SQUAD_MEMBERS_6,
  {
    userId: 'user-screenshot-007',
    displayName: '小雨',
    archetype: 'otter',
    topInterests: ['潜水', '摄影', 'vintage'],
    ageLabel: '27',
    industryNicheLabel: '品牌视觉',
    industryCategoryLabel: '设计创意',
    ageVisible: true,
    industryVisible: true,
    gender: 'female',
    educationLevel: '本科',
    hometownRegionCity: '广东 · 珠海',
    hometownAffinityOptin: true,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['fun', 'friends'],
  },
  {
    userId: 'user-screenshot-008',
    displayName: '老王',
    archetype: 'owl',
    topInterests: ['围棋', '历史', '茶'],
    ageLabel: '35',
    industryNicheLabel: '高校教师',
    industryCategoryLabel: '教育科研',
    ageVisible: true,
    industryVisible: true,
    gender: 'male',
    educationLevel: '博士',
    hometownRegionCity: '山东 · 青岛',
    hometownAffinityOptin: false,
    educationVisible: true,
    relationshipStatus: 'married',
    intent: ['discussion', 'friends'],
  },
  {
    userId: 'user-screenshot-009',
    displayName: '米粒',
    archetype: 'parrot',
    topInterests: ['脱口秀', '剧本杀', '探店'],
    ageLabel: '25',
    industryNicheLabel: '新媒体运营',
    industryCategoryLabel: '广告营销',
    ageVisible: true,
    industryVisible: true,
    gender: 'female',
    educationLevel: '本科',
    hometownRegionCity: '江苏 · 南京',
    hometownAffinityOptin: false,
    educationVisible: true,
    relationshipStatus: 'single',
    intent: ['fun', 'networking'],
  },
]

const MOCK_SQUAD_GROUP = {
  id: 'group-screenshot-001',
  groupNumber: 3,
  memberCount: 4,
  matchScore: 87,
  avgPairScore: 82,
  diversityScore: 74,
  energyBalance: 79,
  matchExplanation: '这一桌有喜欢深挖话题的倾听者，也有能把场子带起来的气氛担当，互补得刚刚好。',
  theme: '轻松有料的周末饭局',
  subtitle: '适合想认真聊聊，也想笑出声的人',
  vibe: 'balanced',
  themeEmoji: '🍲',
  highlights: ['话题有料', '氛围松弛', '匹配精准'],
  venueName: '悦聚小馆',
  venueAddress: '深圳市南山区粤海街道科苑路 15 号',
  venueAssignmentStatus: 'assigned',
  finalDateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString(),
  status: 'matched',
}

const MOCK_SQUAD_POOL = {
  id: 'pool-screenshot-001',
  title: '周末松弛感饭局 · 南山',
  description: '一场轻松有料的周末饭局，悦仔会根据你的社交画像和预算偏好帮你匹配一桌合拍的人。',
  eventType: '饭局',
  city: '深圳',
  district: '南山',
  dateTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000).toISOString(),
}

app.get('/api/pool-groups/:id', (req, res) => {
  const isSix = req.params.id === 'group-screenshot-006'
  const isNine = req.params.id === 'group-screenshot-009'
  res.json({
    group: {
      ...MOCK_SQUAD_GROUP,
      id: req.params.id,
      memberCount: isNine ? 9 : isSix ? 6 : MOCK_SQUAD_GROUP.memberCount,
    },
    pool: MOCK_SQUAD_POOL,
    members: isNine ? MOCK_SQUAD_MEMBERS_9 : isSix ? MOCK_SQUAD_MEMBERS_6 : MOCK_SQUAD_MEMBERS,
  })
})

app.get('/api/pool-groups/:id/analysis', (req, res) => {
  const currentUserId = MOCK_USER.id
  const pairExplanations = [
    {
      pairKey: ['user-screenshot-001', 'user-screenshot-002'].sort().join('-'),
      explanation: '你们都是那种先观察再开口的人，但一旦被点燃，话题能走很深。',
      chemistryScore: 88,
      sharedInterests: ['咖啡'],
      connectionPoints: ['都爱在咖啡馆里发呆', '聊天节奏偏慢热'],
      // The WithRarity text deliberately ships full-width parens so the H5
      // preview exercises the stripConnectionPointParens renderer path (A3).
      connectionPointsWithRarity: [
        { text: '（都爱在咖啡馆里发呆）', rarity: 'common' },
        { text: '聊天节奏偏慢热', rarity: 'rare' },
      ],
      introAngle: '最近有喝到让你惊喜的咖啡吗？',
    },
    {
      pairKey: ['user-screenshot-001', 'user-screenshot-003'].sort().join('-'),
      explanation: '一个喜欢把感受说出来，一个擅长接住情绪，这对组合很容易聊出共鸣。',
      chemistryScore: 85,
      sharedInterests: ['阅读'],
      connectionPoints: ['都偏内向细腻', '阅读习惯相似'],
      connectionPointsWithRarity: [
        { text: '都偏内向细腻', rarity: 'rare' },
        { text: '阅读习惯相似', rarity: 'common' },
      ],
      introAngle: '最近在读什么书？',
    },
    {
      pairKey: ['user-screenshot-001', 'user-screenshot-004'].sort().join('-'),
      explanation: '一个爱想，一个爱玩，刚好能互相带出新体验。',
      chemistryScore: 76,
      sharedInterests: ['电影'],
      connectionPoints: ['都爱看电影', '生活节奏互补'],
      connectionPointsWithRarity: [
        { text: '都爱看电影', rarity: 'common' },
        { text: '生活节奏互补', rarity: 'common' },
      ],
      introAngle: '最近有看到想二刷的电影吗？',
    },
    {
      pairKey: ['user-screenshot-002', 'user-screenshot-003'].sort().join('-'),
      explanation: '两个人都擅长倾听，但风格不同，一个是毒舌式幽默，一个是温柔式接话。',
      chemistryScore: 72,
      sharedInterests: ['旅行'],
      connectionPoints: ['旅行风格都偏随性'],
      introAngle: '最近一次说走就走的旅行去了哪？',
    },
    {
      pairKey: ['user-screenshot-002', 'user-screenshot-004'].sort().join('-'),
      explanation: '都是能把场子热起来的人，聊到游戏和精酿会特别起劲。',
      chemistryScore: 81,
      sharedInterests: ['精酿', '游戏'],
      connectionPoints: ['都爱探索小酒馆', '游戏口味接近'],
      introAngle: '最近有发现什么好喝的精酿？',
    },
    {
      pairKey: ['user-screenshot-003', 'user-screenshot-004'].sort().join('-'),
      explanation: '一个治愈系，一个开心果，组合起来会让饭局很舒服。',
      chemistryScore: 78,
      sharedInterests: ['烘焙'],
      connectionPoints: ['都喜欢动手做东西'],
      introAngle: '有没有试过露营时自己烤东西吃？',
    },
  ]

  // Six-member fixture: add viewer pairs for the two extra members (also
  // exercises the privacy-omission path — user-screenshot-006 has
  // ageVisible: false) and an epic-rarity connection for the holo sweep.
  if (req.params.id === 'group-screenshot-006') {
    pairExplanations.push(
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-005'].sort().join('-'),
        explanation: '都喜欢慢慢把生活过出细节，聊到咖啡和猫会停不下来。',
        chemistryScore: 83,
        sharedInterests: ['咖啡', '猫'],
        connectionPoints: ['都爱在咖啡馆里画画', '都是猫系人格'],
        connectionPointsWithRarity: [
          { text: '都爱在咖啡馆里画画', rarity: 'common' },
          { text: '都是猫系人格', rarity: 'rare' },
        ],
        introAngle: '最近有画什么让你满意的小东西吗？',
      },
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-006'].sort().join('-'),
        explanation: '一个深耕产品，一个冲在创业一线，聊起用户和增长会火花四溅。',
        chemistryScore: 91,
        sharedInterests: ['播客'],
        connectionPoints: ['都相信长期主义', '都爱听商业播客'],
        connectionPointsWithRarity: [
          { text: '都相信长期主义', rarity: 'epic' },
          { text: '都爱听商业播客', rarity: 'common' },
        ],
        introAngle: '最近哪一期播客让你印象最深？',
      }
    )
  }

  // Nine-member fixture (overflow capture): viewer pairs for members 7–9 so
  // the fan renders full connection-point pills; the 9th member only appears
  // inside the "+1" overflow chip on the last visible card.
  if (req.params.id === 'group-screenshot-009') {
    // Reuse the six-member extra pairs first (fixture id builds on the 6 set).
    pairExplanations.push(
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-005'].sort().join('-'),
        explanation: '都喜欢慢慢把生活过出细节，聊到咖啡和猫会停不下来。',
        chemistryScore: 83,
        sharedInterests: ['咖啡', '猫'],
        connectionPoints: ['都爱在咖啡馆里画画', '都是猫系人格'],
        introAngle: '最近有画什么让你满意的小东西吗？',
      },
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-006'].sort().join('-'),
        explanation: '一个深耕产品，一个冲在创业一线，聊起用户和增长会火花四溅。',
        chemistryScore: 91,
        sharedInterests: ['播客'],
        connectionPoints: ['都相信长期主义', '都爱听商业播客'],
        introAngle: '最近哪一期播客让你印象最深？',
      },
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-007'].sort().join('-'),
        explanation: '都爱用镜头收集生活，审美口味意外地合拍。',
        chemistryScore: 80,
        sharedInterests: ['摄影'],
        connectionPoints: ['都喜欢随手拍', '审美偏复古'],
        introAngle: '最近拍到过最满意的一张是什么？',
      },
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-008'].sort().join('-'),
        explanation: '一个产品视角，一个学者视角，聊问题都能聊到底层。',
        chemistryScore: 79,
        sharedInterests: ['历史'],
        connectionPoints: ['都爱刨根问底', '聊天节奏稳'],
        introAngle: '最近在读哪本历史书？',
      },
      {
        pairKey: ['user-screenshot-001', 'user-screenshot-009'].sort().join('-'),
        explanation: '一个慢热，一个自来熟，组合起来饭局不会冷场。',
        chemistryScore: 74,
        sharedInterests: ['探店'],
        connectionPoints: ['都爱发现小店'],
        introAngle: '最近探到最惊喜的店是哪家？',
      }
    )
  }

  const myPairs = pairExplanations.filter((pair) => pair.pairKey.includes(currentUserId))

  res.json({
    groupId: req.params.id,
    overallChemistry: 'warm',
    groupDynamics: '这一桌有倾听者、有气氛组、有细腻派，整体互补，容易自然破冰。',
    iceBreakers: ['最近最上头的一件事', '如果周末必须出门，你会去哪？', '今年最想尝试的新体验'],
    pairExplanations,
    myPairs,
    fromCache: true,
    generatedAt: new Date().toISOString(),
    groupThemeTags: ['轻松有料', '互补成桌', '慢热也能深聊'],
    groupThemeCompanion: '像老朋友的客厅，舒服又不乏惊喜。',
    provider: null,
    fallbackUsed: false,
  })
})

app.post('/api/pool-groups/:id/confirm-attendance', (req, res) => {
  res.json({ success: true, blindBoxEventId: null, attendanceStatus: 'confirmed' })
})

// ─── Gathering room (集结房间) ──────────────────────────────────
// REST snapshot + WS presence fixtures for the H5 screenshot harness.
// Six members, distinct archetypes; the viewer (user-screenshot-001) is still
// pending so the 确认出席 CTA renders active, two members are already confirmed
// so the seated pose + 已确认 badge are visible in the capture.

const GATHERING_ROOM_EVENT_ID = 'blindbox-event-screenshot-001'

/** Full starter equipment set for one archetype — assetKeys resolve to the
 *  approved full-starter composite in PixelAvatarComposite. */
function gatheringRoomStarterEquipment(archetype) {
  const slots = ['top', 'bottom', 'shoes', 'accessory']
  const equippedItems = slots.map((slot) => ({
    id: `equipment-starter-${archetype}-${slot}`,
    slug: `starter-${archetype}-${slot}`,
    name: `${archetype} 初始${slot}`,
    description: null,
    slot,
    rarity: 'common',
    assetKey: `equipment/starter/${archetype}/${slot}/v1`,
    compatibleArchetypes: [archetype],
  }))
  return {
    outfit: {
      topItemId: `equipment-starter-${archetype}-top`,
      bottomItemId: `equipment-starter-${archetype}-bottom`,
      shoesItemId: `equipment-starter-${archetype}-shoes`,
      accessoryItemId: `equipment-starter-${archetype}-accessory`,
      version: 1,
    },
    equippedItems,
  }
}

function gatheringRoomMember({ userId, displayName, archetype, attendanceStatus, topInterests, ageLabel, industryNicheLabel }) {
  return {
    userId,
    displayName,
    archetype,
    attendanceStatus,
    topInterests,
    ageVisible: true,
    industryVisible: true,
    ageLabel,
    industryNicheLabel,
    ...gatheringRoomStarterEquipment(archetype),
  }
}

const GATHERING_ROOM_MEMBERS = [
  gatheringRoomMember({
    userId: 'user-screenshot-001',
    displayName: '悦仔测试',
    archetype: 'corgi',
    attendanceStatus: 'pending',
    topInterests: ['徒步', '咖啡', '电影'],
    ageLabel: '28',
    industryNicheLabel: '互联网产品',
  }),
  gatheringRoomMember({
    userId: 'user-screenshot-002',
    displayName: '阿泽',
    archetype: 'fox',
    attendanceStatus: 'confirmed',
    topInterests: ['脱口秀', '精酿', '旅行'],
    ageLabel: '30',
    industryNicheLabel: '品牌策划',
  }),
  gatheringRoomMember({
    userId: 'user-screenshot-003',
    displayName: '桃桃',
    archetype: 'hamster_praise',
    attendanceStatus: 'confirmed',
    topInterests: ['烘焙', '瑜伽', '手账'],
    ageLabel: '26',
    industryNicheLabel: '心理咨询',
  }),
  gatheringRoomMember({
    userId: 'user-screenshot-004',
    displayName: '阿鸣',
    archetype: 'rooster',
    attendanceStatus: 'pending',
    topInterests: ['创业', '跑步', '播客'],
    ageLabel: '31',
    industryNicheLabel: '连续创业者',
  }),
  gatheringRoomMember({
    userId: 'user-screenshot-005',
    displayName: '小禾',
    archetype: 'koala',
    attendanceStatus: 'pending',
    topInterests: ['插画', '咖啡', '猫'],
    ageLabel: '26',
    industryNicheLabel: '自由插画师',
  }),
  gatheringRoomMember({
    userId: 'user-screenshot-006',
    displayName: '老王',
    archetype: 'owl',
    attendanceStatus: 'pending',
    topInterests: ['围棋', '历史', '茶'],
    ageLabel: '35',
    industryNicheLabel: '高校教师',
  }),
]

// Exclude exactly one member (the owl, user-screenshot-006) from WS presence
// so the screenshots cover the absent-member rendering path: header reads
// 已到 5/6, the owl's avatar queues at the room door, and its name card stays
// at the seat. REST room-state still returns all six members.
const GATHERING_ROOM_PRESENT_USER_IDS = GATHERING_ROOM_MEMBERS
  .map((member) => member.userId)
  .filter((userId) => userId !== 'user-screenshot-006')

app.get('/api/pool-groups/:id/room-state', (req, res) => {
  res.json({
    groupId: req.params.id,
    blindBoxEventId: GATHERING_ROOM_EVENT_ID,
    totalParticipants: GATHERING_ROOM_MEMBERS.length,
    confirmedCount: GATHERING_ROOM_MEMBERS.filter((member) => member.attendanceStatus === 'confirmed').length,
    // ~1 day out so the header countdown renders 还有 1 天.
    eventDateTime: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    members: GATHERING_ROOM_MEMBERS,
  })
})

// Analytics sink
app.post('/api/analytics/:event', (req, res) => {
  res.json({ success: true })
})

// ─── Social Icebreaker (screenshot states) ──────────────────────
// Phase comes from the sessionId: /pages/icebreaker-session/index?sessionId=mock-<phase>
// Variants: mock-fuse (all-ready countdown), mock-stall (host stall nudge).

const IB_HOST_ID = 'user-screenshot-001'

// Minimal AIGC meta fixture — lets the screenshot gate verify the disclosure
// rows (mirrors the shared AIResponseMeta shape).
function mockAigcMeta(promptVersion) {
  return {
    generatedAt: new Date().toISOString(),
    fromCache: false,
    provider: 'deepseek',
    fallbackUsed: false,
    promptVersion,
    aigc: { aiGenerated: true, labelType: 'ai-generated' },
  }
}
const IB_PARTICIPANTS = [
  { userId: IB_HOST_ID, displayName: '悦仔测试', archetype: '社牛柯基', isActive: true },
  { userId: 'ib-p2', displayName: '小鹿', archetype: '寻宝狐', isActive: true },
  { userId: 'ib-p3', displayName: '阿澈', archetype: '机灵海豚', isActive: true },
  { userId: 'ib-p4', displayName: '桃桃', archetype: '夸夸仓鼠', isActive: true },
  { userId: 'ib-p5', displayName: '老周', archetype: '靠谱大象', isActive: true },
  { userId: 'ib-p6', displayName: '眠眠', archetype: '树洞考拉', isActive: true },
]

const IB_LIE_STATEMENTS = [
  { index: 0, text: '我小时候拿过全省少儿围棋冠军' },
  { index: 1, text: '我从来不喝咖啡，一喝就睡不着' },
  { index: 2, text: '我曾经在沙漠里住过一个月的帐篷' },
]

function buildIcebreakerState(sessionId) {
  const variant = sessionId.replace('mock-', '')
  const now = Date.now()
  const base = {
    socialSessionId: sessionId,
    icebreakerSessionId: sessionId,
    hostUserId: IB_HOST_ID,
    hostDisplayName: '悦仔测试',
    playerCount: 6,
    activePlayerCount: 6,
    phaseStartedAt: now - 90_000,
    sessionStartedAt: now - 20 * 60_000,
    completedPhases: ['warmup'],
    eventTier: 'glow',
    eventType: '饭局',
    vibe: 'balanced',
    autoAdvanceEnabled: true,
    enabledPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice', 'speed_friending'],
    joinedParticipants: IB_PARTICIPANTS,
    archetypeMixText: '柯基 × 狐狸 × 海豚 × 仓鼠 × 大象 × 考拉',
  }

  switch (variant) {
    case 'micro_challenge':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-1',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
          visualHint: '越真诚越好',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2'],
        currentChallengeMeta: mockAigcMeta('social-micro-challenge-v1'),
      }
    case 'fuse':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-2',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
        },
        challengeCompletedBy: IB_PARTICIPANTS.map((p) => p.userId),
        autoAdvanceScheduledAt: now + 6_000,
        advanceFuseKind: 'all_ready',
      }
    case 'stall':
      return {
        ...base,
        currentPhase: 'micro_challenge',
        currentChallenge: {
          id: 'mc-shot-3',
          title: '互相问3个问题',
          description: '每人准备3个能真正了解对方的问题，轮流问。越真诚越好。',
          durationSeconds: 180,
          completionCTA: '我完成了',
        },
        challengeCompletedBy: [IB_HOST_ID, 'ib-p2'],
        stallNudgeAt: now - 30_000,
      }
    case 'lie_detective':
      return {
        ...base,
        currentPhase: 'lie_detective',
        lieDetectiveMode: 'v1',
        lieDetectivePlayers: IB_PARTICIPANTS.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          statements: IB_LIE_STATEMENTS,
        })),
        currentLieDetectivePlayerIndex: 1,
        votes: [],
        lieDetectiveStatementsMeta: mockAigcMeta('social-lie-detective-v1'),
      }
    case 'auction':
      return {
        ...base,
        currentPhase: 'auction',
        auctionLots: [
          { id: 'lot-1', title: '当众唱一句儿歌', teaser: '跑调也要唱完，大家投票打分', emoji: '🎤' },
          { id: 'lot-2', title: '爆料一个自己的小怪癖', teaser: '越具体越好笑', emoji: '🤫' },
          { id: 'lot-3', title: '请全桌喝一杯', teaser: '今晚的豪气担当就是你', emoji: '🍜' },
        ],
        auctionCurrentLotIndex: 0,
        auctionBalances: { [IB_HOST_ID]: 120, 'ib-p2': 75 },
        auctionHighBid: { userId: 'ib-p2', amount: 45 },
        auctionLotStartedAt: now - 10_000,
        auctionAllLotsClosed: false,
        auctionLotsMeta: mockAigcMeta('social-auction-lots-v1'),
        auctionBidHistory: [
          { userId: IB_HOST_ID, amount: 20, at: now - 60_000, lotIndex: 0 },
          { userId: 'ib-p2', amount: 45, at: now - 30_000, lotIndex: 0 },
        ],
      }
    case 'personality_dice':
      return {
        ...base,
        currentPhase: 'personality_dice',
        personalityDiceChallenges: IB_PARTICIPANTS.map((p, i) => ({
          userId: p.userId,
          displayName: p.displayName,
          archetype: p.archetype,
          challengeEmoji: ['🎤', '📷', '🕺', '💌', '🎭', '🌟'][i],
          challengeTitle: ['模仿一种动物叫声', '和左边的人自拍一张', '即兴跳10秒舞', '夸右边的人三个优点', '用方言自我介绍', '分享一个童年糗事'][i],
          challengeBody: '放轻松，大家陪你一起玩',
          passLine: '喝杯茶压压惊',
        })),
        currentDicePlayerIndex: 1,
        diceCompletedBy: [],
        dicePassedBy: [],
        personalityDiceChallengesMeta: mockAigcMeta('social-personality-dice-v1'),
      }
    case 'speed_friending':
      return {
        ...base,
        currentPhase: 'speed_friending',
        speedFriendingPairs: [
          { userIdA: IB_HOST_ID, userIdB: 'ib-p2', displayNameA: '悦仔测试', displayNameB: '小鹿', roundIndex: 0 },
          { userIdA: 'ib-p3', userIdB: 'ib-p4', displayNameA: '阿澈', displayNameB: '桃桃', roundIndex: 0 },
          { userIdA: 'ib-p5', userIdB: 'ib-p6', displayNameA: '老周', displayNameB: '眠眠', roundIndex: 0 },
        ],
        speedFriendingCurrentRound: 0,
        speedFriendingTotalRounds: 3,
        speedFriendingRoundStartedAt: now - 3 * 60_000,
        speedFriendingAllRoundsComplete: false,
      }
    case 'recap':
      return {
        ...base,
        currentPhase: 'recap',
        completedPhases: ['warmup', 'micro_challenge', 'lie_detective', 'auction', 'personality_dice'],
        lastAdvanceTrigger: 'auto_all_ready',
      }
    case 'warmup-mood':
      // Host with no topics yet → mood grid (host_no_topics).
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-generating':
      // Same entry state; the /topics mock for this session hangs so the
      // generating shimmer is capturable after a mood tap.
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-error':
      // /topics 500s for this session → client topicsError → error card.
      return { ...base, currentPhase: 'warmup', completedPhases: [] }
    case 'warmup-topic':
      // Topic dealt, partial ready — ember rim + count + ready CTA.
      return {
        ...base,
        currentPhase: 'warmup',
        completedPhases: [],
        selectedMood: 'funny',
        warmupTopics: [
          { id: 'wt-1', question: '最近一次让你笑出来的小事是什么？', mood: 'funny', emoji: '😄', category: '轻松开场', depthLevel: 1, promptStyle: 'experiential', safety: 'gentle' },
          { id: 'wt-2', question: '如果你要给今晚这桌起个队名，会叫什么？', mood: 'funny', emoji: '🎲', category: '桌面气氛', depthLevel: 1, promptStyle: 'reflective', safety: 'gentle' },
          { id: 'wt-3', question: '你朋友最常用哪句话吐槽你？', mood: 'funny', emoji: '🍌', category: '熟人视角', depthLevel: 2, promptStyle: 'experiential', safety: 'open' },
        ],
        warmupTopicsMeta: mockAigcMeta('social-warmup-topics-v1'),
        currentTopicIndex: 0,
        warmupReadyUserIds: [IB_HOST_ID, 'ib-p2', 'ib-p3'],
      }
    default:
      return { ...base, currentPhase: 'warmup' }
  }
}

app.post('/api/social-icebreaker/start', (req, res) => {
  const sessionId = req.body?.sessionId || 'mock-micro_challenge'
  const state = buildIcebreakerState(sessionId)
  res.json({
    socialSessionId: state.socialSessionId,
    currentPhase: state.currentPhase,
    hostUserId: state.hostUserId,
    hostDisplayName: state.hostDisplayName,
    state,
  })
})

app.get('/api/social-icebreaker/:socialSessionId/recap', (req, res) => {
  const state = buildIcebreakerState(req.params.socialSessionId)
  res.json({
    meta: mockAigcMeta('social-recap-summary-v1'),
    summary: {
      headline: '今晚到这儿，刚刚好',
      closingLine: '悦仔的任务完成啦，接下来的故事，你们当面接着讲～',
      moments: ['小鹿猜中了老周的谎言，全场惊呼', '桃桃的儿歌拍卖拍出了 85 币高价', '眠眠说她是全桌最会倾听的人，没人反对'],
    },
    medals: [
      { emoji: '🕵️', title: '最佳侦探', recipientDisplayName: '小鹿', description: '猜对谎言次数最多' },
      { emoji: '🎯', title: '挑战先锋', recipientDisplayName: '悦仔测试', description: '最快完成微挑战' },
      { emoji: '💬', title: '话题王', recipientDisplayName: '阿澈', description: '贡献了最多有趣话题' },
    ],
    state,
  })
})

app.get('/api/social-icebreaker/:socialSessionId', (req, res) => {
  res.json(buildIcebreakerState(req.params.socialSessionId))
})

// Transition/action endpoints must not silently no-op: future interactive
// flows would pass green while doing nothing. Static screenshot captures
// don't call these; anything that does should fail loudly.
const MOCK_ACTION_501 = [
  'advance', 'early-end', 'warmup/ready', 'micro-challenge/complete',
  'lie-detective/vote', 'lie-detective/generate', 'lie-detective/submit-tags',
  'lie-detective/next-player', 'auction/bid', 'auction/close-lot', 'auction/generate-lots',
  'personality-dice/complete', 'personality-dice/choose', 'personality-dice/generate',
  'speed-friending/next-round', 'speed-friending/complete', 'quip-battle/submit',
  'quip-battle/vote', 'undercover-word/describe', 'undercover-word/vote',
  'group-mirror/submit', 'group-mirror/reveal', 'stall-nudge/dismiss', 'select-phase',
  'end-session',
]

app.post('/api/social-icebreaker/:socialSessionId/:action', (req, res) => {
  // Interactive warmup captures: deterministic /topics outcomes per session.
  if (req.params.action === 'topics' && req.params.socialSessionId === 'mock-warmup-error') {
    return res.status(500).json({ error: 'MOCK_TOPICS_FAILURE' })
  }
  if (req.params.action === 'topics' && req.params.socialSessionId === 'mock-warmup-generating') {
    // Hold long enough for the generating shimmer to be screenshotted.
    return setTimeout(() => res.status(500).json({ error: 'MOCK_TOPICS_TIMEOUT' }), 8000)
  }
  if (MOCK_ACTION_501.includes(req.params.action)) {
    return res.status(501).json({ error: 'MOCK_ACTION_NOT_SIMULATED', action: req.params.action })
  }
  res.json({ state: buildIcebreakerState(req.params.socialSessionId) })
})

app.post('/api/analytics/social-icebreaker', (req, res) => {
  res.json({ success: true })
})

app.post('/api/analytics/auth', (req, res) => {
  res.json({ success: true })
})

// Static SPA fallback
app.use(express.static(DIST_DIR))
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-h5-server] listening on http://localhost:${PORT}`)
})

// ─── WebSocket mock (gathering-room presence) ──────────────────
// The mini-program connects to ws://localhost:5001/ws (derived from
// TARO_APP_API_BASE_URL). On USER_JOINED we reply with an authoritative
// ROOM_PRESENCE_STATE snapshot (five of six fixture members present — the owl
// is absent to cover the absent-member rendering path) and mirror
// the production ROOM_MEMBER_ENTERED broadcast; clients dedupe their own id.
const wss = new WebSocketServer({ server, path: '/ws' })

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    let message
    try {
      message = JSON.parse(raw.toString())
    } catch {
      return
    }

    if (message.type === 'PING') {
      socket.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }))
      return
    }

    if (message.type === 'USER_JOINED' && message.eventId && message.userId) {
      const timestamp = new Date().toISOString()
      socket.send(JSON.stringify({
        type: 'ROOM_PRESENCE_STATE',
        eventId: message.eventId,
        data: { eventId: message.eventId, presentUserIds: GATHERING_ROOM_PRESENT_USER_IDS },
        timestamp,
      }))
      const entered = JSON.stringify({
        type: 'ROOM_MEMBER_ENTERED',
        eventId: message.eventId,
        data: { eventId: message.eventId, userId: message.userId },
        timestamp,
      })
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) {
          client.send(entered)
        }
      }
    }
  })
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
