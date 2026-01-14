/**
 * IndustrySelector - AI-powered industry selection (simplified)
 * 
 * Functionality:
 * - AI-only mode (no manual selection tabs)
 * - Uses SmartIndustryClassifier for intelligent classification
 * - Unified callback interface
 */

import { cn } from "@/lib/utils";
import { SmartIndustryClassifier } from "./SmartIndustryClassifier";

interface IndustrySelection {
  category: { id: string; label: string };
  segment: { id: string; label: string };
  niche?: { id: string; label: string };
  rawInput?: string;
  source?: "seed" | "ontology" | "ai" | "fallback" | "manual";
  confidence?: number;
}

interface IndustrySelectorProps {
  onSelect: (selection: IndustrySelection) => void;
  className?: string;
}

export function IndustrySelector({ onSelect, className }: IndustrySelectorProps) {
  return (
    <div className={cn("w-full", className)}>
      <SmartIndustryClassifier
        onClassified={(result) => {
          onSelect({
            category: result.category,
            segment: result.segment,
            niche: result.niche,
            rawInput: result.rawInput,
            source: result.source,
            confidence: result.confidence,
          });
        }}
        mascotPrompt="🎯 告诉小悦你的职业，AI帮你精准匹配"
        placeholder="例：我做医疗AI / 银行柜员 / 快递员"
      />
    </div>
  );
}
