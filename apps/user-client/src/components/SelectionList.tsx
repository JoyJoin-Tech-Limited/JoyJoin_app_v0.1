import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  getSelectionClasses, 
  selectionAnimationClasses, 
  selectionMotionVariants 
} from "@/hooks/useSelectionAnimation";

interface SelectionOption {
  value: string;
  label: string;
  tag?: string;
}

interface SelectionListProps {
  options: SelectionOption[];
  selected: string | string[] | undefined;
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
  questionId?: string;
  /** Use compact spacing for smaller screens */
  compact?: boolean;
  /** Custom class for the container */
  className?: string;
}

/**
 * SelectionList - Shared component for selectable options
 * 
 * Used across onboarding, personality test, setup, and event forms.
 * Provides consistent styling and animation.
 */
export function SelectionList({
  options,
  selected,
  onSelect,
  multiSelect = false,
  questionId,
  compact = false,
  className,
}: SelectionListProps) {
  const isSelected = (value: string) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(value);
    }
    return selected === value;
  };

  const handleSelect = (value: string) => {
    if (multiSelect) {
      const currentSelected = Array.isArray(selected) ? selected : [];
      if (currentSelected.includes(value)) {
        onSelect(currentSelected.filter(v => v !== value));
      } else {
        onSelect([...currentSelected, value]);
      }
    } else {
      onSelect(value);
    }
  };

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3", className)}>
      {options.map((option, index) => {
        const selected = isSelected(option.value);
        return (
          <motion.div
            key={option.value}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex flex-col gap-2"
          >
            <motion.button
              whileTap={selectionMotionVariants.tap}
              onClick={() => handleSelect(option.value)}
              className={cn(
                getSelectionClasses(selected),
                compact && "py-3 min-h-[56px]"
              )}
              data-testid={`button-option-${option.value}`}
            >
              <div className="flex-1 text-left">
                <span className={selectionAnimationClasses.text(selected)}>
                  {option.label}
                </span>
                {option.tag && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {option.tag}
                  </span>
                )}
              </div>
              {selected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={selectionAnimationClasses.indicator}
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
                </motion.div>
              )}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}

export default SelectionList;
