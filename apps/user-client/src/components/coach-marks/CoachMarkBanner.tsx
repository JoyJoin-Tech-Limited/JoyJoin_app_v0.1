import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getArchetypeImage } from "@/lib/archetypeImages";

interface CoachMarkBannerProps {
  archetype: string;
  archetypeName: string;
  description: string;
  onDismiss: () => void;
}

export function CoachMarkBanner({
  archetype,
  archetypeName,
  description,
  onDismiss,
}: CoachMarkBannerProps) {
  const archetypeImage = getArchetypeImage(archetype);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="relative mx-4 mt-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-4 shadow-lg"
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="flex items-start gap-4 pr-8">
          {archetypeImage && (
            <div className="relative">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <img
                  src={archetypeImage}
                  alt={archetype}
                  className="h-20 w-20 object-contain"
                />
              </motion.div>
              <motion.div
                className="absolute -top-1 -right-1"
                animate={{
                  rotate: [0, 10, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <Sparkles className="h-5 w-5 text-primary" />
              </motion.div>
            </div>
          )}

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">
                你的专属画像已生成！✨
              </h3>
            </div>
            <p className="text-sm font-semibold text-primary">
              {archetype} · {archetypeName}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
            <p className="text-sm font-medium text-foreground mt-2">
              开始探索活动，遇见志同道合的朋友吧 🎉
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
