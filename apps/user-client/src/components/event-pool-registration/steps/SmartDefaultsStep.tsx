import { useState } from "react";
import { motion } from "framer-motion";
import SmartDefaultsCard from "../shared/SmartDefaultsCard";
import CollapsibleSection from "../shared/CollapsibleSection";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { SHARED_OPTIONS } from "@/lib/event-pool-options";
import { shenzhenClusters } from "@shared/districts";

interface SmartDefaultsStepProps {
  eventType: "饭局" | "酒局";
  eventArea: string;
  userLanguages: string[];
  selectedDistricts: string[];
  selectedLanguages: string[];
  onUpdateDistricts: (districts: string[]) => void;
  onUpdateLanguages: (languages: string[]) => void;
}

export default function SmartDefaultsStep({
  eventType,
  eventArea,
  userLanguages,
  selectedDistricts,
  selectedLanguages,
  onUpdateDistricts,
  onUpdateLanguages,
}: SmartDefaultsStepProps) {
  const [showCustomization, setShowCustomization] = useState(false);

  // Get smart defaults
  const getDefaultDistricts = () => {
    const cluster = shenzhenClusters.find(c => 
      c.displayName === eventArea || c.id === eventArea
    );
    return cluster?.districts.slice(0, 3).map(d => d.name) || [];
  };

  const defaultDistrictNames = getDefaultDistricts();
  const defaultLanguageLabels = userLanguages.map(lang => 
    SHARED_OPTIONS.languages.find(l => l.value === lang)?.label
  ).filter(Boolean) as string[];

  const handleToggleLanguage = (langValue: string) => {
    if (selectedLanguages.includes(langValue)) {
      onUpdateLanguages(selectedLanguages.filter(l => l !== langValue));
    } else {
      onUpdateLanguages([...selectedLanguages, langValue]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold mb-2">偏好设置</h2>
        <p className="text-sm text-muted-foreground">
          我们已根据活动位置和您的资料预填了以下选项
        </p>
      </div>

      {/* Smart Defaults Card */}
      {!showCustomization && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <SmartDefaultsCard
            districts={defaultDistrictNames}
            languages={defaultLanguageLabels}
            eventSpecificDefaults={[]}
            onCustomize={() => setShowCustomization(true)}
          />
        </motion.div>
      )}

      {/* Customization Panel */}
      {showCustomization && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4"
        >
          {/* District Selector */}
          <CollapsibleSection 
            title="商圈偏好"
            defaultOpen={true}
          >
            <div className="space-y-3">
              {shenzhenClusters.map(cluster => (
                <div key={cluster.id} className="space-y-2">
                  <div className="font-medium text-sm text-muted-foreground">
                    {cluster.displayName}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {cluster.districts.map(district => (
                      <div key={district.id} className="flex items-center gap-2">
                        <Checkbox
                          id={district.id}
                          checked={selectedDistricts.includes(district.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onUpdateDistricts([...selectedDistricts, district.id]);
                            } else {
                              onUpdateDistricts(selectedDistricts.filter(d => d !== district.id));
                            }
                          }}
                        />
                        <Label 
                          htmlFor={district.id} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {district.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Language Selector */}
          <CollapsibleSection 
            title="语言偏好"
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2">
              {SHARED_OPTIONS.languages.map(lang => (
                <Badge
                  key={lang.value}
                  variant={selectedLanguages.includes(lang.value) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/90"
                  onClick={() => handleToggleLanguage(lang.value)}
                >
                  {lang.flag} {lang.label}
                </Badge>
              ))}
            </div>
          </CollapsibleSection>
        </motion.div>
      )}
    </div>
  );
}
