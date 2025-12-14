import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Sparkles, Users, Volume2 } from 'lucide-react';

interface NumberAssignment {
  userId: string;
  displayName: string;
  numberPlate: number;
  archetype?: string | null;
  profileImageUrl?: string;
}

interface NumberPlateDisplayProps {
  myNumberPlate: number | null;
  myUserId: string;
  assignments: NumberAssignment[];
  currentSpeaker?: number;
  onReady?: () => void;
  isReady?: boolean;
  readyCount: number;
  totalCount: number;
}

export function NumberPlateDisplay({
  myNumberPlate,
  myUserId,
  assignments,
  currentSpeaker = 1,
  onReady,
  isReady = false,
  readyCount,
  totalCount,
}: NumberPlateDisplayProps) {
  const [showReveal, setShowReveal] = useState(true);
  const [revealComplete, setRevealComplete] = useState(false);
  const isMyTurn = myNumberPlate === currentSpeaker;
  const sortedAssignments = [...assignments].sort((a, b) => a.numberPlate - b.numberPlate);

  useEffect(() => {
    if (myNumberPlate !== null) {
      const timer = setTimeout(() => {
        setRevealComplete(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [myNumberPlate]);

  const getArchetypeInitial = (archetype: string | null | undefined): string => {
    if (!archetype) return '';
    return archetype.slice(0, 1);
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2).toUpperCase();
  };

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

  return (
    <div className="p-4 space-y-6" data-testid="number-plate-display">
      <div className="text-center">
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

      {isMyTurn && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center"
          data-testid="my-turn-banner"
        >
          <div className="flex items-center justify-center gap-2 text-primary mb-2">
            <Volume2 className="w-5 h-5" />
            <span className="text-lg font-semibold">轮到你啦！</span>
          </div>
          <p className="text-sm text-muted-foreground">
            向大家介绍一下自己吧，说你想说的～
          </p>
        </motion.div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
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
                      
                      <div className="relative">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={assignment.profileImageUrl} />
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {getInitials(assignment.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        {assignment.archetype && (
                          <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-medium">
                            {getArchetypeInitial(assignment.archetype)}
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
                          <Volume2 className="w-5 h-5 text-primary" />
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

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            {readyCount} / {totalCount} 人已准备好
          </span>
          <div className="h-2 flex-1 mx-4 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${(readyCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
        
        <Button
          className="w-full"
          size="lg"
          onClick={onReady}
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
}
