import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThemeTag {
  themeTitle: string;
  themeEmoji: string;
}

interface FloatingThemeTagsProps {
  themeTags: ThemeTag[];
  maxTags?: number;
  autoRotate?: boolean;
}

export default function FloatingThemeTags({
  themeTags,
  maxTags = 5,
  autoRotate = true,
}: FloatingThemeTagsProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Limit to maxTags
  const limitedTags = themeTags.slice(0, maxTags);
  
  // Get 3 visible tags with wrapping - memoized function
  const getVisibleTags = useCallback((index: number) => {
    if (limitedTags.length === 0) return [];
    
    const tags = [];
    for (let i = 0; i < Math.min(3, limitedTags.length); i++) {
      const tagIndex = (index + i) % limitedTags.length;
      tags.push({
        ...limitedTags[tagIndex],
        key: `${tagIndex}-${index + i}`,
        position: i,
      });
    }
    return tags;
  }, [limitedTags]);
  
  const [visibleTags, setVisibleTags] = useState(() => getVisibleTags(0));
  
  useEffect(() => {
    if (!autoRotate || limitedTags.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % limitedTags.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [autoRotate, limitedTags.length]);
  
  useEffect(() => {
    setVisibleTags(getVisibleTags(currentIndex));
  }, [currentIndex, getVisibleTags]);
  
  if (limitedTags.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        暂无盲盒主题案例
      </div>
    );
  }
  
  const positions = [
    { x: "10%", initialY: 0 },
    { x: "70%", initialY: 60 },
    { x: "30%", initialY: 120 },
  ];
  
  return (
    <div className="relative h-48 overflow-hidden">
      <AnimatePresence mode="popLayout">
        {visibleTags.map((tag, index) => {
          const pos = positions[tag.position % 3];
          
          return (
            <motion.div
              key={tag.key}
              initial={{
                opacity: 0,
                y: 0,
                x: 0,
              }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [0, -20, -10, 0],
                x: 0,
              }}
              exit={{
                opacity: 0,
                transition: { duration: 0.3 },
              }}
              transition={{
                duration: 4,
                times: [0, 0.2, 0.8, 1],
                ease: "easeInOut",
              }}
              className="absolute"
              style={{
                left: pos.x,
                top: `${pos.initialY}px`,
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border border-gray-200/50 dark:border-gray-700/50">
                <span className="text-xl">{tag.themeEmoji}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {tag.themeTitle}
                </span>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
