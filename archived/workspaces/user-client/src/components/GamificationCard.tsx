import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Flame, Coins, Trophy, ChevronRight, Snowflake,
  Sprout, Compass, Link, Star, Handshake, PartyPopper, Crown, Sparkles, Gem
} from "lucide-react";
import { useLocation } from "wouter";

const LEVEL_ICONS: Record<string, React.ReactNode> = {
  sprout: <Sprout className="h-6 w-6 text-white" />,
  compass: <Compass className="h-6 w-6 text-white" />,
  link: <Link className="h-6 w-6 text-white" />,
  star: <Star className="h-6 w-6 text-white" />,
  trophy: <Trophy className="h-6 w-6 text-white" />,
  handshake: <Handshake className="h-6 w-6 text-white" />,
  "party-popper": <PartyPopper className="h-6 w-6 text-white" />,
  crown: <Crown className="h-6 w-6 text-white" />,
  sparkles: <Sparkles className="h-6 w-6 text-white" />,
  gem: <Gem className="h-6 w-6 text-white" />,
};

interface LevelConfig {
  level: number;
  name: string;
  nameCn: string;
  xpRequired: number;
  icon: string;
  benefits: string[];
  benefitsCn: string[];
}

interface NextLevelInfo {
  nextLevel: number;
  xpNeeded: number;
  progress: number;
}

interface GamificationInfo {
  experiencePoints: number;
  joyCoins: number;
  currentLevel: number;
  levelConfig: LevelConfig;
  nextLevelInfo: NextLevelInfo | null;
  activityStreak: number;
  lastActivityDate: string | null;
  streakFreezeAvailable: boolean;
  eventsAttended: number;
}

export default function GamificationCard() {
  const [, setLocation] = useLocation();
  
  const { data: gamification, isLoading } = useQuery<GamificationInfo>({
    queryKey: ["/api/user/gamification"],
  });

  if (isLoading) {
    return (
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!gamification) {
    return null;
  }

  const { levelConfig, nextLevelInfo, activityStreak, joyCoins, experiencePoints, streakFreezeAvailable } = gamification;

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div 
          className="p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10"
          data-testid="gamification-card"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              {LEVEL_ICONS[levelConfig.icon] || <Star className="h-6 w-6 text-white" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg" data-testid="text-level">
                  Lv.{levelConfig.level}
                </span>
                <span className="text-muted-foreground" data-testid="text-level-name">
                  {levelConfig.nameCn}
                </span>
              </div>
              {nextLevelInfo && (
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={nextLevelInfo.progress} className="h-2 flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {experiencePoints} / {levelConfig.xpRequired + (nextLevelInfo.xpNeeded || 0)} XP
                  </span>
                </div>
              )}
              {!nextLevelInfo && (
                <Badge variant="secondary" className="mt-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0">
                  <Trophy className="h-3 w-3 mr-1" />
                  满级
                </Badge>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div 
              className="flex-1 bg-background/60 rounded-lg p-3 flex items-center gap-2 backdrop-blur-sm"
              data-testid="stat-joy-coins"
            >
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="font-bold text-lg leading-none">{joyCoins}</div>
                <div className="text-xs text-muted-foreground">悦币</div>
              </div>
            </div>
            
            <div 
              className="flex-1 bg-background/60 rounded-lg p-3 flex items-center gap-2 backdrop-blur-sm"
              data-testid="stat-streak"
            >
              <Flame className={`h-5 w-5 ${activityStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-bold text-lg leading-none flex items-center gap-1">
                  {activityStreak}
                  {streakFreezeAvailable && activityStreak > 0 && (
                    <span title="冻结卡可用">
                      <Snowflake className="h-3 w-3 text-blue-400" />
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">周连击</div>
              </div>
            </div>
          </div>

          {levelConfig.benefitsCn.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">当前权益</div>
              <div className="flex flex-wrap gap-1.5">
                {levelConfig.benefitsCn.map((benefit, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-background/50">
                    {benefit}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t bg-muted/30">
          <Button 
            variant="ghost" 
            className="w-full justify-between"
            onClick={() => setLocation('/rewards')}
            data-testid="button-view-rewards"
          >
            <span className="flex items-center gap-2">
              <Coins className="h-4 w-4" />
              兑换优惠券
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
