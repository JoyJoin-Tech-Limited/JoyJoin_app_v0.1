import { motion } from "framer-motion";
import { MessageCircle, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { guideCopy } from "@/copy/guide";

import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01.png";

interface GuideStepAIConciergeProps {
  /** 点击"和小悦聊聊"回调 */
  onChatWithXiaoyue?: () => void;
  /** 是否减少动画 */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * 引导页步骤 3: 小悦 AI 助手引导
 */
export function GuideStepAIConcierge({
  onChatWithXiaoyue,
  reducedMotion = false,
  className,
}: GuideStepAIConciergeProps) {
  const copy = guideCopy.step3;
  
  const containerVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 20 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.4, ease: "easeOut" }
        },
      };
  
  const avatarVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { scale: 0.8, opacity: 0 },
        visible: { 
          scale: 1, 
          opacity: 1,
          transition: { delay: 0.2, duration: 0.3, type: "spring", stiffness: 200 }
        },
      };
  
  const staggerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: reducedMotion ? 0 : 0.1,
      },
    },
  };
  
  const itemVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, x: -10 },
        visible: { 
          opacity: 1, 
          x: 0,
          transition: { duration: 0.3 }
        },
      };
  
  return (
    <motion.div
      className={cn("flex flex-col items-center text-center px-6", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 小悦头像 */}
      <motion.div
        variants={avatarVariants}
        className="relative mb-6"
      >
        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-purple-200 dark:border-purple-700 shadow-lg">
          <img
            src={xiaoyueNormal}
            alt="小悦"
            className="w-full h-full object-cover"
          />
        </div>
        {/* AI 标识 */}
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center border-2 border-background">
          <Bot className="w-4 h-4 text-white" />
        </div>
      </motion.div>
      
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {copy.title}
        </h1>
        <p className="text-muted-foreground">
          {copy.subtitle}
        </p>
      </motion.div>
      
      {/* 描述 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-6"
      >
        {copy.description}
      </motion.p>
      
      {/* 功能列表 */}
      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm space-y-3"
      >
        {copy.features.map((feature, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="flex items-center gap-3 bg-card rounded-xl p-4 border shadow-sm text-left"
          >
            <span className="text-lg">{feature.slice(0, 2)}</span>
            <span className="text-sm text-foreground">{feature.slice(3)}</span>
          </motion.div>
        ))}
      </motion.div>
      
      {/* 聊天气泡提示 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-6 flex items-center gap-2 text-purple-600 dark:text-purple-400"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="text-sm font-medium">随时可以找我聊天哦~</span>
      </motion.div>
    </motion.div>
  );
}
