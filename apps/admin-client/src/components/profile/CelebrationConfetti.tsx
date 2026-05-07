import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";

interface CelebrationConfettiProps {
  show: boolean;
  onComplete?: () => void;
  type?: "step" | "major" | "final";
}

const confettiColors = [
  "#a855f7", // purple
  "#ec4899", // pink
  "#f97316", // orange
  "#22c55e", // green
  "#3b82f6", // blue
  "#eab308", // yellow
];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  scale: number;
}

export default function CelebrationConfetti({ 
  show, 
  onComplete,
  type = "step" 
}: CelebrationConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (show) {
      const count = type === "final" ? 50 : type === "major" ? 30 : 15;
      const newParticles: Particle[] = [];
      
      for (let i = 0; i < count; i++) {
        newParticles.push({
          id: i,
          x: Math.random() * 100,
          color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
          delay: Math.random() * 0.3,
          rotation: Math.random() * 360,
          scale: 0.5 + Math.random() * 0.5,
        });
      }
      
      setParticles(newParticles);
      
      const timer = setTimeout(() => {
        setParticles([]);
        onComplete?.();
      }, type === "final" ? 3000 : 2000);
      
      return () => clearTimeout(timer);
    }
  }, [show, type, onComplete]);

  if (!show && particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute w-3 h-3 rounded-sm"
            style={{
              left: `${particle.x}%`,
              backgroundColor: particle.color,
              transform: `scale(${particle.scale})`,
            }}
            initial={{ 
              y: -20, 
              opacity: 1,
              rotate: 0,
            }}
            animate={{ 
              y: "100vh",
              opacity: [1, 1, 0],
              rotate: particle.rotation + 720,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: type === "final" ? 3 : 2,
              delay: particle.delay,
              ease: "easeOut",
            }}
          />
        ))}
      </AnimatePresence>
      
      {type === "final" && show && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
        >
          <motion.div
            className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center"
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.5,
              repeat: 2,
            }}
          >
            <PartyPopper className="w-8 h-8 text-primary" />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export function StepCompleteAnimation({ show }: { show: boolean }) {
  if (!show) return null;
  
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-green-500 rounded-full p-4"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.4, ease: "backOut" }}
      >
        <motion.svg
          className="w-8 h-8 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <motion.path
            d="M5 13l4 4L19 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
      </motion.div>
    </motion.div>
  );
}
