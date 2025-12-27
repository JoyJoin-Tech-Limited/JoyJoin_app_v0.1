import { User } from "lucide-react";
import { archetypeAvatars, archetypeBgColors } from "@/lib/archetypeAvatars";

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
        const avatarImg = participant.archetype ? archetypeAvatars[participant.archetype] : null;
        const bgColor = participant.archetype ? archetypeBgColors[participant.archetype] : null;
        
        return (
          <div
            key={participant.id}
            className={`${SIZE_CLASSES[size]} rounded-full ${avatarImg && bgColor ? bgColor : `bg-gradient-to-br ${gradientColor}`} flex items-center justify-center border-2 border-background shadow-sm transition-transform hover:scale-110 hover:z-10 overflow-hidden`}
            style={{ zIndex: displayedParticipants.length - index }}
            title={`${participant.displayName || "用户"}${participant.archetype ? ` · ${participant.archetype}` : ''}`}
          >
            {avatarImg ? (
              <img 
                src={avatarImg} 
                alt={participant.archetype || ""} 
                className="w-full h-full object-contain p-0.5"
              />
            ) : (
              <User className={`${ICON_SIZE_CLASSES[size]} text-white`} />
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
