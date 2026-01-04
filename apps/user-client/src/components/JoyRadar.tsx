import { motion } from "framer-motion";
import { Users } from "lucide-react";

interface JoyRadarProps {
  currentParticipants: number;
  maxParticipants: number;
  className?: string;
}

export default function JoyRadar({ currentParticipants, maxParticipants, className = "" }: JoyRadarProps) {
  const remaining = maxParticipants - currentParticipants;
  const isFull = remaining <= 0;
  const isAlmostFull = remaining <= 2 && remaining > 0;

  if (isFull) {
    return (
      <div className={`flex items-center gap-1.5 text-xs ${className}`} data-testid="joy-radar-full">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
        <span className="text-muted-foreground">已满员</span>
      </div>
    );
  }

  return (
    <motion.div
      className={`flex items-center gap-1.5 text-xs ${className}`}
      data-testid="joy-radar"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={`relative w-2 h-2 rounded-full ${isAlmostFull ? 'bg-orange-500' : 'bg-green-500'}`}
        animate={{
          scale: [1, 1.3, 1],
          opacity: [1, 0.7, 1],
        }}
        transition={{
          repeat: Infinity,
          duration: isAlmostFull ? 0.8 : 1.5,
        }}
      >
        <motion.div
          className={`absolute inset-0 rounded-full ${isAlmostFull ? 'bg-orange-500' : 'bg-green-500'}`}
          animate={{
            scale: [1, 2, 2],
            opacity: [0.5, 0, 0],
          }}
          transition={{
            repeat: Infinity,
            duration: isAlmostFull ? 0.8 : 1.5,
          }}
        />
      </motion.div>
      
      <div className="flex items-center gap-1">
        <Users className="w-3 h-3 text-muted-foreground" />
        <span className={isAlmostFull ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-muted-foreground'}>
          {isAlmostFull ? (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              仅剩{remaining}位
            </motion.span>
          ) : (
            `剩余${remaining}位`
          )}
        </span>
      </div>
    </motion.div>
  );
}
