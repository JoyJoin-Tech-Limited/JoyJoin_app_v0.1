import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { haptics } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface BudgetCardProps {
  option: {
    value: string;
    label: string;
    emoji: string;
    color: string;
    bgColor: string;
    description: string;
  };
  selected: boolean;
  onClick: () => void;
}

export default function BudgetCard({ option, selected, onClick }: BudgetCardProps) {
  const handleClick = () => {
    haptics.light();
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
        option.bgColor,
        selected 
          ? `${option.color} bg-gradient-to-br from-primary/10 to-transparent shadow-md` 
          : "border-border hover:border-primary/30"
      )}
      whileHover={{ rotate: selected ? 0 : 2 }}
      whileTap={{ scale: 0.95 }}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md"
        >
          <Check className="w-4 h-4 text-white" />
        </motion.div>
      )}
      
      <div className="flex flex-col items-center gap-2">
        <motion.div
          className="text-3xl"
          animate={selected ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.3 }}
        >
          {option.emoji}
        </motion.div>
        <div className="text-sm font-semibold">{option.label}</div>
        <div className="text-xs text-muted-foreground">{option.description}</div>
      </div>
    </motion.button>
  );
}
