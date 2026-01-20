import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { haptics } from "@/lib/haptics";

export interface SelectionOption {
  value: string;
  label: string;
  tag?: string;
}

interface SelectionListProps {
  options: SelectionOption[];
  selected: string | string[] | undefined;
  onSelect: (value: string | string[]) => void;
  multiSelect?: boolean;
  className?: string;
}

/**
 * SelectionList - Unified component for questionnaire options
 * Optimized for mobile-first interaction with consistent typography and feedback.
 * 
 * Expert UIUX Refinements:
 * 1. Readability (Typography): Standardized on 18px (text-lg) for option labels
 * 2. Affordance & Targets: Increased to 68px min-height and 20px (px-5) padding
 * 3. Visual Hierarchy: Tags moved to separate line below label
 * 4. Feedback Loops: Added placeholder circle for unselected states
 * 5. Motion Design: Subtle entry animations (x: -10) with Sparkle rotation
 * 6. Haptic Feedback: Light vibration on selection for tactile response
 * 7. Accessibility: Keyboard navigation and ARIA attributes
 */
export function SelectionList({
  options,
  selected,
  onSelect,
  multiSelect = false,
  className,
}: SelectionListProps) {
  const handleSelect = (value: string) => {
    haptics.light();
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

  const handleKeyDown = (e: React.KeyboardEvent, value: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(value);
    }
  };

  const isSelected = (value: string) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(value);
    }
    return selected === value;
  };

  return (
    <div className={cn("space-y-3", className)} role="listbox" aria-multiselectable={multiSelect}>
      {options.map((option, index) => (
        <motion.div
          key={option.value}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect(option.value)}
            onKeyDown={(e) => handleKeyDown(e, option.value)}
            role="option"
            aria-selected={isSelected(option.value)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 transition-all duration-200 min-h-[56px]",
              "shadow-sm select-none touch-none relative overflow-hidden",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              isSelected(option.value)
                ? "border-primary bg-primary/10 ring-1 ring-primary/20"
                : "border-border bg-card hover:border-primary/40 active:bg-accent/5"
            )}
            data-testid={`button-option-${option.value}`}
          >
            <div className="flex-1 text-left">
              <span className={cn(
                "text-lg font-semibold leading-snug tracking-tight block",
                isSelected(option.value) ? "text-primary" : "text-foreground/90"
              )}>
                {option.label}
              </span>
              {option.tag && (
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground/80 mt-1 font-bold">
                  {option.tag}
                </div>
              )}
            </div>
            
            {isSelected(option.value) ? (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30"
              >
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </motion.div>
            ) : (
              <div className="w-7 h-7 rounded-full border-2 border-muted/50 flex-shrink-0" />
            )}
          </motion.button>
        </motion.div>
      ))}
    </div>
  );
}

export default SelectionList;
