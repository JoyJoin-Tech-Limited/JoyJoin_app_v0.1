import { MapPin } from "lucide-react";
import { getHongKongDateForComparison } from "@/lib/hongKongTime";

interface HeroWelcomeProps {
  userName?: string;
  selectedCity: "香港" | "深圳";
  selectedArea?: string;
  onLocationClick: () => void;
}

const areaDisplay = {
  "香港": "中西区",
  "深圳": "南山区"
};

function getTimeGreeting(): { text: string; emoji: string } {
  const h = getHongKongDateForComparison(new Date()).getUTCHours();
  if (h >= 5 && h < 12) return { text: "早上好", emoji: "☀️" };
  if (h >= 12 && h < 14) return { text: "午安", emoji: "🌤️" };
  if (h >= 14 && h < 18) return { text: "下午好", emoji: "🌈" };
  if (h >= 18 && h < 22) return { text: "晚上好", emoji: "🌆" };
  return { text: "夜深了", emoji: "🌙" };
}

export default function HeroWelcome({ 
  userName = "朋友", 
  selectedCity,
  selectedArea,
  onLocationClick 
}: HeroWelcomeProps) {
  const displayArea = selectedArea || areaDisplay[selectedCity];
  const displayLocation = `${selectedCity}•${displayArea}`;
  const { text: timeGreeting, emoji: timeEmoji } = getTimeGreeting();
  
  return (
    <div className="relative overflow-hidden px-4 pt-4 pb-2">
      {/* Ambient gradient blobs */}
      <div className="absolute -top-6 -right-6 w-48 h-48 rounded-full bg-gradient-to-br from-violet-400/20 via-pink-300/15 to-transparent blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 -left-4 w-32 h-32 rounded-full bg-gradient-to-tr from-amber-300/15 to-transparent blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-2">
      {/* 问候语 */}
      <h1 className="text-3xl font-bold font-cn-display" data-testid="text-hero-greeting">
        {timeGreeting}，{userName} {timeEmoji}
      </h1>
      
      {/* Slogan with 地点 Chip */}
      <div className="flex items-center flex-wrap gap-2 text-xl font-semibold">
        <span>在</span>
        <button
          type="button"
          onClick={onLocationClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 transition-all hover-elevate active-elevate-2 border border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`选择地区，当前为${displayLocation}`}
          data-testid="button-location-chip"
        >
          <MapPin className="h-4 w-4 text-primary" />
          <span className="text-primary font-semibold">{displayLocation}</span>
          <svg 
            className="h-3.5 w-3.5 text-primary/70" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <span>认识新朋友</span>
      </div>
      
      {/* 副标题 */}
      <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-hero-subtitle">
        AI 为你匹配 4–6 人小聚，轻松好聊，开心上桌
      </p>
      </div>
    </div>
  );
}
