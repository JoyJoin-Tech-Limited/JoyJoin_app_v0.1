import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronDown, Sparkles, RefreshCw, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface ConversationTopicsCardProps {
  eventId: string;
  className?: string;
}

interface TopicSuggestion {
  topic: string;
  reason: string;
  icebreaker?: string;
}

interface ConversationTopicsResponse {
  topics: TopicSuggestion[];
  commonInterests: string[];
  generatedAt: string;
}

export default function ConversationTopicsCard({ eventId, className = "" }: ConversationTopicsCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<ConversationTopicsResponse>({
    queryKey: ['/api/events', eventId, 'conversation-topics'],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/conversation-topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to fetch topics');
      return res.json();
    },
    enabled: isOpen,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <Card className={`overflow-hidden ${className}`} data-testid="conversation-topics-card">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover-elevate py-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span>可以聊的话题</span>
                {data?.topics && (
                  <Badge variant="secondary" className="text-xs">
                    {data.topics.length}个建议
                  </Badge>
                )}
              </div>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <AnimatePresence mode="wait">
              {isLoading || isFetching ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-6"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  >
                    <Sparkles className="w-6 h-6 text-primary" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground mt-2">小悦正在分析共同话题...</p>
                </motion.div>
              ) : data?.topics && data.topics.length > 0 ? (
                <motion.div
                  key="topics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  {data.commonInterests && data.commonInterests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {data.commonInterests.map((interest, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-primary/5">
                          {interest}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {data.topics.map((topic, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-muted/50 rounded-xl p-3"
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Lightbulb className="w-3 h-3 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{topic.topic}</p>
                          <p className="text-xs text-muted-foreground mt-1">{topic.reason}</p>
                          {topic.icebreaker && (
                            <div className="mt-2 p-2 bg-background rounded-lg border border-dashed">
                              <p className="text-xs text-primary italic">
                                💬 "{topic.icebreaker}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    data-testid="button-refresh-topics"
                  >
                    <RefreshCw className={`w-3 h-3 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                    换一批话题
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-4 text-muted-foreground text-sm"
                >
                  暂无话题建议
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
