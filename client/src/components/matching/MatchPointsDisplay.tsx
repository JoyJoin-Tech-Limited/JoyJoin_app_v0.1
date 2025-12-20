import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { 
  MapPin, 
  Users, 
  Heart, 
  Briefcase, 
  GraduationCap, 
  Globe, 
  Sparkles,
  Baby,
  MessageCircle,
  Compass,
  Star
} from "lucide-react";

export interface MatchPoint {
  id: string;
  label: string;
  category: 'hometown' | 'interests' | 'background' | 'culture' | 'personality' | 'family' | 'lifestyle';
  score?: number;
  isRare?: boolean;
}

interface MatchPointsDisplayProps {
  matchPoints: MatchPoint[];
  displayMode?: 'tags' | 'cards' | 'progress';
  showScore?: boolean;
  compact?: boolean;
  className?: string;
}

const categoryConfig: Record<string, { icon: typeof Users; color: string; bgColor: string }> = {
  hometown: { icon: MapPin, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  interests: { icon: Heart, color: 'text-pink-600 dark:text-pink-400', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  background: { icon: Briefcase, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  culture: { icon: Globe, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  personality: { icon: Compass, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  family: { icon: Baby, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  lifestyle: { icon: Sparkles, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
};

function TagsView({ matchPoints, showScore, compact }: { matchPoints: MatchPoint[]; showScore?: boolean; compact?: boolean }) {
  return (
    <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
      {matchPoints.map((point, index) => {
        const config = categoryConfig[point.category] || categoryConfig.interests;
        const Icon = config.icon;
        
        return (
          <motion.div
            key={point.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
          >
            <Badge
              variant="outline"
              className={`${config.bgColor} ${config.color} border-0 ${compact ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'} ${point.isRare ? 'ring-2 ring-primary ring-offset-1' : ''}`}
              data-testid={`badge-match-point-${point.id}`}
            >
              <Icon className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} />
              {point.label}
              {point.isRare && (
                <Star className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} ml-1 fill-current`} />
              )}
              {showScore && point.score && (
                <span className="ml-1 opacity-70">+{point.score}</span>
              )}
            </Badge>
          </motion.div>
        );
      })}
    </div>
  );
}

function CardsView({ matchPoints, showScore }: { matchPoints: MatchPoint[]; showScore?: boolean }) {
  const groupedByCategory = matchPoints.reduce((acc, point) => {
    if (!acc[point.category]) acc[point.category] = [];
    acc[point.category].push(point);
    return acc;
  }, {} as Record<string, MatchPoint[]>);

  return (
    <div className="grid grid-cols-2 gap-3">
      {Object.entries(groupedByCategory).map(([category, points], index) => {
        const config = categoryConfig[category] || categoryConfig.interests;
        const Icon = config.icon;
        
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`${config.bgColor} border-0`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className={`text-xs font-medium ${config.color}`}>
                    {getCategoryLabel(category)}
                  </span>
                </div>
                <div className="space-y-1">
                  {points.map(point => (
                    <div 
                      key={point.id} 
                      className="text-sm flex items-center gap-1"
                      data-testid={`card-match-point-${point.id}`}
                    >
                      {point.isRare && <Star className="h-3 w-3 text-primary fill-primary" />}
                      <span>{point.label}</span>
                      {showScore && point.score && (
                        <span className="text-xs opacity-60">+{point.score}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function ProgressView({ matchPoints }: { matchPoints: MatchPoint[] }) {
  const groupedByCategory = matchPoints.reduce((acc, point) => {
    if (!acc[point.category]) acc[point.category] = { points: [], totalScore: 0 };
    acc[point.category].points.push(point);
    acc[point.category].totalScore += point.score || 10;
    return acc;
  }, {} as Record<string, { points: MatchPoint[]; totalScore: number }>);

  const maxScore = Math.max(...Object.values(groupedByCategory).map(g => g.totalScore), 30);

  return (
    <div className="space-y-3">
      {Object.entries(groupedByCategory).map(([category, data], index) => {
        const config = categoryConfig[category] || categoryConfig.interests;
        const Icon = config.icon;
        const percentage = Math.min(100, (data.totalScore / maxScore) * 100);
        
        return (
          <motion.div
            key={category}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="space-y-1"
          >
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span className="font-medium">{getCategoryLabel(category)}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {data.points.map(p => p.label).join('、')}
              </span>
            </div>
            <Progress 
              value={percentage} 
              className="h-2"
              data-testid={`progress-match-${category}`}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    hometown: '老乡缘分',
    interests: '共同兴趣',
    background: '职业背景',
    culture: '文化认同',
    personality: '性格互补',
    family: '家庭阶段',
    lifestyle: '生活方式',
  };
  return labels[category] || category;
}

export default function MatchPointsDisplay({ 
  matchPoints, 
  displayMode = 'tags', 
  showScore = false,
  compact = false,
  className = ''
}: MatchPointsDisplayProps) {
  if (matchPoints.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {displayMode === 'tags' && (
        <TagsView matchPoints={matchPoints} showScore={showScore} compact={compact} />
      )}
      {displayMode === 'cards' && (
        <CardsView matchPoints={matchPoints} showScore={showScore} />
      )}
      {displayMode === 'progress' && (
        <ProgressView matchPoints={matchPoints} />
      )}
    </div>
  );
}

export function parseMatchPointsFromStrings(matchPointStrings: string[]): MatchPoint[] {
  return matchPointStrings.map((label, index) => {
    let category: MatchPoint['category'] = 'interests';
    let isRare = false;
    
    if (label.includes('老乡') || label.includes('来自')) {
      category = 'hometown';
      isRare = true;
    } else if (label.includes('留学') || label.includes('海外')) {
      category = 'culture';
      isRare = true;
    } else if (label.includes('孩子') || label.includes('宝宝') || label.includes('家庭')) {
      category = 'family';
    } else if (label.includes('性格') || label.includes('原型')) {
      category = 'personality';
    } else if (label.includes('职业') || label.includes('行业') || label.includes('工作')) {
      category = 'background';
    } else if (label.includes('喜欢') || label.includes('兴趣') || label.includes('爱好')) {
      category = 'interests';
    }
    
    return {
      id: `mp-${index}`,
      label,
      category,
      isRare,
    };
  });
}
