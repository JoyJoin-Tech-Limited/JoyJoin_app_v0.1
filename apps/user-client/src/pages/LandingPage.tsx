/**
 * Landing Page V2 — Maximum Impact
 *
 * Route: / (default for unauthenticated users)
 * Updated: 2026-03-26 (V2: Duolingo-style CTAs, 3-card hero, sticky bottom zone)
 *
 * Features:
 * - 3-card stacked hero illustration (匹配 → 悦聚 → 延续)
 * - Gradient headline with ZCOOL QingKe HuangYou font
 * - 3 pill-shaped feature badges
 * - Primary CTA: Duolingo 3D press shadow, h-16, "看看我会遇见谁" → /personality-test
 * - Secondary CTA: text link "已有账号？登录" → WeChat OAuth
 * - Sticky bottom CTA zone with env(safe-area-inset-bottom)
 * - WeChat WebView safe (no backdrop-filter, no hover states, touch-action manipulation)
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useWeChatLogin } from "@/hooks/useWeChatLogin";
import logoImage from "@/assets/box_logo_archetypes.png";
import matchCardImg from "@/assets/landing screen/匹配卡片.png";
import dinnerImg from "@/assets/landing screen/动物聚餐.png";
import continueImg from "@/assets/landing screen/动物延续.png";

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin();

  const handlePrimaryCTA = () => {
    console.log('[Analytics] Landing: Primary CTA clicked');
    localStorage.removeItem("joyjoin_v4_assessment_session");
    localStorage.removeItem("joyjoin_v4_presignup_answers");
    localStorage.removeItem("joyjoin_synced_session_id");
    localStorage.removeItem("joyjoin_synced_answer_count");
    setLocation('/personality-test');
  };

  const handleSecondaryCTA = () => {
    console.log('[Analytics] Landing: Secondary CTA clicked');
    handleWeChatLogin();
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.dataset.fallbackApplied === "true") return;
    img.dataset.fallbackApplied = "true";
    img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='100%25' height='100%25' fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='20'%3EImage unavailable%3C/text%3E%3C/svg%3E";
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center"
      style={{
        fontFamily: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
        backgroundImage:
          "linear-gradient(180deg, #FFF0E8 0%, #F5E6FF 35%, #EDE4FF 55%, #F8F4FF 80%, #FFFBF9 100%)," +
          "radial-gradient(circle at 20% 15%, rgba(255, 200, 160, 0.5), transparent 55%)," +
          "radial-gradient(circle at 80% 10%, rgba(200, 170, 255, 0.5), transparent 50%)," +
          "radial-gradient(circle at 50% 60%, rgba(255, 200, 230, 0.35), transparent 55%)",
        backgroundBlendMode: "normal, screen, screen, screen",
        overflowX: "hidden",
      }}
    >
      {/* Scrollable content zone */}
      <div
        className="flex-1 flex flex-col items-center w-full max-w-sm mx-auto px-5"
        style={{ paddingTop: "calc(2rem + env(safe-area-inset-top))" }}
      >
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-white/40 rounded-3xl"
              style={{ filter: "blur(16px)" }}
            />
            <img
              src={logoImage}
              alt="悦聚 Logo"
              className="relative w-20 h-20 object-contain drop-shadow-xl"
              loading="eager"
              onError={handleImageError}
            />
          </div>
        </div>

        {/* 3-Card Hero */}
        <div
          className="relative w-full"
          style={{ height: "min(52vw, 260px)" }}
          aria-label="三张活动卡片展示"
        >
          {/* SVG dashed orbit circles */}
          <svg
            className="absolute inset-0 pointer-events-none z-0"
            viewBox="0 0 400 280"
            aria-hidden="true"
          >
            <circle
              cx={115}
              cy={110}
              r={95}
              stroke="#D4B8FF"
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="6 5"
            />
            <circle
              cx={285}
              cy={210}
              r={95}
              stroke="#D4B8FF"
              strokeWidth={1.5}
              fill="none"
              strokeDasharray="6 5"
            />
          </svg>

          {/* Left card — 匹配 */}
          <div
            className="absolute left-0 top-0 z-10 w-[30vw] max-w-[130px] rounded-2xl shadow-lg border-[3px] border-[#F28B82] bg-[#F28B82] flex flex-col p-[3px] overflow-hidden"
          >
            <div className="aspect-square w-full overflow-hidden rounded-[11px]">
              <img
                src={matchCardImg}
                alt="匹配"
                className="w-full h-full object-cover block"
                loading="eager"
                onError={handleImageError}
              />
            </div>
            <div className="py-1.5 text-center rounded-b-[11px]">
              <span className="text-[14px] font-bold text-white drop-shadow-sm">匹配</span>
            </div>
          </div>

          {/* Centre card — 悦聚 */}
          <div
            className="absolute left-1/2 top-[8%] -translate-x-1/2 z-20 w-[40vw] max-w-[170px] rounded-2xl shadow-lg border-[3px] border-[#C9956B] bg-[#C9956B] flex flex-col p-[3px] overflow-hidden"
          >
            <div className="aspect-square w-full overflow-hidden rounded-[11px]">
              <img
                src={dinnerImg}
                alt="悦聚"
                className="w-full h-full object-cover block"
                loading="eager"
                onError={handleImageError}
              />
            </div>
            <div className="py-1.5 text-center rounded-b-[11px]">
              <span className="text-[14px] font-bold text-white drop-shadow-sm">悦聚</span>
            </div>
          </div>

          {/* Right card — 延续 */}
          <div
            className="absolute right-0 bottom-0 z-10 w-[30vw] max-w-[130px] rounded-2xl shadow-lg border-[3px] border-[#7ECFB3] bg-[#7ECFB3] flex flex-col p-[3px] overflow-hidden"
          >
            <div className="aspect-square w-full overflow-hidden rounded-[11px]">
              <img
                src={continueImg}
                alt="延续"
                className="w-full h-full object-cover block"
                loading="eager"
                onError={handleImageError}
              />
            </div>
            <div className="py-1.5 text-center rounded-b-[11px]">
              <span className="text-[14px] font-bold text-[#134A3E] drop-shadow-sm">延续</span>
            </div>
          </div>
        </div>

        {/* Headline, subtitle and pill badges */}
        <div className="w-full text-center mt-6 space-y-3">
          <h1
            style={{
              background: "linear-gradient(135deg, #7C3AED 0%, #C060FF 40%, #FF6BAE 70%, #FFA64D 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontFamily: '"ZCOOL QingKe HuangYou", "Noto Sans SC", sans-serif',
              fontSize: "clamp(30px, 9vw, 38px)",
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            让对的相遇不再错过
          </h1>
          <p className="text-[15px] text-[#7B6A96] text-center leading-relaxed max-w-[300px] mx-auto">
            通过氛围测试，找到你的氛围原型，遇见志同道合的ta
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {["🧠 氛围测试", "🎯 算法匹配", "👥 4-6人局"].map((label) => (
              <span
                key={label}
                className="bg-white/60 rounded-full px-3 py-1 text-[13px] font-semibold text-[#5A4A7A] shadow-sm"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Spacer so content doesn't hide behind sticky CTA */}
        <div className="h-40" />
      </div>

      {/* Sticky bottom CTA zone */}
      <section
        className="fixed bottom-0 left-0 right-0 flex justify-center pointer-events-none"
      >
        <div
          className="w-full max-w-sm mx-auto px-5 space-y-3 pointer-events-auto"
          style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
        >
          {/* Primary CTA — Duolingo 3D press */}
          <Button
            onClick={handlePrimaryCTA}
            size="lg"
            className="w-full h-16 rounded-2xl text-white text-xl font-bold border-0 transition-all duration-75 ease-in-out active:translate-y-[4px] active:shadow-[0_2px_0_#5a1fb5]"
            style={{
              background: "linear-gradient(135deg, #8B5CFF 0%, #C471FF 100%)",
              boxShadow: "0 6px 0 #5a1fb5",
              touchAction: "manipulation",
            }}
          >
            看看我会遇见谁
          </Button>

          {/* Secondary CTA — text link */}
          <button
            onClick={handleSecondaryCTA}
            disabled={isLoggingIn}
            aria-label="已有账号，点击登录"
            className="w-full py-2 text-[#6B5B8D] text-base font-medium underline underline-offset-4 disabled:opacity-50 transition-opacity"
            style={{ touchAction: "manipulation", background: "none", border: "none" }}
          >
            {isLoggingIn ? "登录中..." : "已有账号？登录"}
          </button>

          {/* Legal footer */}
          <p
            className="text-center text-[11px] text-[#8B7AAD]"
            style={{ fontFamily: '"Noto Sans SC", system-ui, sans-serif' }}
          >
            我已阅读并同意
            <a
              href="/terms"
              className="underline text-[#6B5B8D]"
              onClick={() => console.log('[Analytics] Landing: Terms clicked')}
            >
              《用户协议》
            </a>
            和
            <a
              href="/privacy"
              className="underline text-[#6B5B8D]"
              onClick={() => console.log('[Analytics] Landing: Privacy clicked')}
            >
              《隐私政策》
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
