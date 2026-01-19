import logoImage from "@/assets/box_logo_archetypes.png";

interface JoyJoinLogoProps {
  size?: "sm" | "md" | "lg";
  showEnglish?: boolean;
}

export default function JoyJoinLogo({ size = "md", showEnglish = true }: JoyJoinLogoProps) {
  const logoSizes = {
    sm: "h-16",
    md: "h-20",
    lg: "h-24"
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className="flex items-center gap-2">
      <img 
        src={logoImage} 
        alt="悦聚·JoyJoin" 
        className={`${logoSizes[size]} w-auto object-contain`}
      />
      <div className="flex items-center gap-1.5">
        <span className={`${textSizes[size]} font-bold`} style={{ fontFamily: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif' }}>悦聚</span>
        {showEnglish && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className={`${textSizes[size]} font-semibold text-muted-foreground`} style={{ fontFamily: '"ZCOOL QingKe HuangYou", "Outfit", sans-serif' }}>JoyJoin</span>
          </>
        )}
      </div>
    </div>
  );
}
