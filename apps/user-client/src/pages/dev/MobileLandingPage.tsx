/**
 * Mobile-First Landing Page
 * 
 * Implements the Mobile UI Design Specification with:
 * - 2x2 feature grid with tilted cards
 * - Mobile-optimized touch interactions
 * - Safe area support
 * - Gradient brand text
 * - Sticky primary CTA button
 * 
 * Based on: Mobile UI Design Specification
 * Route: /dev/mobile-landing (dev sandbox only)
 */

import { useLocation } from "wouter";
import MobileContainer from "@/components/mobile/MobileContainer";
import TiltedFeatureCard from "@/components/mobile/TiltedFeatureCard";
import MobilePrimaryButton from "@/components/mobile/MobilePrimaryButton";
import { Users, Brain, Sparkles, Gamepad2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useWeChatLogin } from "@/hooks/useWeChatLogin";

export default function MobileLandingPage() {
  const [, setLocation] = useLocation();
  const [agreed, setAgreed] = useState(false);
  const { toast } = useToast();
  const { handleWeChatLogin, isLoggingIn } = useWeChatLogin();

  // Feature cards configuration
  const features = [
    {
      id: 1,
      icon: <Users className="w-10 h-10 text-[#FF6B9D]" />,
      title: "4-6人智能匹配",
      description: "告别尴尬社交",
      tilt: -1.5,
    },
    {
      id: 2,
      icon: <Brain className="w-10 h-10 text-[#A86BFF]" />,
      title: "易图测试",
      description: "",
      tilt: 1.2,
    },
    {
      id: 3,
      icon: <Sparkles className="w-10 h-10 text-[#FF6B9D]" />,
      title: "算法匹配",
      description: "",
      tilt: 0.8,
    },
    {
      id: 4,
      icon: <Gamepad2 className="w-10 h-10 text-[#A86BFF]" />,
      title: "破冰游戏",
      description: "",
      tilt: -1.2,
    },
  ];

  const handleMainAction = () => {
    if (!agreed) {
      toast({
        title: "请先同意协议",
        description: "请阅读并同意用户协议和隐私政策",
        variant: "destructive",
      });
      return;
    }
    setLocation("/onboarding");
  };

  const handleLogin = () => {
    handleWeChatLogin();
  };

  const handleOpenAgreement = (type: 'user' | 'privacy') => {
    window.open(type === 'user' ? '/terms' : '/privacy', '_blank');
  };

  return (
    <MobileContainer className="bg-gradient-to-b from-[#FAFAFA] via-[#FFF5F7] to-[#FFE4E1] flex flex-col overflow-auto">
      {/* Brand Section */}
      <section className="flex-none text-center pt-8 pb-6">
        {/* Gradient Brand Text */}
        <h1
          className="text-5xl font-bold mb-3"
          style={{
            background: "linear-gradient(135deg, #FF6B9D, #A86BFF)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
          }}
        >
          JoyJoin
        </h1>
        
        {/* Tagline */}
        <p className="text-base text-gray-600 font-normal">
          悦聚，让对的相遇不再错过
        </p>
      </section>

      {/* Feature Grid (2x2) */}
      <section className="flex-1 flex items-center justify-center pb-4">
        <div className="w-full max-w-md grid grid-cols-2 gap-4 px-2">
          {features.map((feature) => (
            <TiltedFeatureCard
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
              tiltDegrees={feature.tilt}
            />
          ))}
        </div>
      </section>

      {/* Sticky Bottom Section */}
      <section className="flex-none space-y-4 pb-safe">
        {/* Primary CTA Button */}
        <MobilePrimaryButton
          onClick={handleMainAction}
          tiltDegrees={0.8}
        >
          看看我会遇见谁
        </MobilePrimaryButton>

        {/* Secondary Link */}
        <div className="text-center">
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="text-sm text-[#A86BFF] font-normal active:opacity-70 transition-opacity disabled:opacity-50"
          >
            {isLoggingIn ? "登录中..." : "已有账号登录"}
          </button>
        </div>

        {/* Legal Agreement */}
        <div className="flex items-start gap-2 px-4">
          <Checkbox
            id="agree"
            checked={agreed}
            onCheckedChange={(checked) => setAgreed(checked === true)}
            className="mt-0.5 min-w-[44px] min-h-[44px]"
          />
          <label
            htmlFor="agree"
            className="text-xs text-gray-600 leading-relaxed cursor-pointer select-none"
          >
            我已阅读并同意
            <button
              onClick={() => handleOpenAgreement('user')}
              className="text-[#A86BFF] mx-1 active:opacity-70"
            >
              《用户协议》
            </button>
            和
            <button
              onClick={() => handleOpenAgreement('privacy')}
              className="text-[#A86BFF] ml-1 active:opacity-70"
            >
              《隐私政策》
            </button>
          </label>
        </div>
      </section>
    </MobileContainer>
  );
}
