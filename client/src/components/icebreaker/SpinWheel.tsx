import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCw, Crown, Sparkles, Users } from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

interface SpinWheelProps {
  participants?: Participant[];
  onSelect?: (participant: Participant) => void;
  title?: string;
}

const defaultColors = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
];

const defaultParticipants: Participant[] = [
  { id: '1', name: '1号' },
  { id: '2', name: '2号' },
  { id: '3', name: '3号' },
  { id: '4', name: '4号' },
  { id: '5', name: '5号' },
];

export function SpinWheel({
  participants = defaultParticipants,
  onSelect,
  title = '随机选人',
}: SpinWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const participantsWithColors = useMemo(() =>
    participants.map((p, i) => ({
      ...p,
      color: p.color || defaultColors[i % defaultColors.length],
    })),
    [participants]
  );

  const segmentAngle = 360 / participants.length;

  const handleSpin = useCallback(() => {
    if (isSpinning) return;

    setIsSpinning(true);
    setShowResult(false);
    setSelectedIndex(null);

    const randomIndex = Math.floor(Math.random() * participants.length);
    const spins = 5 + Math.random() * 3;
    // Calculate target position: center of selected segment should be at top (0°)
    const targetPosition = 360 - randomIndex * segmentAngle - segmentAngle / 2;
    // Account for current rotation position to calculate correct delta
    const currentPosition = rotation % 360;
    const delta = (targetPosition - currentPosition + 360) % 360;
    const targetAngle = spins * 360 + delta;
    
    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setIsSpinning(false);
      setSelectedIndex(randomIndex);
      setShowResult(true);
      onSelect?.(participantsWithColors[randomIndex]);
    }, 4000);
  }, [isSpinning, participants.length, segmentAngle, onSelect, participantsWithColors, rotation]);

  const handleReset = useCallback(() => {
    setShowResult(false);
    setSelectedIndex(null);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4" data-testid="spin-wheel">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {participants.length} 人
        </Badge>
        <span className="text-sm text-muted-foreground">{title}</span>
      </div>

      <div className="relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
        </div>

        <motion.div
          className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-primary/30 shadow-xl"
          animate={{ rotate: rotation }}
          transition={{ 
            duration: 4, 
            ease: [0.25, 0.1, 0.25, 1],
          }}
        >
          {participantsWithColors.map((participant, index) => {
            const startAngle = index * segmentAngle;
            const endAngle = (index + 1) * segmentAngle;
            const midAngle = (startAngle + endAngle) / 2;
            const textRadius = 70;
            const textX = 128 + textRadius * Math.cos((midAngle - 90) * Math.PI / 180);
            const textY = 128 + textRadius * Math.sin((midAngle - 90) * Math.PI / 180);

            return (
              <div
                key={participant.id}
                className="absolute inset-0"
                style={{
                  clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((startAngle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((endAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((endAngle - 90) * Math.PI / 180)}%)`,
                }}
              >
                <div className={`w-full h-full ${participant.color}`} />
                <div
                  className="absolute text-white font-bold text-sm drop-shadow-md whitespace-nowrap"
                  style={{
                    left: `${textX}px`,
                    top: `${textY}px`,
                    transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                  }}
                >
                  {participant.name}
                </div>
              </div>
            );
          })}

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-lg flex items-center justify-center border-2 border-primary/30">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showResult && selectedIndex !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            className="w-full max-w-xs"
          >
            <Card className="border-2 border-primary bg-primary/5">
              <CardContent className="p-4 text-center space-y-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30"
                >
                  <Crown className="w-6 h-6 text-amber-600" />
                </motion.div>
                <p className="text-lg font-bold text-primary">
                  {participantsWithColors[selectedIndex].name}
                </p>
                <p className="text-sm text-muted-foreground">
                  被选中啦!
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3">
        <Button
          size="lg"
          onClick={handleSpin}
          disabled={isSpinning}
          className="min-w-[120px]"
          data-testid="button-spin"
        >
          <RotateCw className={`w-5 h-5 mr-2 ${isSpinning ? 'animate-spin' : ''}`} />
          {isSpinning ? '转动中...' : '开始转!'}
        </Button>

        {showResult && (
          <Button
            variant="outline"
            onClick={handleReset}
            data-testid="button-reset-wheel"
          >
            再来一次
          </Button>
        )}
      </div>
    </div>
  );
}

export default SpinWheel;
