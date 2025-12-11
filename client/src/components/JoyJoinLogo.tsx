import { Sparkles } from "lucide-react";

interface JoyJoinLogoProps {
  size?: "sm" | "md" | "lg";
  showEnglish?: boolean;
}

export default function JoyJoinLogo({ size = "md", showEnglish = true }: JoyJoinLogoProps) {
  const sizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl"
  };

  return (
    <div className="flex items-center gap-2">
      <Sparkles className={`${size === 'sm' ? 'h-5 w-5' : size === 'md' ? 'h-6 w-6' : 'h-7 w-7'} text-primary`} />
      <div className="flex items-center gap-1.5">
        <span className={`${sizes[size]} font-display font-bold`}>悦聚</span>
        {showEnglish && (
          <>
            <span className="text-muted-foreground">·</span>
            <span className={`${sizes[size]} font-display font-semibold text-muted-foreground`}>Joy</span>
          </>
        )}
      </div>
    </div>
  );
}
