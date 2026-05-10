import { motion } from "framer-motion";
import CollapsibleSection from "../shared/CollapsibleSection";
import SelectableBadge from "../shared/SelectableBadge";
import { DINNER_OPTIONS } from "@/lib/event-pool-options";
import { Leaf } from "lucide-react";

interface DinnerPreferencesStepProps {
  selectedDietary: string[];
  onUpdateDietary: (dietary: string[]) => void;
}

export default function DinnerPreferencesStep({
  selectedDietary,
  onUpdateDietary,
}: DinnerPreferencesStepProps) {
  const handleToggleDietary = (dietaryValue: string) => {
    if (selectedDietary.includes(dietaryValue)) {
      onUpdateDietary(selectedDietary.filter(d => d !== dietaryValue));
    } else {
      onUpdateDietary([...selectedDietary, dietaryValue]);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2">饭局偏好</h2>
        <p className="text-sm text-muted-foreground">
          以下为可选项，帮助我们更好地为您匹配
        </p>
      </div>

      <CollapsibleSection 
        title="饮食限制" 
        icon={<Leaf className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="grid grid-cols-2 gap-2">
          {DINNER_OPTIONS.dietary.map(dietary => (
            <SelectableBadge
              key={dietary.value}
              selected={selectedDietary.includes(dietary.value)}
              onClick={() => handleToggleDietary(dietary.value)}
            >
              {dietary.emoji} {dietary.label}
            </SelectableBadge>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
