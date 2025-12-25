import { ReactNode } from "react";
import ParticleBackground from "@/components/ui/particle-background";

interface BlindBoxSectionProps {
  children: ReactNode;
  className?: string;
}

export default function BlindBoxSection({ children, className = "" }: BlindBoxSectionProps) {
  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      data-testid="blindbox-section"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-primary/10 to-background pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent pointer-events-none" />
      <ParticleBackground 
        particleCount={25} 
        color="147, 51, 234"
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
