import { motion } from "framer-motion";

export function SwipeParticles({ show }: { show: boolean }) {
  if (!show) return null;

  const particles = Array.from({ length: 12 });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((_, i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const distance = 100 + Math.random() * 50;
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        return (
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
              x, 
              y, 
              scale: [0, 1.5, 0],
              opacity: [1, 0.8, 0] 
            }}
            transition={{ 
              duration: 0.8, 
              delay: i * 0.02,
              ease: "easeOut" 
            }}
          />
        );
      })}
    </div>
  );
}
