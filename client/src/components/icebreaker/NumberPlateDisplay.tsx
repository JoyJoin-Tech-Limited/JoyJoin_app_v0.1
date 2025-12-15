import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Sparkles, Users, Mic } from 'lucide-react';

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

function getArchetypeImage(archetype: string | null | undefined): string | null {
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

function getArchetypeName(archetype: string | null | undefined): string {
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

interface NumberAssignment {
  userId: string;
  displayName: string;
  numberPlate: number;
  archetype?: string | null;
  profileImageUrl?: string;
}

interface NumberPlateDisplayProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  myNumberPlate: number | null;
  myUserId: string;
  assignments: NumberAssignment[];
  currentSpeaker?: number;
  onReady?: (isAutoVote?: boolean) => void;
  isReady?: boolean;
  readyCount: number;
  totalCount: number;
  autoReadyTimeoutSeconds?: number;
  eventTitle?: string;
}

export function NumberPlateDisplay({
  open = true,
  onOpenChange,
  myNumberPlate,
  myUserId,
  assignments,
  currentSpeaker = 1,
  onReady,
  isReady = false,
  readyCount,
  totalCount,
  autoReadyTimeoutSeconds = 60,
  eventTitle,
}: NumberPlateDisplayProps) {
  const [showReveal, setShowReveal] = useState(true);
  const [revealComplete, setRevealComplete] = useState(false);
  const [countdown, setCountdown] = useState(autoReadyTimeoutSeconds);
  const [autoVoteTriggered, setAutoVoteTriggered] = useState(false);
  const isMyTurn = myNumberPlate === currentSpeaker;
  const sortedAssignments = [...assignments].sort((a, b) => a.numberPlate - b.numberPlate);
  
  const currentSpeakerInfo = assignments.find(a => a.numberPlate === currentSpeaker);

  useEffect(() => {
    if (myNumberPlate !== null) {
      const timer = setTimeout(() => {
        setRevealComplete(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [myNumberPlate]);

  useEffect(() => {
    if (isReady) {
      return;
    }
    
    setCountdown(autoReadyTimeoutSeconds);
    setAutoVoteTriggered(false);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onReady) {
            setAutoVoteTriggered(true);
            onReady(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isReady, autoReadyTimeoutSeconds, onReady]);

  if (showReveal && myNumberPlate !== null && !revealComplete) {
    return (
      <div 
        className="fixed inset-0 bg-background/95 backdrop-blur-sm flex items-center justify-center z-50"
        data-testid="number-plate-reveal"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ 
            type: 'spring', 
            stiffness: 200, 
            damping: 15,
            duration: 0.8 
          }}
          className="relative"
        >
          <motion.div
            animate={{ 
              boxShadow: [
                '0 0 20px rgba(139, 92, 246, 0.3)',
                '0 0 60px rgba(139, 92, 246, 0.5)',
                '0 0 20px rgba(139, 92, 246, 0.3)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-48 h-48 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center"
          >
            <span 
              className="text-8xl font-bold text-primary-foreground"
              data-testid="text-my-number"
            >
              {myNumberPlate}
            </span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-6"
          >
            <p className="text-2xl font-semibold">你的号码是</p>
            <p className="text-muted-foreground mt-2 flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              按号码顺序自我介绍
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  const content = (
    <div className="flex flex-col h-full overflow-hidden rounded-t-3xl">
      <div className="flex items-center justify-center">
        <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mt-3 mb-4" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="text-center mb-4">
          {eventTitle && (
            <h2 className="text-lg font-semibold text-primary mb-2" data-testid="text-event-title">
              {eventTitle}
            </h2>
          )}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div 
              className="w-16 h-16 rounded-full bg-primary flex items-center justify-center"
              data-testid="badge-my-number"
            >
              <span className="text-3xl font-bold text-primary-foreground">
                {myNumberPlate || '?'}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">我的号码</p>
        </div>

        {isMyTurn ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center mb-4"
            data-testid="my-turn-banner"
          >
            <div className="flex items-center justify-center gap-2 text-primary mb-2">
              <Mic className="w-5 h-5" />
              <span className="text-lg font-semibold">轮到你啦！</span>
            </div>
            <p className="text-sm text-muted-foreground">
              向大家介绍一下自己吧，说你想说的～
            </p>
          </motion.div>
        ) : currentSpeakerInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center mb-4"
            data-testid="speaker-guide-banner"
          >
            <div className="flex items-center justify-center gap-2 text-primary/80">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Mic className="w-4 h-4" />
              </motion.div>
              <span className="text-sm font-medium" data-testid="text-speaker-guide">
                {currentSpeakerInfo.displayName} 正在自我介绍中～
              </span>
            </div>
          </motion.div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              今天的小伙伴们
            </h3>
            <Badge variant="outline">
              当前: {currentSpeaker}号
            </Badge>
          </div>

          <div className="grid gap-2">
            <AnimatePresence>
              {sortedAssignments.map((assignment, index) => {
                const isMe = assignment.userId === myUserId;
                const isSpeaking = assignment.numberPlate === currentSpeaker;
                const hasPassed = assignment.numberPlate < currentSpeaker;
                
                return (
                  <motion.div
                    key={assignment.userId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    data-testid={`participant-row-${assignment.userId}`}
                  >
                    <Card className={`transition-all ${
                      isSpeaking 
                        ? 'border-primary bg-primary/5 shadow-lg' 
                        : hasPassed 
                          ? 'opacity-60' 
                          : ''
                    } ${isMe ? 'ring-2 ring-primary/30' : ''}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          isSpeaking 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {assignment.numberPlate}
                        </div>
                        
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {getArchetypeImage(assignment.archetype) ? (
                              <img 
                                src={getArchetypeImage(assignment.archetype)!} 
                                alt={getArchetypeName(assignment.archetype)}
                                className="w-8 h-8 object-contain"
                              />
                            ) : (
                              <span className="text-primary text-sm font-medium">
                                {assignment.displayName.slice(0, 1)}
                              </span>
                            )}
                          </div>
                          {assignment.archetype && (
                            <span className="text-[10px] text-primary/80 whitespace-nowrap bg-primary/10 px-1.5 py-0.5 rounded-full">
                              {getArchetypeName(assignment.archetype)}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isMe ? 'text-primary' : ''}`}>
                            {assignment.displayName}
                            {isMe && <span className="ml-1 text-xs">(我)</span>}
                          </p>
                          {assignment.archetype && (
                            <p className="text-xs text-muted-foreground truncate">
                              {assignment.archetype}
                            </p>
                          )}
                        </div>

                        {isSpeaking && (
                          <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 1, repeat: Infinity }}
                          >
                            <Mic className="w-5 h-5 text-primary" />
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-sm text-muted-foreground">
            {readyCount} / {totalCount} 人已准备好
          </span>
          <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(readyCount / Math.max(totalCount, 1)) * 100}%` }}
            />
          </div>
        </div>
        
        {!isReady && countdown > 0 && (
          <div className="flex items-center justify-center gap-2 mb-3 text-sm text-muted-foreground">
            <div className="relative w-6 h-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted/30"
                />
                <motion.circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={countdown <= 10 ? 'text-orange-500' : 'text-primary'}
                  strokeDasharray={2 * Math.PI * 10}
                  animate={{ strokeDashoffset: 2 * Math.PI * 10 * (1 - countdown / autoReadyTimeoutSeconds) }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </svg>
            </div>
            <span className={countdown <= 10 ? 'text-orange-500 font-medium' : ''} data-testid="text-countdown">
              {countdown}秒后自动准备
            </span>
          </div>
        )}
        
        <Button
          className="w-full"
          size="lg"
          onClick={() => onReady?.(false)}
          disabled={isReady}
          data-testid="button-ready"
        >
          {isReady ? (
            '等待其他人准备好...'
          ) : (
            <>
              准备好了，进入破冰环节
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

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
        data-testid="number-plate-display"
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>号码牌分配</DialogTitle>
        </VisuallyHidden>
        {content}
      </DialogContent>
    </Dialog>
  );
}
