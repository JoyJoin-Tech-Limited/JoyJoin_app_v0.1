/**
 * Enhanced Loading Screen with Progress Indicator
 * 加载屏幕 - 显示进度条和百分比
 */

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

interface AnimationLoadingScreenProps {
  progress: number;
  eventTheme?: {
    blindBoxColor: string;
    accentColor: string;
  };
  message?: string;
}

export const AnimationLoadingScreen: React.FC<AnimationLoadingScreenProps> = ({
  progress,
  eventTheme,
  message = '小悦正在组局...',
}) => {
  const defaultTheme = {
    blindBoxColor: '#a78bfa',
    accentColor: '#ec4899',
  };

  const theme = eventTheme || defaultTheme;

  return (
    <motion.div 
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Blind Box Animation */}
      <motion.div
        className="w-32 h-32 rounded-2xl flex items-center justify-center mb-8"
        style={{ backgroundColor: theme.blindBoxColor }}
        animate={{
          rotate: [-2, 2, -2, 2, 0],
          scale: [1, 1.02, 1, 1.02, 1],
        }}
        transition={{
          duration: 0.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        <Sparkles className="w-12 h-12" style={{ color: theme.accentColor }} />
      </motion.div>

      {/* Loading Message */}
      <motion.p 
        className="text-muted-foreground mb-8 text-center"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {message}
      </motion.p>

      {/* Progress Bar */}
      <div className="w-48 h-2 rounded-full bg-secondary/50 overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: theme.accentColor }}
          initial={{ width: '0%' }}
          animate={{ width: `${Math.min(progress, 99)}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Progress Percentage */}
      <motion.p 
        className="text-xs text-muted-foreground"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {Math.min(progress, 99)}%
      </motion.p>
    </motion.div>
  );
};
