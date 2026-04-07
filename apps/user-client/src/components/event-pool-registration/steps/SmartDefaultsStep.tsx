import { useMemo, useState } from "react";
import { motion } from "framer-motion";
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

function getDefaultDistricts(eventArea: string) {
  const cluster = shenzhenClusters.find((candidate) => candidate.displayName === eventArea || candidate.id === eventArea);
  return cluster?.districts.slice(0, 3).map((district) => district.name) ?? [];
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
  const [isEditing, setIsEditing] = useState(false);
  const defaultDistrictNames = useMemo(() => getDefaultDistricts(eventArea), [eventArea]);
  const defaultLanguageLabels = useMemo(
    () =>
      userLanguages
        .map((lang) => SHARED_OPTIONS.languages.find((option) => option.value === lang)?.label)
        .filter(Boolean) as string[],
    [userLanguages],
  );

  const selectedDistrictNames = useMemo(() => {
    const districtMap = new Map(
      shenzhenClusters.flatMap((cluster) =>
        cluster.districts.map((district) => [district.id, district.name] as const),
      ),
    );
    return selectedDistricts.map((districtId) => districtMap.get(districtId) ?? districtId);
  }, [selectedDistricts]);

  const selectedLanguageLabels = useMemo(
    () =>
      selectedLanguages
        .map((lang) => SHARED_OPTIONS.languages.find((option) => option.value === lang)?.label ?? lang),
    [selectedLanguages],
  );

  const toggleLanguage = (langValue: string) => {
    if (selectedLanguages.includes(langValue)) {
      onUpdateLanguages(selectedLanguages.filter((lang) => lang !== langValue));
      return;
    }
    onUpdateLanguages([...selectedLanguages, langValue]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-xl font-bold">把你的信号装进盲盒</h2>
        <p className="text-sm text-muted-foreground">
          下面这些默认值会帮小悦更快把你放进合适的桌里；想细调，随时可以展开。
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[28px] border border-primary/10 bg-gradient-to-br from-primary/5 to-violet-500/5 p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">你的设置</p>
            <h3 className="mt-2 text-lg font-semibold">
              {eventType === "饭局" ? "舒服开聊的晚餐半径" : "适合微醺开聊的夜晚半径"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="rounded-full bg-background px-3 py-1 text-xs text-primary shadow-sm"
          >
            {isEditing ? "收起细调" : "细调一下"}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">默认商圈</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedDistrictNames.length > 0 ? selectedDistrictNames : defaultDistrictNames).map((district) => (
                <Badge key={district} variant="secondary" className="rounded-full px-3 py-1">
                  {district}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">默认语言</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(selectedLanguageLabels.length > 0 ? selectedLanguageLabels : defaultLanguageLabels).map((language) => (
                <Badge key={language} variant="outline" className="rounded-full px-3 py-1">
                  {language}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5 rounded-[28px] border bg-background/80 p-4"
        >
          <div className="space-y-3">
            <p className="text-sm font-medium">想优先在哪些区域见面？</p>
            <div className="space-y-4">
              {shenzhenClusters.map((cluster) => (
                <div key={cluster.id} className="space-y-2">
                  <p className="text-xs text-muted-foreground">{cluster.displayName}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {cluster.districts.map((district) => (
                      <label
                        key={district.id}
                        className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedDistricts.includes(district.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              onUpdateDistricts([...selectedDistricts, district.id]);
                              return;
                            }
                            onUpdateDistricts(selectedDistricts.filter((candidate) => candidate !== district.id));
                          }}
                        />
                        <span>{district.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">希望这桌默认用哪些语言？</p>
            <div className="flex flex-wrap gap-2">
              {SHARED_OPTIONS.languages.map((lang) => (
                <button
                  key={lang.value}
                  type="button"
                  onClick={() => toggleLanguage(lang.value)}
                  className={`rounded-full border px-4 py-2 text-sm transition-all ${
                    selectedLanguages.includes(lang.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:border-primary/40"
                  }`}
                >
                  {lang.flag} {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            这些只是你的默认倾向，不会锁死最终安排；小悦仍会优先保证整桌的整体契合度。
          </div>
        </motion.div>
      )}
    </div>
  );
}
