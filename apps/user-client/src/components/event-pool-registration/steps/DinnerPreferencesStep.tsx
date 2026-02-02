import { motion } from "framer-motion";
import CollapsibleSection from "../shared/CollapsibleSection";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DINNER_OPTIONS } from "@/lib/event-pool-options";
import { UtensilsCrossed, Leaf, Flame } from "lucide-react";

interface DinnerPreferencesStepProps {
  selectedCuisines: string[];
  selectedDietary: string[];
  tasteIntensity: string | undefined;
  onUpdateCuisines: (cuisines: string[]) => void;
  onUpdateDietary: (dietary: string[]) => void;
  onUpdateTasteIntensity: (intensity: string) => void;
}

export default function DinnerPreferencesStep({
  selectedCuisines,
  selectedDietary,
  tasteIntensity,
  onUpdateCuisines,
  onUpdateDietary,
  onUpdateTasteIntensity,
}: DinnerPreferencesStepProps) {
  const handleToggleCuisine = (cuisineValue: string) => {
    if (selectedCuisines.includes(cuisineValue)) {
      onUpdateCuisines(selectedCuisines.filter(c => c !== cuisineValue));
    } else {
      onUpdateCuisines([...selectedCuisines, cuisineValue]);
    }
  };

  const handleToggleDietary = (dietaryValue: string) => {
    if (selectedDietary.includes(dietaryValue)) {
      onUpdateDietary(selectedDietary.filter(d => d !== dietaryValue));
    } else {
      onUpdateDietary([...selectedDietary, dietaryValue]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">饭局偏好</h2>
        <p className="text-sm text-muted-foreground">
          以下为可选项，帮助我们更好地为您匹配
        </p>
      </div>

      {/* Cuisines */}
      <CollapsibleSection 
        title="菜系偏好" 
        icon={<UtensilsCrossed className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="grid grid-cols-3 gap-2">
          {DINNER_OPTIONS.cuisines.map(cuisine => (
            <motion.div
              key={cuisine.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Badge
                variant={selectedCuisines.includes(cuisine.value) ? "default" : "outline"}
                className="cursor-pointer w-full justify-center py-2 text-sm"
                onClick={() => handleToggleCuisine(cuisine.value)}
              >
                {cuisine.emoji} {cuisine.label}
              </Badge>
            </motion.div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Taste Intensity */}
      <CollapsibleSection 
        title="口味偏好" 
        icon={<Flame className="w-4 h-4" />}
        defaultOpen={false}
      >
        <RadioGroup 
          value={tasteIntensity} 
          onValueChange={onUpdateTasteIntensity}
          className="space-y-3"
        >
          {DINNER_OPTIONS.tasteIntensity.map(option => (
            <div 
              key={option.value} 
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => onUpdateTasteIntensity(option.value)}
            >
              <RadioGroupItem value={option.value} id={option.value} />
              <div className="flex-1">
                <Label 
                  htmlFor={option.value} 
                  className="font-medium cursor-pointer flex items-center gap-2"
                >
                  <span className="text-lg">{option.emoji}</span>
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </CollapsibleSection>

      {/* Dietary Restrictions */}
      <CollapsibleSection 
        title="饮食限制" 
        icon={<Leaf className="w-4 h-4" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-2 gap-2">
          {DINNER_OPTIONS.dietary.map(dietary => (
            <motion.div
              key={dietary.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Badge
                variant={selectedDietary.includes(dietary.value) ? "default" : "outline"}
                className="cursor-pointer w-full justify-center py-2 text-sm"
                onClick={() => handleToggleDietary(dietary.value)}
              >
                {dietary.emoji} {dietary.label}
              </Badge>
            </motion.div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
