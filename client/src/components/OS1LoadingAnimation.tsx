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
  variant = "warm",
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
    warm: {
      primary: "from-orange-400 to-rose-500",
      glow: "shadow-orange-500/30",
      text: "text-orange-100",
      bg: "bg-gradient-to-br from-orange-950/80 to-rose-950/80",
    },
    purple: {
      primary: "from-purple-400 to-pink-500",
      glow: "shadow-purple-500/30",
      text: "text-purple-100",
      bg: "bg-gradient-to-br from-purple-950/80 to-pink-950/80",
    },
    gradient: {
      primary: "from-orange-400 via-rose-500 to-purple-500",
      glow: "shadow-rose-500/30",
      text: "text-rose-100",
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
            background: `linear-gradient(90deg, transparent, rgba(251, 146, 60, 0.3), transparent)`,
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
  variant = "warm",
}: {
  messages?: string[];
  variant?: "warm" | "purple" | "gradient";
}) {
  const colorConfig = {
    warm: "bg-gradient-to-br from-orange-950 via-rose-950 to-slate-950",
    purple: "bg-gradient-to-br from-purple-950 via-pink-950 to-slate-950",
    gradient: "bg-gradient-to-br from-slate-950 via-rose-950 to-purple-950",
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
            className="absolute rounded-full bg-orange-500/10"
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

export function OS1InlineLoader({
  message = "思考中...",
  variant = "warm",
}: {
  message?: string;
  variant?: "warm" | "purple" | "gradient";
}) {
  const colors = {
    warm: "from-orange-400 to-rose-500",
    purple: "from-purple-400 to-pink-500",
    gradient: "from-orange-400 to-purple-500",
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`w-2 h-2 rounded-full bg-gradient-to-r ${colors[variant]}`}
            animate={{
              y: [0, -6, 0],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 0.8,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
