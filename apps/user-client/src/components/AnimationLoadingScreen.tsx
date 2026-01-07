/**
 * Enhanced Loading Screen with OS1-style Animation
 * 加载屏幕 - 灵感来自《Her》电影的OS1界面
 * 柔和的波形动画 + 动态主题支持 + 呼吸感脉动
 */

import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

interface AnimationLoadingScreenProps {
  progress: number;
  eventTheme?: {
    blindBoxColor: string;
    accentColor: string;
  };
  message?: string;
}

const MATCHING_MESSAGES = [
  '小悦正在组局...',
  '正在寻找有趣的灵魂...',
  '分析匹配度中...',
  '筛选最佳组合...',
  '即将揭晓...',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export const AnimationLoadingScreen: React.FC<AnimationLoadingScreenProps> = ({
  progress,
  eventTheme,
  message,
}) => {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  
  useEffect(() => {
    if (message) return;
    
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % MATCHING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [message]);

  const displayMessage = message || MATCHING_MESSAGES[currentMessageIndex];

  const colors = useMemo(() => {
    // 默认使用紫色系（与JoyJoin品牌色一致 --primary: 280 45% 55%）
    const defaultPrimary = { r: 139, g: 92, b: 246 };  // violet-500
    const defaultAccent = { r: 168, g: 85, b: 247 };   // purple-500
    
    const primaryRgb = eventTheme?.blindBoxColor ? hexToRgb(eventTheme.blindBoxColor) : null;
    const accentRgb = eventTheme?.accentColor ? hexToRgb(eventTheme.accentColor) : null;
    
    return {
      primary: primaryRgb || defaultPrimary,
      accent: accentRgb || defaultAccent,
    };
  }, [eventTheme]);

  const bgGradient = `linear-gradient(to bottom right, 
    rgb(${Math.floor(colors.primary.r * 0.15)}, ${Math.floor(colors.primary.g * 0.1)}, ${Math.floor(colors.primary.b * 0.1)}),
    rgb(${Math.floor(colors.accent.r * 0.15)}, ${Math.floor(colors.accent.g * 0.1)}, ${Math.floor(colors.accent.b * 0.1)}),
    rgb(15, 23, 42))`;

  const barGradient = `linear-gradient(to top, 
    rgb(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}), 
    rgb(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}))`;
  const barShadow = `0 10px 15px -3px rgba(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}, 0.3)`;
  const progressBarColor = `linear-gradient(to right, 
    rgb(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}), 
    rgb(${colors.accent.r}, ${colors.accent.g}, ${colors.accent.b}))`;

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: bgGradient }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Ambient glow circles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 300 + i * 100,
              height: 300 + i * 100,
              left: '50%',
              top: '45%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle, rgba(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}, ${0.1 - i * 0.02}) 0%, transparent 70%)`,
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* OS1 Wave-form Animation */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        {/* Outer glow */}
        <motion.div
          className="absolute inset-0 rounded-full opacity-20 blur-2xl"
          style={{ background: barGradient }}
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        
        {/* Wave bars */}
        <div className="relative flex items-end justify-center gap-1.5 h-full py-6">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const isCenter = i === 3;
            const distFromCenter = Math.abs(i - 3);
            const baseHeight = isCenter ? 50 : 35 - distFromCenter * 5;
            
            return (
              <motion.div
                key={i}
                className="w-1.5 rounded-full"
                style={{ 
                  background: barGradient,
                  boxShadow: barShadow,
                }}
                animate={{
                  height: [baseHeight * 0.4, baseHeight, baseHeight * 0.6, baseHeight * 0.9, baseHeight * 0.4],
                  opacity: [0.6, 1, 0.8, 1, 0.6],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeInOut",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Rotating message */}
      <motion.p 
        key={currentMessageIndex}
        className="mb-8 text-center text-lg font-medium"
        style={{ color: `rgba(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}, 0.9)` }}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
      >
        {displayMessage}
      </motion.p>

      {/* Progress indicator */}
      <div 
        className="w-48 h-1.5 rounded-full overflow-hidden mb-3"
        style={{ backgroundColor: `rgba(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}, 0.15)` }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: progressBarColor }}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(progress, 99)}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Progress percentage */}
      <motion.p 
        className="text-sm"
        style={{ color: `rgba(${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}, 0.5)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {Math.min(progress, 99)}%
      </motion.p>
    </motion.div>
  );
};
