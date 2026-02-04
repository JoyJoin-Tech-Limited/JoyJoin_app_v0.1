/**
 * Static Landing Page
 * 
 * Fixed viewport landing screen with no scroll required.
 * Features:
 * - 4 tilted photo tiles using modular config
 * - Brand logo with ZCOOL QingKe HuangYou font
 * - 3 feature tags
 * - Primary CTA: "看看我会遇见谁" → /personality-test (Option B: Post-Test Signup)
 * - Secondary CTA: "已有账号登录" → /login
 * - Legal footer links
 * 
 * Route: /
 * Updated: 2026-02-04 (Post-Test Signup Flow)
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_Chinese_FuLuDouTi.png";
import { landingImages } from "@/config/landingImages";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  // Primary CTA handler - go directly to personality test (no login required)
  const handlePrimaryCTA = () => {
    console.log('[Analytics] Landing: Primary CTA clicked');
    // Option B: Post-Test Signup - show value (personality test) before asking for signup
    setLocation('/personality-test');
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
      className="fixed inset-0 overflow-hidden bg-gradient-to-b from-[#FFF5F7] via-[#FFF0F5] to-[#FFE4E1] flex flex-col"
      style={{
        minHeight: '100vh',
        height: '100dvh',
      }}
    >
      {/* Top section: Photo tiles */}
      <section className="flex-none px-4 pt-6 sm:pt-8" aria-label="精选活动照片">
        <div className="max-w-sm mx-auto">
          {/* 2x2 grid of tilted photo tiles */}
          <div className="grid grid-cols-2 gap-3">
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
                  onError={handleImageError}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Middle section: Logo, title, tags - takes remaining space */}
      <section className="flex-1 flex flex-col justify-center px-4 pt-4" aria-label="品牌介绍">
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
          <div className="flex flex-wrap justify-center gap-2">
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
      </section>

      {/* Bottom section: CTAs and footer */}
      <section className="flex-none px-4 pb-6 sm:pb-8" aria-label="行动按钮">
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
          <footer className="pt-2 text-center text-xs text-gray-500">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                console.log('[Analytics] Landing: Privacy policy clicked');
                window.open('/privacy', '_blank');
              }}
              className="hover:text-pink-600 transition-colors"
              aria-label="查看隐私政策"
            >
              隐私政策
            </a>
            <span className="mx-2">·</span>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                console.log('[Analytics] Landing: Terms of service clicked');
                window.open('/terms', '_blank');
              }}
              className="hover:text-pink-600 transition-colors"
              aria-label="查看用户协议"
            >
              用户协议
            </a>
          </footer>
        </div>
      </section>
    </main>
  );
}
