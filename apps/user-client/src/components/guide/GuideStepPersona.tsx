import { motion } from "framer-motion";
import { User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { guideCopy } from "@/copy/guide";

interface GuideStepPersonaProps {
  /** 用户原型名称 */
  archetype?: string;
  /** 原型描述 */
  archetypeDescription?: string;
  /** 是否减少动画 */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * 引导页步骤 1: 用户画像生成说明
 */
export function GuideStepPersona({
  archetype,
  archetypeDescription,
  reducedMotion = false,
  className,
}: GuideStepPersonaProps) {
  const copy = guideCopy.step1;
  
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
  
  const badgeVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { scale: 0.8, opacity: 0 },
        visible: { 
          scale: 1, 
          opacity: 1,
          transition: { delay: 0.2, duration: 0.3, type: "spring", stiffness: 200 }
        },
      };
  
  return (
    <motion.div
      className={cn("flex flex-col items-center text-center px-6", className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* 原型徽章 with glow effect */}
      <motion.div
        variants={badgeVariants}
        className="relative w-32 h-32 rounded-full flex items-center justify-center mb-6"
      >
        {/* Outer glow ring */}
        {!reducedMotion && (
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-xl"
            animate={{ 
              scale: [1, 1.1, 1],
              opacity: [0.5, 0.8, 0.5],
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              ease: "easeInOut",
            }}
          />
        )}
        {/* Main badge */}
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
          <div className="w-28 h-28 rounded-full bg-background flex items-center justify-center">
            <User className="w-16 h-16 text-purple-600" />
          </div>
        </div>
      </motion.div>
      
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h1 className="text-2xl font-bold text-foreground">
            {copy.title}
          </h1>
          <Sparkles className="w-5 h-5 text-yellow-500" />
        </div>
        
        <p className="text-muted-foreground mb-6">
          {copy.subtitle}
        </p>
      </motion.div>
      
      {/* 原型信息卡片 */}
      {archetype && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="w-full max-w-sm bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-2xl p-5 border border-purple-200 dark:border-purple-800"
        >
          <div className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2">
            {archetype}
          </div>
          {archetypeDescription && (
            <p className="text-sm text-muted-foreground">
              {archetypeDescription}
            </p>
          )}
        </motion.div>
      )}
      
      {/* 描述 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground mt-6 max-w-xs"
      >
        {copy.description}
      </motion.p>
    </motion.div>
  );
}
