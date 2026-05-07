import kaiXinKeJi from "@/assets/corgi_transparent_1.png";
import taiYangJi from "@/assets/rooster_transparent_6.png";
import kuaKuaTun from "@/assets/hamster_praise_transparent_5.png";
import jiZhiHu from "@/assets/fox_transparent_2.png";
import danDingHaiTun from "@/assets/dolphin_calm_transparent_7.png";
import zhiWangZhu from "@/assets/spider_transparent_4.png";
import nuanXinXiong from "@/assets/koala_transparent_3.png";
import lingGanZhangYu from "@/assets/octopus_transparent_12.png";
import chenSiMaoTouYing from "@/assets/owl_transparent_8.png";
import dingXinDaXiang from "@/assets/elephant_transparent_11.png";
import wenRuGui from "@/assets/turtle_transparent_9.png";
import yinShenMao from "@/assets/cat_transparent_10.png";

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
