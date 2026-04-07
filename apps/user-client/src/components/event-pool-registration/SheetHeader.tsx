import { motion } from "framer-motion";
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
  const progressPercentage = (currentStep / totalSteps) * 100;
  const phases = [
    { id: 1, label: "Setting Vibe", subtitle: "定今晚气氛" },
    { id: 2, label: "Make a Wish", subtitle: "说出主愿望" },
    { id: 3, label: "Seal", subtitle: "封盒确认" },
  ];
  const activePhase = phases[currentStep - 1] ?? phases[0];

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{activePhase.label}</span>
          <span>{activePhase.subtitle}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-purple-600"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {phases.map((phase) => {
            const isActive = phase.id === currentStep;
            const isComplete = phase.id < currentStep;
            return (
              <div
                key={phase.id}
                className={`rounded-xl border px-2 py-2 text-center transition-all ${
                  isActive
                    ? "border-primary bg-primary/8 text-foreground"
                    : isComplete
                    ? "border-primary/20 bg-primary/5 text-muted-foreground"
                    : "border-border bg-background/70 text-muted-foreground"
                }`}
              >
                <p className="text-[11px] font-medium">{phase.label}</p>
                <p className="mt-0.5 text-[10px] opacity-70">{phase.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Info Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="bg-gradient-to-br from-background to-muted/30 backdrop-blur-sm rounded-xl p-4 border shadow-sm"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-base">{poolData.title}</h3>
          <Badge variant="secondary" className="shrink-0">
            {Math.round(progressPercentage)}% 已封存
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
            <span>{poolData.registrationCount}人已报名</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
