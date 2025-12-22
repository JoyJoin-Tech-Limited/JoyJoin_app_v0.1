import { Briefcase, Users, Coffee, Heart, Globe, Sparkles, LucideIcon } from "lucide-react";

export interface InsightCategoryConfig {
  icon: LucideIcon;
  color: string;
}

export const insightCategoryConfig: Record<string, InsightCategoryConfig> = {
  career: { icon: Briefcase, color: 'text-blue-500 bg-blue-500/10' },
  personality: { icon: Users, color: 'text-violet-500 bg-violet-500/10' },
  lifestyle: { icon: Coffee, color: 'text-amber-500 bg-amber-500/10' },
  preference: { icon: Heart, color: 'text-pink-500 bg-pink-500/10' },
  background: { icon: Globe, color: 'text-green-500 bg-green-500/10' },
  social: { icon: Users, color: 'text-orange-500 bg-orange-500/10' },
};

export const defaultInsightConfig: InsightCategoryConfig = {
  icon: Sparkles,
  color: 'text-primary bg-primary/10',
};

export function getInsightCategoryConfig(category: string): InsightCategoryConfig {
  return insightCategoryConfig[category] || defaultInsightConfig;
}

export const INSIGHT_CONFIDENCE_THRESHOLD = 0.7;
export const INSIGHT_DISPLAY_LIMIT = 3;
