import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 5001
const DIST_DIR = path.resolve(__dirname, '../apps/mini-program/dist')

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

const MOCK_USER = {
  id: 'user-screenshot-001',
  displayName: '悦仔测试',
  nickname: '悦仔测试',
  archetype: 'corgi',
  primaryArchetype: 'corgi',
  nextStep: 'discover',
  hasCompletedOnboarding: true,
  profileEssentialComplete: true,
  profileExtendedComplete: true,
  activeAssessmentSessionId: null,
  paymentsEnabled: true,
  intent: ['deep_chat', 'fun'],
  pendingReferralCode: '',
  features: {
    restartOnboarding: false,
    smartProfession: true,
    onboardingForceSkip: false,
    matchingLiveReveal: true,
    socialIcebreakerClientForceEnd: false,
    personalityDiceChooseMode: false,
    runPlanTemplatesEnabled: true,
    personalityShareEnabled: true,
    personalitySlotAnimationEnabled: true,
    promoBannerEnabled: true,
    personalityTestEchoEnabled: true,
    paymentsEnabled: true,
    squadUnboxingDragRevealEnabled: true,
    socialIcebreakerCustomModeEnabled: true,
    profileRedesignEnabled: true,
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
  sampleArchetypes: ['corgi', 'dolphin', 'fox'],
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

// Event pool
app.get('/api/event-pools/:id', (req, res) => {
  res.json({ ...MOCK_POOL, id: req.params.id })
})

// My registrations
app.get('/api/my-pool-registrations', (req, res) => {
  res.json([])
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
    intent: ['deep_chat', 'fun'],
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
    intent: ['fun', 'expand_circle'],
  },
  {
    userId: 'user-screenshot-003',
    displayName: '小鹿',
    archetype: 'dolphin',
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
    intent: ['deep_chat', 'new_experience'],
  },
  {
    userId: 'user-screenshot-004',
    displayName: '大熊',
    archetype: 'panda',
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
  res.json({
    group: { ...MOCK_SQUAD_GROUP, id: req.params.id },
    pool: MOCK_SQUAD_POOL,
    members: MOCK_SQUAD_MEMBERS,
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
      connectionPointsWithRarity: [
        { text: '都爱在咖啡馆里发呆', rarity: 'common' },
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

// Analytics sink
app.post('/api/analytics/:event', (req, res) => {
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

const server = app.listen(PORT, () => {
  console.log(`[mock-h5-server] listening on http://localhost:${PORT}`)
})

process.on('SIGTERM', () => server.close())
process.on('SIGINT', () => server.close())
