import { LucideIcon } from "lucide-react";
import { 
  Pizza, Coffee, Palette, Dumbbell, Music, Gamepad2, 
  Tent, Book, Wine, Trophy, Bike, Camera, Utensils,
  Heart, Sparkles, PartyPopper, Mountain, Film
} from "lucide-react";

interface EventIconBannerProps {
  vibeGradient: string;
  iconName?: string;
}

const iconMap: Record<string, LucideIcon> = {
  pizza: Pizza,
  coffee: Coffee,
  palette: Palette,
  dumbbell: Dumbbell,
  music: Music,
  gamepad: Gamepad2,
  tent: Tent,
  book: Book,
  wine: Wine,
  trophy: Trophy,
  bike: Bike,
  camera: Camera,
  utensils: Utensils,
  heart: Heart,
  sparkles: Sparkles,
  party: PartyPopper,
  mountain: Mountain,
  film: Film
};

export default function EventIconBanner({ vibeGradient, iconName = "sparkles" }: EventIconBannerProps) {
  const Icon = iconMap[iconName] || Sparkles;
  
  return (
    <div className={`relative h-24 bg-gradient-to-br ${vibeGradient} flex items-center justify-center overflow-hidden`}>
      <Icon className="h-12 w-12 text-white/15 absolute" strokeWidth={1.5} />
    </div>
  );
}

export { iconMap };
