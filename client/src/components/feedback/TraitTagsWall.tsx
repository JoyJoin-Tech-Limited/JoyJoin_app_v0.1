import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Attendee {
  userId: string;
  displayName: string;
  archetype?: string;
}

interface TraitData {
  displayName: string;
  tags: string[];
  needsImprovement: boolean;
  improvementNote: string;
}

interface TraitTagsWallProps {
  attendees: Attendee[];
  initialTraits?: Record<string, TraitData>;
  onNext: (data: { attendeeTraits: Record<string, TraitData> }) => void;
}

const TRAIT_TAGS = [
  "幽默风趣",
  "善于倾听",
  "见识广博",
  "真诚友善",
  "积极主动",
  "善于表达",
  "有同理心",
  "思维敏捷",
  "细心体贴",
  "开放包容",
];

// 8个核心社交角色系统
const archetypeIcons: Record<string, string> = {
  "火花塞": "🙌",
  "探索者": "🧭",
  "故事家": "🗣️",
  "挑战者": "💪",
  "连接者": "🤗",
  "协调者": "🧘",
  "氛围组": "🕺",
  "肯定者": "🙏",
};

export default function TraitTagsWall({ attendees, initialTraits = {}, onNext }: TraitTagsWallProps) {
  const [traits, setTraits] = useState<Record<string, TraitData>>(initialTraits);
  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null);

  const toggleTag = (userId: string, tag: string) => {
    setTraits(prev => {
      const current = prev[userId] || {
        displayName: attendees.find(a => a.userId === userId)?.displayName || "",
        tags: [],
        needsImprovement: false,
        improvementNote: "",
      };

      const tags = current.tags.includes(tag)
        ? current.tags.filter(t => t !== tag)
        : [...current.tags, tag];

      return {
        ...prev,
        [userId]: { ...current, tags },
      };
    });
  };

  const toggleNeedsImprovement = (userId: string) => {
    setTraits(prev => {
      const current = prev[userId] || {
        displayName: attendees.find(a => a.userId === userId)?.displayName || "",
        tags: [],
        needsImprovement: false,
        improvementNote: "",
      };

      return {
        ...prev,
        [userId]: { ...current, needsImprovement: !current.needsImprovement },
      };
    });
  };

  const setImprovementNote = (userId: string, note: string) => {
    setTraits(prev => {
      const current = prev[userId] || {
        displayName: attendees.find(a => a.userId === userId)?.displayName || "",
        tags: [],
        needsImprovement: false,
        improvementNote: "",
      };

      return {
        ...prev,
        [userId]: { ...current, improvementNote: note },
      };
    });
  };

  const handleSubmit = () => {
    // Only include attendees with at least one tag or improvement feedback
    const filteredTraits = Object.entries(traits).reduce((acc, [userId, data]) => {
      if (data.tags.length > 0 || data.needsImprovement) {
        acc[userId] = data;
      }
      return acc;
    }, {} as Record<string, TraitData>);

    onNext({ attendeeTraits: filteredTraits });
  };

  const totalTagsGiven = Object.values(traits).reduce((sum, t) => sum + t.tags.length, 0);

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="text-4xl">🏷️</div>
            <h2 className="text-xl font-bold">为伙伴贴上印象标签</h2>
            <p className="text-sm text-muted-foreground">
              点击选择最符合的印象（可选1-3位伙伴）
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/50">
            <span className="text-muted-foreground">已标记</span>
            <span className="font-medium text-primary">{totalTagsGiven} 个标签</span>
          </div>

          {/* Attendee List */}
          <div className="space-y-3">
            {attendees.map((attendee) => {
              const isExpanded = expandedAttendee === attendee.userId;
              const attendeeTraits = traits[attendee.userId] || {
                displayName: attendee.displayName,
                tags: [],
                needsImprovement: false,
                improvementNote: "",
              };
              const tagCount = attendeeTraits.tags.length;

              const archetypeIcon = attendee.archetype 
                ? archetypeIcons[attendee.archetype] || "✨"
                : "✨";

              return (
                <div key={attendee.userId} className="border rounded-lg overflow-hidden">
                  {/* Attendee Header */}
                  <button
                    onClick={() => setExpandedAttendee(isExpanded ? null : attendee.userId)}
                    className="w-full p-4 flex items-center justify-between hover-elevate active-elevate-2 bg-background transition-colors"
                    data-testid={`button-expand-attendee-${attendee.userId}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">
                        {archetypeIcon}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold">{attendee.displayName}</p>
                        {attendee.archetype && (
                          <p className="text-xs text-muted-foreground">{attendee.archetype}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {tagCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {tagCount} 个标签
                        </Badge>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Tag Selection */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 space-y-4 border-t">
                          {/* Tag Grid */}
                          <div className="flex flex-wrap gap-2.5">
                            {TRAIT_TAGS.map((tag) => {
                              const isSelected = attendeeTraits.tags.includes(tag);
                              return (
                                <Badge
                                  key={tag}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer hover-elevate active-elevate-2 text-sm px-3.5 py-1.5"
                                  onClick={() => toggleTag(attendee.userId, tag)}
                                  data-testid={`tag-${attendee.userId}-${tag}`}
                                >
                                  {isSelected && "✓ "}
                                  {tag}
                                </Badge>
                              );
                            })}
                          </div>

                          {/* Needs Improvement Toggle */}
                          <div className="pt-3 border-t">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={attendeeTraits.needsImprovement}
                                onChange={() => toggleNeedsImprovement(attendee.userId)}
                                className="h-4 w-4 rounded border-input"
                                data-testid={`checkbox-improvement-${attendee.userId}`}
                              />
                              <span className="text-sm font-medium">需要改进</span>
                            </label>

                            {/* Improvement Note (Conditional) */}
                            <AnimatePresence>
                              {attendeeTraits.needsImprovement && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="mt-3"
                                >
                                  <Textarea
                                    value={attendeeTraits.improvementNote}
                                    onChange={(e) => setImprovementNote(attendee.userId, e.target.value)}
                                    placeholder="具体建议（匿名）"
                                    rows={2}
                                    maxLength={100}
                                    className="resize-none"
                                    data-testid={`textarea-improvement-${attendee.userId}`}
                                  />
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {attendeeTraits.improvementNote.length}/100
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Skip/Next Button */}
          <div className="space-y-2">
            <Button 
              onClick={handleSubmit} 
              size="lg" 
              className="w-full"
              data-testid="button-next-traits"
            >
              {totalTagsGiven > 0 ? "下一步" : "跳过"}
            </Button>
            {totalTagsGiven === 0 && (
              <p className="text-xs text-center text-muted-foreground">
                可以跳过这一步，继续其他反馈
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
