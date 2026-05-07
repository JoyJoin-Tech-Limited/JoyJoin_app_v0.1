import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface SocialGoalCardProps {
  option: {
    value: string;
    label: string;
    emoji: string;
    color: string;
    description: string;
  };
  selected: boolean;
  onClick: () => void;
}

export default function SocialGoalCard({ option, selected, onClick }: SocialGoalCardProps) {
  const handleClick = () => {
    haptics.medium();
    onClick();
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all duration-200",
        "hover:scale-[1.03] active:scale-[0.98]",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        `bg-gradient-to-br ${option.color} to-transparent`,
        selected 
          ? "border-primary shadow-md ring-2 ring-primary/20" 
          : "border-border hover:border-primary/30"
      )}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.95 }}
    >
      {selected && (
        <>
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md z-10"
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
          
          {/* Shimmer effect */}
          <motion.div
            className="absolute inset-0 rounded-xl overflow-hidden"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity, 
              repeatDelay: 3,
              ease: "easeInOut"
            }}
          >
            <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          </motion.div>
        </>
      )}
      
      <div className="flex flex-col items-center gap-2 relative z-0">
        <motion.div
          className="text-3xl"
          animate={selected ? { 
            scale: [1, 1.15, 1],
          } : {}}
          transition={{ 
            duration: 2,
            repeat: selected ? Infinity : 0,
            ease: "easeInOut"
          }}
        >
          {option.emoji}
        </motion.div>
        <div className="text-sm font-semibold">{option.label}</div>
        <div className="text-xs text-muted-foreground text-center leading-tight">
          {option.description}
        </div>
      </div>
    </motion.button>
  );
}
