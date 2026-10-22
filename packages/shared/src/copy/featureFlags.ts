// 特征开关后台页面的中文显示名与功能描述。
// 契约测试：apps/server/src/__tests__/featureFlagCopyContract.test.ts 强制本文件覆盖 FLAG_ENV_MAP 每个 key，
// 且每个 key 必须归属到一个已声明的分区（FEATURE_FLAG_SECTIONS）。
// 文案面向内部运营/超管，默认状态以 FLAG_ENV_MAP / DEFAULT_FLAG_VALUES 注释为准。

// ── 分区定义（admin 页面按此顺序分组渲染）────────────────
export interface FeatureFlagSection {
  id: string
  label: string
  description: string
}

export const FEATURE_FLAG_SECTIONS: FeatureFlagSection[] = [
  { id: 'onboarding', label: '新手引导与落地页', description: '新用户从落地页到完成资料填写的引导链路' },
  { id: 'personality-test', label: '人格测试与命格揭晓', description: '答题过程、命格揭晓动画与结果分享物料' },
  { id: 'discover-registration', label: '发现页与报名页', description: '发现页活动流、报名页首屏展示与游客预览' },
  {
    id: 'registration-payment',
    label: '报名、支付与退款',
    description: '报名资格、支付与退款管线，以及报名成功后的流程动效（涉及资金，改动需谨慎）',
  },
  { id: 'matching', label: '匹配与排桌', description: '报名截止后的排桌成组、契合度策略与结果复核' },
  { id: 'squad-unboxing', label: '桌友揭晓', description: '排桌完成后揭晓同桌成员的体验' },
  { id: 'venue', label: '场地分配', description: '活动场地的自动分配与预算邻近放宽' },
  { id: 'gathering-room', label: '集结房间', description: '活动开始前线上集结房间的总开关' },
  {
    id: 'icebreaker-core',
    label: '现场冰局·流程与现场体验',
    description: '冰局流程模板、模式与主持人控制、现场感官反馈与内容个性化生成',
  },
  {
    id: 'icebreaker-gameplay',
    label: '现场冰局·玩法升级',
    description: '各玩法环节的升级版、本局高光提炼与回顾分享，随游戏性大版本统一放行',
  },
  { id: 'notifications', label: '消息通知', description: '微信订阅消息等站外触达，需配置对应模板' },
  { id: 'profile', label: '个人主页', description: '主页形象、装扮体系与个人故事' },
  { id: 'alang-flash', label: '街头盲盒', description: '街头盲盒（阿浪）总开关、剧情引擎与测试开关' },
  { id: 'content-compliance', label: '内容与合规', description: '内容审核、AIGC 角标与隐私相关开关' },
]

export const FEATURE_FLAG_SECTION_BY_KEY: Record<string, string> = {
  // 新手引导与落地页
  restartOnboarding: 'onboarding',
  smartProfession: 'onboarding',
  onboardingForceSkip: 'onboarding',
  guidanceQueueEnabled: 'onboarding',
  discoverSpotlightEnabled: 'onboarding',
  landingStepLoopEnabled: 'onboarding',
  testIntroWhyLineEnabled: 'onboarding',
  testGatherGlowEnabled: 'onboarding',
  entryCardInsightV2Enabled: 'onboarding',

  // 人格测试与命格揭晓
  personalityTestEchoEnabled: 'personality-test',
  personalitySlotAnimationEnabled: 'personality-test',
  personalitySlotCurvatureEnabled: 'personality-test',
  personalitySlotProfileFast: 'personality-test',
  personalitySlotProfileDramatic: 'personality-test',
  personalityShareEnabled: 'personality-test',
  shareAnimatedClipEnabled: 'personality-test',
  shareQrCodeEnabled: 'personality-test',

  // 发现页与报名页
  promoBannerEnabled: 'discover-registration',
  oracleCardCornerStatEnabled: 'discover-registration',
  poolTeaserEnabled: 'discover-registration',
  personaSnapshotEnabled: 'discover-registration',
  guestEventPreviewEnabled: 'discover-registration',
  flashTeaserHeroEnabled: 'discover-registration',

  // 报名、支付与退款
  registrationEnabled: 'registration-payment',
  duoRegistrationEnabled: 'registration-payment',
  paymentsEnabled: 'registration-payment',
  checkoutSubscriptionUpsellEnabled: 'registration-payment',
  preRevealRefundEnabled: 'registration-payment',
  noRefundAfterReveal: 'registration-payment',
  autoRefundEnabled: 'registration-payment',
  poolCompletionSweepEnabled: 'registration-payment',
  flowLifecycleEnabled: 'registration-payment',

  // 匹配与排桌
  matchingLiveReveal: 'matching',
  matchingPuzzlePreludeEnabled: 'matching',
  matchingOperatorReviewEnabled: 'matching',
  matchNeverMeetSentinel: 'matching',
  magnetismGroupRulesEnabled: 'matching',
  magnetismWeightProfileV2Enabled: 'matching',
  matchChemistryCalibrationEnabled: 'matching',
  compositionGatesEnabled: 'matching',
  tableViabilityFloorEnabled: 'matching',
  matchHistoryNoveltyEnabled: 'matching',
  derivedChemistryEnabled: 'matching',

  // 桌友揭晓
  squadUnboxingDragRevealEnabled: 'squad-unboxing',
  squadUnboxingTeaseV2Enabled: 'squad-unboxing',
  socialSquadComposedHeroEnabled: 'squad-unboxing',
  squadUnboxingPocketDeckEnabled: 'squad-unboxing',

  // 场地分配
  venueAssignmentEnabled: 'venue',
  budgetAdjacencyEnabled: 'venue',

  // 集结房间
  gatheringRoomEnabled: 'gathering-room',

  // 现场冰局·流程与现场体验
  socialIcebreakerClientForceEnd: 'icebreaker-core',
  socialIcebreakerCustomModeEnabled: 'icebreaker-core',
  runPlanTemplatesEnabled: 'icebreaker-core',
  icebreakerContentStatusEnabled: 'icebreaker-core',
  icebreakerHapticGrammarEnabled: 'icebreaker-core',
  icebreakerMoodFieldEnabled: 'icebreaker-core',
  icebreakerGlanceStackEnabled: 'icebreaker-core',
  icebreakerGroupBeatsEnabled: 'icebreaker-core',
  icebreakerAudioEnabled: 'icebreaker-core',
  icebreakerMatchingAwareEnabled: 'icebreaker-core',

  // 现场冰局·玩法升级
  miniscriptEvidenceVoteV2Enabled: 'icebreaker-gameplay',
  lieDetectiveV2Enabled: 'icebreaker-gameplay',
  personalityDiceChooseModeEnabled: 'icebreaker-gameplay',
  auctionV2Enabled: 'icebreaker-gameplay',
  highlightsInjectorEnabled: 'icebreaker-gameplay',
  sessionGlowEnabled: 'icebreaker-gameplay',
  recapSharePosterEnabled: 'icebreaker-gameplay',
  quipInspirationChipsEnabled: 'icebreaker-gameplay',

  // 消息通知
  subscribeRemindersEnabled: 'notifications',

  // 个人主页
  profileRedesignEnabled: 'profile',
  profilePixelAvatarEnabled: 'profile',
  profileIdentityStageEnabled: 'profile',
  equipmentRewardsEnabled: 'profile',
  personalStoryEnabled: 'profile',

  // 街头盲盒
  alangEnabled: 'alang-flash',
  flashShenzhenLocationGateEnabled: 'alang-flash',
  flashTaskRetryTestEnabled: 'alang-flash',
  flashAnyLocationArrivalTestEnabled: 'alang-flash',
  flashStoryV2Enabled: 'alang-flash',
  flashStoryActionsEnabled: 'alang-flash',
  flashStoryAiResponsesEnabled: 'alang-flash',

  // 内容与合规
  contentModerationMsgSecCheckEnabled: 'content-compliance',
  contentModerationSevereFailClosedEnabled: 'content-compliance',
  aigcLabelsEnabled: 'content-compliance',
  industryCohortCountEnabled: 'content-compliance',
  wechatIdCollectionEnabled: 'content-compliance',
}

export const FEATURE_FLAG_LABELS: Record<string, string> = {
  // ── 新手引导与落地页 ──────────────────────────────
  restartOnboarding: '允许重置新手引导',
  smartProfession: '智能职业识别',
  onboardingForceSkip: '引导强制跳过',
  guidanceQueueEnabled: '引导提示队列',
  discoverSpotlightEnabled: '发现页报名指引高亮',
  landingStepLoopEnabled: '落地页三步引导动效',
  testIntroWhyLineEnabled: '人格测试开场导语',
  testGatherGlowEnabled: '答题聚光动效',
  entryCardInsightV2Enabled: '档案卡悦仔观察',

  // ── 人格测试与命格揭晓 ────────────────────────────
  personalityTestEchoEnabled: '答题回声动画',
  personalitySlotAnimationEnabled: '命格转盘动画',
  personalitySlotCurvatureEnabled: '转盘三维鼓面',
  personalitySlotProfileFast: '转盘快节奏时序',
  personalitySlotProfileDramatic: '转盘戏剧化时序',
  personalityShareEnabled: '人格结果分享海报',
  shareAnimatedClipEnabled: '动态分享短片',
  shareQrCodeEnabled: '分享海报小程序码',

  // ── 发现页与报名页 ────────────────────────────────
  promoBannerEnabled: '发现页活动横幅',
  oracleCardCornerStatEnabled: '活动卡报名人数角标',
  poolTeaserEnabled: '报名页流程预告条',
  personaSnapshotEnabled: '报名页人格拼图预览',
  guestEventPreviewEnabled: '游客活动预告卡',
  flashTeaserHeroEnabled: '街头盲盒悬念横幅',

  // ── 匹配与排桌 ────────────────────────────────────
  matchingLiveReveal: '匹配结果实时揭晓',
  matchingPuzzlePreludeEnabled: '揭晓前拼图悬念',
  matchingOperatorReviewEnabled: '匹配结果人工复核',
  matchNeverMeetSentinel: '不愿再见硬排除',
  magnetismGroupRulesEnabled: '惊艳开局组队规则',
  magnetismWeightProfileV2Enabled: '契合权重新方案',
  matchChemistryCalibrationEnabled: '契合度自动校准',
  compositionGatesEnabled: '组队构成硬门槛',
  tableViabilityFloorEnabled: '成桌可行性底线',
  matchHistoryNoveltyEnabled: '反小圈子新颖约束',
  derivedChemistryEnabled: '推演契合矩阵',

  // ── 报名、支付与退款 ──────────────────────────────
  registrationEnabled: '活动报名总开关',
  duoRegistrationEnabled: '双人同行报名',
  paymentsEnabled: '支付系统总开关',
  checkoutSubscriptionUpsellEnabled: '下单页悦聚月卡推荐',
  preRevealRefundEnabled: '开盲盒前可退款',
  noRefundAfterReveal: '开盲盒后取消不退款',
  autoRefundEnabled: '场次未成行自动退款',
  poolCompletionSweepEnabled: '局自动完结清扫',
  flowLifecycleEnabled: '报名后盲盒生命周期动效',

  // ── 场地分配 ──────────────────────────────────────
  venueAssignmentEnabled: '场地自动分配',
  budgetAdjacencyEnabled: '预算邻近放宽分配',

  // ── 消息通知 ──────────────────────────────────────
  subscribeRemindersEnabled: '微信订阅消息提醒',

  // ── 现场冰局·流程与现场体验 ───────────────────────
  socialIcebreakerClientForceEnd: '冰局客户端强制结束',
  socialIcebreakerCustomModeEnabled: '自定义冰局模式',
  runPlanTemplatesEnabled: '冰局流程模板',
  icebreakerContentStatusEnabled: '冰局内容状态显示',
  icebreakerHapticGrammarEnabled: '冰局触感语法',
  icebreakerMoodFieldEnabled: '冰局氛围色场',
  icebreakerGlanceStackEnabled: '冰局速览层级',
  icebreakerGroupBeatsEnabled: '冰局全员同步节拍',
  icebreakerAudioEnabled: '冰局轻音效',
  icebreakerMatchingAwareEnabled: '冰局匹配感知生成',

  // ── 现场冰局·玩法升级 ─────────────────────────────
  miniscriptEvidenceVoteV2Enabled: '剧本杀证物与动机投票',
  lieDetectiveV2Enabled: '真假侦探 V2 模式',
  personalityDiceChooseModeEnabled: '人格骰子自选模式',
  auctionV2Enabled: '虚拟拍卖 V2',
  highlightsInjectorEnabled: '本场高光注入',
  sessionGlowEnabled: '高光值与勋章',
  recapSharePosterEnabled: '回顾页高光卡分享',
  quipInspirationChipsEnabled: '妙语灵感起手',

  // ── 桌友揭晓 ──────────────────────────────────────
  squadUnboxingDragRevealEnabled: '拖拽揭晓桌友',
  squadUnboxingTeaseV2Enabled: '揭晓前预告文案池',
  socialSquadComposedHeroEnabled: '揭晓页组合主视觉',
  squadUnboxingPocketDeckEnabled: '桌友卡收起',

  // ── 集结房间 ──────────────────────────────────────
  gatheringRoomEnabled: '集结房间',

  // ── 个人主页 ──────────────────────────────────────
  profileRedesignEnabled: '个人主页新版',
  profilePixelAvatarEnabled: '我的形象馆',
  profileIdentityStageEnabled: '主页身份景深背景',
  equipmentRewardsEnabled: '装扮奖励系统',
  personalStoryEnabled: '个人故事',

  // ── 街头盲盒 ──────────────────────────────────────
  alangEnabled: '街头盲盒总开关',
  flashShenzhenLocationGateEnabled: '街头盲盒深圳定位限制',
  flashTaskRetryTestEnabled: '街头盲盒任务复测',
  flashAnyLocationArrivalTestEnabled: '街头盲盒任意地点到达测试',
  flashStoryV2Enabled: '盲盒剧情 V2 引擎',
  flashStoryActionsEnabled: '盲盒剧情互动节点',
  flashStoryAiResponsesEnabled: '盲盒剧情 AI 回复润色',

  // ── 内容与合规 ────────────────────────────────────
  contentModerationMsgSecCheckEnabled: '微信语义内容审核',
  contentModerationSevereFailClosedEnabled: '严重违规硬拦截',
  aigcLabelsEnabled: 'AI 生成内容角标',
  industryCohortCountEnabled: '同行业同侪人数查询',
  wechatIdCollectionEnabled: '微信号收集',
}

export const FEATURE_FLAG_DESCRIPTIONS: Record<string, string> = {
  // ── 新手引导与落地页 ──────────────────────────────
  restartOnboarding: '默认关闭。开启后，已完成新手引导的用户可在设置中重置引导进度，重新走一遍完整流程。',
  smartProfession: '默认开启。开启后，用户用自由文本填写职业时会触发智能分类，自动归入标准职业类别，减少手选成本；关闭后退回关键词模板反应，且不再产出职业分类数据。',
  onboardingForceSkip:
    '默认关闭。仅内部测试，谨慎开启：开启后所有用户在新手引导页面都会看到「跳过」按钮，会绕过正常引导流程，生产环境禁止开启。',
  guidanceQueueEnabled:
    '默认关闭。开启后启用服务端引导提示队列：记录用户已看过的提示、同一时刻最多展示一条，并在发现页接入新手指引气泡。需先完成两周基线数据观察再开启。',
  discoverSpotlightEnabled:
    '默认关闭。骨架位（未接入）：引导迭代 W1 预注册，原计划 W3 消费，当前无任何消费方，开启无效果。设计意图：发现页活动卡片展示报名指引高亮（光标点 + 价格角标），引导新用户完成首次报名。',
  landingStepLoopEnabled:
    '默认关闭。骨架位（未接入）：引导迭代 W1 预注册，原计划 W2a 消费，当前无任何消费方，开启无效果。设计意图：落地页三步流程的微动效循环演示，帮助新用户理解玩法。',
  testIntroWhyLineEnabled:
    '默认关闭。骨架位（未接入）：引导迭代 W1 预注册，原计划 W2b 消费，当前无任何消费方，开启无效果。设计意图：人格测试开场页展示「为什么要测」的说明文案，降低开始测试的心理门槛。',
  testGatherGlowEnabled:
    '默认关闭。骨架位（未接入）：引导迭代 W1 预注册，原计划 W4 消费，当前无任何消费方，开启无效果。设计意图：人格测试答题提交时的聚光动效反馈，强化每题作答的仪式感。',
  entryCardInsightV2Enabled:
    '默认开启，为已上线功能的回退开关。开启后，资料复核卡展示悦仔的三行观察解读与依据标签；关闭后回退为单行标签语样式，无需发版。',

  // ── 人格测试与命格揭晓 ────────────────────────────
  personalityTestEchoEnabled: '默认开启。开启后，人格测试答题之间展示「回声」式加载状态；关闭后降级为普通加载指示。',
  personalitySlotAnimationEnabled: '默认开启。开启后，人格测试结果页播放命格转盘揭晓动画；关闭时结果直接展示。',
  personalitySlotCurvatureEnabled:
    '默认开启。开启后，命格揭晓转盘呈立体鼓面弯曲效果；关闭时降级为平面缩放效果，无需发版。注意：客户端代码里还有一个写死的总开关，两处同时开启才会真正显示立体效果。',
  personalitySlotProfileFast:
    '默认开启。开启后，揭晓动画采用快节奏时序（快速转动、快速落定）。与戏剧化时序同时开启时，戏剧化优先。',
  personalitySlotProfileDramatic:
    '默认关闭。开启后，揭晓动画采用戏剧化时序（更长悬停、更慢收尾、更强仪式感），优先级高于快节奏。两者都关闭时为基准时序。',
  personalityShareEnabled: '默认开启。开启后，用户可生成并分享人格结果海报，是好友转化的主要入口之一。',
  shareAnimatedClipEnabled:
    '默认关闭。开启后，结果页可生成约 2 秒的动态分享短片（服务端合成静音视频）；关闭时分享物料保持静态海报。',
  shareQrCodeEnabled:
    '默认开启。开启后，分享海报上附带小程序码：新朋友扫码可直接进入人格测试，并自动记为分享人邀请来的用户；关闭时海报降级为纯复制文案样式。所有失败情况均自动降级，不影响分享。',

  // ── 发现页与报名页 ────────────────────────────────
  promoBannerEnabled:
    '默认开启。开启后，发现页顶部展示活动推广横幅；关闭时整个横幅隐藏。可用于横幅素材 A/B 测试或内容巡检期间临时下线。',
  oracleCardCornerStatEnabled: '默认开启。开启后，发现页活动卡片右上角展示已报名人数角标，营造热度感；关闭时角标隐藏。',
  poolTeaserEnabled:
    '默认关闭。开启后，活动报名页第一屏展示「报名后会发生什么」的流程预告条（悦仔解说样式），降低报名犹豫。',
  personaSnapshotEnabled: '默认开启。开启后，活动报名页首屏展示本场报名者的整体人格拼图预览；关闭时隐藏该预览。',
  guestEventPreviewEnabled:
    '默认关闭。开启后，未登录游客可查看活动预告列表；当可展示的活动不足时自动显示为空，不向游客报错。',
  flashTeaserHeroEnabled:
    '默认关闭。开启且街头盲盒总开关关闭时，发现页横幅对已有人格结果的用户展示街头盲盒悬念预告样式，用于上线前的预热；街头盲盒正式开启后此开关自动失效。',

  // ── 匹配与排桌 ────────────────────────────────────
  matchingLiveReveal: '默认开启。开启后，用户在匹配状态页可实时观看桌友揭晓动画；关闭时揭晓只在桌友揭晓环节进行。',
  matchingPuzzlePreludeEnabled:
    '默认关闭。开启后，匹配状态页的实时揭晓阶段先展示抽象拼图悬念，再进入桌友身份展示；真实身份揭晓仍在桌友揭晓环节。【2026-10-22 停放】客户端已接线（useMatchingStatusController → MatchingStatusSections），但无 owner 与验收前置：开启前需在真机确认拼图悬念与桌友揭晓的时序衔接。',
  matchingOperatorReviewEnabled:
    '默认关闭。开启后，匹配结果先进入运营人工复核状态，确认后才通知用户并分配场地；关闭时匹配完成后立即自动通知与派场。冷启动阶段必须保持关闭——没有值班运营时开启会让排桌停在待复核，通知、场地分配、邀请奖励全部不执行。',
  matchNeverMeetSentinel:
    '默认关闭，策略待审定，谨慎开启：开启后，历史记录中标记「不愿再见」的任意一方会被硬性排除出同桌；关闭时仅保留重逢加分，不做硬性排除。',
  magnetismGroupRulesEnabled:
    '默认关闭。开启后，排桌强制执行「惊艳开局」组队规则：保证没人落单、每桌都有带动气氛的人、有共同话题切入点。需先用测试局对比验证新规则不会降低成桌率，再正式开启。',
  magnetismWeightProfileV2Enabled:
    '默认关闭。开启后，排桌打分时各项因素的占比切换为新方案：共同兴趣更重要、性格契合次之。需先用测试局对比验证新旧方案效果，再正式开启。',
  matchChemistryCalibrationEnabled:
    '默认关闭。开启后，两人之间的契合度分数会按真实见面反馈自动校正；当前校正效果尚未达标，仍以人工设定的契合表为准。验证通过前请保持关闭。',
  compositionGatesEnabled:
    '默认关闭。开启后，排桌成组时必须满足组队构成底线：每位成员至少有一位聊得来的同桌、每桌恰好一位带动气氛的成员等，保障每桌开局质量。规则完成大规模模拟验证前请保持关闭。',
  tableViabilityFloorEnabled:
    '默认开启。开启后，提交排桌前会校验每桌的质量底线（每位成员至少与一人高度契合、每桌至少一位活跃带动者），并把落单成员自动并入合适的桌；关闭时跳过该校验。组队构成硬门槛开启后会取代本开关的同等校验。',
  matchHistoryNoveltyEnabled:
    '默认关闭，待校准：开启后，限制同一桌内历史互选过的熟人组合数量，防止重逢加分把老熟人反复排到一起。',
  derivedChemistryEnabled:
    '默认关闭，谨慎开启：开启后，两种人格原型「合不合得来」改由系统自动推算，替代人工调校的契合表，会直接影响排桌结果；当前推算结果与人工表的一致性尚未通过检验。',

  // ── 报名、支付与退款 ──────────────────────────────
  registrationEnabled: '默认开启，为报名功能总闸。关闭后用户无法报名任何活动（接口直接拒绝），已报名用户不受影响。',
  duoRegistrationEnabled:
    '默认开启。开启后，用户可邀请一位好友以双人同行方式报名同一局，匹配时保证两人同桌；关闭后隐藏入口，已绑定双人不受影响。',
  paymentsEnabled: '默认关闭，为支付系统总闸。开启后允许创建支付订单；关闭时所有支付接口不可用并提示支付功能暂停。',
  checkoutSubscriptionUpsellEnabled:
    '默认关闭。开启后，活动下单页展示悦聚月卡推荐卡片；关闭时不展示。卡面价格数据始终提供，与本开关无关。',
  preRevealRefundEnabled:
    '默认关闭。开启后，用户在开盲盒（揭晓）前取消报名可获得全额退款，积分在删除前同步退回；关闭时保持旧行为（直接取消，不退款）。',
  noRefundAfterReveal:
    '默认关闭，需法务确认条款后开启：开启后，开盲盒后取消报名不退款，并自动完成组员移除、到场状态更新、剩余成员通知与成组解散退款处理；关闭时保持旧行为。',
  autoRefundEnabled:
    '默认开启，为资金操作保险开关。开启后，场次未成行时自动执行退款并恢复积分；关闭时整个自动退款管线停用，异常需人工处理。',
  poolCompletionSweepEnabled:
    '默认开启。开启后，系统每小时自动将已开始三小时的局标记为完结（含对应报名记录），不再需要人工操作；关闭时需回归手动完结。',
  flowLifecycleEnabled:
    '默认开启。开启后，用户首次报名成功会播放一次盲盒生命周期全屏动效；关闭时报名成功仅显示常规提示，不影响任何数据。',

  // ── 场地分配 ──────────────────────────────────────
  venueAssignmentEnabled:
    '默认开启。开启后，匹配完成后自动为各桌分配合适场地；关闭时所有桌标记为「场地待定」，需人工介入。',
  budgetAdjacencyEnabled:
    '默认关闭，需先完成新旧方案双跑对比：开启后，场地分配对预算采用邻近档位放宽策略（完全匹配 > 相邻一档 > 两档以上不排），替代旧的精确重叠算法。',

  // ── 消息通知 ──────────────────────────────────────
  subscribeRemindersEnabled:
    '默认开启，为微信订阅消息提醒总闸。开启后，系统在活动当天早晨推送当日提醒、次日推送回顾评价提醒；各推送点还需单独配置对应的微信模板才会真正发送。',

  // ── 现场冰局·流程与现场体验 ───────────────────────
  socialIcebreakerClientForceEnd:
    '默认关闭。仅内部测试，谨慎开启：开启后主持人可在客户端强制结束整场冰局，正常运营请勿开启。',
  socialIcebreakerCustomModeEnabled:
    '默认开启。开启后，可创建和调整自定义冰局模式；关闭时只保留预设的几种冰局玩法，进行中的自定义局不受影响。',
  runPlanTemplatesEnabled:
    '默认开启。开启后，冰局各环节流程由后台模板配置驱动，客户端可选择本场氛围（深聊/均衡/玩乐）；关闭时回退为旧版固定流程，并隐藏氛围选择。',
  icebreakerContentStatusEnabled:
    '默认关闭。开启后，冰局界面会显示各环节内容准备状态、成员「我离开一下」暂离标记和主持人离线提示；关闭时界面与旧版完全一致，用户无感知。仅影响界面显示，不影响任何数据。',
  icebreakerHapticGrammarEnabled:
    '默认关闭，待现场验证：开启后，冰局会话页按状态切换触发五类触感反馈（轻点/轮到你/确认/揭晓/庆祝）。',
  icebreakerMoodFieldEnabled: '默认关闭，待现场验证：开启后，冰局会话页背景随环节情绪切换氛围色场，并保持屏幕常亮。',
  icebreakerGlanceStackEnabled:
    '默认关闭，待现场验证。开启后，暖场与微挑战环节把信息分三层展示，用户扫一眼就能掌握全局，减少低头看屏时间。',
  icebreakerGroupBeatsEnabled:
    '默认关闭。开启后，冰局的关键时刻（轮到谁、揭晓、庆祝等）全桌手机会同时震动一下，增强同桌同频感。依赖现场网络稳定性，需实地测试通过后再开启。',
  icebreakerAudioEnabled: '默认关闭，待触感语法现场验证后启用：开启后，冰局在触感反馈同时播放轻量短音效（一秒以内）。',
  icebreakerMatchingAwareEnabled:
    '默认关闭。开启后，冰局各环节的内容生成会参考本桌成员的匹配信息（人格构成、共同兴趣等），让内容更贴合这一桌人；关闭时生成内容与旧版完全一致。【2026-10-22 停放】服务端 6 处已接线（含 W5 定向测试），但无 owner：开启前需人工抽检生成文案不泄露匹配评分，并评估每次生成的上下文成本。',

  // ── 现场冰局·玩法升级 ─────────────────────────────
  miniscriptEvidenceVoteV2Enabled:
    '默认关闭。开启后，剧本杀环节增加证物展示与两轮投票（先猜嫌疑人、再猜动机），在进入该环节时锁定，中途切换不影响进行中的局；关闭时保持单轮投票旧玩法。',
  lieDetectiveV2Enabled:
    '默认关闭。开启后，真假侦探升级为 V2：玩家只写两个关键词，由 AI 扩写成三条陈述并混入一条假话，猜哪条是假的。进入环节后锁定，不影响进行中的局；关闭时保持 V1 玩法。',
  personalityDiceChooseModeEnabled:
    '默认开启，为已上线功能的回退开关。开启后，人格骰子环节用户可从多个挑战中选一个；关闭时新开局回到单一挑战旧模式。写入开关前需确认当前环境有意保持自选模式开启，误写一条「关闭」会立即下线线上功能。',
  auctionV2Enabled:
    '默认关闭。开启后，虚拟拍卖升级为 V2：点按阶梯加价、被反超时有提示、支持「孤注一掷」加价，结算分两段推进高潮。进入环节后锁定，关闭时保持 V1 拍卖。开启前需完成基线数据留存与文案评审。',
  highlightsInjectorEnabled:
    '默认关闭。开启后，系统会自动提炼本场高光时刻（妙语金句、最胶着的真假侦探回合、暖场聊过的话题），供后续环节的内容生成参考，让内容更「本局化」；只使用汇总信息，不涉及个人身份。',
  sessionGlowEnabled:
    '默认关闭。开启后，系统按真实表现累计高光值、颁发有据可查的勋章，并在回顾页展示「今晚的高光」板块；关闭时回顾与勋章行为与旧版完全一致。开启前需完成文案评审并确认客户端版本已上线；上线后勋章必须 100% 来自真实数据。',
  recapSharePosterEnabled:
    '默认关闭。开启后，冰局回顾页提供「存下这张高光卡」与「转发给微信朋友」入口，并注册小程序分享；关闭时回顾页保持单一「看完了」按钮。海报为客户端本地生成，不涉及服务端改动。',
  quipInspirationChipsEnabled:
    '默认关闭。开启后，妙语 battle 答题框下方展示三枚灵感起手文案，帮助用户快速起头；内容为人工精选静态池，非 AI 生成。关闭时答题界面与旧版一致。',

  // ── 桌友揭晓 ──────────────────────────────────────
  squadUnboxingDragRevealEnabled: '默认开启。开启后，桌友揭晓采用拖拽丝带手势；关闭时回退为旧的「揭晓桌友」按钮。',
  squadUnboxingTeaseV2Enabled:
    '默认开启，为已上线功能的回退开关。开启后，揭晓前待机气泡轮换预告文案（领奖暗示、进度提示等）；关闭时恢复单行静态提示，无需发版。',
  socialSquadComposedHeroEnabled:
    '默认关闭。开启后，桌友揭晓页使用悦仔与礼物组合主视觉（单击手势 + 隐藏拖拽彩蛋）；关闭时保持现有头图加拖拽丝带布局。',
  squadUnboxingPocketDeckEnabled:
    '默认开启。开启后，桌友揭晓页支持收起卡组；关闭时隐藏收起按钮，卡组保持展开扇形，已收起的用户保持收起状态。',

  // ── 集结房间 ──────────────────────────────────────
  gatheringRoomEnabled:
    '默认关闭，待房间美术与实时在线链路实机验证后开启。开启后，已成桌成员可在活动前进入集结房间（像素场景等候室）互相互动；关闭时隐藏所有入口。',

  // ── 个人主页 ──────────────────────────────────────
  profileRedesignEnabled:
    '默认开启，为个人主页整体回退开关。关闭时回退为简化版旧布局，不加载新版头图、里程碑与分享卡入口。',
  profilePixelAvatarEnabled: '默认关闭。开启后，个人主页展示像素形象形象馆（我的形象）；可与主页布局回退独立控制。',
  profileIdentityStageEnabled: '默认开启。开启后，个人主页背景渲染多层景深身份场景；关闭时回退为静态身份卡片。',
  equipmentRewardsEnabled: '默认关闭。开启后，启用装扮道具的获取与穿戴体系（无支付路径）；关闭时个人装扮功能整体隐藏。',
  personalStoryEnabled: '默认关闭。开启后，启用私密个人故事的生成与阅读功能，仅本人可见；关闭时入口隐藏。',

  // ── 街头盲盒 ──────────────────────────────────────
  alangEnabled:
    '默认关闭，为街头盲盒总开关。开启后，街头盲盒全部正式链路（地图探索、NPC 相遇、剧情任务）对用户可见；关闭时整个玩法隐藏。',
  flashShenzhenLocationGateEnabled:
    '默认开启，关闭需谨慎：开启时街头盲盒仅允许深圳范围内定位参与；关闭后非生产环境可在深圳以外测试。生产环境始终锁定为深圳。',
  flashTaskRetryTestEnabled:
    '默认关闭，仅非生产环境生效。仅内部测试：开启后，测试用户可在任务进行页或反馈页直接从头复测同一任务，无需先完成交付流程。',
  flashAnyLocationArrivalTestEnabled:
    '默认关闭，仅非生产环境生效。仅内部测试：开启后，测试用户可在任意有效坐标完成 NPC 到达、任务到达与交付链路；生产环境强制关闭。',
  flashStoryV2Enabled:
    '默认开启。开启后，街头盲盒剧情使用新版引擎（V2，多分支结构）；旧剧情内容仍按原方式播放。关闭时立即回退旧版，可不留痕回滚。',
  flashStoryActionsEnabled:
    '默认关闭。开启后，剧情中的互动节点允许用户真实提交选择并影响走向；关闭时服务端自动应用审核过的默认结果，剧情进度不丢失、不重复结算。',
  flashStoryAiResponsesEnabled:
    '默认关闭。开启后，NPC 回复在审核过的剧情计划之上做 AI 润色；AI 不掌控结算、进度、碎片与结局。关闭时使用纯审核文案。【2026-10-22 停放】服务端已接线，但无 owner：开启前需在深圳灰度期人工抽检 NPC 回复，且微信审核期间必须关闭。',

  // ── 内容与合规 ────────────────────────────────────
  contentModerationMsgSecCheckEnabled:
    '默认开启。开启后，通过本地关键词初筛的用户文本会再经微信语义审核（超时自动放行，不阻塞用户）；关闭时仅保留本地初筛。',
  contentModerationSevereFailClosedEnabled:
    '默认开启，为应急回退开关：开启时警告级违规内容同样拦截；关闭时警告级内容放行（仍记录日志，不升级处罚）。严重级违规无论如何都硬拦截，本开关无法关闭该能力。',
  aigcLabelsEnabled:
    '默认开启。开启后，小程序内 AI 生成的内容表面展示「AI 生成」角标（fail-closed：仅当内容确实由模型生成时才出标，模板与兜底内容不打标）。这是微信对 AIGC 的强制标识要求，只有合规复核确认可豁免时才关闭。',
  industryCohortCountEnabled:
    '默认开启，为隐私查询的保险开关。开启后，可查询同城市同行业的人数规模（不足十人时返回空，保护个人）；关闭时接口直接返回空，不执行任何查询。',
  wechatIdCollectionEnabled:
    '默认关闭，待上线前基线数据拉取后开启。开启后，活动评价流程在选人后增加可选的微信号填写步骤，并在回顾页展示联系方式补救卡片；关闭时评价流程与现状完全一致。',
}
