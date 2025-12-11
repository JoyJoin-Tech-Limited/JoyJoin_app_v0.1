import { motion } from "framer-motion";

interface RegistrationProgressProps {
  currentStage: "basic" | "interests" | "personality" | "complete";
  currentStep?: number;
  totalSteps?: number;
}

export default function RegistrationProgress({
  currentStage,
  currentStep = 0,
  totalSteps = 0,
}: RegistrationProgressProps) {
  const stages = [
    { id: "basic", label: "基础信息", icon: "👤" },
    { id: "interests", label: "兴趣爱好", icon: "✨" },
    { id: "personality", label: "性格测评", icon: "🎭" },
  ];

  const stageIndex = stages.findIndex((s) => s.id === currentStage);
  const overallProgress = ((stageIndex + 1) / stages.length) * 100;

  // 计算当前阶段的进度百分比
  let stageProgress = 0;
  if (currentStage === "basic" && totalSteps > 0) {
    stageProgress = (currentStep / totalSteps) * 100;
  } else if (currentStage === "interests" && totalSteps > 0) {
    stageProgress = (currentStep / totalSteps) * 100;
  } else if (currentStage === "personality") {
    stageProgress = 100;
  }

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* 全局进度条 */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-medium">
              {currentStep > 0 && totalSteps > 0
                ? `第 ${currentStep} 步 / 共 ${totalSteps} 步`
                : `${stages[stageIndex]?.label || "注册进度"}`}
            </h2>
            <span className="text-xs text-muted-foreground">
              {Math.round(overallProgress)}%
            </span>
          </div>

          {/* 整体进度条 */}
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* 阶段指示器 */}
        <div className="flex justify-between gap-2">
          {stages.map((stage, idx) => {
            const isActive = idx === stageIndex;
            const isCompleted = idx < stageIndex;

            return (
              <motion.div
                key={stage.id}
                className="flex-1"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <button
                  className={`w-full text-center py-2 px-2 rounded-md text-xs font-medium transition-all ${
                    isCompleted
                      ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                      : isActive
                        ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                        : "bg-muted text-muted-foreground"
                  }`}
                  disabled
                >
                  <span className="block text-lg mb-1">{stage.icon}</span>
                  {stage.label}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* 当前阶段细节进度条 */}
        {currentStep > 0 && totalSteps > 0 && (
          <div className="h-0.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
              initial={{ width: 0 }}
              animate={{ width: `${stageProgress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
