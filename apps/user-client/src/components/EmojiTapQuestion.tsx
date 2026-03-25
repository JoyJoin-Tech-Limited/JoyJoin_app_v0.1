/**
 * EmojiTapQuestion — fast gut-feel emoji tap for V4 personality assessment.
 * Renders 5 emoji pill cards in a 2-column + 1-centered grid.
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export interface EmojiTapOption {
  value: string;
  /** Full label string, emoji prefix first, e.g. "🍿 吃瓜围观，看看怎么发展" */
  text: string;
  traitScores: Record<string, number>;
}

interface EmojiTapQuestionProps {
  options: EmojiTapOption[];
  selected: string | undefined;
  onSelect: (value: string) => void;
  animate?: boolean;
}

/**
 * Extract the leading emoji grapheme cluster from a string.
 * Handles multi-codepoint sequences including:
 *   - \p{Emoji_Presentation} — emoji with default emoji presentation
 *   - \p{Emoji}\uFE0F        — text-style emoji forced to emoji presentation via VS-16
 *   - \u200D                 — Zero Width Joiner (ZWJ) for combined sequences (e.g. 🏳️‍🌈)
 */
function extractEmoji(text: string): string {
  // Match the first Unicode emoji sequence (incl. ZWJ / variation selectors / skin tones)
  const match = text.match(
    /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/u,
  );
  return match ? match[0] : text.slice(0, 2);
}

/** Return the text portion after the leading emoji and any following spaces. */
function extractLabel(text: string): string {
  const emoji = extractEmoji(text);
  return text.slice(emoji.length).replace(/^\s+/, "");
}

export function EmojiTapQuestion({
  options,
  selected,
  onSelect,
  animate = true,
}: EmojiTapQuestionProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animate && !prefersReducedMotion;

  return (
    <div className="w-full" data-testid="emoji-tap-question">
      <div className="grid grid-cols-2 gap-3">
        {options.map((option, index) => {
          const isSelected = selected === option.value;
          const emoji = extractEmoji(option.text);
          const label = extractLabel(option.text);

          // Last item when total is odd gets full-width centering
          const isLastOdd = options.length % 2 !== 0 && index === options.length - 1;

          return (
            <motion.button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              initial={shouldAnimate ? { opacity: 0, y: 10 } : undefined}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
              transition={shouldAnimate ? { delay: index * 0.06 } : undefined}
              whileTap={shouldAnimate ? { scale: 0.95 } : undefined}
              onClick={() => {
                haptics.medium();
                onSelect(option.value);
              }}
              data-testid={`emoji-tap-option-${option.value}`}
              className={cn(
                "relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2",
                "transition-all duration-200 min-h-[90px]",
                isLastOdd && "col-span-2 mx-auto w-1/2",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary/20 scale-105"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <span className="text-3xl leading-none">{emoji}</span>
              <span
                className={cn(
                  "text-sm text-center leading-tight",
                  isSelected ? "text-primary font-semibold" : "text-foreground/80",
                )}
              >
                {label}
              </span>

              {/* Selection pulse ring — only when selected and animations allowed */}
              {isSelected && shouldAnimate && (
                <motion.div
                  className="absolute inset-0 rounded-2xl bg-primary/20 pointer-events-none"
                  initial={{ scale: 1, opacity: 0.4 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 0.4 }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
