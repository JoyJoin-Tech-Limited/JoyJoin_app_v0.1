/**
 * IndustrySelector - 行业选择器（智能+手动双模式）
 * 
 * 功能：
 * - Tab 1: 智能识别（SmartIndustryClassifier）
 * - Tab 2: 手动选择（IndustryCascadeSelector）
 * - 统一回调接口
 */

import { useState } from "react";
import { Sparkles, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartIndustryClassifier } from "./SmartIndustryClassifier";
import { IndustryCascadeSelector } from "./IndustryCascadeSelector";
import { cn } from "@/lib/utils";

interface IndustrySelection {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  rawInput?: string;
  source?: "seed" | "ontology" | "ai" | "manual";
  confidence?: number;
}

interface IndustrySelectorProps {
  onSelect: (selection: IndustrySelection) => void;
  defaultTab?: "smart" | "manual";
  className?: string;
}

export function IndustrySelector({
  onSelect,
  defaultTab = "smart",
  className,
}: IndustrySelectorProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  const handleSmartClassified = (result: any) => {
    onSelect({
      category: result.category,
      segment: result.segment,
      niche: result.niche,
      rawInput: result.rawInput,
      source: result.source,
      confidence: result.confidence,
    });
  };

  const handleManualSelect = (selection: any) => {
    onSelect({
      ...selection,
      source: "manual",
      confidence: 1.0,
    });
  };

  const handleSwitchToManual = () => {
    setActiveTab("manual");
  };

  return (
    <div className={cn("w-full", className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="smart" className="gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">智能识别</span>
            <span className="sm:hidden">智能</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">手动选择</span>
            <span className="sm:hidden">手动</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smart" className="mt-0">
          <SmartIndustryClassifier
            onClassified={handleSmartClassified}
            onManualSelect={handleSwitchToManual}
            mascotPrompt="🎯 告诉小悦你的职业，AI帮你精准匹配"
            placeholder="例：我做医疗AI / 银行柜员 / 快递员"
          />
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            或者
            <button
              onClick={handleSwitchToManual}
              className="text-primary hover:underline ml-1 font-medium"
            >
              手动选择行业分类
            </button>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-0">
          <div className="mb-4 text-sm text-muted-foreground">
            📋 按步骤选择：大类 → 细分领域 → 具体赛道（可选）
          </div>
          <IndustryCascadeSelector
            onSelect={handleManualSelect}
            onBack={() => setActiveTab("smart")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
