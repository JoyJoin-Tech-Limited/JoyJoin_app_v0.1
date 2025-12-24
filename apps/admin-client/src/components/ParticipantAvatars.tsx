import { User } from "lucide-react";

interface Participant {
  id: string;
  displayName: string | null;
  archetype?: string | null;
}

interface ParticipantAvatarsProps {
  participants: Participant[];
  maxDisplay?: number;
  size?: "sm" | "md" | "lg";
}

const ARCHETYPE_EMOJIS: Record<string, string> = {
  '开心柯基': '🐕',
  '太阳鸡': '🐓',
  '夸夸豚': '🐬',
  '机智狐': '🦊',
  '淡定海豚': '🐬',
  '织网蛛': '🕷️',
  '暖心熊': '🐻',
  '灵感章鱼': '🐙',
  '沉思猫头鹰': '🦉',
  '定心大象': '🐘',
  '稳如龟': '🐢',
  '隐身猫': '🐱',
};

const GRADIENT_COLORS = [
  "from-purple-400 to-indigo-400",
  "from-blue-400 to-cyan-400",
  "from-emerald-400 to-teal-400",
  "from-amber-400 to-orange-400",
  "from-pink-400 to-rose-400",
  "from-violet-400 to-purple-400",
];

const SIZE_CLASSES = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const ICON_SIZE_CLASSES = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export default function ParticipantAvatars({ 
  participants, 
  maxDisplay = 8,
  size = "md" 
}: ParticipantAvatarsProps) {
  const displayedParticipants = participants.slice(0, maxDisplay);
  const remainingCount = participants.length - maxDisplay;

  const getGradientColor = (index: number) => {
    return GRADIENT_COLORS[index % GRADIENT_COLORS.length];
  };

  return (
    <div className="flex items-center -space-x-2">
      {displayedParticipants.map((participant, index) => {
        const gradientColor = getGradientColor(index);
        const emoji = participant.archetype ? ARCHETYPE_EMOJIS[participant.archetype] : null;
        
        return (
          <div
            key={participant.id}
            className={`${SIZE_CLASSES[size]} rounded-full bg-gradient-to-br ${gradientColor} flex items-center justify-center text-white border-2 border-background shadow-sm transition-transform hover:scale-110 hover:z-10`}
            style={{ zIndex: displayedParticipants.length - index }}
            title={`${participant.displayName || "用户"}${participant.archetype ? ` · ${participant.archetype}` : ''}`}
          >
            {emoji ? (
              <span className="text-sm">{emoji}</span>
            ) : (
              <User className={ICON_SIZE_CLASSES[size]} />
            )}
          </div>
        );
      })}
      
      {remainingCount > 0 && (
        <div
          className={`${SIZE_CLASSES[size]} rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground border-2 border-background text-xs`}
          title={`还有 ${remainingCount} 位参与者`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
