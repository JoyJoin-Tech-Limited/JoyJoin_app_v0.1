import { motion } from "framer-motion";
import { archetypeMap } from "@/lib/userFieldMappings";

interface ArchetypeCoinMinimalProps {
  archetype: string;
  count: number;
  index?: number;
}

// Extract emoji from archetype display text
function getArchetypeEmoji(archetype: string): string {
  const display = archetypeMap[archetype];
  if (!display) return "✨";
  
  // Extract emoji using a more robust method
  // Emojis are typically at the end after a space
  // Using Unicode range for emoji detection
  const emojiMatch = display.match(/[\u{1F300}-\u{1F9FF}][\u{FE00}-\u{FE0F}]?[\u{200D}\u{FE0F}]*[\u{1F300}-\u{1F9FF}]*/u);
  if (emojiMatch) return emojiMatch[0];
  
  // Fallback: simple split on space and take last element
  const parts = display.split(' ');
  return parts[parts.length - 1] || "✨";
}

export default function ArchetypeCoinMinimal({ 
  archetype, 
  count,
  index = 0 
}: ArchetypeCoinMinimalProps) {
  const emoji = getArchetypeEmoji(archetype);
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 20,
        delay: index * 0.03,
      }}
      className="relative"
    >
      <div className="aspect-square rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center justify-center gap-1 transition-all hover:shadow-md hover:scale-105">
        {/* Emoji */}
        <div className="text-2xl leading-none">
          {emoji}
        </div>
        
        {/* Archetype Name */}
        <div className="text-[9px] font-medium text-center text-gray-700 dark:text-gray-300 line-clamp-1 w-full px-0.5">
          {archetype}
        </div>
      </div>
      
      {/* Count Badge */}
      {count > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: index * 0.03 + 0.2 }}
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md"
        >
          {count}
        </motion.div>
      )}
      
      {/* Pulse Animation when count > 0 */}
      {count > 0 && (
        <motion.div
          className="absolute inset-0 rounded-2xl bg-violet-500/20 pointer-events-none"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.5, 0, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
    </motion.div>
  );
}
