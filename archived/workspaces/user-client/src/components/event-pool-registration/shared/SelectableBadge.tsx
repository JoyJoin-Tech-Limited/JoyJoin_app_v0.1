import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SelectableBadgeProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Accessible badge component with keyboard support
 * Wraps Badge with proper ARIA attributes and keyboard handling
 */
export default function SelectableBadge({ 
  selected, 
  onClick, 
  children, 
  className 
}: SelectableBadgeProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <Badge
        variant={selected ? "default" : "outline"}
        className={cn(
          "cursor-pointer w-full justify-center py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
          className
        )}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="checkbox"
        aria-checked={selected}
      >
        {children}
      </Badge>
    </motion.div>
  );
}
