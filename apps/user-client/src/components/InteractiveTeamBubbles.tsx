import { motion } from "framer-motion";

interface TeamBubble {
  groupId: string;
  teamName: string;
  teamEmoji: string;
  memberCount: number;
  temperatureLevel: "fire" | "warm" | "mild" | "cold";
}

interface InteractiveTeamBubblesProps {
  teams: TeamBubble[];
  onTeamClick?: (groupId: string) => void;
}

export default function InteractiveTeamBubbles({
  teams,
  onTeamClick,
}: InteractiveTeamBubblesProps) {
  const maxTeams = 6;
  const displayTeams = teams.slice(0, maxTeams);
  
  if (displayTeams.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        暂无成功组队
      </div>
    );
  }
  
  // Calculate circular positions
  const radius = 35; // percentage
  const centerX = 50;
  const centerY = 50;
  
  const getPosition = (index: number, total: number) => {
    const angle = (index / total) * 2 * Math.PI;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    return { x, y };
  };
  
  const temperatureColors = {
    fire: "from-orange-500 to-red-500",
    warm: "from-amber-400 to-orange-500",
    mild: "from-blue-400 to-violet-500",
    cold: "from-gray-400 to-gray-500",
  };
  
  const temperatureEmojis = {
    fire: "🔥",
    warm: "🌡️",
    mild: "🌤️",
    cold: "❄️",
  };
  
  return (
    <div className="relative h-80 w-full">
      {displayTeams.map((team, index) => {
        const pos = getPosition(index, displayTeams.length);
        
        const handleClick = () => {
          if (onTeamClick) {
            // Haptic feedback
            if (navigator.vibrate) {
              navigator.vibrate(10);
            }
            onTeamClick(team.groupId);
          }
        };
        
        return (
          <motion.button
            key={team.groupId}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              delay: index * 0.1,
            }}
            onClick={handleClick}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          >
            <div className="relative">
              {/* Main Bubble */}
              <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br ${temperatureColors[team.temperatureLevel]} shadow-lg transition-all group-hover:shadow-xl`}>
                <span className="text-2xl mb-0.5">{team.teamEmoji}</span>
                <span className="text-[9px] font-bold text-white text-center px-1 leading-tight line-clamp-1">
                  {team.teamName}
                </span>
              </div>
              
              {/* Temperature Badge */}
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white dark:bg-gray-900 flex items-center justify-center shadow-md border border-gray-200 dark:border-gray-700">
                <span className="text-xs">{temperatureEmojis[team.temperatureLevel]}</span>
              </div>
              
              {/* Member Count Badge */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-white dark:bg-gray-900 text-[10px] font-bold text-gray-700 dark:text-gray-300 shadow-md border border-gray-200 dark:border-gray-700">
                {team.memberCount}人
              </div>
              
              {/* Pulse Ring on Hover */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none opacity-0 group-hover:opacity-100"
                initial={false}
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
