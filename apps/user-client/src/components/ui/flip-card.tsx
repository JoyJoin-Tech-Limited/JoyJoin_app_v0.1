import type { ReactNode } from "react";
import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface FlipCardProps {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  flipOnClick?: boolean;
  isFlipped?: boolean;
  onFlip?: (flipped: boolean) => void;
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(15);
  }
}

export function FlipCard({ 
  front, 
  back, 
  className,
  flipOnClick = true,
  isFlipped: controlledFlipped,
  onFlip 
}: FlipCardProps) {
  const [internalFlipped, setInternalFlipped] = useState(false);
  
  const isFlipped = controlledFlipped !== undefined ? controlledFlipped : internalFlipped;

  const handleFlip = () => {
    if (!flipOnClick) return;
    
    triggerHaptic();
    
    if (onFlip) {
      onFlip(!isFlipped);
    } else {
      setInternalFlipped(!internalFlipped);
    }
  };

  return (
    <div 
      className={cn("perspective-1000", className)}
      style={{ perspective: "1000px" }}
    >
      <motion.div
        className="relative w-full h-full cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        onClick={handleFlip}
      >
        <div 
          className="absolute inset-0 backface-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {front}
        </div>
        <div 
          className="absolute inset-0 backface-hidden"
          style={{ 
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)"
          }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

interface FlipCardFrontProps {
  children: ReactNode;
  className?: string;
}

export function FlipCardFront({ children, className }: FlipCardFrontProps) {
  return (
    <div className={cn("w-full h-full", className)}>
      {children}
    </div>
  );
}

interface FlipCardBackProps {
  children: ReactNode;
  className?: string;
}

export function FlipCardBack({ children, className }: FlipCardBackProps) {
  return (
    <div className={cn("w-full h-full", className)}>
      {children}
    </div>
  );
}
