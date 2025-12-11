import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Badge } from "@/components/ui/badge";

interface InterestTag {
  name: string;
  icon: string;
}

interface InterestTagCloudProps {
  interests: string[];
}

const interestIcons: Record<string, string> = {
  "电影娱乐": "🎬",
  "旅行探索": "🌍",
  "美食餐饮": "🍜",
  "音乐演出": "🎵",
  "阅读书籍": "📚",
  "艺术文化": "🎨",
  "运动健身": "⚽",
  "健身健康": "💪",
  "摄影": "📷",
  "游戏": "🎮",
  "科技": "💻",
  "创业": "🚀",
  "社交拓展": "🤝",
  "户外活动": "🏕️",
  "瑜伽冥想": "🧘",
  "品酒": "🍷",
  "咖啡茶艺": "☕",
  "烹饪烘焙": "👨‍🍳",
};

export default function InterestTagCloud({ interests }: InterestTagCloudProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollX = useMotionValue(0);

  const tags: InterestTag[] = interests.map(interest => ({
    name: interest,
    icon: interestIcons[interest] || "✨",
  }));

  return (
    <div className="relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      
      <motion.div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-2 px-2 cursor-grab active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: -200, right: 0 }}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        style={{ x: scrollX }}
        data-testid="interest-tag-cloud"
      >
        {tags.map((tag, index) => {
          const xOffset = useTransform(
            scrollX,
            [0, -100],
            [0, index % 2 === 0 ? 10 : -10]
          );

          return (
            <motion.div
              key={`${tag.name}-${index}`}
              style={{ x: xOffset }}
              whileHover={{ scale: isDragging ? 1 : 1.05, y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              data-testid={`interest-tag-${index}`}
            >
              <Badge 
                variant="secondary"
                className="text-sm px-4 py-2 whitespace-nowrap bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 hover-elevate"
              >
                <span className="mr-2 text-base">{tag.icon}</span>
                {tag.name}
              </Badge>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
