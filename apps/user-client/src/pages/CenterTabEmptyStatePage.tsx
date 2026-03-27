import { useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";

const TITLE = "你还没参加任何活动";
const BODY = "去看看为你准备的活动，也许下一次连接就从这里开始。";
const CTA = "去发现活动";

export default function CenterTabEmptyStatePage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    console.log("[Analytics] center_tab_empty_state_viewed", {
      route: "/center-tab/empty",
    });
  }, []);

  const handleDiscoverClick = () => {
    console.log("[Analytics] center_tab_empty_state_cta_tapped", {
      destination: "/discover",
    });
    setLocation("/discover");
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-[linear-gradient(180deg,_#F5F1E8_0%,_#FFFFFF_48%,_#FFFFFF_100%)]">
      <MobileHeader showLogo />

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full border border-primary/10 bg-white shadow-[0_18px_45px_rgba(139,92,246,0.14)]">
            <div className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_top,_rgba(255,155,133,0.22),_rgba(139,92,246,0.08)_55%,_transparent_80%)]" />
            <img
              src={joyJoinLogo}
              alt="JoyJoin"
              className="relative h-20 w-20 object-contain"
            />
            <div className="absolute -right-1 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#FF9B85] text-white shadow-lg">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-[28px] font-black leading-tight text-foreground">{TITLE}</h1>
            <p className="text-sm leading-6 text-muted-foreground">{BODY}</p>
          </div>

          <Button
            onClick={handleDiscoverClick}
            size="lg"
            className="w-full min-h-12 rounded-2xl text-base font-semibold shadow-lg shadow-primary/20"
            data-testid="center-empty-state-cta"
          >
            {CTA}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
