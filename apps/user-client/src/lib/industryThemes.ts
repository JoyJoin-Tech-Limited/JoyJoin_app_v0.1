/**
 * Industry Category Theme Colors
 * Maps category IDs to gradient color schemes for visual consistency
 */

export const INDUSTRY_GRADIENTS = {
  finance: "from-blue-400 to-cyan-400",
  tech: "from-purple-400 to-pink-400",
  healthcare: "from-green-400 to-emerald-400",
  education: "from-indigo-400 to-violet-400",
  manufacturing: "from-orange-400 to-red-400",
  retail: "from-yellow-400 to-amber-400",
  hospitality: "from-pink-400 to-rose-400",
  transport: "from-cyan-400 to-blue-400",
  real_estate: "from-emerald-400 to-green-400",
  media: "from-violet-400 to-purple-400",
  energy: "from-amber-400 to-orange-400",
  agriculture: "from-lime-400 to-green-400",
  construction: "from-gray-400 to-slate-400",
  legal: "from-slate-400 to-zinc-400",
  consulting: "from-teal-400 to-cyan-400",
} as const;

export const INDUSTRY_EMOJIS: Record<string, string> = {
  finance: "💰",
  tech: "💻",
  healthcare: "🏥",
  education: "📚",
  manufacturing: "🏭",
  retail: "🛍️",
  hospitality: "🍽️",
  transport: "🚚",
  real_estate: "🏢",
  media: "📺",
  energy: "⚡",
  agriculture: "🌾",
  construction: "🏗️",
  legal: "⚖️",
  consulting: "💼",
};

/**
 * Get gradient class for a category ID
 */
export function getCategoryGradient(categoryId: string): string {
  return INDUSTRY_GRADIENTS[categoryId as keyof typeof INDUSTRY_GRADIENTS] || "from-gray-400 to-slate-400";
}

/**
 * Get emoji for a category ID
 */
export function getCategoryEmoji(categoryId: string): string {
  return INDUSTRY_EMOJIS[categoryId] || "📁";
}
