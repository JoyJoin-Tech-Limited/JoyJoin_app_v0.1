import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface OS1LoadingAnimationProps {
  messages?: string[];
  showMessage?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "warm" | "purple" | "gradient";
}

const defaultMessages = [
  "小悦正在思考...",
  "正在理解你的意思...",
  "让我想想...",
  "正在为你寻找答案...",
];

const matchingMessages = [
  "正在寻找有趣的灵魂...",
  "分析匹配度中...",
  "筛选最佳组合...",
  "小悦正在施展魔法...",
];

export const OS1_MESSAGE_PRESETS = {
  thinking: defaultMessages,
  matching: matchingMessages,
  analyzing: [
    "正在分析你的性格特征...",
    "解读你的社交风格...",
    "描绘你的独特轮廓...",
  ],
  icebreaker: [
    "正在为你们准备话题...",
    "寻找共同兴趣点...",
    "编织破冰魔法...",
  ],
};

export default function OS1LoadingAnimation({
  messages = defaultMessages,
  showMessage = true,
  size = "md",
  variant = "purple",
}: OS1LoadingAnimationProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  useEffect(() => {
    if (!showMessage || messages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [messages, showMessage]);

  const sizeConfig = {
    sm: { container: "w-16 h-16", bars: 3, barWidth: 3, gap: 2 },
    md: { container: "w-24 h-24", bars: 5, barWidth: 4, gap: 3 },
    lg: { container: "w-32 h-32", bars: 7, barWidth: 5, gap: 4 },
  };

  const colorConfig = {
    purple: {
      primary: "from-violet-400 to-purple-500",
      glow: "shadow-violet-500/30",
      text: "text-violet-100",
      bg: "bg-gradient-to-br from-violet-950/80 to-purple-950/80",
    },
    warm: {
      primary: "from-orange-400 to-rose-500",
      glow: "shadow-orange-500/30",
      text: "text-orange-100",
      bg: "bg-gradient-to-br from-orange-950/80 to-rose-950/80",
    },
    gradient: {
      primary: "from-violet-400 via-purple-500 to-pink-500",
      glow: "shadow-purple-500/30",
      text: "text-purple-100",
      bg: "bg-gradient-to-br from-slate-900/90 to-slate-800/90",
    },
  };

  const config = sizeConfig[size];
  const colors = colorConfig[variant];

  return (
    <div className="flex flex-col items-center justify-center gap-6">
      <div className={`relative ${config.container} flex items-center justify-center`}>
        <motion.div
          className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.primary} opacity-20 blur-xl`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        <div className="relative flex items-end justify-center gap-1 h-full py-4">
          {Array.from({ length: config.bars }).map((_, i) => {
            const delay = i * 0.15;
            const isCenter = i === Math.floor(config.bars / 2);
            
            return (
              <motion.div
                key={i}
                className={`rounded-full bg-gradient-to-t ${colors.primary} ${colors.glow} shadow-lg`}
                style={{ width: config.barWidth }}
                animate={{
                  height: isCenter 
                    ? [20, 40, 60, 40, 20]
                    : [15, 30, 45, 30, 15],
                  opacity: [0.6, 1, 0.8, 1, 0.6],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>

        <motion.div
          className={`absolute inset-0 rounded-full border-2 border-transparent`}
          style={{
            background: `linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent)`,
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: ["200% 0", "-200% 0"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {showMessage && (
        <motion.p
          key={currentMessageIndex}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.5 }}
          className={`text-sm font-medium ${colors.text} text-center`}
        >
          {messages[currentMessageIndex]}
        </motion.p>
      )}
    </div>
  );
}

export function OS1FullScreenLoader({
  messages = defaultMessages,
  variant = "purple",
}: {
  messages?: string[];
  variant?: "warm" | "purple" | "gradient";
}) {
  const colorConfig = {
    purple: "bg-gradient-to-br from-violet-950 via-purple-950 to-slate-950",
    warm: "bg-gradient-to-br from-orange-950 via-rose-950 to-slate-950",
    gradient: "bg-gradient-to-br from-slate-950 via-purple-950 to-violet-950",
  };

  const glowColors = {
    purple: "bg-violet-500/10",
    warm: "bg-orange-500/10",
    gradient: "bg-purple-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center ${colorConfig[variant]}`}
    >
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${glowColors[variant]}`}
            style={{
              width: 300 + i * 100,
              height: 300 + i * 100,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <OS1LoadingAnimation 
        messages={messages} 
        size="lg" 
        variant={variant}
      />
    </motion.div>
  );
}

// 真正的《Her》电影OS1波浪动画 - 使用SVG正弦波曲线
export function OS1InlineLoader({
  message = "思考中...",
  variant = "purple",
  isComplete = false,
}: {
  message?: string;
  variant?: "warm" | "purple" | "gradient";
  isComplete?: boolean;
}) {
  const strokeColors = {
    purple: "#a78bfa", // violet-400
    warm: "#fb923c",   // orange-400
    gradient: "#a78bfa",
  };

  // SVG路径：思考中的正弦波 vs 完成的圆形
  // 正弦波路径：从左到右的平滑波浪
  const wavePath = "M 5 12 Q 12 4, 20 12 T 35 12 T 50 12 T 65 12";
  // 圆形路径
  const circlePath = "M 35 4 A 8 8 0 1 1 34.99 4";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="relative flex items-center justify-center w-[70px] h-6">
        <svg
          width="70"
          height="24"
          viewBox="0 0 70 24"
          fill="none"
          className="overflow-visible"
        >
          <defs>
            <linearGradient id={`os1-gradient-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeColors[variant]} stopOpacity="0.6" />
              <stop offset="50%" stopColor={strokeColors[variant]} stopOpacity="1" />
              <stop offset="100%" stopColor={strokeColors[variant]} stopOpacity="0.6" />
            </linearGradient>
            <filter id="os1-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          <motion.path
            d={isComplete ? circlePath : wavePath}
            stroke={`url(#os1-gradient-${variant})`}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            filter="url(#os1-glow)"
            initial={false}
            animate={isComplete ? {
              // 完成状态：静止的圆环
              pathLength: 1,
              opacity: 1,
            } : {
              // 思考中：波浪呼吸动画
              pathLength: [0.3, 1, 0.3],
              opacity: [0.6, 1, 0.6],
            }}
            transition={isComplete ? {
              duration: 0.5,
              ease: "easeOut",
            } : {
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              strokeDasharray: isComplete ? "none" : "8 4",
            }}
          />
          
          {/* 波浪流动效果 - 仅在思考中显示 */}
          {!isComplete && (
            <motion.path
              d={wavePath}
              stroke={strokeColors[variant]}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
              opacity={0.4}
              animate={{
                strokeDashoffset: [0, -24],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                strokeDasharray: "4 8",
              }}
            />
          )}
        </svg>
      </div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
