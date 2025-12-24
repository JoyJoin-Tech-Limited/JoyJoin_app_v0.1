import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap } from "lucide-react";

interface MatchScoreBadgeProps {
  myFit: number;
  groupSpark?: "High" | "Medium" | "Low";
  compact?: boolean;
}

const sparkLabels = {
  High: "高",
  Medium: "中",
  Low: "低"
};

export default function MatchScoreBadge({ myFit, groupSpark, compact = false }: MatchScoreBadgeProps) {
  const sparkColors = {
    High: "text-emerald-500",
    Medium: "text-amber-500",
    Low: "text-slate-400"
  };

  if (compact) {
    return (
      <Badge className="bg-background/90 backdrop-blur-sm text-foreground border-0 px-2 py-0.5">
        <Sparkles className="h-3 w-3 mr-1" />
        <span className="text-xs font-semibold">{myFit}%</span>
      </Badge>
    );
  }

  return (
    <Badge className="bg-background/90 backdrop-blur-sm text-foreground border-0 px-2.5 py-1 flex-col items-start gap-0.5">
      <div className="flex items-center gap-1">
        <Sparkles className="h-3 w-3" />
        <span className="text-xs font-semibold">{myFit}% 匹配</span>
      </div>
      {groupSpark && (
        <div className="flex items-center gap-1">
          <Zap className={`h-3 w-3 ${sparkColors[groupSpark]}`} />
          <span className="text-[10px]">氛围: {sparkLabels[groupSpark]}</span>
        </div>
      )}
    </Badge>
  );
}
