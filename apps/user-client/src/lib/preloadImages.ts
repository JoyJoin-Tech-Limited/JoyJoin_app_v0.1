import xiaoyueNormal from "@assets/Xiao_Yue_Avatar-01_1766766685652.png";
import xiaoyueExcited from "@assets/Xiao_Yue_Avatar-03_1766766685650.png";
import xiaoyuePointing from "@assets/Xiao_Yue_Avatar-04_1766766685649.png";
import xiaoyueFox from "@assets/Xiao_Yue_Avatar-06_1766766685632.png";

import corgiImg from '@assets/开心柯基_1763997660297.png';
import foxImg from '@assets/机智狐_1763997660293.png';
import bearImg from '@assets/暖心熊_1763997660292.png';
import dolphinImg from '@assets/淡定海豚_1763997660293.png';
import octopusImg from '@assets/灵感章鱼_1763997660292.png';
import owlImg from '@assets/沉思猫头鹰_1763997660294.png';
import spiderImg from '@assets/织网蛛_1763997660291.png';
import catImg from '@assets/隐身猫_1763997660297.png';

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
  dolphinImg,
  octopusImg,
  owlImg,
  spiderImg,
  catImg,
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
