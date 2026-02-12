/**
 * Static Landing Page
 * 
 * Fixed viewport landing screen with no scroll required.
 * Features:
 * - 4 tilted photo tiles using modular config
 * - Brand logo with ZCOOL QingKe HuangYou font
 * - 3 feature tags
 * - Primary CTA: "看看我会遇见谁" → /onboarding (8 anchor questions)
 * - Secondary CTA: "已有账号登录" → /login
 * - Legal footer links
 * 
 * Route: /
 * Updated: 2026-02-12 (Onboarding First Flow)
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import logoImage from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";

// Import landing screen images
import malePortrait from "@/assets/landing screen/男生单人.png";
import femalePortrait from "@/assets/landing screen/女生单人.png";
import diningScene from "@/assets/landing screen/聚餐.png";
import drinkingScene from "@/assets/landing screen/酒局.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  // Inline image array
  const landingImages = [
    { src: malePortrait, alt: "男生单人", rotation: -8, translateY: 10 },
    { src: diningScene, alt: "朋友聚餐", rotation: 5, translateY: 20 },
    { src: drinkingScene, alt: "酒局现场", rotation: 6, translateY: -15 },
    { src: femalePortrait, alt: "女生单人", rotation: -5, translateY: -10 },
  ];

  // Primary CTA handler - go to onboarding (8 anchor questions)
  const handlePrimaryCTA = () => {
    console.log('[Analytics] Landing: Primary CTA clicked');
    // Direct to onboarding (8 anchor questions) first
    setLocation('/onboarding');
  };

  // Secondary CTA handler - go to login
  const handleSecondaryCTA = () => {
    console.log('[Analytics] Landing: Secondary CTA clicked');
    setLocation('/login');
  };

  // Image error handler
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";
    img.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='20'%3EImage unavailable%3C/text%3E%3C/svg%3E";
  };

  return (
    <main 
      className="min-h-screen bg-gradient-to-b from-[#FFF5F7] via-[#FFF0F5] to-[#FFE4E1] flex flex-col items-center justify-between overflow-hidden px-6 pt-4 pb-8"
    >
      {/* Top section: Photo tiles */}
      <section className="flex-none pt-6 sm:pt-8" aria-label="精选活动照片">
        <div className="max-w-sm mx-auto">
          {/* 2x2 grid of tilted photo tiles */}
          <div className="grid grid-cols-2 gap-3">
            {landingImages.map((image, index) => (
              <div
                key={index}
                className="relative rounded-2xl overflow-hidden shadow-lg aspect-[4/5] bg-white p-1"
              >
                <div
                  className="w-full h-full transition-transform duration-200 hover:scale-[1.02]"
                  style={{
                    transform: `rotate(${image.rotation}deg) translateY(${image.translateY}px)`,
                  }}
                >
                  <img 
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover rounded-xl filter sepia-[.15] contrast-110" 
                    loading="eager"
                    onError={handleImageError}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Middle section: Logo, title, tags - takes remaining space */}
      <section className="flex-1 flex flex-col justify-center pt-4" aria-label="品牌介绍">
        <div className="max-w-sm mx-auto w-full text-center">
          {/* Logo with floating animation and glow effect */}
          <div className="w-24 h-24 relative animate-float mx-auto mb-4">
            <div className="absolute inset-0 bg-white/40 backdrop-blur-sm rounded-full blur-xl transform scale-150"></div>
            <div className="relative w-full h-full flex items-center justify-center">
              <img 
                src={logoImage} 
                alt="悦聚 Logo" 
                className="h-20 w-auto object-contain drop-shadow-xl"
              />
            </div>
          </div>

          {/* Brand title with gradient */}
          <h1 
            className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-violet-600 to-purple-500 mb-2 leading-tight drop-shadow-sm"
            style={{ fontFamily: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif' }}
          >
            让对的相遇<br/>不再错过
          </h1>

          {/* Feature Icons */}
          <div className="flex items-center justify-center space-x-6 w-full px-4 mt-4">
            <div className="text-purple-900/70 font-medium text-sm text-center">
              <span className="block mb-1 opacity-80 text-lg">🧠</span>
              氛围测试
            </div>
            <div className="text-purple-900/70 font-medium text-sm text-center">
              <span className="block mb-1 opacity-80 text-lg">🎯</span>
              算法匹配
            </div>
            <div className="text-purple-900/70 font-medium text-sm text-center">
              <span className="block mb-1 opacity-80 text-lg">👥</span>
              4-6人局
            </div>
          </div>
        </div>
      </section>

      {/* Bottom section: CTAs and footer */}
      <section className="flex-none pb-6 sm:pb-8" aria-label="行动按钮">
        <div className="max-w-sm mx-auto space-y-3">
          {/* Primary CTA */}
          <Button
            onClick={handlePrimaryCTA}
            size="lg"
            className="w-full h-14 bg-gradient-to-r from-[#FF1493] to-[#FF69B4] hover:from-[#E6007E] hover:to-[#FF1493] text-white text-lg font-semibold shadow-lg transition-all duration-200 motion-reduce:transition-none motion-reduce:active:scale-100 active:scale-[0.98] border-0"
          >
            看看我会遇见谁
          </Button>

          {/* Secondary CTA */}
          <Button
            onClick={handleSecondaryCTA}
            variant="outline"
            size="lg"
            className="w-full h-12 border-2 border-pink-200 hover:border-pink-300 hover:bg-pink-50 text-pink-600 font-medium transition-all duration-200 motion-reduce:transition-none motion-reduce:active:scale-100 active:scale-[0.98]"
          >
            已有账号登录
          </Button>

          {/* Legal footer */}
          <div className="text-center mt-4">
            <p className="text-[10px] text-gray-500">
              我已阅读并同意
              <a 
                className="font-bold underline text-gray-700 hover:text-pink-600 transition-colors" 
                href="/terms" 
                aria-label="查看用户协议"
                onClick={() => console.log('[Analytics] Landing: Terms of service clicked')}
              >
                《用户协议》
              </a>
              和
              <a 
                className="font-bold underline text-gray-700 hover:text-pink-600 transition-colors" 
                href="/privacy" 
                aria-label="查看隐私政策"
                onClick={() => console.log('[Analytics] Landing: Privacy policy clicked')}
              >
                《隐私政策》
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
