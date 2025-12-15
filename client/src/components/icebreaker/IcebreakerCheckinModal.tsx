import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, Users, Sparkles } from 'lucide-react';

import kaiXinKeJi from '@assets/开心柯基_transparent_1_1765650619462.png';
import jiZhiHu from '@assets/机智狐_transparent_2_1765650619453.png';
import nuanXinXiong from '@assets/暖心熊_transparent_3_1765650619461.png';
import zhiWangZhu from '@assets/织网蛛_transparent_4_1765650619463.png';
import kuaKuaTun from '@assets/夸夸豚_transparent_5_1765650619478.png';
import taiYangJi from '@assets/太阳鸡_transparent_6_1765650619458.png';
import danDingHaiTun from '@assets/淡定海豚_transparent_7_1765650619477.png';
import chenSiMaoTouYing from '@assets/沉思猫头鹰_transparent_8_1765650619459.png';
import wenRuGui from '@assets/稳如龟_transparent_9_1765650619461.png';
import yinShenMao from '@assets/隐身猫_transparent_10_1765650619464.png';
import dingXinDaXiang from '@assets/定心大象_transparent_11_1765650619460.png';
import lingGanZhangYu from '@assets/灵感章鱼_transparent_12_1765650619464.png';

const ARCHETYPE_IMAGES: Record<string, string> = {
  '开心柯基': kaiXinKeJi,
  '机智狐': jiZhiHu,
  '暖心熊': nuanXinXiong,
  '织网蛛': zhiWangZhu,
  '夸夸豚': kuaKuaTun,
  '太阳鸡': taiYangJi,
  '淡定海豚': danDingHaiTun,
  '沉思猫头鹰': chenSiMaoTouYing,
  '稳如龟': wenRuGui,
  '隐身猫': yinShenMao,
  '定心大象': dingXinDaXiang,
  '灵感章鱼': lingGanZhangYu,
};

const ARCHETYPES = Object.keys(ARCHETYPE_IMAGES);

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

function getArchetypeImage(archetype: string | null): string | null {
  if (!archetype) return null;
  if (ARCHETYPE_IMAGES[archetype]) {
    return ARCHETYPE_IMAGES[archetype];
  }
  for (const key of ARCHETYPES) {
    if (archetype.includes(key) || key.includes(archetype)) {
      return ARCHETYPE_IMAGES[key];
    }
  }
  const index = Math.abs(archetype.charCodeAt(0)) % ARCHETYPES.length;
  return ARCHETYPE_IMAGES[ARCHETYPES[index]];
}

function getArchetypeName(archetype: string | null): string {
  if (!archetype) return '';
  if (ARCHETYPE_IMAGES[archetype]) {
    return archetype;
  }
  for (const key of ARCHETYPES) {
    if (archetype.includes(key) || key.includes(archetype)) {
      return key;
    }
  }
  const index = Math.abs(archetype.charCodeAt(0)) % ARCHETYPES.length;
  return ARCHETYPES[index];
}

export function IcebreakerCheckinModal({
  open,
  onOpenChange,
  checkedInCount,
  expectedAttendees,
  checkins,
  isConnected,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="m-0 p-0 border-0 bg-gradient-to-b from-primary/10 via-background to-background"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          top: 'auto',
          height: '85vh',
          borderRadius: '1.5rem 1.5rem 0 0',
          zIndex: 50,
          transform: 'none'
        }}
        data-testid="icebreaker-checkin-modal"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>活动签到</DialogTitle>
        </VisuallyHidden>
        <div className="flex flex-col h-full overflow-hidden rounded-t-3xl">
          <div className="flex items-center justify-center">
            <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mt-3 mb-4" />
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-md mx-auto"
            >
              <h1 
                className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent"
                data-testid="text-event-title"
              >
                {eventTitle || '活动签到'}
              </h1>
              
              <p className="text-muted-foreground text-sm mb-6" data-testid="text-welcome">
                {welcomeMessage || '欢迎来到今天的聚会！请点击下方按钮完成签到。'}
              </p>

              <div className="relative w-40 h-40 mx-auto mb-6">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="80"
                    cy="80"
                    r="72"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted/20"
                  />
                  <motion.circle
                    cx="80"
                    cy="80"
                    r="72"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-primary"
                    strokeDasharray={2 * Math.PI * 72}
                    initial={{ strokeDashoffset: 2 * Math.PI * 72 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 72 * (1 - progressPercent / 100) }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span 
                    key={checkedInCount}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    className="text-4xl font-bold text-primary"
                    data-testid="text-checkin-count"
                  >
                    {checkedInCount}
                  </motion.span>
                  <span className="text-base text-muted-foreground">
                    / {expectedAttendees}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Users className="w-3 h-3" />
                    已签到
                  </span>
                </div>
              </div>

              {!hasCheckedIn ? (
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    size="lg"
                    onClick={handleCheckin}
                    disabled={isCheckingIn || !isConnected}
                    className="w-full max-w-xs font-bold rounded-2xl shadow-lg shadow-primary/30"
                    data-testid="button-checkin"
                  >
                    {isCheckingIn ? (
                      <>
                        <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                        签到中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6 mr-2" />
                        我到了！
                      </>
                    )}
                  </Button>
                </motion.div>
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
                className="mt-6 w-full max-w-md"
              >
                <h3 className="text-sm font-medium text-muted-foreground mb-3 text-center">
                  已到场的小伙伴
                </h3>
                <div className="flex flex-wrap justify-center gap-4">
                  <AnimatePresence mode="popLayout">
                    {checkins.map((participant, index) => {
                      const archetypeImage = getArchetypeImage(participant.archetype);
                      const archetypeName = getArchetypeName(participant.archetype);
                      
                      return (
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
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 p-1 border-2 border-primary/30">
                              {archetypeImage ? (
                                <img 
                                  src={archetypeImage} 
                                  alt={archetypeName || participant.displayName}
                                  className="w-full h-full object-contain rounded-full"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                                  {participant.displayName.slice(0, 2)}
                                </div>
                              )}
                            </div>
                            {archetypeName && (
                              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-primary/90 text-white text-[10px] whitespace-nowrap font-medium shadow-sm">
                                {archetypeName}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground max-w-[70px] truncate text-center mt-2">
                            {participant.displayName}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>

          <div className="px-6 py-3 border-t bg-muted/30">
            <p className="text-center text-xs text-muted-foreground">
              提示：到了现场后再签到哦，方便大家相互找到～
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
