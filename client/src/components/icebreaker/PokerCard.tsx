import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';

interface PokerCardProps {
  number?: number;
  isKing?: boolean;
  isFlipped: boolean;
  isRevealed?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-16 h-24',
  md: 'w-20 h-30',
  lg: 'w-24 h-36',
};

const numberSizes = {
  sm: 'text-2xl',
  md: 'text-3xl',
  lg: 'text-4xl',
};

const cornerNumberSizes = {
  sm: 'text-[8px]',
  md: 'text-[10px]',
  lg: 'text-xs',
};

export function PokerCard({
  number,
  isKing = false,
  isFlipped,
  isRevealed = false,
  onClick,
  disabled = false,
  size = 'md',
}: PokerCardProps) {
  const sizeClass = sizeClasses[size];
  const numberSize = numberSizes[size];
  const cornerSize = cornerNumberSizes[size];

  return (
    <div
      className={`${sizeClass} perspective-1000 cursor-pointer select-none`}
      onClick={disabled ? undefined : onClick}
      data-testid={`poker-card-${isKing ? 'king' : number}`}
    >
      <motion.div
        className="relative w-full h-full"
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring', stiffness: 100, damping: 15 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Card Back */}
        <div
          className={`
            absolute inset-0 rounded-lg shadow-lg backface-hidden
            bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800
            border-2 border-purple-400/30
            flex items-center justify-center
            ${disabled ? 'opacity-60' : 'hover:shadow-xl transition-shadow'}
          `}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Pattern on back */}
          <div className="absolute inset-2 rounded-md border border-purple-400/20 flex items-center justify-center">
            <div className="w-full h-full rounded-md bg-gradient-to-br from-purple-500/20 to-indigo-600/20 flex items-center justify-center">
              <div className="text-purple-300/50 font-bold text-lg">JJ</div>
            </div>
          </div>
          {/* Corner decorations */}
          <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-purple-400/30" />
          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-400/30" />
          <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-purple-400/30" />
          <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-purple-400/30" />
        </div>

        {/* Card Front */}
        <div
          className={`
            absolute inset-0 rounded-lg shadow-lg backface-hidden
            ${isKing 
              ? 'bg-gradient-to-br from-amber-100 via-yellow-50 to-amber-100 border-2 border-amber-400' 
              : 'bg-white border-2 border-gray-200'
            }
            ${isRevealed ? 'ring-4 ring-primary ring-offset-2' : ''}
            ${disabled ? 'opacity-60' : ''}
          `}
          style={{ 
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          {isKing ? (
            /* King Card Design */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
              {/* Top left crown */}
              <div className={`absolute top-1 left-1.5 flex flex-col items-center ${cornerSize}`}>
                <Crown className="w-3 h-3 text-amber-600" />
                <span className="text-amber-700 font-bold">K</span>
              </div>
              
              {/* Center crown */}
              <div className="flex flex-col items-center justify-center">
                <Crown className={`${size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-10 h-10' : 'w-8 h-8'} text-amber-500 drop-shadow-lg`} />
                <span className={`${numberSize} font-black text-amber-600 mt-1`}>国王</span>
              </div>
              
              {/* Bottom right crown (rotated) */}
              <div className={`absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 ${cornerSize}`}>
                <Crown className="w-3 h-3 text-amber-600" />
                <span className="text-amber-700 font-bold">K</span>
              </div>
              
              {/* Gold shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-200/30 via-transparent to-amber-200/30 rounded-lg pointer-events-none" />
            </div>
          ) : (
            /* Number Card Design */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-2">
              {/* Top left number */}
              <div className={`absolute top-1 left-1.5 flex flex-col items-center ${cornerSize} text-primary font-bold`}>
                <span>{number}</span>
              </div>
              
              {/* Center number */}
              <div className="flex items-center justify-center">
                <span className={`${numberSize} font-black text-primary`}>{number}</span>
              </div>
              
              {/* Bottom right number (rotated) */}
              <div className={`absolute bottom-1 right-1.5 flex flex-col items-center rotate-180 ${cornerSize} text-primary font-bold`}>
                <span>{number}</span>
              </div>
              
              {/* Subtle pattern */}
              <div className="absolute inset-4 border border-gray-100 rounded-sm pointer-events-none" />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default PokerCard;
