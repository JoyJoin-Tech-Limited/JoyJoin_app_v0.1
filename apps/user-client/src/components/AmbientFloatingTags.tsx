import { motion } from "framer-motion";

interface TeamTag {
  teamName: string;
  teamEmoji: string;
}

interface AmbientFloatingTagsProps {
  teamTags: TeamTag[];
}

export default function AmbientFloatingTags({ teamTags }: AmbientFloatingTagsProps) {
  // Limit to 8 tags for ambient background
  const ambientTags = teamTags.slice(0, 8);
  
  if (ambientTags.length === 0) return null;
  
  // Define positions across the screen (in pixels for consistent behavior)
  const positions = [
    { x: 20, y: 50 },
    { x: 320, y: 75 },
    { x: 60, y: 150 },
    { x: 280, y: 175 },
    { x: 100, y: 250 },
    { x: 240, y: 275 },
    { x: 40, y: 350 },
    { x: 300, y: 375 },
  ];
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 z-0">
      {ambientTags.map((tag, index) => {
        const pos = positions[index % positions.length];
        const duration = 15 + Math.random() * 10; // 15-25s
        
        return (
          <motion.div
            key={`ambient-${index}`}
            className="absolute"
            initial={{
              x: pos.x,
              y: pos.y,
              opacity: 0,
            }}
            animate={{
              x: [0, 80, 0],
              y: [0, 120, 0],
              opacity: [0, 0.4, 0.4, 0],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: index * 2,
              times: [0, 0.33, 0.66, 1],
            }}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
            }}
          >
            <div className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm">
              <span className="text-2xl">{tag.teamEmoji}</span>
              <span className="text-base font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {tag.teamName}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
