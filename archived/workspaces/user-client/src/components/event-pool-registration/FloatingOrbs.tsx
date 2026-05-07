import { motion, useReducedMotion } from "framer-motion";

export default function FloatingOrbs() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-gradient-to-r from-primary/15 to-purple-500/15 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-gradient-to-r from-pink-500/15 to-primary/15 blur-3xl" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Primary orb */}
      <motion.div
        className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-primary/15 to-purple-500/15 blur-3xl"
        initial={{ top: "20%", left: "10%" }}
        animate={{
          top: ["20%", "30%", "20%"],
          left: ["10%", "20%", "10%"],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Purple orb */}
      <motion.div
        className="absolute w-72 h-72 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/15 blur-3xl"
        initial={{ top: "50%", right: "15%" }}
        animate={{
          top: ["50%", "40%", "50%"],
          right: ["15%", "25%", "15%"],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {/* Pink orb */}
      <motion.div
        className="absolute w-48 h-48 rounded-full bg-gradient-to-r from-pink-500/15 to-primary/15 blur-3xl"
        initial={{ bottom: "15%", left: "50%" }}
        animate={{
          bottom: ["15%", "25%", "15%"],
          left: ["50%", "40%", "50%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </div>
  );
}
