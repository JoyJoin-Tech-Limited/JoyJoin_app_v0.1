import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, HelpCircle, Zap, Crown } from "lucide-react";

interface MysteryBadgeProps {
  icon: string;
  label: string;
  type: "interest" | "background" | "experience";
  rarity: "common" | "rare" | "epic";
  isRevealed: boolean;
  onReveal: () => void;
  delay?: number;
}

const rarityStyles = {
  common: {
    // Common (常见) - 灰色系
    unrevealedBg: "bg-gray-100",
    unrevealedBorder: "border-gray-300",
    unrevealedBorderWidth: "border",
    revealedBg: "bg-[#F3F4F6]",
    revealedBorder: "border-[#D1D5DB]",
    revealedBorderWidth: "border",
    revealedText: "text-[#6B7280]",
    revealedShadow: "shadow-none",
    glow: "rgba(209, 213, 219, 0)",
    iconColor: "text-gray-400",
  },
  rare: {
    // Rare (稀有) - 紫色系
    unrevealedBg: "bg-purple-50",
    unrevealedBorder: "border-purple-300",
    unrevealedBorderWidth: "border-2",
    revealedBg: "bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF]",
    revealedBorder: "border-[#8B5CF6]",
    revealedBorderWidth: "border-2",
    revealedText: "text-[#8B5CF6]",
    revealedShadow: "shadow-[0_0_12px_rgba(139,92,246,0.4)]",
    glow: "rgba(139, 92, 246, 0.5)",
    iconColor: "text-purple-500",
  },
  epic: {
    // Epic (珍贵) - 金色系
    unrevealedBg: "bg-amber-50",
    unrevealedBorder: "border-amber-300",
    unrevealedBorderWidth: "border-2",
    revealedBg: "bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A]",
    revealedBorder: "border-[#F59E0B]",
    revealedBorderWidth: "border-[3px]",
    revealedText: "text-[#F59E0B]",
    revealedShadow: "shadow-[0_0_20px_rgba(245,158,11,0.6)]",
    glow: "rgba(245, 158, 11, 0.7)",
    iconColor: "text-amber-500",
  },
};

const rarityIcons = {
  common: null,
  rare: Zap,
  epic: Crown,
};

export default function MysteryBadge({
  icon,
  label,
  type,
  rarity,
  isRevealed,
  onReveal,
  delay = 0,
}: MysteryBadgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const styles = rarityStyles[rarity];
  const RarityIcon = rarityIcons[rarity];

  return (
    <motion.div
      className="relative w-full aspect-[4/5] cursor-pointer"
      style={{ perspective: "1000px", willChange: "transform" }}
      initial={{ scale: 0, y: 20, opacity: 0 }}
      animate={{
        scale: 1,
        y: 0,
        opacity: 1,
        rotateY: isHovered && !isRevealed ? 5 : 0,
      }}
      transition={{
        delay,
        type: "spring",
        stiffness: 260,
        damping: 20,
      }}
      onClick={!isRevealed ? onReveal : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={!isRevealed ? { y: -2 } : {}}
      data-testid={`mystery-badge-${label}`}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ 
          transformStyle: "preserve-3d",
          willChange: "transform"
        }}
        animate={{ rotateY: isRevealed ? 180 : 0 }}
        transition={{ 
          duration: 0.5,
          ease: [0.4, 0.0, 0.2, 1]
        }}
      >
        {/* Front - Mystery Box */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <motion.div
            className={`w-full h-full rounded-lg ${styles.unrevealedBorderWidth} ${styles.unrevealedBorder} ${styles.unrevealedBg} flex flex-col items-center justify-center gap-2 ${
              !isRevealed ? "hover-elevate" : ""
            }`}
            animate={
              !isRevealed && isHovered
                ? {
                    scale: [1, 1.05, 1],
                    boxShadow: [
                      `0 0 0 ${styles.glow}`,
                      `0 0 20px ${styles.glow}`,
                      `0 0 0 ${styles.glow}`,
                    ],
                  }
                : {}
            }
            transition={{
              duration: rarity === "epic" ? 0.8 : 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              animate={{
                rotate: [0, rarity === "epic" ? 10 : 5, rarity === "epic" ? -10 : -5, 0],
              }}
              transition={{
                duration: rarity === "epic" ? 1.5 : 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <HelpCircle className={`w-6 h-6 ${styles.iconColor}`} />
            </motion.div>
            <div className={`text-[10px] font-medium ${styles.iconColor}`}>
              点击揭晓
            </div>
          </motion.div>
        </div>

        {/* Back - Revealed Badge */}
        <div
          className="absolute inset-0 backface-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <motion.div
            className={`w-full h-full rounded-lg ${styles.revealedBorderWidth} ${styles.revealedBorder} ${styles.revealedBg} ${styles.revealedShadow} flex flex-col items-center justify-center gap-1 p-2 relative overflow-hidden`}
            initial={{ scale: 1 }}
            animate={
              isRevealed
                ? rarity === "epic"
                  ? {
                      // Epic: Pre-vibration effect
                      scale: [1, 0.95, 1.08, 1],
                      rotate: [0, -2, 2, 0],
                    }
                  : {
                      // Rare: Smooth appearance
                      scale: [1, 1.05, 1],
                    }
                : {}
            }
            transition={{
              delay: 0.6,
              duration: rarity === "epic" ? 0.8 : 0.5,
              type: "spring",
              stiffness: rarity === "epic" ? 400 : 300,
            }}
          >
            {/* Rare: Purple glow pulse */}
            {rarity === "rare" && isRevealed && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-purple-200/40 via-purple-300/20 to-transparent rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            {/* Epic: Continuous gold glow */}
            {rarity === "epic" && isRevealed && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-amber-300/30 via-amber-400/20 to-transparent rounded-lg"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <div className="text-xl relative z-10">{icon}</div>
            <div className={`text-[10px] font-semibold text-center ${styles.revealedText} leading-tight px-1 relative z-10`}>
              {label}
            </div>

            {/* Rarity indicator icon */}
            {RarityIcon && (
              <div className="absolute top-1 right-1">
                <RarityIcon className={`w-3 h-3 ${styles.iconColor}`} />
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* Sparkle effect when revealed */}
      <AnimatePresence>
        {isRevealed && (
          <>
            {/* Only show sparkle for rare and epic */}
            {rarity !== "common" && (
              <motion.div
                className="absolute -top-2 -right-2"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ delay: 0.5, type: "spring" }}
              >
                <Sparkles className={`w-4 h-4 ${styles.iconColor}`} />
              </motion.div>
            )}

            {/* Epic: Gold burst with particle orbit */}
            {rarity === "epic" && (
              <>
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: "50%",
                      top: "50%",
                    }}
                    initial={{ scale: 0, x: "-50%", y: "-50%" }}
                    animate={{
                      scale: [0, 1, 0],
                      x: ["-50%", `${Math.cos((i * Math.PI) / 3) * 50}px`],
                      y: ["-50%", `${Math.sin((i * Math.PI) / 3) * 50}px`],
                      opacity: [1, 0.8, 0],
                    }}
                    transition={{
                      duration: 1.5,
                      delay: 0.6 + i * 0.08,
                      ease: "easeOut",
                    }}
                  >
                    <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                  </motion.div>
                ))}
              </>
            )}
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
