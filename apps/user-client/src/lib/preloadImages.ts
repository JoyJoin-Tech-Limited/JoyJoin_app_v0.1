// Only import the Xiaoyue mascot images needed on the critical path
// (used in PersonalityTestPageV4 and onboarding flows).
// Archetype images are intentionally NOT imported or preloaded here.
// They are fetched on demand by the components that use them (e.g. DiscoverPage,
// MatchingStatusPage, PoolGroupDetailPage, etc.), so we avoid preloading
// the full archetype set at startup.
import xiaoyueNormal from "@/assets/Xiao_Yue_Avatar-01.png";
import xiaoyueExcited from "@/assets/Xiao_Yue_Avatar-03.png";
import xiaoyuePointing from "@/assets/Xiao_Yue_Avatar-04.png";
import xiaoyueFox from "@/assets/Xiao_Yue_Avatar-06.png";

const XIAOYUE_IMAGES = [
  xiaoyueNormal,
  xiaoyueExcited,
  xiaoyuePointing,
  xiaoyueFox,
];

let preloaded = false;

export function preloadXiaoyueImages(): void {
  if (typeof window === 'undefined') return;
  if (preloaded) return;
  preloaded = true;

  // Only preload the 4 Xiaoyue mascot images used on the critical onboarding path.
  XIAOYUE_IMAGES.forEach((src) => {
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
