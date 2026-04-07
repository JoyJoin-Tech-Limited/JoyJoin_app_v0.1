import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "匹配需要多久？",
    answer: "通常在入座截止后 24 小时内完成成桌。人数越多，成桌越快。我们会通过微信和APP通知你结果。",
  },
  {
    question: "不满意匹配结果怎么办？",
    answer: "匹配成功后可以选择不确认参加，但请尽早告知。我们会根据你的反馈优化未来的匹配算法。频繁放弃可能影响匹配优先级。",
  },
  {
    question: "队名可以改吗？",
    answer: "AI生成的队名独一无二且经过精心设计。如果你的队伍一致同意，可以联系客服申请修改，但我们建议保留原创队名体验惊喜感。",
  },
  {
    question: "费用怎么算？",
    answer: "活动采用AA制，费用根据餐厅人均和实际消费计算。我们会提前告知预估费用范围。部分活动可能收取小额服务费用于场地和游戏道具。",
  },
  {
    question: "能带朋友吗？",
    answer: "为保证匹配质量，不建议带朋友参加盲盒活动。如果想和朋友一起，可以选择「邀请好友」功能，系统会优先将你们分配到同一组。",
  },
];

export default function FAQMinimal() {
  const [openIndex, setOpenIndex] = useState(0);
  
  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };
  
  return (
    <div className="space-y-3">
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.05 }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden transition-all hover:border-violet-300 dark:hover:border-violet-700"
          >
            <button
              onClick={() => toggleFAQ(index)}
              className="w-full flex items-start justify-between gap-3 p-4 text-left"
            >
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-50 flex-1">
                {faq.question}
              </h4>
              
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0 mt-0.5"
              >
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </motion.div>
            </button>
            
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
