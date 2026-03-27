import { useEffect } from "react";
import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import purpleGradientBg from "@/assets/empty state transition/purple gradient background.svg";
import giftBoxIllustration from "@/assets/empty state transition/gift box + animals 插画.svg";
import { CENTER_TAB_EMPTY_STATE_ROUTE, DISCOVER_ROUTE } from "@/lib/centerTabRouting";

const TITLE = "你还没参加任何活动";
const BODY = "去看看为你准备的活动\n也许下一次连接就从这里开始";
const CTA = "去发现活动";

export default function CenterTabEmptyStatePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("[Analytics] center_tab_empty_state_viewed", {
      route: CENTER_TAB_EMPTY_STATE_ROUTE,
    });
  }, []);

  const handleDiscoverClick = () => {
    console.log("[Analytics] center_tab_empty_state_cta_tapped", {
      destination: DISCOVER_ROUTE,
    });
    setLocation(DISCOVER_ROUTE);
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-white">
      {/* Background layer — soft purple glow */}
      <img
        src={purpleGradientBg}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover select-none"
      />

      {/* Foreground content */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+88px)] pt-16">
        {/* Hero illustration */}
        <div className="w-full max-w-[320px]">
          <img
            src={giftBoxIllustration}
            alt="礼物盒和动物插画"
            className="w-full h-auto object-contain drop-shadow-xl"
          />
        </div>

        {/* Text block */}
        <div className="mt-8 w-full max-w-sm text-center space-y-3">
          <h1 className="text-[26px] font-black leading-snug tracking-tight text-gray-900">
            {TITLE}
          </h1>
          <p className="whitespace-pre-line text-[15px] leading-7 text-gray-500">
            {BODY}
          </p>
        </div>

        {/* CTA */}
        <div className="mt-10 w-full max-w-sm">
          <Button
            onClick={handleDiscoverClick}
            size="lg"
            className="relative w-full h-14 rounded-full text-base font-semibold text-white border-0 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 shadow-lg shadow-purple-400/30 transition-all duration-200 active:scale-[0.98]"
            data-testid="center-empty-state-cta"
            aria-label="去发现活动"
          >
            <Sparkles className="h-4 w-4 mr-2 shrink-0" aria-hidden="true" />
            {CTA}
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
