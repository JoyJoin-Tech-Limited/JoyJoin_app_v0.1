import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { guideCopy } from "@/copy/guide";

interface GuideStepBlindBoxFlowProps {
  /** 是否减少动画 */
  reducedMotion?: boolean;
  className?: string;
}

/**
 * 引导页步骤 2: 盲盒活动流程介绍
 */
export function GuideStepBlindBoxFlow({
  reducedMotion = false,
  className,
}: GuideStepBlindBoxFlowProps) {
  const copy = guideCopy.step2;
  
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
  
  const staggerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: reducedMotion ? 0 : 0.1,
      },
    },
  };
  
  const itemVariants = reducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, x: -20 },
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
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {copy.title}
        </h1>
        <p className="text-muted-foreground">
          {copy.subtitle}
        </p>
      </motion.div>
      
      {/* 流程步骤 */}
      <motion.div
        variants={staggerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-sm space-y-3"
      >
        {copy.steps.map((step, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            className="flex items-center gap-4 bg-card rounded-xl p-4 border shadow-sm"
          >
            {/* 步骤图标 */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center text-2xl flex-shrink-0">
              {step.icon}
            </div>
            
            {/* 步骤内容 */}
            <div className="flex-1 text-left">
              <div className="font-semibold text-foreground">
                {step.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {step.desc}
              </div>
            </div>
            
            {/* 步骤序号 */}
            <div className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
              {index + 1}
            </div>
          </motion.div>
        ))}
      </motion.div>
      
      {/* 底部描述 */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="text-muted-foreground mt-6 text-sm"
      >
        {copy.description}
      </motion.p>
    </motion.div>
  );
}
