import { useEffect, useState, useRef, useMemo, useId } from "react";
import Lottie, { LottieRefCurrentProps } from "lottie-react";
import { motion, AnimatePresence } from "framer-motion";

interface LottieWaveAnimationProps {
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

export const LOTTIE_MESSAGE_PRESETS = {
  thinking: defaultMessages,
  matching: [
    "正在寻找有趣的灵魂...",
    "分析匹配度中...",
    "筛选最佳组合...",
    "小悦正在施展魔法...",
  ],
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

// 生成《Her》风格流体波浪Lottie动画数据
function generateHerWaveAnimation(color: string, width: number, height: number) {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255
    ] : [0.65, 0.55, 0.98]; // 默认紫色
  };

  const [r, g, b] = hexToRgb(color);
  const centerY = height / 2;
  const amplitude = height * 0.25;

  // 创建流畅的贝塞尔曲线波浪
  const generateWaveKeyframes = (phase: number) => {
    const points = [];
    const segments = 4;
    
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * width;
      const y = centerY + Math.sin((i / segments) * Math.PI * 2 + phase) * amplitude;
      points.push([x, y]);
    }
    
    return points;
  };

  // 生成60帧的波浪动画
  const frames = 60;
  const keyframes = [];
  
  for (let f = 0; f < frames; f++) {
    const phase = (f / frames) * Math.PI * 2;
    const points = generateWaveKeyframes(phase);
    
    // 构建贝塞尔路径顶点
    const vertices = points.map(p => [p[0], p[1]]);
    const inTangents = points.map((_, i) => {
      if (i === 0) return [0, 0];
      const dx = width / 4 * 0.55;
      return [-dx, 0];
    });
    const outTangents = points.map((_, i) => {
      if (i === points.length - 1) return [0, 0];
      const dx = width / 4 * 0.55;
      return [dx, 0];
    });
    
    keyframes.push({
      t: f,
      s: [{
        i: inTangents,
        o: outTangents,
        v: vertices,
        c: false
      }]
    });
  }

  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op: 60,
    w: Math.round(width),
    h: Math.round(height),
    nm: "Her Wave",
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: "Wave",
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [width / 2, height / 2, 0] },
          a: { a: 0, k: [width / 2, height / 2, 0] },
          s: { a: 0, k: [100, 100, 100] }
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            it: [
              {
                ind: 0,
                ty: "sh",
                ks: {
                  a: 1,
                  k: keyframes
                },
                nm: "Path"
              },
              {
                ty: "st",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 3 },
                lc: 2,
                lj: 2,
                nm: "Stroke"
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ],
            nm: "Wave Group"
          }
        ],
        ip: 0,
        op: 60,
        st: 0,
        bm: 0
      },
      // 第二条波浪 - 相位偏移，更透明
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: "Wave2",
        sr: 1,
        ks: {
          o: { a: 0, k: 40 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [width / 2, height / 2 + 3, 0] },
          a: { a: 0, k: [width / 2, height / 2, 0] },
          s: { a: 0, k: [100, 80, 100] }
        },
        ao: 0,
        shapes: [
          {
            ty: "gr",
            it: [
              {
                ind: 0,
                ty: "sh",
                ks: {
                  a: 1,
                  k: keyframes.map((kf, i) => ({
                    ...kf,
                    t: (i + 15) % 60 // 相位偏移
                  }))
                },
                nm: "Path2"
              },
              {
                ty: "st",
                c: { a: 0, k: [r, g, b, 1] },
                o: { a: 0, k: 60 },
                w: { a: 0, k: 2 },
                lc: 2,
                lj: 2,
                nm: "Stroke2"
              },
              {
                ty: "tr",
                p: { a: 0, k: [0, 0] },
                a: { a: 0, k: [0, 0] },
                s: { a: 0, k: [100, 100] },
                r: { a: 0, k: 0 },
                o: { a: 0, k: 100 }
              }
            ],
            nm: "Wave Group 2"
          }
        ],
        ip: 0,
        op: 60,
        st: 0,
        bm: 0
      }
    ],
    markers: []
  };
}

// 简化版：使用CSS动画的流体波浪（更可靠的备选方案）
function FluidWaveSVG({ 
  width, 
  height, 
  color 
}: { 
  width: number; 
  height: number; 
  color: string;
}) {
  const pathRef1 = useRef<SVGPathElement>(null);
  const pathRef2 = useRef<SVGPathElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let animationId: number;
    let startTime: number | null = null;

    const generateFluidPath = (
      w: number, 
      h: number, 
      time: number, 
      amplitude: number,
      phaseOffset: number = 0
    ): string => {
      const centerY = h / 2;
      const segments = 8;
      let d = `M 0 ${centerY}`;

      for (let i = 0; i < segments; i++) {
        const t = i / segments;
        const nextT = (i + 1) / segments;
        
        const x1 = t * w;
        const x2 = nextT * w;
        
        // 有机波浪：多个正弦叠加
        const y1 = centerY + 
          Math.sin((t * Math.PI * 2) + time + phaseOffset) * amplitude * 0.7 +
          Math.sin((t * Math.PI * 4) + time * 1.3 + phaseOffset) * amplitude * 0.3;
        const y2 = centerY + 
          Math.sin((nextT * Math.PI * 2) + time + phaseOffset) * amplitude * 0.7 +
          Math.sin((nextT * Math.PI * 4) + time * 1.3 + phaseOffset) * amplitude * 0.3;
        
        // 贝塞尔控制点
        const cpX1 = x1 + (x2 - x1) * 0.5;
        const cpY1 = y1;
        const cpX2 = x1 + (x2 - x1) * 0.5;
        const cpY2 = y2;
        
        d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x2} ${y2}`;
      }

      return d;
    };

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // 呼吸效果的幅度变化
      const breathingAmplitude = 4 + Math.sin(elapsed * 0.8) * 2;

      if (pathRef1.current) {
        pathRef1.current.setAttribute('d', generateFluidPath(width, height, elapsed * 1.5, breathingAmplitude, 0));
      }
      if (pathRef2.current) {
        pathRef2.current.setAttribute('d', generateFluidPath(width, height, elapsed * 1.2, breathingAmplitude * 0.6, Math.PI / 3));
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [width, height, prefersReducedMotion]);

  const staticPath = `M 0 ${height/2} Q ${width*0.25} ${height*0.3}, ${width*0.5} ${height/2} T ${width} ${height/2}`;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="lottie-wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="30%" stopColor={color} stopOpacity="0.8" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="70%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0.2" />
        </linearGradient>
        <filter id="lottie-glow" x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge>
            <feMergeNode in="blur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 次波浪 - 更淡 */}
      <path
        ref={pathRef2}
        d={staticPath}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.3"
      />

      {/* 主波浪 */}
      <path
        ref={pathRef1}
        d={staticPath}
        stroke="url(#lottie-wave-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        filter="url(#lottie-glow)"
      />
    </svg>
  );
}

// 主组件
export default function LottieWaveAnimation({
  messages = defaultMessages,
  showMessage = true,
  size = "md",
  variant = "purple",
}: LottieWaveAnimationProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (!showMessage || messages.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [messages, showMessage]);

  const sizeConfig = {
    sm: { width: 60, height: 24 },
    md: { width: 100, height: 36 },
    lg: { width: 140, height: 48 },
  };

  const colorConfig = {
    purple: {
      color: "#a78bfa",
      text: "text-violet-300",
      glow: "#8b5cf6",
    },
    warm: {
      color: "#fb923c",
      text: "text-orange-300",
      glow: "#f97316",
    },
    gradient: {
      color: "#c084fc",
      text: "text-purple-300",
      glow: "#a855f7",
    },
  };

  const config = sizeConfig[size];
  const colors = colorConfig[variant];

  // 生成Lottie动画数据
  const animationData = useMemo(() => 
    generateHerWaveAnimation(colors.color, config.width, config.height),
    [colors.color, config.width, config.height]
  );

  // 尝试使用Lottie，如果失败则回退到SVG
  const [useLottie, setUseLottie] = useState(true);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative flex items-center justify-center">
        {/* 背景发光层 */}
        <motion.div
          className="absolute rounded-full blur-xl"
          style={{
            width: config.width * 1.6,
            height: config.height * 2.5,
            background: `radial-gradient(ellipse, ${colors.glow}25 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.12, 1],
            opacity: [0.35, 0.55, 0.35],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* 波浪动画 */}
        {useLottie ? (
          <Lottie
            lottieRef={lottieRef}
            animationData={animationData}
            loop={true}
            autoplay={true}
            style={{ 
              width: config.width, 
              height: config.height,
              filter: `drop-shadow(0 0 4px ${colors.glow}50)`,
            }}
            onError={() => setUseLottie(false)}
          />
        ) : (
          <FluidWaveSVG 
            width={config.width} 
            height={config.height} 
            color={colors.color}
          />
        )}
      </div>

      {/* 消息文字 */}
      {showMessage && (
        <AnimatePresence mode="wait">
          <motion.p
            key={currentMessageIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.4 }}
            className={`text-sm font-medium ${colors.text} text-center`}
          >
            {messages[currentMessageIndex]}
          </motion.p>
        </AnimatePresence>
      )}
    </div>
  );
}

// 内联版本 - 用于聊天气泡内（增强版：3层波浪 + 浮动粒子）
export function LottieInlineLoader({
  message = "思考中...",
  variant = "purple",
}: {
  message?: string;
  variant?: "warm" | "purple" | "gradient";
}) {
  const uniqueId = useId();
  
  const colorConfig = {
    purple: { 
      main: "#a78bfa", 
      glow: "#8b5cf6", 
      light: "#c4b5fd",
      accent: "#ddd6fe"
    },
    warm: { 
      main: "#fb923c", 
      glow: "#f97316",
      light: "#fed7aa",
      accent: "#ffedd5"
    },
    gradient: { 
      main: "#c084fc", 
      glow: "#a855f7",
      light: "#e9d5ff",
      accent: "#f3e8ff"
    },
  };

  const colors = colorConfig[variant];
  const gradId = `inline-grad-${uniqueId}`;
  const glowId = `inline-glow-${uniqueId}`;
  const particleGlowId = `particle-glow-${uniqueId}`;

  // 动画配置
  const width = 70;
  const height = 32;
  const centerY = height / 2;

  return (
    <div className="flex items-center gap-3 py-2">
      {/* 增强版多层波浪动画 */}
      <div className="relative" style={{ width, height }}>
        {/* 多层背景发光 */}
        <motion.div
          className="absolute rounded-full blur-lg"
          style={{ 
            width: width * 1.2,
            height: height * 1.5,
            left: -width * 0.1,
            top: -height * 0.25,
            background: `radial-gradient(ellipse, ${colors.glow}40 0%, ${colors.glow}15 50%, transparent 80%)`,
          }}
          animate={{ 
            opacity: [0.4, 0.7, 0.4],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        
        {/* 内层发光 */}
        <motion.div
          className="absolute rounded-full blur-md"
          style={{ 
            width: width * 0.8,
            height: height,
            left: width * 0.1,
            top: 0,
            background: `${colors.light}25`,
          }}
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        />
        
        {/* 主波浪层 SVG */}
        <svg 
          width={width} 
          height={height} 
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 overflow-visible"
        >
          <defs>
            {/* 主渐变 */}
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={colors.main} stopOpacity="0.1" />
              <stop offset="20%" stopColor={colors.main} stopOpacity="0.7" />
              <stop offset="50%" stopColor={colors.main} stopOpacity="1" />
              <stop offset="80%" stopColor={colors.main} stopOpacity="0.7" />
              <stop offset="100%" stopColor={colors.main} stopOpacity="0.1" />
            </linearGradient>
            
            {/* 发光滤镜 */}
            <filter id={glowId} x="-50%" y="-100%" width="200%" height="300%">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* 粒子发光滤镜 */}
            <filter id={particleGlowId} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* 第三层波浪 - 最远/最淡 */}
          <motion.path
            d={`M 0 ${centerY} Q ${width*0.25} ${centerY-4}, ${width*0.5} ${centerY} T ${width} ${centerY}`}
            stroke={colors.accent}
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
            opacity="0.25"
            animate={{ 
              d: [
                `M 0 ${centerY} Q ${width*0.25} ${centerY-4}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY+5}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY-4}, ${width*0.5} ${centerY} T ${width} ${centerY}`
              ]
            }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* 第二层波浪 - 中间层 */}
          <motion.path
            d={`M 0 ${centerY} Q ${width*0.25} ${centerY+5}, ${width*0.5} ${centerY} T ${width} ${centerY}`}
            stroke={colors.light}
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.45"
            animate={{ 
              d: [
                `M 0 ${centerY} Q ${width*0.25} ${centerY+5}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY-6}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY+5}, ${width*0.5} ${centerY} T ${width} ${centerY}`
              ]
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
          />
          
          {/* 主波浪 - 最亮/最粗 */}
          <motion.path
            d={`M 0 ${centerY} Q ${width*0.25} ${centerY-7}, ${width*0.5} ${centerY} T ${width} ${centerY}`}
            stroke={`url(#${gradId})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            filter={`url(#${glowId})`}
            animate={{ 
              d: [
                `M 0 ${centerY} Q ${width*0.25} ${centerY-7}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY+8}, ${width*0.5} ${centerY} T ${width} ${centerY}`,
                `M 0 ${centerY} Q ${width*0.25} ${centerY-7}, ${width*0.5} ${centerY} T ${width} ${centerY}`
              ]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* 浮动粒子1 - 左侧 */}
          <motion.circle
            cx={width * 0.2}
            r="2.5"
            fill={colors.main}
            filter={`url(#${particleGlowId})`}
            animate={{ 
              cy: [centerY - 3, centerY + 5, centerY - 3],
              opacity: [0.7, 1, 0.7],
              r: [2.5, 3, 2.5]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
          
          {/* 浮动粒子2 - 中间 */}
          <motion.circle
            cx={width * 0.5}
            r="3"
            fill={colors.glow}
            filter={`url(#${particleGlowId})`}
            animate={{ 
              cy: [centerY + 4, centerY - 6, centerY + 4],
              opacity: [0.8, 1, 0.8],
              r: [3, 3.5, 3]
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          />
          
          {/* 浮动粒子3 - 右侧 */}
          <motion.circle
            cx={width * 0.8}
            r="2"
            fill={colors.light}
            filter={`url(#${particleGlowId})`}
            animate={{ 
              cy: [centerY - 2, centerY + 6, centerY - 2],
              opacity: [0.6, 0.9, 0.6],
              r: [2, 2.5, 2]
            }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
          />
        </svg>
      </div>
      
      <span className="text-sm text-muted-foreground">{message}</span>
    </div>
  );
}

// 全屏加载版本
export function LottieFullScreenLoader({
  messages = defaultMessages,
  variant = "purple",
}: {
  messages?: string[];
  variant?: "warm" | "purple" | "gradient";
}) {
  const bgConfig = {
    purple: "bg-gradient-to-br from-violet-950 via-purple-950 to-slate-950",
    warm: "bg-gradient-to-br from-orange-950 via-rose-950 to-slate-950",
    gradient: "bg-gradient-to-br from-slate-950 via-purple-950 to-violet-950",
  };

  const glowConfig = {
    purple: "bg-violet-500/10",
    warm: "bg-orange-500/10",
    gradient: "bg-purple-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`fixed inset-0 z-50 flex items-center justify-center ${bgConfig[variant]}`}
    >
      {/* 背景发光球 */}
      <div className="absolute inset-0 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full ${glowConfig[variant]}`}
            style={{
              width: 280 + i * 100,
              height: 280 + i * 100,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.1, 0.2, 0.1],
            }}
            transition={{
              duration: 3.5 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <LottieWaveAnimation
        messages={messages}
        size="lg"
        variant={variant}
      />
    </motion.div>
  );
}
