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
      className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2"
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.3, 
        delay: prefersReducedMotion ? 0 : index * 0.08 
      }}
      data-testid={`trait-slider-${index}`}
    >
      <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
        {leftLabel}
      </span>
      
      <div className="relative h-1.5 bg-muted rounded-full overflow-visible">
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-[0_2px_6px_rgba(88,63,184,0.25)]"
          initial={prefersReducedMotion ? { left: `calc(${position}% - 6px)`, y: "-50%" } : { left: "calc(50% - 6px)", scale: 0, y: "-50%" }}
          animate={{ 
            left: `calc(${position}% - 6px)`,
            scale: 1,
            y: "-50%"
          }}
          transition={{
            left: {
              type: "spring",
              stiffness: 180,
              damping: 16,
              delay: prefersReducedMotion ? 0 : 0.2 + index * 0.08
            },
            scale: {
              type: "spring",
              stiffness: 200,
              delay: prefersReducedMotion ? 0 : 0.2 + index * 0.08
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
  { key: "E", left: "敏感易感", right: "淡定从容" },
  { key: "X", left: "安静内敛", right: "活跃外放" },
  { key: "P", left: "谨慎现实", right: "乐观积极" },
  { key: "A", left: "保持距离", right: "热情亲近" },
  { key: "O", left: "传统务实", right: "开放探索" },
  { key: "C", left: "随性自由", right: "严谨自律" },
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
