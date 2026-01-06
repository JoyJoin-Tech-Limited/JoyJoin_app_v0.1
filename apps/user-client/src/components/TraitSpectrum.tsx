import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

interface TraitSliderProps {
  leftLabel: string;
  rightLabel: string;
  value: number;
  index: number;
}

function TraitSlider({ leftLabel, rightLabel, value, index }: TraitSliderProps) {
  const prefersReducedMotion = useReducedMotion();
  const position = Math.max(0, Math.min(100, value));
  
  return (
    <motion.div
      className="grid grid-cols-[4rem_1fr_4rem] items-center gap-3"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: prefersReducedMotion ? 0 : index * 0.1 
      }}
      data-testid={`trait-slider-${index}`}
    >
      <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
        {leftLabel}
      </span>
      
      <div className="relative h-2 bg-muted rounded-full overflow-visible">
        <motion.div
          className="absolute left-0 top-0 h-full bg-primary/30 rounded-full"
          initial={prefersReducedMotion ? { width: `${position}%` } : { width: "0%" }}
          animate={{ width: `${position}%` }}
          transition={{
            type: "spring",
            stiffness: 100,
            damping: 15,
            delay: prefersReducedMotion ? 0 : 0.2 + index * 0.1
          }}
        />
        
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-md"
          initial={prefersReducedMotion ? { left: `calc(${position}% - 8px)`, y: "-50%" } : { left: "calc(50% - 8px)", scale: 0, y: "-50%" }}
          animate={{ 
            left: `calc(${position}% - 8px)`,
            scale: 1,
            y: prefersReducedMotion ? "-50%" : ["-50%", "-70%", "-50%", "-60%", "-50%"]
          }}
          transition={{
            left: {
              type: "spring",
              stiffness: 180,
              damping: 16,
              delay: prefersReducedMotion ? 0 : 0.3 + index * 0.1
            },
            scale: {
              type: "spring",
              stiffness: 200,
              delay: prefersReducedMotion ? 0 : 0.3 + index * 0.1
            },
            y: {
              duration: 0.6,
              times: [0, 0.2, 0.4, 0.7, 1],
              ease: "easeOut",
              delay: prefersReducedMotion ? 0 : 0.5 + index * 0.1
            }
          }}
        />
      </div>
      
      <span className="text-xs text-muted-foreground text-left whitespace-nowrap">
        {rightLabel}
      </span>
    </motion.div>
  );
}

interface TraitSpectrumProps {
  traitScores: {
    A?: number;
    O?: number;
    C?: number;
    E?: number;
    X?: number;
    P?: number;
  };
}

const TRAIT_BIPOLAR_LABELS: { key: string; left: string; right: string }[] = [
  { key: "E", left: "焦虑", right: "淡定" },
  { key: "X", left: "内敛", right: "外放" },
  { key: "P", left: "务实", right: "乐观" },
  { key: "A", left: "独立", right: "亲和" },
  { key: "O", left: "务实", right: "开放" },
  { key: "C", left: "随性", right: "严谨" },
];

export default function TraitSpectrum({ traitScores }: TraitSpectrumProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const sliders = useMemo(() => {
    return TRAIT_BIPOLAR_LABELS.map((trait) => ({
      ...trait,
      value: traitScores[trait.key as keyof typeof traitScores] ?? 50,
    }));
  }, [traitScores]);

  return (
    <motion.div
      className="space-y-4 py-2"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      data-testid="trait-spectrum"
    >
      {sliders.map((slider, index) => (
        <TraitSlider
          key={slider.key}
          leftLabel={slider.left}
          rightLabel={slider.right}
          value={slider.value}
          index={index}
        />
      ))}
    </motion.div>
  );
}
