/**
 * Static Landing Page
 * 
 * Fixed viewport landing screen with no scroll required.
 * Features:
 * - 4 tilted photo tiles using modular config
 * - Brand logo with ZCOOL QingKe HuangYou font
 * - 3 feature tags
 * - Primary CTA: "看看我会遇见谁" → /onboarding
 * - Secondary CTA: "已有账号登录" → /login
 * - Legal footer links
 * 
 * Route: /
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_Chinese_FuLuDouTi.png";
import { landingImages } from "@/config/landingImages";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  // Primary CTA handler - go to onboarding (first 8 anchor questions)
  const handlePrimaryCTA = () => {
    console.log('[Analytics] Landing: Primary CTA clicked');
    setLocation('/onboarding');
  };

  // Secondary CTA handler - go to login
  const handleSecondaryCTA = () => {
    console.log('[Analytics] Landing: Secondary CTA clicked');
    setLocation('/login');
  };

  // Footer link handlers
  const handlePrivacyPolicy = () => {
    console.log('[Analytics] Landing: Privacy policy clicked');
    window.open('/privacy', '_blank');
  };

  const handleTermsOfService = () => {
    console.log('[Analytics] Landing: Terms of service clicked');
    window.open('/terms', '_blank');
  };

  return (
    <div 
      className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#FFF5F7] via-[#FFF0F5] to-[#FFE4E1] flex flex-col"
      style={{
        height: '100dvh',
      }}
    >
      {/* Main content container */}
      
      {/* Top section: Photo tiles */}
      <div className="flex-none px-4 pt-6 sm:pt-8">
        <div className="max-w-sm mx-auto">
          {/* 2x2 grid of tilted photo tiles */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {landingImages.map((image) => (
              <div
                key={image.id}
                className="relative aspect-square overflow-hidden rounded-2xl shadow-lg"
                style={{
                  transform: `rotate(${image.rotation || 0}deg)`,
                }}
              >
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Middle section: Logo, title, tags - takes remaining space */}
      <div className="flex-1 flex flex-col justify-center px-4 -mt-8">
        <div className="max-w-sm mx-auto w-full text-center">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <img 
              src={joyJoinLogo}
              alt="悦聚 JoyJoin"
              className="h-16 w-auto"
            />
          </div>

          {/* Brand title with ZCOOL QingKe HuangYou font */}
          <h1 
            className="text-4xl font-bold mb-6 leading-tight"
            style={{
              fontFamily: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
              color: '#FF1493',
            }}
          >
            让陌生相遇<br />不再尴尬
          </h1>

          {/* Three feature tags */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <Badge 
              variant="outline" 
              className="px-3 py-1.5 bg-white/80 border-pink-200 text-pink-600 text-sm font-medium"
            >
              氛围测试
            </Badge>
            <Badge 
              variant="outline" 
              className="px-3 py-1.5 bg-white/80 border-pink-200 text-pink-600 text-sm font-medium"
            >
              算法匹配
            </Badge>
            <Badge 
              variant="outline" 
              className="px-3 py-1.5 bg-white/80 border-pink-200 text-pink-600 text-sm font-medium"
            >
              4-6人局
            </Badge>
          </div>
        </div>
      </div>

      {/* Bottom section: CTAs and footer */}
      <div className="flex-none px-4 pb-6 sm:pb-8">
        <div className="max-w-sm mx-auto space-y-3">
          {/* Primary CTA */}
          <Button
            onClick={handlePrimaryCTA}
            size="lg"
            className="w-full h-14 bg-gradient-to-r from-[#FF1493] to-[#FF69B4] hover:from-[#E6007E] hover:to-[#FF1493] text-white text-lg font-semibold shadow-lg transition-all duration-200 active:scale-[0.98] border-0"
          >
            看看我会遇见谁
          </Button>

          {/* Secondary CTA */}
          <Button
            onClick={handleSecondaryCTA}
            variant="outline"
            size="lg"
            className="w-full h-12 border-2 border-pink-200 hover:border-pink-300 hover:bg-pink-50 text-pink-600 font-medium transition-all duration-200 active:scale-[0.98]"
          >
            已有账号登录
          </Button>

          {/* Legal footer */}
          <div className="pt-2 text-center text-xs text-gray-500">
            <button
              onClick={handlePrivacyPolicy}
              className="hover:text-pink-600 transition-colors"
            >
              隐私政策
            </button>
            <span className="mx-2">·</span>
            <button
              onClick={handleTermsOfService}
              className="hover:text-pink-600 transition-colors"
            >
              用户协议
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
