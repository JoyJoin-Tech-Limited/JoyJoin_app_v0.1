import { motion } from "framer-motion";
import { useState, useEffect, useId, useRef } from "react";

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

// 生成连续正弦波SVG路径
function generateSineWavePath(
  width: number,
  height: number,
  amplitude: number,
  frequency: number = 2,
  phase: number = 0
): string {
  const centerY = height / 2;
  const points: string[] = [];
  const steps = 50;
  
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y = centerY + Math.sin((i / steps) * Math.PI * 2 * frequency + phase) * amplitude;
    
    if (i === 0) {
      points.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      points.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  
  return points.join(' ');
}

// Her电影风格的呼吸正弦波组件 - 使用CSS动画避免React重渲染
function BreathingSineWave({
  width = 70,
  height = 24,
  color = "#a78bfa",
  isComplete = false,
}: {
  width?: number;
  height?: number;
  color?: string;
  isComplete?: boolean;
}) {
  const uniqueId = useId();
  const pathRef = useRef<SVGPathElement>(null);

  // 使用requestAnimationFrame直接操作DOM，避免React重渲染
  useEffect(() => {
    if (isComplete || !pathRef.current) return;

    let animationId: number;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // 波幅呼吸：2.5秒周期
      const amplitude = 5.5 + Math.sin(elapsed * Math.PI * 0.8) * 2.5;
      // 相位缓慢移动
      const phase = elapsed * 0.5;
      
      const path = generateSineWavePath(width, height, amplitude, 2, phase);
      if (pathRef.current) {
        pathRef.current.setAttribute('d', path);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isComplete, width, height]);

  // 完成状态的圆形路径
  const circleRadius = 8;
  const initialWavePath = generateSineWavePath(width, height, 5.5, 2, 0);
  const circlePath = `M ${width/2} ${height/2 - circleRadius} A ${circleRadius} ${circleRadius} 0 1 1 ${width/2 - 0.01} ${height/2 - circleRadius}`;

  const gradientId = `sine-gradient-${uniqueId}`;
  const glowId = `sine-glow-${uniqueId}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="30%" stopColor={color} stopOpacity="0.9" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="70%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0.3" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      {isComplete ? (
        <motion.path
          d={circlePath}
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          filter={`url(#${glowId})`}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      ) : (
        <path
          ref={pathRef}
          d={initialWavePath}
          stroke={`url(#${gradientId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter={`url(#${glowId})`}
        />
      )}
    </svg>
  );
}

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
    sm: { width: 60, height: 20 },
    md: { width: 100, height: 32 },
    lg: { width: 140, height: 44 },
  };

  const colorConfig = {
    purple: {
      color: "#a78bfa",
      text: "text-violet-300",
    },
    warm: {
      color: "#fb923c",
      text: "text-orange-300",
    },
    gradient: {
      color: "#c084fc",
      text: "text-purple-300",
    },
  };

  const config = sizeConfig[size];
  const colors = colorConfig[variant];

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* 背景发光 */}
        <motion.div
          className="absolute rounded-full blur-xl"
          style={{
            width: config.width * 1.5,
            height: config.height * 2,
            background: `radial-gradient(ellipse, ${colors.color}30 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        <BreathingSineWave
          width={config.width}
          height={config.height}
          color={colors.color}
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

// Her电影风格内联加载器 - 连续正弦波呼吸动画
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
    purple: "#a78bfa",
    warm: "#fb923c",
    gradient: "#c084fc",
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <BreathingSineWave
        width={70}
        height={24}
        color={strokeColors[variant]}
        isComplete={isComplete}
      />
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}
