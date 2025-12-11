import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import PersonalityRadarChart from "./PersonalityRadarChart";

interface PersonalityTrait {
  name: string;
  score: number;
  maxScore: number;
}

interface PersonalityProfileProps {
  traits: PersonalityTrait[];
  challenges: string[];
  idealMatch: string;
  energyLevel?: number;
  onRetakeQuiz?: () => void;
}

const getEnergyLevelConfig = (level: number) => {
  if (level >= 80) return { label: "超强能量", color: "from-orange-500 to-red-500", icon: "🔥" };
  if (level >= 60) return { label: "高能量", color: "from-yellow-500 to-orange-500", icon: "⚡" };
  if (level >= 40) return { label: "中等能量", color: "from-blue-500 to-indigo-500", icon: "💫" };
  if (level >= 20) return { label: "温和能量", color: "from-teal-500 to-cyan-500", icon: "🌊" };
  return { label: "沉静能量", color: "from-slate-500 to-gray-500", icon: "🌙" };
};

export default function PersonalityProfile({ 
  traits, 
  challenges, 
  idealMatch,
  energyLevel = 75,
  onRetakeQuiz 
}: PersonalityProfileProps) {
  const energyConfig = getEnergyLevelConfig(energyLevel);

  return (
    <div className="space-y-4">
      <Card className="border shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold">性格特质</h3>
            {onRetakeQuiz && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetakeQuiz}
                data-testid="button-retake-quiz"
              >
                重新测试
              </Button>
            )}
          </div>

          <PersonalityRadarChart 
            affinityScore={traits.find(t => t.name === "亲和力")?.score || 0}
            opennessScore={traits.find(t => t.name === "开放性")?.score || 0}
            conscientiousnessScore={traits.find(t => t.name === "责任心")?.score || 0}
            emotionalStabilityScore={traits.find(t => t.name === "情绪稳定性")?.score || 0}
            extraversionScore={traits.find(t => t.name === "外向性")?.score || 0}
            positivityScore={traits.find(t => t.name === "正能量性")?.score || 0}
          />

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2">
            {traits.map((trait, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{trait.name}</span>
                <span className="font-medium flex-shrink-0">{trait.score}/{trait.maxScore}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={`border-0 shadow-sm bg-gradient-to-r ${energyConfig.color} text-white`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                <h3 className="font-semibold text-sm">能量值</h3>
              </div>
              <p className="text-xs opacity-90">
                {energyLevel >= 60 
                  ? "你是活动中的能量源，能带动全场氛围" 
                  : energyLevel >= 40
                  ? "你能为活动带来平衡的能量"
                  : "你用稳定的能量支持团队"}
              </p>
            </div>
            <div className="text-center ml-4">
              <div className="text-3xl mb-1">{energyConfig.icon}</div>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                {energyConfig.label}
              </Badge>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${energyLevel}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs opacity-75">0</span>
              <span className="text-xs font-semibold">{energyLevel}/100</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm bg-destructive/5">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">潜在友谊挑战</h3>
          <div className="space-y-2">
            {challenges.map((challenge, index) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <Sparkles className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground leading-relaxed">{challenge}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">理想朋友类型</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{idealMatch}</p>
        </CardContent>
      </Card>
    </div>
  );
}
