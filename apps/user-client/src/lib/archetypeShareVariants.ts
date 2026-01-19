/**
 * Archetype Share Card Color Variants
 * 5 variants per archetype for viral social sharing
 * Total: 60 variants across 12 archetypes
 */

export interface ShareCardVariant {
  name: string;         // e.g., "经典橙红", "暗夜紫"
  gradient: string;     // e.g., "from-orange-400 via-red-400 to-pink-500"
  primaryColor: string; // hex for trait bars
  mood: string;         // e.g., "energetic, clever"
}

export const archetypeShareVariants: Record<string, ShareCardVariant[]> = {
  "机智狐": [
    { name: "经典橙红", gradient: "from-orange-400 via-red-400 to-pink-500", primaryColor: "#FF6B6B", mood: "机智活泼，充满创意" },
    { name: "暗夜紫", gradient: "from-purple-600 via-violet-600 to-fuchsia-600", primaryColor: "#9B59B6", mood: "神秘深邃，智慧闪烁" },
    { name: "森林绿", gradient: "from-emerald-500 via-green-500 to-teal-500", primaryColor: "#10B981", mood: "自然灵动，机敏聪慧" },
    { name: "极光蓝", gradient: "from-cyan-400 via-blue-400 to-indigo-500", primaryColor: "#06B6D4", mood: "清新灵动，点子不断" },
  ],
  "开心柯基": [
    { name: "阳光黄", gradient: "from-yellow-400 via-amber-400 to-orange-400", primaryColor: "#FFD93D", mood: "活力四射，快乐无限" },
    { name: "粉红泡泡", gradient: "from-pink-400 via-rose-400 to-red-400", primaryColor: "#FF69B4", mood: "甜美可爱，充满爱心" },
    { name: "天空蓝", gradient: "from-sky-400 via-blue-400 to-cyan-400", primaryColor: "#0EA5E9", mood: "轻松愉快，阳光灿烂" },
    { name: "薄荷绿", gradient: "from-green-400 via-emerald-400 to-teal-400", primaryColor: "#34D399", mood: "清新活泼，元气满满" },
  ],
  "暖心熊": [
    { name: "温暖棕", gradient: "from-amber-600 via-orange-600 to-red-500", primaryColor: "#FFA07A", mood: "温柔体贴，如沐春风" },
    { name: "秋叶红", gradient: "from-red-500 via-orange-500 to-amber-500", primaryColor: "#EF4444", mood: "热情温暖，关怀备至" },
    { name: "蜂蜜金", gradient: "from-yellow-500 via-amber-500 to-orange-500", primaryColor: "#F59E0B", mood: "甜美温柔，暖心治愈" },
    { name: "樱花粉", gradient: "from-pink-400 via-rose-400 to-pink-500", primaryColor: "#F472B6", mood: "柔软温柔，细腻温情" },
  ],
  "织网蛛": [
    { name: "神秘紫", gradient: "from-purple-600 via-violet-600 to-fuchsia-600", primaryColor: "#9B59B6", mood: "深谋远虑，连接众人" },
    { name: "深海蓝", gradient: "from-blue-700 via-indigo-700 to-purple-700", primaryColor: "#3B82F6", mood: "沉稳睿智，编织关系" },
    { name: "月光银", gradient: "from-gray-400 via-slate-400 to-zinc-400", primaryColor: "#94A3B8", mood: "优雅从容，洞察人心" },
    { name: "紫罗兰", gradient: "from-violet-500 via-purple-500 to-fuchsia-500", primaryColor: "#8B5CF6", mood: "高雅睿智，善于联结" },
  ],
  "夸夸豚": [
    { name: "梦幻粉", gradient: "from-pink-400 via-fuchsia-400 to-purple-400", primaryColor: "#FF69B4", mood: "甜美可爱，正能量爆棚" },
    { name: "彩虹渐变", gradient: "from-pink-400 via-purple-400 to-blue-400", primaryColor: "#EC4899", mood: "多彩缤纷，欢乐无限" },
    { name: "泡泡糖", gradient: "from-rose-400 via-pink-400 to-fuchsia-400", primaryColor: "#FB7185", mood: "活泼可爱，赞美专家" },
    { name: "珊瑚橙", gradient: "from-orange-400 via-pink-400 to-rose-400", primaryColor: "#F97316", mood: "热情洋溢，快乐传递" },
  ],
  "太阳鸡": [
    { name: "旭日橙", gradient: "from-orange-500 via-amber-500 to-yellow-500", primaryColor: "#FFA500", mood: "朝气蓬勃，温暖如阳" },
    { name: "火焰红", gradient: "from-red-600 via-orange-600 to-amber-600", primaryColor: "#DC2626", mood: "热情洋溢，活力四射" },
    { name: "金色阳光", gradient: "from-yellow-400 via-amber-400 to-orange-400", primaryColor: "#FBBF24", mood: "明亮灿烂，正能量满满" },
    { name: "琥珀金", gradient: "from-amber-500 via-yellow-600 to-orange-600", primaryColor: "#D97706", mood: "温暖稳重，光芒四射" },
  ],
  "淡定海豚": [
    { name: "海洋蓝", gradient: "from-blue-500 via-cyan-500 to-teal-500", primaryColor: "#4FC3F7", mood: "平静从容，智慧深远" },
    { name: "湖水绿", gradient: "from-teal-500 via-cyan-500 to-blue-400", primaryColor: "#14B8A6", mood: "宁静致远，思维清晰" },
    { name: "月光蓝", gradient: "from-indigo-400 via-blue-400 to-cyan-400", primaryColor: "#6366F1", mood: "平和安详，冷静睿智" },
    { name: "薄荷冰", gradient: "from-cyan-300 via-teal-300 to-emerald-300", primaryColor: "#67E8F9", mood: "清新淡定，从容不迫" },
  ],
  "沉思猫头鹰": [
    { name: "深紫夜", gradient: "from-purple-700 via-indigo-700 to-violet-700", primaryColor: "#8B4789", mood: "深邃睿智，洞察本质" },
    { name: "月夜蓝", gradient: "from-indigo-600 via-blue-700 to-slate-700", primaryColor: "#4F46E5", mood: "沉静深思，智慧如海" },
    { name: "森林暮色", gradient: "from-green-700 via-teal-700 to-cyan-700", primaryColor: "#047857", mood: "深沉稳重，思考深远" },
    { name: "紫檀木", gradient: "from-violet-600 via-purple-700 to-fuchsia-700", primaryColor: "#7C3AED", mood: "优雅深沉，洞悉万物" },
  ],
  "稳如龟": [
    { name: "苔藓绿", gradient: "from-green-600 via-emerald-600 to-teal-600", primaryColor: "#2E7D32", mood: "沉稳踏实，可靠安心" },
    { name: "大地棕", gradient: "from-amber-700 via-orange-700 to-red-700", primaryColor: "#92400E", mood: "厚重稳健，值得信赖" },
    { name: "橄榄绿", gradient: "from-lime-700 via-green-700 to-emerald-700", primaryColor: "#65A30D", mood: "平稳可靠，长久陪伴" },
    { name: "翡翠绿", gradient: "from-emerald-500 via-green-600 to-teal-600", primaryColor: "#10B981", mood: "温润沉稳，持久可靠" },
  ],
  "隐身猫": [
    { name: "幽灵灰", gradient: "from-gray-500 via-slate-500 to-zinc-500", primaryColor: "#757575", mood: "神秘低调，观察敏锐" },
    { name: "暗影黑", gradient: "from-slate-700 via-gray-700 to-neutral-700", primaryColor: "#334155", mood: "沉默寡言，深藏不露" },
    { name: "烟雾紫", gradient: "from-purple-600 via-gray-600 to-slate-600", primaryColor: "#7C3AED", mood: "迷离神秘，若隐若现" },
    { name: "迷雾蓝", gradient: "from-blue-600 via-slate-600 to-gray-600", primaryColor: "#2563EB", mood: "安静神秘，思绪缥缈" },
  ],
  "定心大象": [
    { name: "宁静蓝", gradient: "from-blue-600 via-indigo-600 to-purple-600", primaryColor: "#5C6BC0", mood: "沉稳安定，心如止水" },
    { name: "薰衣草", gradient: "from-purple-400 via-violet-400 to-indigo-400", primaryColor: "#A78BFA", mood: "优雅平和，安抚人心" },
    { name: "天青石", gradient: "from-sky-500 via-blue-500 to-indigo-500", primaryColor: "#0EA5E9", mood: "清澈稳定，镇定自若" },
    { name: "紫水晶", gradient: "from-violet-500 via-purple-500 to-indigo-500", primaryColor: "#8B5CF6", mood: "高贵沉稳，气场强大" },
  ],
  "灵感章鱼": [
    { name: "创意紫", gradient: "from-purple-500 via-fuchsia-500 to-pink-500", primaryColor: "#AB47BC", mood: "天马行空，灵感无限" },
    { name: "电光蓝", gradient: "from-cyan-500 via-blue-500 to-purple-500", primaryColor: "#06B6D4", mood: "思维跳跃，创意爆发" },
    { name: "魔法粉", gradient: "from-fuchsia-500 via-purple-500 to-violet-500", primaryColor: "#D946EF", mood: "神奇多变，点子王者" },
    { name: "霓虹紫", gradient: "from-violet-600 via-fuchsia-600 to-pink-600", primaryColor: "#A855F7", mood: "前卫新潮，灵感迸发" },
  ],
};

/**
 * Get default variant for an archetype (first variant in the list)
 */
export function getDefaultVariant(archetype: string): ShareCardVariant {
  const variants = archetypeShareVariants[archetype];
  if (!variants || variants.length === 0) {
    return {
      name: "经典",
      gradient: "from-gray-500 to-gray-600",
      primaryColor: "#9CA3AF",
      mood: "平衡稳定"
    };
  }
  return variants[0];
}

/**
 * Get all variants for an archetype
 */
export function getArchetypeVariants(archetype: string): ShareCardVariant[] {
  return archetypeShareVariants[archetype] || [];
}
