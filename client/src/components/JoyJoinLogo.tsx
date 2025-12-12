import logoImage from "@assets/JoyJoinapp_logo_Chinese_FuLuDouTi_1765450433449.png";

interface JoyJoinLogoProps {
  size?: "sm" | "md" | "lg";
  showEnglish?: boolean;
}

export default function JoyJoinLogo({ size = "md", showEnglish = true }: JoyJoinLogoProps) {
  const logoSizes = {
    sm: "h-12",
    md: "h-16",
    lg: "h-20"
  };

  const textSizes = {
    sm: "text-2xl",
    md: "text-3xl",
    lg: "text-4xl"
  };

  return (
    <div className="flex items-center gap-2">
      <img 
        src={logoImage} 
        alt="悦聚·JoyJoin" 
        className={`${logoSizes[size]} w-auto object-contain`}
      />
      <div className="flex items-center gap-1.5">
        <span className={`${textSizes[size]} font-display font-bold`}>悦聚</span>
        {showEnglish && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className={`${textSizes[size]} font-display font-semibold text-muted-foreground`}>JoyJoin</span>
          </>
        )}
      </div>
    </div>
  );
}
