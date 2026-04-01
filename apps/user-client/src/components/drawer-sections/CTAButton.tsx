import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame } from "lucide-react";

interface CTAButtonProps {
  onRegister: () => void;
  registrationCount: number;
  isHot: boolean;
}

export default function CTAButton({
  onRegister,
  registrationCount,
  isHot,
}: CTAButtonProps) {
  const handleClick = () => {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
    onRegister();
  };
  
  return (
    <div className="sticky bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-background via-background to-transparent pt-6 pb-safe">
      <div className="px-6">
        <motion.div whileTap={{ scale: 0.97 }} className="relative">
          {/* Hot Badge */}
          {isHot && (
            <motion.div
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
            >
              <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 gap-1 shadow-lg">
                <Flame className="h-3 w-3" />
                即将组队
              </Badge>
            </motion.div>
          )}
          
          {/* Main Button — uses shared premium default variant.
               no-default-hover-elevate/no-default-active-elevate are project-defined
               CSS escape-hatch classes that disable the automatic brightness overlay
               so the shimmer animation is unobstructed. See index.css @layer utilities. */}
          <Button
            onClick={handleClick}
            size="lg"
            className="relative w-full overflow-hidden no-default-hover-elevate no-default-active-elevate"
          >
            {/* Shimmer Effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              style={{ width: "50%" }}
            />
            
            {/* Button Content */}
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-base font-bold">立即报名</span>
              <span className="text-[10px] font-normal opacity-90">
                已有 {registrationCount} 人报名
              </span>
            </div>
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
