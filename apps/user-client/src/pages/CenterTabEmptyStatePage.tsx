import { useLocation } from "wouter";
import { Sparkles } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import purpleGradientBg from "@/assets/empty state transition/purple gradient background.svg";
import giftBoxIllustration from "@/assets/empty state transition/gift box + animals 插画.svg";

const DISCOVER_ROUTE = "/discover";
const TITLE = "你还没参加任何活动";
const BODY = "去看看为你准备的活动\n也许下一次连接就从这里开始";
const CTA = "去发现活动";

export default function CenterTabEmptyStatePage() {
  const [, setLocation] = useLocation();

  const handleDiscoverClick = () => {
    setLocation(DISCOVER_ROUTE);
  };

  return (
    <div className="no-scroll-container relative bg-white">
      <img
        src={purpleGradientBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
      />

      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center px-6 pb-[calc(env(safe-area-inset-bottom,0px)+104px)] pt-12">
        <div className="w-full max-w-[320px]">
          <img
            src={giftBoxIllustration}
            alt="礼物盒和动物插画"
            className="h-auto w-full object-contain drop-shadow-xl"
          />
        </div>

        <div className="mt-8 w-full max-w-sm space-y-3 text-center">
          <h1 className="font-cn-display text-[26px] font-black leading-snug tracking-tight text-gray-900">
            {TITLE}
          </h1>
          <p className="whitespace-pre-line text-[15px] leading-7 text-gray-500">
            {BODY}
          </p>
        </div>

        <div className="mt-10 w-full max-w-sm">
          <Button
            onClick={handleDiscoverClick}
            size="lg"
            className="h-14 w-full rounded-full border-0 bg-gradient-to-r from-purple-600 to-pink-500 text-base font-semibold font-cn-display text-white shadow-lg shadow-purple-400/30 transition-all duration-200 hover:from-purple-700 hover:to-pink-600 active:scale-[0.98]"
            data-testid="center-empty-state-cta"
            aria-label="去发现活动"
          >
            <Sparkles className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            {CTA}
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
