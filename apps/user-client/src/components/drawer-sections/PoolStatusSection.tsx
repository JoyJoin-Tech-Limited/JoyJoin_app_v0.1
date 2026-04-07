import { useState } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Flame } from "lucide-react";
import ArchetypeCoinMinimal from "../ArchetypeCoinMinimal";
import FloatingThemeTags from "../FloatingThemeTags";
import InteractiveThemeBubbles from "../InteractiveThemeBubbles";

interface PoolStats {
  totalRegistrations: number;
  archetypeBreakdown: Record<string, number>;
  /** [Event Pool] Pool-formable group count — see EventPoolStatsResponse for semantics. */
  poolFormableGroupCount: number;
  avgMatchScore: number;
  recentThemeTitles: Array<{
    themeTitle: string | null;
    themeEmoji: string;
  }>;
}

interface ThemeBubble {
  groupId: string;
  themeTitle: string;
  themeEmoji: string;
  memberCount: number;
  temperatureLevel: "fire" | "warm" | "mild" | "cold";
}

interface PoolStatusSectionProps {
  poolId: string;
  stats: PoolStats;
  minGroupSize: number;
  successfulThemes?: ThemeBubble[];
  onThemeClick?: (groupId: string) => void;
}

export default function PoolStatusSection({
  poolId,
  stats,
  minGroupSize,
  successfulThemes = [],
  onThemeClick,
}: PoolStatusSectionProps) {
  const [showAllThemes, setShowAllThemes] = useState(false);
  const recentThemeTitles = stats.recentThemeTitles.filter(
    (theme): theme is { themeTitle: string; themeEmoji: string } =>
      typeof theme.themeTitle === "string" && theme.themeTitle.trim().length > 0,
  );
  
  const spotsNeeded = minGroupSize - (stats.totalRegistrations % minGroupSize);
  const isHot = spotsNeeded <= 2 && spotsNeeded > 0 && spotsNeeded !== minGroupSize;
  const currentProgress = stats.totalRegistrations % minGroupSize;
  
  // Sort archetypes by count
  const sortedArchetypes = Object.entries(stats.archetypeBreakdown)
    .sort(([, a], [, b]) => b - a)
    .map(([archetype, count]) => ({ archetype, count }));
  
  return (
    <div className="space-y-6">
      {/* Progress Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50">
            {stats.totalRegistrations} 人在活动池
          </h3>
          {isHot && (
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1">
              <Flame className="h-3 w-3" />
              即将触发匹配
            </Badge>
          )}
        </div>
        
        {/* Chunked Progress Bar */}
        <div className="space-y-2 mb-4">
          <div className="flex gap-1">
            {Array.from({ length: minGroupSize }).map((_, index) => {
              const isFilled = index < currentProgress;
              
              return (
                <motion.div
                  key={index}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{
                    delay: index * 0.05,
                    type: "spring",
                    stiffness: 260,
                    damping: 20,
                  }}
                  className="flex-1 h-3 rounded-full origin-bottom transition-colors duration-200"
                  style={{
                    backgroundColor: isFilled
                      ? "rgb(139, 92, 246)" // violet-500
                      : "rgb(229, 231, 235)", // gray-200
                  }}
                />
              );
            })}
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentProgress === 0 && stats.totalRegistrations > 0
              ? "已满足匹配门槛！"
              : spotsNeeded > 0 
                ? `再来 ${spotsNeeded} 人即可触发匹配`
                : "已满足匹配门槛！"}
          </p>
        </div>
        
        {/* Stats Row */}
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <div>
            {/* [Event Pool] Pool-formable groups — NOT confirmed 成桌 instances */}
            <span className="font-medium">可匹配组数：</span>
            <span className="ml-1">{stats.poolFormableGroupCount} 组</span>
          </div>
          <div>
            <span className="font-medium">平均匹配度：</span>
            <span className="ml-1">{stats.avgMatchScore}%</span>
          </div>
        </div>
      </div>
      
      {/* Archetype Coins Grid */}
      <div className="space-y-4">
        <div className="px-1">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50">
            谁在活动池？
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            根据参与者原型分布
          </p>
        </div>
        
        {sortedArchetypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
              <span className="text-3xl">✨</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              成为第一个加入的人！
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              开启你的JoyJoin之旅
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {sortedArchetypes.map((item, index) => (
              <ArchetypeCoinMinimal
                key={item.archetype}
                archetype={item.archetype}
                count={item.count}
                index={index}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Theme Showcase */}
      {recentThemeTitles.length > 0 && (
        <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-50">
                近期话题方向
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                以往活动池产生的话题风格
              </p>
            </div>
            
            {successfulThemes.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllThemes(!showAllThemes)}
                className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 gap-1"
              >
                {showAllThemes ? (
                  <>
                    收起 <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    查看全部 <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
          
          {showAllThemes && successfulThemes.length > 0 ? (
            <InteractiveThemeBubbles
              themes={successfulThemes}
              onThemeClick={onThemeClick}
            />
          ) : (
              <FloatingThemeTags
                themeTags={recentThemeTitles}
                maxTags={5}
                autoRotate={true}
              />
          )}
        </div>
      )}
    </div>
  );
}
