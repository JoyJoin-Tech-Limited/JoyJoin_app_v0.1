import { motion } from "framer-motion";
import CollapsibleSection from "../shared/CollapsibleSection";
import SelectableBadge from "../shared/SelectableBadge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { BAR_OPTIONS } from "@/lib/event-pool-options";
import { Wine, Music, Sparkles } from "lucide-react";

interface BarPreferencesStepProps {
  selectedBarThemes: string[];
  alcoholComfort: string | undefined;
  selectedMusicPreference: string[];
  onUpdateBarThemes: (themes: string[]) => void;
  onUpdateAlcoholComfort: (comfort: string) => void;
  onUpdateMusicPreference: (music: string[]) => void;
}

export default function BarPreferencesStep({
  selectedBarThemes,
  alcoholComfort,
  selectedMusicPreference,
  onUpdateBarThemes,
  onUpdateAlcoholComfort,
  onUpdateMusicPreference,
}: BarPreferencesStepProps) {
  const handleToggleBarTheme = (themeValue: string) => {
    if (selectedBarThemes.includes(themeValue)) {
      onUpdateBarThemes(selectedBarThemes.filter(t => t !== themeValue));
    } else {
      onUpdateBarThemes([...selectedBarThemes, themeValue]);
    }
  };

  const handleToggleMusicPreference = (musicValue: string) => {
    if (selectedMusicPreference.includes(musicValue)) {
      onUpdateMusicPreference(selectedMusicPreference.filter(m => m !== musicValue));
    } else {
      onUpdateMusicPreference([...selectedMusicPreference, musicValue]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">酒局偏好</h2>
        <p className="text-sm text-muted-foreground">
          以下为可选项，帮助我们更好地为您匹配
        </p>
      </div>

      {/* Bar Themes */}
      <CollapsibleSection 
        title="酒吧类型" 
        icon={<Sparkles className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
          {BAR_OPTIONS.barThemes.map(theme => (
            <motion.div
              key={theme.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                selectedBarThemes.includes(theme.value)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              }`}
              onClick={() => handleToggleBarTheme(theme.value)}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{theme.emoji}</span>
                <div className="flex-1">
                  <div className="font-medium text-sm mb-1">{theme.label}</div>
                  <p className="text-xs text-muted-foreground">{theme.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CollapsibleSection>

      {/* Alcohol Comfort */}
      <CollapsibleSection 
        title="酒量偏好" 
        icon={<Wine className="w-4 h-4" />}
        defaultOpen={false}
      >
        <RadioGroup 
          value={alcoholComfort} 
          onValueChange={onUpdateAlcoholComfort}
          className="space-y-3"
        >
          {BAR_OPTIONS.alcoholComfort.map(option => (
            <div 
              key={option.value} 
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
              onClick={() => onUpdateAlcoholComfort(option.value)}
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

      {/* Music Preference */}
      <CollapsibleSection 
        title="音乐氛围" 
        icon={<Music className="w-4 h-4" />}
        defaultOpen={false}
      >
        <div className="grid grid-cols-3 gap-2">
          {BAR_OPTIONS.musicPreference.map(music => (
            <SelectableBadge
              key={music.value}
              selected={selectedMusicPreference.includes(music.value)}
              onClick={() => handleToggleMusicPreference(music.value)}
            >
              {music.emoji} {music.label}
            </SelectableBadge>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}
