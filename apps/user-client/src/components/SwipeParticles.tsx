import { motion } from "framer-motion";
import { useMemo } from "react";

export function SwipeParticles({ show }: { show: boolean }) {
  const particles = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const distance = 100 + Math.random() * 50;
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      };
    });
  }, []); // Generate once on mount

  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-gradient-to-br from-pink-400 to-rose-500"
          initial={{ 
            x: 0, 
            y: 0, 
            scale: 0, 
            opacity: 1 
          }}
          animate={{ 
            x: particle.x, 
            y: particle.y, 
            scale: [0, 1.5, 0],
            opacity: [1, 0.8, 0] 
          }}
          transition={{ 
            duration: 0.8, 
            delay: i * 0.02,
            ease: "easeOut" 
          }}
        />
      ))}
    </div>
  );
}
