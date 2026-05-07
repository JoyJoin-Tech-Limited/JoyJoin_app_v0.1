import { MapPin } from "lucide-react";

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

export default function HeroWelcome({ 
  userName = "朋友", 
  selectedCity,
  selectedArea,
  onLocationClick 
}: HeroWelcomeProps) {
  const displayArea = selectedArea || areaDisplay[selectedCity];
  const displayLocation = `${selectedCity}•${displayArea}`;
  
  return (
    <div className="px-4 py-6 space-y-3">
      {/* 问候语 */}
      <h1 className="text-3xl font-bold font-brand" data-testid="text-hero-greeting">
        Hi {userName} 👋
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
  );
}
