import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  X, User, Compass, BookOpen, Brain, Sun, ChevronLeft, ChevronRight,
  Zap, Sparkles, Search, Waves, Users, Heart, Lightbulb, Anchor, Shield, Eye,
  type LucideIcon
} from "lucide-react";

interface Attendee {
  userId: string;
  displayName: string;
  archetype?: string;
  topInterests?: string[];
  industry?: string;
  ageVisible?: boolean;
  industryVisible?: boolean;
}

interface ConnectionPoint {
  label: string;
  type: string;
}

interface StackedAttendeeCardsProps {
  attendees: Attendee[];
  connectionPoints: Record<string, ConnectionPoint[]>;
}

const ARCHETYPE_ICONS: Record<string, LucideIcon> = {
  "探索者": Compass,
  "讲故事的人": BookOpen,
  "智者": Brain,
  "发光体": Sun,
  "开心柯基": Zap,
  "太阳鸡": Sun,
  "夸夸豚": Sparkles,
  "机智狐": Search,
  "淡定海豚": Waves,
  "织网蛛": Users,
  "暖心熊": Heart,
  "灵感章鱼": Lightbulb,
  "沉思猫头鹰": Brain,
  "定心大象": Anchor,
  "稳如龟": Shield,
  "隐身猫": Eye,
};

export default function StackedAttendeeCards({ attendees, connectionPoints }: StackedAttendeeCardsProps) {
  const [selectedAttendee, setSelectedAttendee] = useState<Attendee | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % attendees.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + attendees.length) % attendees.length);
  };

  const getArchetypeIcon = (archetype?: string): LucideIcon => {
    return ARCHETYPE_ICONS[archetype || ""] || User;
  };

  return (
    <>
      <div className="relative h-[360px]">
        <div className="relative w-full h-full flex items-center justify-center">
          {attendees.map((attendee, index) => {
            const offset = index - currentIndex;
            const absOffset = Math.abs(offset);
            const isVisible = absOffset <= 2;
            
            return (
              <motion.div
                key={attendee.userId}
                className="absolute w-[280px]"
                initial={false}
                animate={{
                  x: offset * 40,
                  y: absOffset * 8,
                  scale: 1 - absOffset * 0.08,
                  opacity: isVisible ? 1 - absOffset * 0.3 : 0,
                  zIndex: 10 - absOffset,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                style={{ pointerEvents: offset === 0 ? "auto" : "none" }}
              >
                <Card
                  className="hover-elevate active-elevate-2 cursor-pointer shadow-lg"
                  onClick={() => offset === 0 && setSelectedAttendee(attendee)}
                  data-testid={`attendee-card-${index}`}
                >
                  <CardContent className="p-6">
                    <div className="text-center space-y-3">
                      {(() => {
                        const ArchetypeIcon = getArchetypeIcon(attendee.archetype);
                        return (
                          <div className="flex items-center justify-center">
                            <ArchetypeIcon className="h-12 w-12 text-primary" />
                          </div>
                        );
                      })()}
                      <h3 className="text-xl font-bold">{attendee.displayName}</h3>
                      {attendee.archetype && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {attendee.archetype}
                        </Badge>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {attendee.topInterests?.slice(0, 2).join(" · ")}
                      </p>
                      {connectionPoints[attendee.userId] && connectionPoints[attendee.userId].length > 0 && (
                        <div className="flex items-center justify-center gap-1 text-xs text-primary">
                          <span>与你有</span>
                          <span className="font-bold">{connectionPoints[attendee.userId].length}</span>
                          <span>个共同点</span>
                          <span className="ml-1">•••</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {attendees.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4">
            <button
              onClick={handlePrev}
              className="w-10 h-10 rounded-full bg-card border hover-elevate active-elevate-2 flex items-center justify-center"
              data-testid="button-prev-attendee"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex gap-1.5">
              {attendees.map((_, index) => (
                <div
                  key={index}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: index === currentIndex ? "hsl(var(--primary))" : "hsl(var(--muted))",
                    transform: index === currentIndex ? "scale(1.2)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              className="w-10 h-10 rounded-full bg-card border hover-elevate active-elevate-2 flex items-center justify-center"
              data-testid="button-next-attendee"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedAttendee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAttendee(null)}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-md"
            />

            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-md"
              data-testid="expanded-attendee-card"
            >
              <Card className="shadow-2xl">
                <CardContent className="p-6 space-y-6">
                  <button
                    onClick={() => setSelectedAttendee(null)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted hover-elevate active-elevate-2 flex items-center justify-center"
                    data-testid="button-close-expanded"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-center space-y-3"
                  >
                    {(() => {
                      const SelectedArchetypeIcon = getArchetypeIcon(selectedAttendee.archetype);
                      return (
                        <div className="flex items-center justify-center">
                          <SelectedArchetypeIcon className="h-16 w-16 text-primary" />
                        </div>
                      );
                    })()}
                    <h2 className="text-2xl font-bold">{selectedAttendee.displayName}</h2>
                    {selectedAttendee.archetype && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary">
                        {selectedAttendee.archetype}
                      </Badge>
                    )}
                  </motion.div>

                  {selectedAttendee.topInterests && selectedAttendee.topInterests.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-2"
                    >
                      <h3 className="text-sm font-medium text-muted-foreground">个人兴趣</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedAttendee.topInterests.map((interest, index) => (
                          <Badge key={index} variant="outline" className="bg-accent/30">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {connectionPoints[selectedAttendee.userId] && connectionPoints[selectedAttendee.userId].length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-2"
                    >
                      <h3 className="text-sm font-medium text-primary">与你的共同点</h3>
                      <div className="flex flex-wrap gap-2">
                        {connectionPoints[selectedAttendee.userId].map((point, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 + index * 0.05 }}
                          >
                            <Badge className="bg-primary/10 text-primary border-primary/30">
                              {point.label}
                            </Badge>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {selectedAttendee.industryVisible && selectedAttendee.industry && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="pt-4 border-t space-y-2 text-sm"
                    >
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">行业</span>
                        <span className="font-medium">{selectedAttendee.industry}</span>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
