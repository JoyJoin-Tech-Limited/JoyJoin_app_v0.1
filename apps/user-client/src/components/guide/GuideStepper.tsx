import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { guideCopy } from "@/copy/guide";
import { GuideStepPersona } from "./GuideStepPersona";
import { GuideStepBlindBoxFlow } from "./GuideStepBlindBoxFlow";
import { GuideStepAIConcierge } from "./GuideStepAIConcierge";

interface GuideStepperProps {
  /** 当前步骤 (0-2) */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 用户原型名称 */
  archetype?: string;
  /** 原型描述 */
  archetypeDescription?: string;
  /** 进入下一步 */
  onNext: () => void;
  /** 返回上一步 */
  onPrev: () => void;
  /** 跳过引导 */
  onSkip: () => void;
  /** 完成引导 */
  onComplete: () => void;
  /** 点击"和小悦聊聊" */
  onChatWithXiaoyue?: () => void;
  className?: string;
}

/**
 * 引导页步进器
 * 
 * 全屏 3 步引导流程控制器
 */
export function GuideStepper({
  currentStep,
  totalSteps,
  archetype,
  archetypeDescription,
  onNext,
  onPrev,
  onSkip,
  onComplete,
  onChatWithXiaoyue,
  className,
}: GuideStepperProps) {
  const prefersReducedMotion = useReducedMotion();
  const copy = guideCopy.common;
  
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;
  
  const containerVariants = prefersReducedMotion
    ? { hidden: { opacity: 0 }, visible: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { 
          opacity: 0, 
          x: 50,
          filter: "blur(4px)",
        },
        visible: { 
          opacity: 1, 
          x: 0,
          filter: "blur(0px)",
          transition: { 
            duration: 0.4, 
            ease: [0.25, 0.46, 0.45, 0.94],
            filter: { duration: 0.3 },
          },
        },
        exit: { 
          opacity: 0, 
          x: -50,
          filter: "blur(4px)",
          transition: { duration: 0.25 },
        },
      };
  
  return (
    <div className={cn(
      "fixed inset-0 z-50 bg-background flex flex-col",
      className
    )}>
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        {/* 返回按钮 */}
        <div className="w-10">
          {!isFirstStep && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              data-testid="guide-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
        </div>
        
        {/* 进度指示器 */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <motion.div
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                index === currentStep
                  ? "bg-purple-600"
                  : index < currentStep
                  ? "bg-purple-300"
                  : "bg-gray-300 dark:bg-gray-600"
              )}
              animate={{
                scale: index === currentStep ? 1.2 : 1,
              }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>
        
        {/* 跳过按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSkip}
          className="text-muted-foreground"
          data-testid="guide-skip"
        >
          {copy.skip}
        </Button>
      </div>
      
      {/* 步骤内容 */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="w-full will-change-[filter,transform,opacity]"
          >
            {currentStep === 0 && (
              <GuideStepPersona
                archetype={archetype}
                archetypeDescription={archetypeDescription}
                reducedMotion={prefersReducedMotion}
              />
            )}
            {currentStep === 1 && (
              <GuideStepBlindBoxFlow
                reducedMotion={prefersReducedMotion}
              />
            )}
            {currentStep === 2 && (
              <GuideStepAIConcierge
                onChatWithXiaoyue={onChatWithXiaoyue}
                reducedMotion={prefersReducedMotion}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* 底部操作区 */}
      <div className="p-4 border-t space-y-3">
        {isLastStep ? (
          <>
            {/* 最后一步: 两个 CTA */}
            <Button
              className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
              onClick={onComplete}
              data-testid="guide-complete"
            >
              {guideCopy.step3.secondaryCta}
            </Button>
            {onChatWithXiaoyue && (
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl"
                onClick={onChatWithXiaoyue}
                data-testid="guide-chat-xiaoyue"
              >
                {guideCopy.step3.ctaText}
              </Button>
            )}
          </>
        ) : (
          /* 非最后一步: 继续按钮 */
          <Button
            className="w-full h-14 rounded-2xl text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
            onClick={onNext}
            data-testid="guide-next"
          >
            {copy.next}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}
