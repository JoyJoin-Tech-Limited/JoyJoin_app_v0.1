import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Loader2, Users, Wifi, WifiOff } from 'lucide-react';

interface CheckinParticipant {
  userId: string;
  displayName: string;
  archetype: string | null;
  numberPlate: number | null;
  profileImageUrl?: string;
}

interface IcebreakerCheckinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  checkedInCount: number;
  expectedAttendees: number;
  checkins: CheckinParticipant[];
  isConnected: boolean;
  isReconnecting: boolean;
  hasCheckedIn: boolean;
  onCheckin: () => void;
  welcomeMessage?: string;
  eventTitle?: string;
}

export function IcebreakerCheckinModal({
  open,
  onOpenChange,
  sessionId,
  checkedInCount,
  expectedAttendees,
  checkins,
  isConnected,
  isReconnecting,
  hasCheckedIn,
  onCheckin,
  welcomeMessage,
  eventTitle,
}: IcebreakerCheckinModalProps) {
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const progressPercent = expectedAttendees > 0 ? (checkedInCount / expectedAttendees) * 100 : 0;
  const allCheckedIn = checkedInCount >= expectedAttendees && expectedAttendees > 0;

  const handleCheckin = async () => {
    setIsCheckingIn(true);
    onCheckin();
    setTimeout(() => setIsCheckingIn(false), 500);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

  const getArchetypeInitial = (archetype: string | null): string => {
    if (!archetype) return '';
    return archetype.slice(0, 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="w-full h-full max-w-none max-h-none m-0 p-0 rounded-none border-0 bg-gradient-to-b from-primary/5 via-background to-background"
        data-testid="icebreaker-checkin-modal"
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <Wifi className="w-3 h-3" />
                已连接
              </span>
            ) : isReconnecting ? (
              <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                重连中...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                <WifiOff className="w-3 h-3" />
                已断开
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-md mx-auto"
            >
              <h1 
                className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
                data-testid="text-event-title"
              >
                {eventTitle || '活动签到'}
              </h1>
              
              <p className="text-muted-foreground mb-8" data-testid="text-welcome">
                {welcomeMessage || '欢迎来到今天的聚会！请点击下方按钮完成签到。'}
              </p>

              <div className="relative w-48 h-48 mx-auto mb-8">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 88}
                    initial={{ strokeDashoffset: 2 * Math.PI * 88 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 88 * (1 - progressPercent / 100) }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    key={checkedInCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-5xl font-bold text-primary"
                    data-testid="text-checkin-count"
                  >
                    {checkedInCount}
                  </motion.span>
                  <span className="text-lg text-muted-foreground">
                    / {expectedAttendees}
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                    <Users className="w-4 h-4" />
                    已签到
                  </span>
                </div>
              </div>

              {!hasCheckedIn ? (
                <Button
                  size="lg"
                  onClick={handleCheckin}
                  disabled={isCheckingIn || !isConnected}
                  data-testid="button-checkin"
                >
                  {isCheckingIn ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      签到中...
                    </>
                  ) : (
                    '我到了！'
                  )}
                </Button>
              ) : (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-8 h-8" />
                    <span className="text-xl font-semibold">签到成功</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {allCheckedIn 
                      ? '所有人都到齐啦！即将进入下一环节...' 
                      : '等待其他小伙伴签到中...'}
                  </p>
                </motion.div>
              )}
            </motion.div>

            {checkins.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-8 w-full max-w-md"
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  已到场的小伙伴
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  <AnimatePresence mode="popLayout">
                    {checkins.map((participant, index) => (
                      <motion.div
                        key={participant.userId}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex flex-col items-center gap-1"
                        data-testid={`participant-${participant.userId}`}
                      >
                        <div className="relative">
                          <Avatar className="w-12 h-12 border-2 border-primary/20">
                            <AvatarImage src={participant.profileImageUrl} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(participant.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          {participant.archetype && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                              {getArchetypeInitial(participant.archetype)}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground max-w-[60px] truncate text-center">
                          {participant.displayName}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-6 py-4 border-t bg-muted/30">
            <p className="text-center text-xs text-muted-foreground">
              提示：到了现场后再签到哦，方便大家相互找到～
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
