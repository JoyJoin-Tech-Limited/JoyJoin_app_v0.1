/**
 * 引导页文案 (简体中文)
 * 
 * 3 步引导流程的所有文案集中管理
 */

export const guideCopy = {
  // 通用
  common: {
    skip: "跳过",
    next: "继续",
    done: "进入发现",
    stepOf: (current: number, total: number) => `${current} / ${total}`,
  },
  
  // 步骤 1: 用户画像生成
  step1: {
    title: "你的专属画像",
    subtitle: "这就是其他用户看到的你",
    description: "我们已根据你提供的信息生成了个性化档案，帮你找到志同道合的伙伴！",
    highlight: "点击查看详情，了解你的独特社交风格",
    ctaText: "继续探索",
  },
  
  // 步骤 2: 盲盒活动流程
  step2: {
    title: "盲盒活动玩法",
    subtitle: "报名盲盒活动的流程",
    description: "轻松5步，开启你的惊喜社交之旅",
    steps: [
      { icon: "📍", label: "选择地区", desc: "选择活动区域" },
      { icon: "💝", label: "填写偏好", desc: "告诉我们你的期待" },
      { icon: "✨", label: "智能匹配", desc: "AI为你找到最佳组合" },
      { icon: "📝", label: "活动签到", desc: "到场确认参与" },
      { icon: "💬", label: "活动反馈", desc: "分享你的体验" },
    ],
    ctaText: "了解更多",
  },
  
  // 步骤 3: 小悦 AI 助手
  step3: {
    title: "认识小悦",
    subtitle: "找小悦聊聊",
    description: "小悦是你的 AI 社交助手，可以帮你：",
    features: [
      "🎯 补全用户画像，实现更精准匹配",
      "💡 推荐适合你的活动和话题",
      "🤝 解答关于悦聚的任何问题",
    ],
    ctaText: "和小悦聊聊",
    secondaryCta: "进入发现",
  },
};

export type GuideCopy = typeof guideCopy;
