import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Sparkles, Heart, Star, Clock, Users, PartyPopper, ArrowLeft, ClipboardList, MessageSquareHeart } from 'lucide-react';

interface IcebreakerEndingScreenProps {
  closingMessage?: string | null;
  durationMinutes: number;
  participantCount: number;
  onLeave: () => void;
  eventName?: string;
  onBack?: () => void;
  eventId?: number | string;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function FloatingShape({ 
  delay, 
  duration, 
  x, 
  size,
  colorClass 
}: { 
  delay: number; 
  duration: number; 
  x: number; 
  size: number;
  colorClass: string;
}) {
  return (
    <motion.div
      className={`absolute rounded-full opacity-60 ${colorClass}`}
      style={{ 
        width: size, 
        height: size,
        left: `${x}%`,
        bottom: '-20px',
      }}
      initial={{ y: 0, opacity: 0, scale: 0 }}
      animate={{ 
        y: [-20, -400, -600],
        opacity: [0, 0.6, 0],
        scale: [0.5, 1, 0.8],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: duration * 0.5,
        ease: 'easeOut',
      }}
    />
  );
}

function Confetti({ 
  delay, 
  x, 
  colorClass,
  shapeClass,
  rotateDir,
  xOffset,
  animDuration,
}: { 
  delay: number; 
  x: number; 
  colorClass: string;
  shapeClass: string;
  rotateDir: number;
  xOffset: number;
  animDuration: number;
}) {
  return (
    <motion.div
      className={`absolute w-2 h-3 ${shapeClass} ${colorClass}`}
      style={{ left: `${x}%`, top: '-10px' }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{
        y: [0, 600],
        opacity: [1, 1, 0],
        rotate: [0, 360 * rotateDir],
        x: [0, xOffset],
      }}
      transition={{
        duration: animDuration,
        delay,
        repeat: Infinity,
        repeatDelay: 2,
        ease: 'easeIn',
      }}
    />
  );
}

export function IcebreakerEndingScreen({
  closingMessage,
  durationMinutes,
  participantCount,
  onLeave,
  eventName = 'JoyJoin 悦聚',
  onBack,
  eventId,
}: IcebreakerEndingScreenProps) {
  const [, setLocation] = useLocation();

  const handleFeedback = () => {
    if (eventId) {
      setLocation(`/events/${eventId}/feedback`);
    }
  };

  const colors = [
    'bg-primary/70 dark:bg-primary/50',
    'bg-purple-400 dark:bg-purple-600', 
    'bg-blue-400 dark:bg-blue-600',
    'bg-green-400 dark:bg-green-600',
    'bg-yellow-400 dark:bg-yellow-600',
    'bg-orange-400 dark:bg-orange-600',
  ];

  const confettiColors = [
    'bg-pink-500 dark:bg-pink-400',
    'bg-purple-500 dark:bg-purple-400',
    'bg-blue-500 dark:bg-blue-400',
    'bg-green-500 dark:bg-green-400',
    'bg-yellow-500 dark:bg-yellow-400',
    'bg-red-500 dark:bg-red-400',
    'bg-indigo-500 dark:bg-indigo-400',
  ];

  const shapes = useMemo(() => 
    colors.map((color, i) => ({
      color,
      duration: 4 + seededRandom(i * 7) * 2,
      size: 20 + seededRandom(i * 11) * 30,
    })),
    []
  );

  const confettiItems = useMemo(() => {
    const shapeClasses = ['rounded-sm', 'rounded-full', 'rounded-none'];
    return Array.from({ length: 20 }).map((_, i) => ({
      color: confettiColors[i % confettiColors.length],
      shapeClass: shapeClasses[Math.floor(seededRandom(i * 3) * 3)],
      rotateDir: seededRandom(i * 5) > 0.5 ? 1 : -1,
      xOffset: (seededRandom(i * 13) - 0.5) * 100,
      animDuration: 3 + seededRandom(i * 17) * 2,
    }));
  }, []);

  return (
    <div 
      className="fixed inset-0 overflow-hidden motion-reduce:animate-none"
      data-testid="icebreaker-ending-screen"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 dark:from-purple-900 dark:via-pink-800 dark:to-orange-700" />
      
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="motion-reduce:hidden">
        {shapes.map((shape, i) => (
          <FloatingShape
            key={`shape-${i}`}
            delay={i * 0.5}
            duration={shape.duration}
            x={10 + (i * 15)}
            size={shape.size}
            colorClass={shape.color}
          />
        ))}

        {confettiItems.map((item, i) => (
          <Confetti
            key={`confetti-${i}`}
            delay={i * 0.3}
            x={5 + (i * 4.5)}
            colorClass={item.color}
            shapeClass={item.shapeClass}
            rotateDir={item.rotateDir}
            xOffset={item.xOffset}
            animDuration={item.animDuration}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 pb-48">
        <div className="flex flex-col items-center p-6 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.9) 0%, rgba(236, 72, 153, 0.9) 50%, rgba(251, 146, 60, 0.9) 100%)' }}>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="mb-6"
          >
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <PartyPopper className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl md:text-4xl font-bold text-white text-center mb-4"
            data-testid="text-ending-title"
          >
            {eventName} 完成！
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap items-center justify-center gap-4 mb-6"
          >
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <Users className="w-4 h-4 text-white" />
              <span className="text-white font-medium" data-testid="text-participant-count">
                {participantCount} 人参与
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white font-medium" data-testid="text-duration">
                {durationMinutes} 分钟
              </span>
            </div>
          </motion.div>

          {closingMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 }}
              className="max-w-md mb-6"
            >
              <div className="bg-white/20 backdrop-blur-md rounded-2xl p-6 border border-white/30">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/90 font-medium">小悦说</span>
                </div>
                <p 
                  className="text-white text-lg leading-relaxed"
                  data-testid="text-closing-message"
                >
                  {closingMessage}
                </p>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 mb-4 max-w-xs text-center"
          >
            <p className="text-white/90 text-sm">
              不用着急当场交换联系方式哦！活动结束后可以在 App 里互相添加好友
            </p>
          </motion.div>

          <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
            <Heart className="w-4 h-4" />
            <span>期待下次相遇</span>
            <Star className="w-4 h-4" />
          </div>
          
          <div className="text-white/60 text-xs">
            {eventName}
          </div>
        </div>
        </div>

        {/* Fixed buttons at bottom */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="fixed bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-purple-600 via-purple-600/98 to-purple-600/90 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] px-6 flex flex-col items-center gap-3"
        >
          {eventId && (
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }}
              className="w-full max-w-xs"
            >
              <Button 
                onClick={handleFeedback}
                size="lg"
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold shadow-lg"
                data-testid="button-feedback"
              >
                <MessageSquareHeart className="w-5 h-5 mr-2" />
                留个反馈，帮我们做得更好
              </Button>
            </motion.div>
          )}
          
          <Button 
            onClick={onLeave}
            size="lg"
            variant="outline"
            className="w-full max-w-xs bg-white/20 border-white/40 text-white hover:bg-white/30"
            data-testid="button-leave-session"
          >
            返回主页
          </Button>

          {onBack && (
            <Button 
              onClick={onBack}
              variant="ghost"
              className="text-white/70 hover:text-white hover:bg-white/10"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              退出
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
