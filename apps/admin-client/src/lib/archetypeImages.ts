import kaiXinKeJi from "@assets/corgi_transparent_1_1765650619462.png";
import taiYangJi from "@assets/rooster_transparent_6_1765650619458.png";
import kuaKuaTun from "@assets/hamster_praise_transparent_5_1765650619478.png";
import jiZhiHu from "@assets/fox_transparent_2_1765650619453.png";
import danDingHaiTun from "@assets/dolphin_calm_transparent_7_1765650619477.png";
import zhiWangZhu from "@assets/spider_transparent_4_1765650619463.png";
import nuanXinXiong from "@assets/koala_transparent_3_1765741025689.png";
import lingGanZhangYu from "@assets/octopus_transparent_12_1765650619464.png";
import chenSiMaoTouYing from "@assets/owl_transparent_8_1765650619459.png";
import dingXinDaXiang from "@assets/elephant_transparent_11_1765650619460.png";
import wenRuGui from "@assets/turtle_transparent_9_1765650619461.png";
import yinShenMao from "@assets/cat_transparent_10_1765650619464.png";

export const ARCHETYPE_IMAGES: Record<string, string> = {
  "corgi": kaiXinKeJi,
  "rooster": taiYangJi,
  "hamster_praise": kuaKuaTun,
  "fox": jiZhiHu,
  "dolphin_calm": danDingHaiTun,
  "spider": zhiWangZhu,
  "koala": nuanXinXiong,
  "octopus": lingGanZhangYu,
  "owl": chenSiMaoTouYing,
  "elephant": dingXinDaXiang,
  "turtle": wenRuGui,
  "cat": yinShenMao,
};

export function getArchetypeImage(archetype: string | null | undefined): string | null {
  if (!archetype) return null;
  return ARCHETYPE_IMAGES[archetype] || null;
}
