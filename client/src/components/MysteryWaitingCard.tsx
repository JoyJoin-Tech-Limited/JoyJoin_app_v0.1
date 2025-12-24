import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HelpCircle, Sparkles, Clock } from "lucide-react";
import { useRevealStatus } from "@/hooks/useRevealStatus";

interface MysteryWaitingCardProps {
  eventDateTime: Date | string;
  participantCount?: number;
}

const MYSTERY_PLACEHOLDERS = [
  { delay: 0, size: "h-14 w-14" },
  { delay: 0.1, size: "h-12 w-12" },
  { delay: 0.2, size: "h-14 w-14" },
  { delay: 0.3, size: "h-12 w-12" },
];

export default function MysteryWaitingCard({ eventDateTime, participantCount = 4 }: MysteryWaitingCardProps) {
  const { countdown, countdownMessage, precision, isRevealed } = useRevealStatus(eventDateTime);

  if (isRevealed) {
    return null;
  }

  return (
    <Card className="overflow-hidden border-0 bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-950/30 dark:via-purple-950/30 dark:to-fuchsia-950/30">
      <CardContent className="p-6">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center justify-center -space-x-3">
            {MYSTERY_PLACEHOLDERS.slice(0, Math.min(participantCount, 4)).map((placeholder, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: placeholder.delay, duration: 0.4, type: "spring" }}
              >
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 10px 2px rgba(139, 92, 246, 0.3)",
                      "0 0 20px 4px rgba(139, 92, 246, 0.5)",
                      "0 0 10px 2px rgba(139, 92, 246, 0.3)",
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: placeholder.delay * 2,
                  }}
                  className="rounded-full"
                >
                  <Avatar className={`${placeholder.size} border-2 border-white dark:border-gray-800 shadow-lg`}>
                    <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-600 text-white">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: placeholder.delay }}
                      >
                        <HelpCircle className="h-6 w-6" />
                      </motion.div>
                    </AvatarFallback>
                  </Avatar>
                </motion.div>
              </motion.div>
            ))}
          </div>

          <div className="text-center space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-center gap-2"
            >
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {countdown}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-start gap-2 bg-white/60 dark:bg-gray-800/60 rounded-xl p-3 max-w-xs"
            >
              <Avatar className="h-8 w-8 flex-shrink-0 border border-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs">
                  悦
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {countdownMessage}
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              <span>神秘小伙伴正在等待揭晓</span>
            </motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
