import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RotateCw, Crown, Sparkles, Users } from 'lucide-react';
import { archetypeConfig } from '@/lib/archetypes';

export interface Participant {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
  archetype?: string;
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
  { id: '1', name: '小明', archetype: '开心柯基' },
  { id: '2', name: '小红', archetype: '灵感章鱼' },
  { id: '3', name: '小华', archetype: '沉思猫头鹰' },
  { id: '4', name: '小丽', archetype: '太阳鸡' },
  { id: '5', name: '小强', archetype: '暖心熊' },
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

    const spins = 5 + Math.random() * 3;
    const randomExtraAngle = Math.random() * 360;
    const totalSpinAngle = spins * 360 + randomExtraAngle;
    const newRotation = rotation + totalSpinAngle;
    
    setRotation(newRotation);

    setTimeout(() => {
      setIsSpinning(false);
      // Calculate which segment is at top based on ACTUAL final rotation
      // Segment i center is at angle: (i + 0.5) * segmentAngle from top (clockwise)
      // After rotation R, segment at angle θ appears at (θ + R) mod 360
      // For segment to be at top (0°): (θ + R) ≡ 0, so θ ≡ -R ≡ (360 - R) mod 360
      // So the segment at top has center angle = (360 - R) mod 360
      // Solving for i: (i + 0.5) * segmentAngle = (360 - R) mod 360
      // i = ((360 - R mod 360) / segmentAngle - 0.5)
      const finalMod360 = ((newRotation % 360) + 360) % 360;
      const angleAtTop = (360 - finalMod360 + 360) % 360;
      const n = participants.length;
      let actualIndex = Math.round((angleAtTop / segmentAngle - 0.5 + n) % n);
      if (actualIndex < 0) actualIndex += n;
      if (actualIndex >= n) actualIndex = actualIndex % n;
      
      setSelectedIndex(actualIndex);
      setShowResult(true);
      onSelect?.(participantsWithColors[actualIndex]);
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

            const archetypeInfo = participant.archetype ? archetypeConfig[participant.archetype] : null;
            
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
                  className="absolute text-white font-bold drop-shadow-md whitespace-nowrap flex flex-col items-center gap-0.5"
                  style={{
                    left: `${textX}px`,
                    top: `${textY}px`,
                    transform: `translate(-50%, -50%) rotate(${midAngle}deg)`,
                  }}
                >
                  {archetypeInfo && (
                    <span className="text-base leading-none">{archetypeInfo.icon}</span>
                  )}
                  <span className="text-xs leading-none">{participant.name}</span>
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
        {showResult && selectedIndex !== null && (() => {
          const selected = participantsWithColors[selectedIndex];
          const selectedArchetype = selected.archetype ? archetypeConfig[selected.archetype] : null;
          return (
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
                    className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30"
                  >
                    {selectedArchetype ? (
                      <span className="text-2xl">{selectedArchetype.icon}</span>
                    ) : (
                      <Crown className="w-6 h-6 text-amber-600" />
                    )}
                  </motion.div>
                  <p className="text-lg font-bold text-primary">
                    {selected.name}
                  </p>
                  {selectedArchetype && (
                    <p className="text-xs text-muted-foreground">
                      {selected.archetype}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    被选中啦!
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })()}
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
