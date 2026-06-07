import { View, Text, Input, ScrollView, Image, CustomWrapper } from '@tarojs/components'
import Chip from './ui/Chip'
import Taro from '@tarojs/taro'
import { haptics } from '../lib/utils/haptics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../lib/mascot/xiaoyueExpressions'
import { apiRequest } from '../lib/api/api'
import { useOnboardingAnalytics } from '../hooks/onboarding/useOnboardingAnalytics'
import { useDeviceTier } from '../hooks/useDeviceTier'
import './ProfessionChatOverlay.scss'

export interface ProfessionClassificationData {
  occupationId: string
  standardizedOccupationId: string | null
  industryCategoryLabel: string | null
  industrySegmentLabel: string | null
  industryNicheLabel: string | null
  industryCategory: string | null
  industrySegmentNew: string | null
  industryNiche: string | null
  industrySource: string
  industryConfidence: number
}

export interface ProfessionChatOverlayProps {
  visible: boolean
  isClosing?: boolean
  initialValue?: string
  smartProfession?: boolean
  onSubmit: (value: string, classificationData?: ProfessionClassificationData) => void
  onSkip: () => void
}

const OPENING_MESSAGE = '好奇！你平时是做什么的呀？\n多说说看，悦仔好帮你找到真正聊得来的人～'

const SKIP_RESPONSE = '好呀，那我们先跳过这题～等你想说了，随时可以在个人主页里补充'

interface ChatMessage {
  id: string
  sender: 'xiaoyue' | 'user'
  text: string
  expressionId?: XiaoyueExpressionId
  isFallback?: boolean
}

interface UnderstandProfessionResponse {
  reaction: string
  reactionHint: string
  displayTags: string[]
  classification: {
    category: { id: string; label: string } | null
    segment: { id: string; label: string } | null
    niche: { id: string; label: string } | null
    standardizedOccupationId: string | null
  }
  source: string
  confidence: number
  archetypeContext?: {
    primaryArchetype: string | null
    traits: string[]
  }
}

const PROFESSION_REACTION_ENTRIES: [string, string][] = [
    ['产品经理','哇！产品经理的洞察力通常很强，活动里很容易成为话题发起人'],
    ['程序员','程序员逻辑好、脑洞大，跟艺术/创意型的人配在一起常常有意外火花'],
    ['设计师','设计师的审美和观察力，在局里常常是最早发现氛围变化的人'],
    ['运营','运营的网感和沟通能力，天然适合破冰和串联全场'],
    ['销售','销售出身的社交雷达超灵敏，大概率会成为局里的气氛担当'],
    ['市场','市场人嗅觉敏锐、表达有感染力，很容易在局里找到同频搭子'],
    ['教师','老师的倾听和引导能力，是局里最让人安心的存在'],
    ['医生','医务工作者的细腻和责任感，常常能建立很深的信任连接'],
    ['律师','律师的逻辑和表达都很 sharp，跟脑洞型的人碰撞起来特别有意思'],
    ['咨询','咨询背景的框架思维，很容易把散乱的聊天串成高质量对话'],
    ['金融','金融圈的信息密度高，跟文化/艺术背景的人搭配会很有反差张力'],
    ['创业','创业者自带故事感，一聊起经历就很容易引发共鸣'],
    ['学生','学生党的好奇心是最宝贵的社交货币，保持开放就好'],
    ['自由','自由职业的多元经历，本身就是最好的破冰话题'],
    ['freelance','自由职业的多元经历，本身就是最好的破冰话题'],
    ['经理','管理岗的协调力在局里很吃香，你很可能自然地成为小组粘合剂'],
    ['主管','管理岗的协调力在局里很吃香，你很可能自然地成为小组粘合剂'],
    ['总监','管理层看人的眼光通常很准，匹配时我们会重点参考你的气场偏好'],
    ['工程师','工程师的务实和创意并存，跟表达型的人互补度很高'],
    ['研究员','研究型人格的深度思考，很容易在局里找到愿意认真对话的人'],
    ['编辑','编辑的文字敏感度和信息整合力，会让你成为局里的高质量听众'],
    ['记者','记者的好奇心和提问力，天然适合把浅聊带向深聊'],
    ['hr','HR 看人的直觉超准，你在局里可能会最快发现谁和自己最合拍'],
    ['人力','HR 看人的直觉超准，你在局里可能会最快发现谁和自己最合拍'],
    ['行政','行政的细致和周到，是局里最让人感到被照顾的存在'],
    ['翻译','双语/多语背景的你在局里可是稀缺资源，语言匹配会优先考虑你'],
    ['策划','策划人的创意和节奏感，很容易让一场对话变得有层次'],
    ['开发','开发者的专注力和解决问题的能力，在深度话题上特别圈粉'],
    ['数据分析','数据人的理性 + 好奇，常常能把感性话题聊出新鲜角度'],
    ['品牌','品牌人对情绪和趋势的敏感，让你很容易在局里找到共鸣点'],
    ['公关','公关人的情商和应变力，简直是社交局的隐藏 MVP'],
    ['采购','采购的谈判力和资源意识，很容易把弱关系变成强连接'],
    ['物流','供应链人的全局观，让你在看人看事上都更有系统性'],
    ['建筑','建筑/设计背景的空间感和审美，很容易在文化类局里遇到同好'],
    ['土木','工程师的务实和创意并存，跟表达型的人互补度很高'],
    ['会计','财务人的严谨和细节控，在局里是那种让人很安心的存在'],
    ['财务','财务人的严谨和细节控，在局里是那种让人很安心的存在'],
    ['公务员','体制内背景的稳定性和表达分寸感，匹配时会优先考虑温和型搭子'],
    ['艺术家','艺术家的感知力是稀缺资源，我们一定会帮你找到能接住你表达的人'],
    ['摄影师','摄影师的观察力和审美，在局里很容易成为被关注的亮点'],
    ['作家','作家的表达深度和内心世界，值得被真正懂的人发现'],
    ['音乐人','音乐人的情绪感染力，是局里最天然的破冰器'],
    ['厨师','美食爱好者的共情力很强，「吃」本身就是最好的社交语言'],
    ['餐饮','餐饮人的服务意识和共情力，很容易让人感到被照顾'],
    ['美容','美业人的审美力和亲和力，在局里很容易建立第一印象的好感'],
    ['健身','健身/运动背景的自律和活力，匹配时会优先考虑同样高能量的搭子'],
    ['教练','教练的引导和激励能力，很容易在局里成为小组的隐形 leader'],
    ['瑜伽','瑜伽人的平和和觉察力，适合跟同样向内探索的人深聊'],
    ['心理','心理学背景的洞察力和倾听质量，是深度社交局里的宝藏'],
    ['社工','社工的共情和利他心，让你在局里很容易收获真诚的反馈'],
    ['志愿者','公益人的利他心和行动力，匹配时会优先考虑价值观相近的搭子'],
    ['科学家','科研人的好奇心和严谨，很容易在知识型话题上找到深度连接'],
    ['教授','学术背景的深度和表达逻辑，在高质量对话局里特别受欢迎'],
    ['博士','学术背景的深度和表达逻辑，在高质量对话局里特别受欢迎'],
    ['博士后','学术背景的深度和表达逻辑，在高质量对话局里特别受欢迎'],
    ['护士','医务工作者的细腻和责任感，常常能建立很深的信任连接'],
    ['药剂','医药背景的理性和关怀并存，很容易让人产生信任感'],
    ['证券','金融圈的信息密度高，跟文化/艺术背景的人搭配会很有反差张力'],
    ['投资','投资人的判断力和好奇心，在局里很容易引发高质量的思辨'],
    ['保险','保险人的风险意识和长期思维，很适合跟稳重型的人建立连接'],
    ['房地产','地产人的资源整合力和表达力，很容易在局里快速打开局面'],
    ['中介','中介人的信息敏感度和连接力，天然适合破冰和串联'],
    ['司机','运输/服务行业的阅历和观察力，常常能聊出很有深度的故事'],
    ['服务员','服务行业的共情力和细节观察，很容易让人感到被照顾'],
    ['客服','客服的情绪管理和沟通技巧，在局里很容易成为让人舒服的存在'],
    ['前台','前台/接待的第一印象力和礼仪感，很容易在局里建立好感'],
    ['秘书','秘书的细致和协调能力，是局里最让人感到顺畅的存在'],
    ['助理','助理的执行力和观察力，很容易在局里找到互补型搭子'],
    ['主播','主播的表达力和镜头感，在局里很容易成为话题中心'],
    ['网红','内容创作者的表达力和网感，很容易在局里找到同频的有趣灵魂'],
    ['模特','时尚/表演行业的审美力和表现力，很容易在局里吸引注意力'],
    ['演员','表演行业的人的共情力和表现力，很容易在局里创造深刻连接'],
    ['导演','导演的全局观和审美力，很容易把一场闲聊聊出层次感'],
    ['制片','制片人的统筹力和资源整合力，在局里很容易成为隐形组织者'],
    ['编剧','编剧的故事力和观察力，很容易让对话变得有画面感'],
    ['电竞','电竞人的反应力和团队协作意识，很容易在游戏/竞技局里发光'],
    ['动漫','二次元/动漫爱好者的纯粹和创造力，值得被真正懂的人发现'],
    ['游戏','游戏人的策略思维和创造力，在互动型局里特别受欢迎'],
    ['宠物','宠物行业的温柔和耐心，很容易在局里建立轻松信任的氛围'],
    ['花艺','花艺/美学行业的感知力和审美，很容易在文化局里遇到同好'],
    ['手工','手工/匠人的专注力和创造力，很容易在深度话题局里被欣赏'],
    ['烘焙','烘焙人的细腻和分享欲，「美食」本身就是最好的社交语言'],
    ['咖啡','咖啡人的品味和节奏感，很容易在慢聊局里找到舒适的位置'],
    ['茶艺','茶艺人的平和和仪式感，适合跟同样向内探索的人深聊'],
    ['红酒','品酒/侍酒师的品味和知识储备，很容易在高端局里建立话题'],
    ['导游','导游的表达力和知识储备，很容易在局里成为天然的话题发起者'],
    ['空乘','空乘的服务意识和礼仪感，很容易在局里建立良好的第一印象'],
    ['飞行员','飞行员的决断力和视野，很容易在局里引发别人的好奇'],
    ['军人','军人的纪律性和担当感，很容易在局里建立可靠的信任形象'],
    ['警察','警务背景的正义感和观察力，很容易在局里建立可靠的信任形象'],
    ['消防员','应急行业的勇敢和责任感，很容易让人产生敬佩和信任'],
    ['律师助理','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['法务','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['法官','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['检察官','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['coder','程序员逻辑好、脑洞大，跟艺术/创意型的人配在一起常常有意外火花'],
    ['dev','程序员逻辑好、脑洞大，跟艺术/创意型的人配在一起常常有意外火花'],
    ['engineer','工程师的务实和创意并存，跟表达型的人互补度很高'],
    ['teacher','老师的倾听和引导能力，是局里最让人安心的存在'],
    ['doctor','医务工作者的细腻和责任感，常常能建立很深的信任连接'],
    ['nurse','医务工作者的细腻和责任感，常常能建立很深的信任连接'],
    ['student','学生党的好奇心是最宝贵的社交货币，保持开放就好'],
    ['manager','管理岗的协调力在局里很吃香，你很可能自然地成为小组粘合剂'],
    ['sales','销售出身的社交雷达超灵敏，大概率会成为局里的气氛担当'],
    ['marketing','市场人嗅觉敏锐、表达有感染力，很容易在局里找到同频搭子'],
    ['designer','设计师的审美和观察力，在局里常常是最早发现氛围变化的人'],
    ['artist','艺术家的感知力是稀缺资源，我们一定会帮你找到能接住你表达的人'],
    ['writer','作家的表达深度和内心世界，值得被真正懂的人发现'],
    ['researcher','研究型人格的深度思考，很容易在局里找到愿意认真对话的人'],
    ['consultant','咨询背景的框架思维，很容易把散乱的聊天串成高质量对话'],
    ['entrepreneur','创业者自带故事感，一聊起经历就很容易引发共鸣'],
    ['founder','创业者自带故事感，一聊起经历就很容易引发共鸣'],
    ['startup','创业者自带故事感，一聊起经历就很容易引发共鸣'],
    ['data','数据人的理性 + 好奇，常常能把感性话题聊出新鲜角度'],
    ['phd','学术背景的深度和表达逻辑，在高质量对话局里特别受欢迎'],
    ['lawyer','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['musician','音乐人的情绪感染力，是局里最天然的破冰器'],
    ['chef','美食爱好者的共情力很强，「吃」本身就是最好的社交语言'],
    ['photographer','摄影师的观察力和审美，在局里很容易成为被关注的亮点'],
    ['trainer','教练的引导和激励能力，很容易在局里成为小组的隐形 leader'],
    ['coach','教练的引导和激励能力，很容易在局里成为小组的隐形 leader'],
    ['psychologist','心理学背景的洞察力和倾听质量，是深度社交局里的宝藏'],
    ['therapist','心理学背景的洞察力和倾听质量，是深度社交局里的宝藏'],
    ['blogger','内容创作者的表达力和网感，很容易在局里找到同频的有趣灵魂'],
    ['influencer','内容创作者的表达力和网感，很容易在局里找到同频的有趣灵魂'],
    ['streamer','主播的表达力和镜头感，在局里很容易成为话题中心'],
    ['actor','表演行业的人的共情力和表现力，很容易在局里创造深刻连接'],
    ['pilot','飞行员的决断力和视野，很容易在局里引发别人的好奇'],
    ['flight attendant','空乘的服务意识和礼仪感，很容易在局里建立良好的第一印象'],
    ['soldier','军人的纪律性和担当感，很容易在局里建立可靠的信任形象'],
    ['judge','法律背景的严谨和逻辑力，很容易在思辨型话题局里被欣赏'],
    ['editor','编辑的文字敏感度和信息整合力，会让你成为局里的高质量听众'],
    ['journalist','记者的好奇心和提问力，天然适合把浅聊带向深聊'],
    ['reporter','记者的好奇心和提问力，天然适合把浅聊带向深聊'],
    ['brand manager','品牌人对情绪和趋势的敏感，让你很容易在局里找到共鸣点'],
    ['pr','公关人的情商和应变力，简直是社交局的隐藏 MVP'],
    ['buyer','采购的谈判力和资源意识，很容易把弱关系变成强连接'],
    ['logistics','供应链人的全局观，让你在看人看事上都更有系统性'],
    ['architect','建筑/设计背景的空间感和审美，很容易在文化类局里遇到同好'],
    ['accountant','财务人的严谨和细节控，在局里是那种让人很安心的存在'],
    ['civil servant','体制内背景的稳定性和表达分寸感，匹配时会优先考虑温和型搭子'],
    ['social worker','社工的共情和利他心，让你在局里很容易收获真诚的反馈'],
    ['professor','学术背景的深度和表达逻辑，在高质量对话局里特别受欢迎'],
    ['security','安保/应急行业的责任感和观察力，很容易让人产生信任感'],
    ['waitress','服务行业的共情力和细节观察，很容易让人感到被照顾'],
    ['bartender','调酒师的社交力和氛围营造力，在酒局里简直是天然主场'],
    ['sommelier','品酒/侍酒师的品味和知识储备，很容易在高端局里建立话题'],
    ['receptionist','前台/接待的第一印象力和礼仪感，很容易在局里建立良好的第一印象'],
    ['broadcaster','主播的表达力和镜头感，在局里很容易成为话题中心'],
    ['screenwriter','编剧的故事力和观察力，很容易让对话变得有画面感'],
    ['gamer','游戏人的策略思维和创造力，在互动型局里特别受欢迎'],
    ['vet','宠物行业的温柔和耐心，很容易在局里建立轻松信任的氛围'],
    ['florist','花艺/美学行业的感知力和审美，很容易在文化局里遇到同好'],
    ['craftsman','手工/匠人的专注力和创造力，很容易在深度话题局里被欣赏'],
    ['baker','烘焙人的细腻和分享欲，「美食」本身就是最好的社交语言'],
    ['tea master','茶艺人的平和和仪式感，适合跟同样向内探索的人深聊'],
  ]

function getReactionForProfession(text: string): string {
  const lower = text.toLowerCase()
  for (const [keyword, reaction] of PROFESSION_REACTION_ENTRIES) {
    if (lower.includes(keyword.toLowerCase())) {
      return reaction
    }
  }
  return `「${text.trim()}」——这个背景挺有意思的，我先帮你收进档案了。等会儿让悦仔再仔细品一品，看看能挖出什么有趣的连接～`
}

function mapFallbackExpression(reaction: string): XiaoyueExpressionId {
  if (reaction.includes('洞察力') || reaction.includes('逻辑')) return 'testCurious'
  if (reaction.includes('倾听') || reaction.includes('细腻')) return 'testListening'
  if (reaction.includes('故事') || reaction.includes('共鸣')) return 'matchSuccess'
  return 'homeWelcome'
}

function mapSuccessExpression(reaction: string): XiaoyueExpressionId {
  if (reaction.includes('有趣') || reaction.includes('好奇') || reaction.includes('惊喜')) return 'testCurious'
  if (reaction.includes('温暖') || reaction.includes('安心') || reaction.includes('舒服')) return 'testListening'
  if (reaction.includes('棒') || reaction.includes('厉害') || reaction.includes('赞')) return 'matchSuccess'
  return 'coachGuide'
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const DEBOUNCE_MS = 2000
const MAX_SENDS_PER_SESSION = 5
const API_TIMEOUT_MS = 14000

export default function ProfessionChatOverlay({
  visible,
  isClosing = false,
  initialValue = '',
  smartProfession = false,
  onSubmit,
  onSkip,
}: ProfessionChatOverlayProps) {
  const [inputValue, setInputValue] = useState(initialValue)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [bottomAnchorKey, setBottomAnchorKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSent, setHasSent] = useState(false)
  const [showRevealCard, setShowRevealCard] = useState(false)
  const [revealTags, setRevealTags] = useState<string[]>([])
  const [classificationData, setClassificationData] = useState<ProfessionClassificationData | null>(null)
  const [thinkingLabel, setThinkingLabel] = useState<string | null>(null)
  const [retryMessageId, setRetryMessageId] = useState<string | null>(null)
  const [showMaxSendHint, setShowMaxSendHint] = useState(false)
  const maxSendDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showShortHint, setShowShortHint] = useState(false)
  const sendCountRef = useRef(0)
  const lastSendTimeRef = useRef(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bubbleStaggerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const thinkingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastUserTextRef = useRef<string>('')
  const clearThinkingTimers = useCallback(() => {
    thinkingTimersRef.current.forEach((timer) => clearTimeout(timer))
    thinkingTimersRef.current = []
  }, [])
  const analytics = useOnboardingAnalytics('essential-data', { enabled: true, autoTrackStart: false })
  const deviceTier = useDeviceTier()
  const [isOnline, setIsOnline] = useState(true)
  const inFlightAbortRef = useRef<AbortController | null>(null)
  const isSubmittingRef = useRef(isSubmitting)
  isSubmittingRef.current = isSubmitting

  useEffect(() => {
    if (visible && !isClosing) {
      setInputValue(initialValue)
      setMessages([
        { id: generateId(), sender: 'xiaoyue', text: OPENING_MESSAGE, expressionId: 'coachGuide' },
      ])
      setIsSubmitting(false)
      setHasSent(false)
      setShowRevealCard(false)
      setRevealTags([])
      setClassificationData(null)
      setRetryMessageId(null)
      setShowMaxSendHint(false)
      sendCountRef.current = 0
      lastSendTimeRef.current = 0
      lastUserTextRef.current = ''
      setShowShortHint(false)

      // Check network status on open
      Taro.getNetworkType({
        success: (res) => setIsOnline(res.networkType !== 'none'),
        fail: () => setIsOnline(true), // optimistic default
      })
    }
  }, [visible, isClosing, initialValue])

  // Keep network status fresh during the session — separate effect for stable cleanup
  useEffect(() => {
    if (!visible) return
    const networkHandler = (res: { isConnected: boolean; networkType: string }) => {
      setIsOnline(res.isConnected && res.networkType !== 'none')
    }
    Taro.onNetworkStatusChange(networkHandler)
    return () => {
      Taro.offNetworkStatusChange(networkHandler)
    }
  }, [visible])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current)
      if (bubbleStaggerRef.current) clearTimeout(bubbleStaggerRef.current)
      if (maxSendDismissTimerRef.current) clearTimeout(maxSendDismissTimerRef.current)
      clearThinkingTimers()
    }
  }, [])

  useEffect(() => {
    const handler = (res: { height: number }) => {
      if (!visible) return
      setKeyboardHeight(res.height)
      if (res.height > 0) {
        // Force scroll-to-bottom when keyboard opens so input row stays visible
        setBottomAnchorKey((k) => k + 1)
      }
    }
    Taro.onKeyboardHeightChange(handler)
    return () => {
      Taro.offKeyboardHeightChange(handler)
    }
  }, [visible])

  const handleSendNew = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSubmittingRef.current) return

    // Encourage more detail for very short input
    if (text.length < 3 && !hasSent) {
      setShowShortHint(true)
      return
    }
    setShowShortHint(false)

    const now = Date.now()
    if (now - lastSendTimeRef.current < DEBOUNCE_MS) return
    if (sendCountRef.current >= MAX_SENDS_PER_SESSION) {
      setShowMaxSendHint(true)
      analytics.interaction('profession_chat_max_send_reached')
      if (maxSendDismissTimerRef.current) clearTimeout(maxSendDismissTimerRef.current)
      maxSendDismissTimerRef.current = setTimeout(() => setShowMaxSendHint(false), 4000)
      return
    }

    // Offline guard — show graceful message instead of failing silently
    if (!isOnline) {
      analytics.interaction('profession_chat_offline_blocked')
      Taro.showToast({ title: '网络好像断了，请检查连接后再试', icon: 'none', duration: 2000 })
      return
    }

    sendCountRef.current++
    lastSendTimeRef.current = now
    lastUserTextRef.current = text

    setIsSubmitting(true)
    setHasSent(true)
    setShowRevealCard(false)
    setRetryMessageId(null)
    setShowMaxSendHint(false)
    clearThinkingTimers()
    setThinkingLabel(null)
    // Warm, Xiaoyue-personality thinking labels — rotate to feel alive
    const thinkingLabels = [
      '让我想想…这个职业的小伙伴在局里是什么画风呢',
      '嗯，有点意思，我再品一品～',
      '已经在帮你匹配同频的小伙伴了，稍等片刻～',
    ]
    thinkingTimersRef.current = [
      setTimeout(() => setThinkingLabel(thinkingLabels[0]), 800),
      setTimeout(() => setThinkingLabel(thinkingLabels[1]), 2800),
      setTimeout(() => setThinkingLabel(thinkingLabels[2]), 5200),
    ]

    const userMsg: ChatMessage = { id: generateId(), sender: 'user', text }
    setMessages((prev) => [...prev, userMsg])
    setBottomAnchorKey((k) => k + 1)

    try {
      // Cancel any in-flight request before starting a new one
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort()
      }
      inFlightAbortRef.current = new AbortController()

      const data = await apiRequest<UnderstandProfessionResponse>({
        path: '/api/inference/understand-profession',
        method: 'POST',
        data: { description: text },
        timeout: API_TIMEOUT_MS,
      })

      inFlightAbortRef.current = null

      // Skip low-quality echo hints (e.g., "投资银行！投资银行方向？")
      const hintText = data.reactionHint.trim()
      const lowerHint = hintText.toLowerCase()
      const lowerText = text.toLowerCase()
      const isEcho = lowerHint.startsWith(lowerText) &&
        (hintText.length <= text.length + 6 ||
         hintText.replace(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').trim().length < 6)
      if (isEcho) {
        analytics.interaction('profession_chat_echo_suppressed', {
          hintLength: hintText.length,
          inputLength: text.length,
        })
      } else {
        const hintMsg: ChatMessage = {
          id: generateId(),
          sender: 'xiaoyue',
          text: data.reactionHint,
          expressionId: mapSuccessExpression(data.reactionHint),
        }
        setMessages((prev) => [...prev, hintMsg])
      }

      bubbleStaggerRef.current = setTimeout(() => {
        const fullMsg: ChatMessage = {
          id: generateId(),
          sender: 'xiaoyue',
          text: data.reaction,
          expressionId: mapSuccessExpression(data.reaction),
        }
        setMessages((prev) => [...prev, fullMsg])
        setBottomAnchorKey((k) => k + 1)
        setIsSubmitting(false)
        clearThinkingTimers()
        setThinkingLabel(null)

        const tags = data.displayTags.filter(Boolean)
        if (tags.length > 0) {
          setRevealTags(tags)
          setShowRevealCard(true)
          haptics('success')
          analytics.interaction('profession_chat_classification_success', {
            tagCount: tags.length,
            confidence: data.confidence,
            source: data.source,
          })
        }
        setClassificationData({
          occupationId: text,
          standardizedOccupationId: data.classification.standardizedOccupationId,
          industryCategoryLabel: data.classification.category?.label ?? null,
          industrySegmentLabel: data.classification.segment?.label ?? null,
          industryNicheLabel: data.classification.niche?.label ?? null,
          industryCategory: data.classification.category?.id ?? null,
          industrySegmentNew: data.classification.segment?.id ?? null,
          industryNiche: data.classification.niche?.id ?? null,
          industrySource: data.source,
          industryConfidence: data.confidence,
        })
      }, 400)
    } catch (_err) {
      inFlightAbortRef.current = null
      clearThinkingTimers()
      const didTimeout = _err instanceof Error && (
        _err.name === 'AbortError' ||
        /timeout|超时/.test(_err.message.toLowerCase())
      )
      analytics.interaction('profession_chat_classification_fallback', {
        errorType: _err instanceof Error ? _err.name : 'unknown',
        inputLength: text.length,
        timedOut: didTimeout,
      })
      const reaction = getReactionForProfession(text)
      // Refund send quota on failure so user can retry
      sendCountRef.current = Math.max(0, sendCountRef.current - 1)
      const fallbackMsgId = generateId()
      setMessages((prev) => [
        ...prev,
        { id: fallbackMsgId, sender: 'xiaoyue', text: reaction, expressionId: mapFallbackExpression(reaction), isFallback: true },
      ])
      setRetryMessageId(fallbackMsgId)
      setBottomAnchorKey((k) => k + 1)
      setIsSubmitting(false)
      setThinkingLabel(null)

      setClassificationData({
        occupationId: text,
        standardizedOccupationId: null,
        industryCategoryLabel: null,
        industrySegmentLabel: null,
        industryNicheLabel: null,
        industryCategory: null,
        industrySegmentNew: null,
        industryNiche: null,
        industrySource: didTimeout ? 'timeout_fallback' : 'fallback',
        industryConfidence: 0,
      })
    }
  }, [inputValue, isSubmitting, isOnline, analytics, clearThinkingTimers])

  const handleSendLegacy = useCallback(() => {
    const text = inputValue.trim()
    if (!text || isSubmitting) return

    setIsSubmitting(true)
    setHasSent(true)
    const userMsg: ChatMessage = { id: generateId(), sender: 'user', text }
    setMessages((prev) => [...prev, userMsg])

    timeoutRef.current = setTimeout(() => {
      const reaction = getReactionForProfession(text)
      setMessages((prev) => [...prev, { id: generateId(), sender: 'xiaoyue', text: reaction, expressionId: 'coachGuide' }])
      setIsSubmitting(false)
      setBottomAnchorKey((k) => k + 1)
    }, 600)
  }, [inputValue, isSubmitting])

  const handleSend = smartProfession ? handleSendNew : handleSendLegacy

  const handleRetry = useCallback(() => {
    const text = lastUserTextRef.current
    if (!text || isSubmittingRef.current) return
    analytics.interaction('profession_chat_retry_tapped', {
      inputLength: text.length,
    })
    // Remove the retry button by clearing retryMessageId
    setRetryMessageId(null)
    // Re-trigger with the same text
    setInputValue(text)
    // Use requestAnimationFrame for smoother timing than setTimeout(..., 0)
    requestAnimationFrame(() => {
      if (smartProfession) {
        handleSendNew()
      } else {
        handleSendLegacy()
      }
    })
  }, [smartProfession, handleSendNew, handleSendLegacy, analytics])

  const handleSkip = useCallback(() => {
    haptics('light')
    analytics.interaction('profession_chat_skipped')
    setMessages((prev) => [
      ...prev,
      { id: generateId(), sender: 'xiaoyue', text: SKIP_RESPONSE, expressionId: 'homeWelcome' },
    ])
    skipTimeoutRef.current = setTimeout(() => {
      onSkip()
    }, 400)
  }, [onSkip, analytics])

  const handleConfirm = useCallback(() => {
    analytics.interaction('profession_chat_confirmed', {
      hasClassification: !!classificationData,
      source: classificationData?.industrySource ?? 'legacy',
      tagCount: revealTags.length,
    })
    if (smartProfession && classificationData) {
      onSubmit(inputValue.trim(), classificationData)
    } else {
      onSubmit(inputValue.trim())
    }
  }, [smartProfession, classificationData, inputValue, onSubmit, analytics, revealTags.length])

  const canSubmit = inputValue.trim().length > 0 || hasSent

  const scrollIntoView = useMemo(() => {
    if (messages.length === 0) return ''
    return `bottom-anchor-${bottomAnchorKey}`
  }, [bottomAnchorKey])

  const messageList = useMemo(() => messages.map((msg) => (
    <CustomWrapper key={msg.id}>
      <View
        id={`msg-${msg.id}`}
        className={`profession-overlay__message profession-overlay__message--${msg.sender}`}
        onAnimationEnd={(e) => {
          // Remove will-change after entrance animation completes to free GPU memory
          const target = e.currentTarget as unknown as HTMLElement
          if (target) target.style.willChange = 'auto'
        }}
      >
        {msg.sender === 'xiaoyue' && (
          <View className='profession-overlay__avatar' aria-label='悦仔'>
            <Image
              className='profession-overlay__avatar-img'
              src={getXiaoyueExpressionAsset(msg.expressionId ?? 'coachGuide')}
              mode='aspectFill'
              lazyLoad
            />
          </View>
        )}
        <View className={[
          'profession-overlay__bubble',
          `profession-overlay__bubble--${msg.sender}`,
          msg.isFallback ? 'profession-overlay__bubble--fallback' : '',
        ].filter(Boolean).join(' ')}>
          <Text className='profession-overlay__bubble-text'>{msg.text}</Text>
          {msg.isFallback && msg.id === retryMessageId && (
            <View className='profession-overlay__retry-hint' onClick={handleRetry} hoverClass='profession-overlay__retry-hint--active' hoverStayTime={100}>
              <Text className='profession-overlay__retry-hint-text'>没识别准确？点击重新分析</Text>
            </View>
          )}
        </View>
      </View>
    </CustomWrapper>
  )), [messages, retryMessageId, handleRetry])

  if (!visible && !isClosing) return null

  return (
    <View className={[
      'profession-overlay',
      isClosing ? 'profession-overlay--closing' : '',
      deviceTier.isDegradation ? 'profession-overlay--low-end' : '',
    ].filter(Boolean).join(' ')}>
      <View className='profession-overlay__header'>
        <View className='profession-overlay__step-badge'>
          <Text className='profession-overlay__step-badge-text'>2 / 5</Text>
        </View>
        <View className='profession-overlay__skip' onClick={handleSkip} aria-label='跳过职业输入' hoverClass='profession-overlay__skip--active' hoverStartTime={0} hoverStayTime={100}>
          <Text className='profession-overlay__skip-text'>跳过</Text>
        </View>
      </View>

      <ScrollView
        className='profession-overlay__chat'
        scrollY
        enhanced
        showScrollbar={false}
        scrollIntoView={scrollIntoView}
        style={{ paddingBottom: `${keyboardHeight}px` }}
        aria-live='polite'
        aria-atomic='false'
      >
        <View className='profession-overlay__chat-inner'>
          {messageList}
          {isSubmitting && (
            <View className='profession-overlay__message profession-overlay__message--xiaoyue'>
              <View className='profession-overlay__avatar'>
                <Image
                  className='profession-overlay__avatar-img'
                  src={getXiaoyueExpressionAsset('loadingSystem')}
                  mode='aspectFill'
                  lazyLoad
                />
              </View>
              <View className='profession-overlay__bubble profession-overlay__bubble--xiaoyue'>
                <View className='profession-overlay__typing'>
                  <View className='profession-overlay__typing-dot' />
                  <View className='profession-overlay__typing-dot' />
                  <View className='profession-overlay__typing-dot' />
                  {thinkingLabel && (
                    <Text className='profession-overlay__typing-label' aria-live='polite'>{thinkingLabel}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
          <View id={`bottom-anchor-${bottomAnchorKey}`} style={{ height: 1, width: '100%' }} />
        </View>
      </ScrollView>

      <View
        className='profession-overlay__input-bar'
        style={{ paddingBottom: `max(24rpx, ${keyboardHeight}px)` }}
      >
        <Input
          className='profession-overlay__input'
          placeholder={isSubmitting ? '悦仔正在琢磨中…' : '告诉我你的职业~'}
          value={inputValue}
          onInput={(e) => setInputValue(e.detail.value)}
          onConfirm={handleSend}
          maxlength={50}
          adjustPosition={false}
          holdKeyboard
          disabled={isSubmitting}
          confirmType='send'
          cursorSpacing={32}
        />
        {canSubmit ? (
          <View
            className={`profession-overlay__send${isSubmitting ? ' profession-overlay__send--disabled' : ''}`}
            onClick={() => { if (!isSubmitting) { haptics('medium'); handleSend() } }}
            aria-label='发送'
            hoverClass='profession-overlay__send--active'
            hoverStartTime={0}
            hoverStayTime={100}
          >
            <View className='profession-overlay__send-arrow' />
          </View>
        ) : null}
      </View>

      {/* Preload common Xiaoyue expressions to eliminate first-render flicker */}
      <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0 }}>
        <Image src={getXiaoyueExpressionAsset('coachGuide')} mode='aspectFill' />
        <Image src={getXiaoyueExpressionAsset('loadingSystem')} mode='aspectFill' />
        <Image src={getXiaoyueExpressionAsset('homeWelcome')} mode='aspectFill' />
        <Image src={getXiaoyueExpressionAsset('testCurious')} mode='aspectFill' />
        <Image src={getXiaoyueExpressionAsset('testListening')} mode='aspectFill' />
        <Image src={getXiaoyueExpressionAsset('matchSuccess')} mode='aspectFill' />
      </View>

      {showRevealCard && revealTags.length > 0 && (
        <View
          className={[
            'profession-overlay__reveal-card',
            classificationData?.industrySource?.includes('fallback') ? 'profession-overlay__reveal-card--fallback' : '',
          ].filter(Boolean).join(' ')}
          role='region'
          aria-label='职业分析结果'
        >
          {/* Success celebration sparkles — CSS-only, GPU-composited */}
          {!classificationData?.industrySource?.includes('fallback') && (
            <View className='profession-overlay__celebration' aria-hidden='true'>
              <View className='profession-overlay__sparkle profession-overlay__sparkle--1' />
              <View className='profession-overlay__sparkle profession-overlay__sparkle--2' />
              <View className='profession-overlay__sparkle profession-overlay__sparkle--3' />
              <View className='profession-overlay__sparkle profession-overlay__sparkle--4' />
              <View className='profession-overlay__sparkle profession-overlay__sparkle--5' />
            </View>
          )}
          <View className='profession-overlay__reveal-title-row'>
            {!classificationData?.industrySource?.includes('fallback') && (
              <View className='profession-overlay__reveal-checkmark'>
                <View className='profession-overlay__reveal-checkmark-stem' />
                <View className='profession-overlay__reveal-checkmark-kick' />
              </View>
            )}
            <Text className='profession-overlay__reveal-title'>
              {classificationData?.industrySource?.includes('fallback') ? '已收进档案，悦仔正在细品' : '你的匹配画像已更新'}
            </Text>
          </View>
          <View className='profession-overlay__reveal-tags'>
            {revealTags.map((tag) => (
              <Chip key={tag} label={tag} selected level={1} compact />
            ))}
          </View>
          {classificationData?.industrySource?.includes('fallback') && (
            <Text className='profession-overlay__reveal-hint'>网络有点慢，悦仔先记下了。等信号好了再帮你细细分析～</Text>
          )}
          <View className='profession-overlay__reveal-confirm' onClick={() => { haptics('success'); handleConfirm() }} aria-label='确认并继续' hoverClass='profession-overlay__reveal-confirm--active' hoverStartTime={0} hoverStayTime={100}>
            <Text className='profession-overlay__reveal-confirm-text'>确认并继续</Text>
          </View>
        </View>
      )}

      {!isOnline && (
        <View className='profession-overlay__offline-banner'>
          <Text className='profession-overlay__offline-banner-text'>网络已断开，请检查连接</Text>
        </View>
      )}

      {showShortHint && !isSubmitting && (
        <View className='profession-overlay__short-hint'>
          <Text className='profession-overlay__short-hint-text'>多写一点，悦仔才能更懂你～</Text>
        </View>
      )}

      {showMaxSendHint && (
        <View className='profession-overlay__max-send-hint'>
          <Text className='profession-overlay__max-send-hint-text'>已达到最大重试次数，先继续吧～</Text>
        </View>
      )}

      {retryMessageId && !isSubmitting && !showRevealCard && (
        <View className='profession-overlay__retry-bar'>
          <View className='profession-overlay__retry-btn' onClick={() => { haptics('medium'); handleRetry() }} aria-label='重试' hoverClass='profession-overlay__retry-btn--active' hoverStartTime={0} hoverStayTime={100}>
            <Text className='profession-overlay__retry-btn-text'>重试</Text>
          </View>
        </View>
      )}

      {canSubmit && !isSubmitting && !showRevealCard && (
        <View
          className='profession-overlay__cta'
        style={keyboardHeight > 0 ? { paddingBottom: `${keyboardHeight}px` } : undefined}
        >
          <View className='profession-overlay__cta-btn' onClick={() => { haptics('medium'); handleConfirm() }} aria-label='确认并继续' hoverClass='profession-overlay__cta-btn--active' hoverStartTime={0} hoverStayTime={100}>
            <Text className='profession-overlay__cta-text'>确认并继续</Text>
          </View>
        </View>
      )}
    </View>
  )
}
