import { motion } from "framer-motion";
import { Check, Lightbulb } from "lucide-react";

const steps = [
  {
    emoji: "📝",
    title: "选择你的偏好",
    description: "告诉我们你的兴趣、预算和时间",
  },
  {
    emoji: "⏳",
    title: "加入活动池",
    description: "等待系统找到最合适的伙伴",
  },
  {
    emoji: "✨",
    title: "AI智能组队",
    description: "基于性格、兴趣匹配最佳队友",
  },
  {
    emoji: "🎁",
    title: "获得专属队名",
    description: "AI生成独一无二的团队名称",
  },
  {
    emoji: "🎉",
    title: "线下见面",
    description: "在精选餐厅开启美好体验",
  },
];

const tips = [
  "匹配成功后24小时内需确认参加",
  "活动当天可在线签到解锁破冰游戏",
  "活动后记得留下你的真实评价",
];

export default function HowItWorksMinimal() {
  return (
    <div className="space-y-4">
      {/* Steps */}
      {steps.map((step, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.1 }}
          className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-800 flex items-start gap-4"
        >
          {/* Icon Circle */}
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <span className="text-2xl">{step.emoji}</span>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-50">
                {index + 1}. {step.title}
              </h4>
              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {step.description}
            </p>
          </div>
        </motion.div>
      ))}
      
      {/* Tips Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: steps.length * 0.1 }}
        className="bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-900"
      >
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">
            💡 温馨提示
          </h4>
        </div>
        
        <ul className="space-y-2">
          {tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300">
              <span className="flex-shrink-0 mt-0.5 w-1 h-1 rounded-full bg-blue-500" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
