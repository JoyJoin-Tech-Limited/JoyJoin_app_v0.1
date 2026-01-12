import corgiImg from "@/assets/开心柯基_transparent_1.png";
import foxImg from "@/assets/机智狐_transparent_2.png";
import bearImg from "@/assets/暖心熊_transparent_3.png";
import spiderImg from "@/assets/织网蛛_transparent_4.png";
import dolphinPraiseImg from "@/assets/夸夸豚_transparent_5.png";
import sunChickenImg from "@/assets/太阳鸡_transparent_6.png";
import dolphinImg from "@/assets/淡定海豚_transparent_7.png";
import owlImg from "@/assets/沉思猫头鹰_transparent_8.png";
import turtleImg from "@/assets/稳如龟_transparent_9.png";
import catImg from "@/assets/隐身猫_transparent_10.png";
import elephantImg from "@/assets/定心大象_transparent_11.png";
import octopusImg from "@/assets/灵感章鱼_transparent_12.png";

export interface ArchetypeData {
  name: string;
  image: string;
  accent: string;
  glow: string;
}

export const ALL_ARCHETYPES: ArchetypeData[] = [
  { name: "开心柯基", image: corgiImg, accent: "#f59e0b", glow: "rgba(245, 158, 11, 0.25)" },
  { name: "机智狐", image: foxImg, accent: "#f97316", glow: "rgba(249, 115, 22, 0.25)" },
  { name: "暖心熊", image: bearImg, accent: "#ec4899", glow: "rgba(236, 72, 153, 0.25)" },
  { name: "织网蛛", image: spiderImg, accent: "#4f46e5", glow: "rgba(79, 70, 229, 0.22)" },
  { name: "夸夸豚", image: dolphinPraiseImg, accent: "#10b981", glow: "rgba(16, 185, 129, 0.22)" },
  { name: "太阳鸡", image: sunChickenImg, accent: "#facc15", glow: "rgba(250, 204, 21, 0.22)" },
  { name: "淡定海豚", image: dolphinImg, accent: "#0ea5e9", glow: "rgba(14, 165, 233, 0.22)" },
  { name: "沉思猫头鹰", image: owlImg, accent: "#8b5cf6", glow: "rgba(139, 92, 246, 0.22)" },
  { name: "稳如龟", image: turtleImg, accent: "#22c55e", glow: "rgba(34, 197, 94, 0.22)" },
  { name: "隐身猫", image: catImg, accent: "#64748b", glow: "rgba(100, 116, 139, 0.22)" },
  { name: "定心大象", image: elephantImg, accent: "#a855f7", glow: "rgba(168, 85, 247, 0.22)" },
  { name: "灵感章鱼", image: octopusImg, accent: "#06b6d4", glow: "rgba(6, 182, 212, 0.22)" },
];

export function getArchetypeIndex(name: string) {
  const normalized = name?.trim();
  const idx = ALL_ARCHETYPES.findIndex((item) => item.name === normalized);
  return idx >= 0 ? idx : 0;
}

export function getArchetypeByName(name?: string | null): ArchetypeData {
  const idx = getArchetypeIndex(name ?? "");
  return ALL_ARCHETYPES[idx] ?? ALL_ARCHETYPES[0];
}

let preloaded = false;
export function preloadArchetypeImages() {
  if (preloaded || typeof window === "undefined") return;
  preloaded = true;

  ALL_ARCHETYPES.forEach(({ image }) => {
    const img = new Image();
    img.src = image;
  });
}
