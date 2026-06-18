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
