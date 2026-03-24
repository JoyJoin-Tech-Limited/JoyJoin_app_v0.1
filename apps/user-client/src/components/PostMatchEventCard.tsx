import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import MeetYourTable from "./MeetYourTable";
import WhyThisTable from "./WhyThisTable";
import { Users, Zap, ChevronDown, ChevronUp, Copy } from "lucide-react";
import type { AttendeeData, UserContext } from "@/lib/attendeeAnalytics";
import type { GroupAnalysisResponse, OverallChemistry } from "@shared/types/groupAnalysis";

interface PostMatchEventCardProps {
  matchedAttendees?: AttendeeData[];
  matchExplanation?: string;
  currentUser: UserContext;
  groupAnalysis?: GroupAnalysisResponse;
  isLoadingAnalysis?: boolean;
}

const CHEMISTRY_CONFIG: Record<OverallChemistry, { label: string; emoji: string; className: string }> = {
  fire: { label: "深度共鸣", emoji: "🔥", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300" },
  warm: { label: "暖意融融", emoji: "✨", className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300" },
  mild: { label: "轻松聊得来", emoji: "💬", className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300" },
  cold: { label: "慢热相识", emoji: "🌱", className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300" },
};

export default function PostMatchEventCard({ 
  matchedAttendees, 
  matchExplanation,
  currentUser,
  groupAnalysis,
  isLoadingAnalysis = false,
}: PostMatchEventCardProps) {
  const [showOtherPairs, setShowOtherPairs] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!matchedAttendees || matchedAttendees.length === 0) {
    return null;
  }

  const currentUserId = (currentUser as UserContext & { userId?: string }).userId;

  const myPairs = groupAnalysis?.pairExplanations.filter(p =>
    currentUserId && p.pairKey.includes(currentUserId)
  ) ?? [];

  const otherPairs = groupAnalysis?.pairExplanations.filter(p =>
    !currentUserId || !p.pairKey.includes(currentUserId)
  ) ?? [];

  const handleCopyIceBreaker = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("[PostMatchEventCard] Clipboard write failed:", err);
    });
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const chemistryConfig = groupAnalysis ? CHEMISTRY_CONFIG[groupAnalysis.overallChemistry] : null;

  return (
    <Card className="border shadow-sm" data-testid="card-post-match-preview">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5" />
          活动预览
          {isLoadingAnalysis && (
            <Skeleton className="h-5 w-20 ml-auto" />
          )}
          {!isLoadingAnalysis && chemistryConfig && (
            <Badge
              variant="outline"
              className={`ml-auto text-xs font-medium ${chemistryConfig.className}`}
              data-testid="badge-overall-chemistry"
            >
              {chemistryConfig.emoji} {chemistryConfig.label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <MeetYourTable 
          attendees={matchedAttendees} 
          currentUser={currentUser}
        />

        {/* Group dynamics / explanation */}
        {isLoadingAnalysis && (
          <div className="space-y-2" data-testid="skeleton-group-dynamics">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {!isLoadingAnalysis && groupAnalysis?.groupDynamics && (
          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-group-dynamics">
            {groupAnalysis.groupDynamics}
          </p>
        )}
        {!isLoadingAnalysis && !groupAnalysis && matchExplanation && (
          <WhyThisTable explanation={matchExplanation} />
        )}

        {/* Pair explanations — current user's pairs first */}
        {isLoadingAnalysis && (
          <div className="space-y-3" data-testid="skeleton-pair-explanations">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        )}
        {!isLoadingAnalysis && groupAnalysis && groupAnalysis.pairExplanations.length > 0 && (
          <div className="space-y-3" data-testid="section-pair-explanations">
            {myPairs.map(pair => (
              <div
                key={pair.pairKey}
                className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-1.5"
                data-testid="pair-explanation-mine"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  {pair.chemistryScore >= 85 && (
                    <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  )}
                  {pair.connectionPoints.map((cp, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {cp}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm leading-relaxed">{pair.explanation}</p>
              </div>
            ))}

            {otherPairs.length > 0 && (
              <div>
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowOtherPairs(v => !v)}
                  data-testid="button-toggle-other-pairs"
                >
                  {showOtherPairs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showOtherPairs ? "收起其他配对" : `查看其他 ${otherPairs.length} 个配对`}
                </button>
                {showOtherPairs && (
                  <div className="mt-2 space-y-2">
                    {otherPairs.map(pair => (
                      <div
                        key={pair.pairKey}
                        className="rounded-lg bg-muted/40 border p-3 space-y-1.5"
                        data-testid="pair-explanation-other"
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {pair.chemistryScore >= 85 && (
                            <Zap className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          )}
                          {pair.connectionPoints.map((cp, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {cp}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">{pair.explanation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Ice-breakers */}
        {isLoadingAnalysis && (
          <div className="space-y-2" data-testid="skeleton-icebreakers">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-8 w-full rounded-full" />
            <Skeleton className="h-8 w-full rounded-full" />
          </div>
        )}
        {!isLoadingAnalysis && groupAnalysis && groupAnalysis.iceBreakers.length > 0 && (
          <div className="space-y-2" data-testid="section-icebreakers">
            <p className="text-xs font-medium text-muted-foreground">今晚聊什么？</p>
            <div className="flex flex-col gap-2">
              {groupAnalysis.iceBreakers.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopyIceBreaker(topic, idx)}
                  className="text-left text-sm px-3 py-2 rounded-full bg-muted hover:bg-muted/80 active:scale-[0.98] transition-all flex items-center justify-between gap-2"
                  data-testid="chip-icebreaker"
                >
                  <span>{topic}</span>
                  <Copy className={`h-3.5 w-3.5 flex-shrink-0 ${copiedIndex === idx ? "text-primary" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
