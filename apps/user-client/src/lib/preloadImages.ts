import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";
import xiaoyueFox from "@assets/Xiao_Yue_Avatar-06_1766766685632.png";

import corgiImg from "@assets/开心柯基_transparent_1.png";
import foxImg from "@assets/机智狐_transparent_2.png";
import bearImg from "@assets/暖心熊_transparent_3.png";
import spiderImg from "@assets/织网蛛_transparent_4.png";
import pigImg from "@assets/夸夸豚_transparent_5.png";
import chickenImg from "@assets/太阳鸡_transparent_6.png";
import dolphinImg from "@assets/淡定海豚_transparent_7.png";
import owlImg from "@assets/沉思猫头鹰_transparent_8.png";
import turtleImg from "@assets/稳如龟_transparent_9.png";
import catImg from "@assets/隐身猫_transparent_10.png";
import elephantImg from "@assets/定心大象_transparent_11.png";
import octopusImg from "@assets/灵感章鱼_transparent_12.png";

const XIAOYUE_IMAGES = [
  xiaoyueNormal,
  xiaoyueExcited,
  xiaoyuePointing,
  xiaoyueFox,
];

const ARCHETYPE_IMAGES = [
  corgiImg,
  foxImg,
  bearImg,
  spiderImg,
  pigImg,
  chickenImg,
  dolphinImg,
  owlImg,
  turtleImg,
  catImg,
  elephantImg,
  octopusImg,
];

let preloaded = false;

export function preloadXiaoyueImages(): void {
  if (typeof window === 'undefined') return;
  if (preloaded) return;
  preloaded = true;
  
  const allImages = [...XIAOYUE_IMAGES, ...ARCHETYPE_IMAGES];
  
  allImages.forEach((src) => {
    const img = new Image();
    img.src = src;
  });
}

export function preloadCriticalImages(): void {
  if (preloaded) return;
  preloaded = true;
  
  XIAOYUE_IMAGES.forEach((src) => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = src;
    document.head.appendChild(link);
  });
}
