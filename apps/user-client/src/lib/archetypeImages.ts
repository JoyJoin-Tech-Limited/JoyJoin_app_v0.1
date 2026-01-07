import kaiXinKeJi from "@/assets/开心柯基_transparent_1.png";
import taiYangJi from "@/assets/太阳鸡_transparent_6.png";
import kuaKuaTun from "@/assets/夸夸豚_transparent_5.png";
import jiZhiHu from "@/assets/机智狐_transparent_2.png";
import danDingHaiTun from "@/assets/淡定海豚_transparent_7.png";
import zhiWangZhu from "@/assets/织网蛛_transparent_4.png";
import nuanXinXiong from "@/assets/暖心熊_transparent_3.png";
import lingGanZhangYu from "@/assets/灵感章鱼_transparent_12.png";
import chenSiMaoTouYing from "@/assets/沉思猫头鹰_transparent_8.png";
import dingXinDaXiang from "@/assets/定心大象_transparent_11.png";
import wenRuGui from "@/assets/稳如龟_transparent_9.png";
import yinShenMao from "@/assets/隐身猫_transparent_10.png";

export const ARCHETYPE_IMAGES: Record<string, string> = {
  "开心柯基": kaiXinKeJi,
  "太阳鸡": taiYangJi,
  "夸夸豚": kuaKuaTun,
  "机智狐": jiZhiHu,
  "淡定海豚": danDingHaiTun,
  "织网蛛": zhiWangZhu,
  "暖心熊": nuanXinXiong,
  "灵感章鱼": lingGanZhangYu,
  "沉思猫头鹰": chenSiMaoTouYing,
  "定心大象": dingXinDaXiang,
  "稳如龟": wenRuGui,
  "隐身猫": yinShenMao,
};

export function getArchetypeImage(archetype: string | null | undefined): string | null {
  if (!archetype) return null;
  return ARCHETYPE_IMAGES[archetype] || null;
}
