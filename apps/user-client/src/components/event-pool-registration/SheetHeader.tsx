import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users } from "lucide-react";

interface SheetHeaderProps {
  currentStep: number;
  totalSteps: number;
  poolData: {
    title: string;
    date: string;
    area: string;
    registrationCount: number;
  };
}

export default function SheetHeader({ currentStep, totalSteps, poolData }: SheetHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Step indicator — soft dots, not a workflow progress bar */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i + 1 < currentStep
                ? "w-4 bg-primary"
                : i + 1 === currentStep
                  ? "w-4 bg-primary/60"
                  : "w-1.5 bg-muted-foreground/20"
            }`}
          />
        ))}
      </div>

      {/* Event card — invitation style, not logistics panel */}
      <div
        className="bg-gradient-to-br from-background to-muted/30 backdrop-blur-sm rounded-xl p-4 border shadow-sm"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-base">{poolData.title}</h3>
          <Badge variant="secondary" className="shrink-0">
            正在入座
          </Badge>
        </div>
        
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{poolData.date}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{poolData.area}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{poolData.registrationCount} 位桌友已就位</span>
          </div>
        </div>
      </div>
    </div>
  );
}
