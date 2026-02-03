import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Check, Zap, ArrowRight, Sparkles } from "lucide-react";
import joyJoinLogo from "@/assets/box_logo_archetypes.png";
import { useAuth } from "@/hooks/useAuth";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

// Design system tokens (matching requirement specifications)
const DESIGN_TOKENS = {
  colors: {
    primary: '#8B5CF6',    // Purple
    secondary: '#EC4899',  // Pink
    accent: '#F59E0B',     // Amber
  },
  spacing: {
    xs: '8px',
    sm: '16px',
    md: '24px',
    lg: '32px',
    xl: '48px',
    '2xl': '64px',
  },
};

// Sample photos for social proof grid (placeholder paths - to be replaced with actual assets)
const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop',
];

interface LandingPageData {
  photoLoaded: boolean[];
  userCount: number;
}

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, nextStep } = useAuth();
  const [data, setData] = useState<LandingPageData>({
    photoLoaded: new Array(8).fill(false),
    userCount: 12847,
  });

  // Track analytics on mount
  useEffect(() => {
    // Track page view
    console.log('[Analytics] Landing page view');
    const startTime = Date.now();

    // Track time spent
    return () => {
      const timeSpent = Date.now() - startTime;
      console.log('[Analytics] Landing page exit', { timeSpentMs: timeSpent });
    };
  }, []);

  // Handle photo load
  const handlePhotoLoad = (index: number) => {
    setData(prev => ({
      ...prev,
      photoLoaded: prev.photoLoaded.map((loaded, i) => i === index ? true : loaded)
    }));
  };

  // Primary CTA handler
  const handleStartMatching = () => {
    console.log('[Analytics] tap_create_room');
    
    if (!isAuthenticated) {
      // Not logged in - go to onboarding
      setLocation('/onboarding');
      return;
    }

    // Use server-driven navigation
    if (nextStep && nextStep !== 'discover') {
      // User needs to complete onboarding
      const routeMap = {
        'onboarding': '/onboarding',
        'personality-test': '/personality-test',
        'essential-data': '/onboarding/setup',
        'guide': '/guide',
        'discover': '/discover',
      };
      setLocation(routeMap[nextStep as keyof typeof routeMap] || '/onboarding');
    } else {
      // User is fully onboarded - go to discover
      setLocation('/discover');
    }
  };

  // Secondary CTA handler
  const handleJoinWithCode = () => {
    console.log('[Analytics] tap_join_room');
    setLocation('/invite');
  };

  // Footer link handlers
  const handlePrivacyPolicy = () => {
    console.log('[Analytics] tap_privacy_policy');
    // Navigate to privacy policy page (to be implemented)
    window.open('/privacy', '_blank');
  };

  const handleTermsOfService = () => {
    console.log('[Analytics] tap_terms_of_service');
    // Navigate to terms page (to be implemented)
    window.open('/terms', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF5FF] via-[#FEF3F8] to-[#FFFBEB] overflow-hidden">
      {/* Hero Section */}
      <section className="relative px-4 pt-12 pb-8 text-center">
        {/* Floating Logo */}
        <motion.div
          className="flex justify-center mb-4"
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            ease: "easeInOut",
            repeat: Infinity,
          }}
        >
          <img 
            src={joyJoinLogo}
            alt="悦聚 Logo"
            className="h-[120px] w-auto drop-shadow-lg"
          />
        </motion.div>

        {/* Brand Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base text-muted-foreground mb-4"
        >
          真实社交·有趣相遇
        </motion.p>

        {/* Main Heading with Gradient */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl font-bold mb-4 leading-tight bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent"
          style={{
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          让陌生相遇<br />不再尴尬
        </motion.h1>

        {/* Sub-heading */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-lg text-foreground/80 mb-8"
        >
          AI智能匹配，4-6人小局，告别尬聊
        </motion.p>
      </section>

      {/* Social Proof Section */}
      <section className="px-4 pb-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="max-w-lg mx-auto"
        >
          {/* Photo Grid */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {SAMPLE_PHOTOS.map((photo, index) => (
              <div key={index} className="relative aspect-square rounded-2xl overflow-hidden">
                {/* Skeleton loader */}
                {!data.photoLoaded[index] && (
                  <div 
                    className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse"
                    style={{
                      animation: 'shimmer 1.5s infinite',
                      backgroundSize: '200% 100%',
                    }}
                  />
                )}
                {/* Actual image */}
                <motion.img
                  src={photo}
                  alt={`User ${index + 1}`}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: data.photoLoaded[index] ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  onLoad={() => handlePhotoLoad(index)}
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* Social Proof Text */}
          <p className="text-center text-sm text-muted-foreground">
            已有{' '}
            <span className="font-bold text-primary text-base">
              {data.userCount.toLocaleString()}
            </span>{' '}
            人完成匹配
          </p>
        </motion.div>
      </section>

      {/* Primary Actions */}
      <section className="px-4 pb-6">
        <div className="max-w-md mx-auto space-y-4">
          {/* Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Button
              onClick={handleStartMatching}
              size="lg"
              className="w-full min-h-[112px] bg-gradient-to-r from-[#8B5CF6] to-[#A855F7] hover:from-[#7C3AED] hover:to-[#9333EA] text-white text-lg font-semibold shadow-[0_8px_32px_rgba(139,92,246,0.2)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.3)] transition-all duration-200 active:scale-[0.98] border-0 flex flex-col items-center justify-center gap-2"
            >
              <span className="flex items-center gap-2">
                开始匹配
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="text-sm text-white/80 font-normal">
                AI为你推荐合适的人
              </span>
            </Button>
          </motion.div>

          {/* Secondary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              onClick={handleJoinWithCode}
              variant="outline"
              size="lg"
              className="w-full min-h-[88px] border-2 border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-accent/5 text-foreground font-medium transition-all duration-200 active:scale-[0.98]"
            >
              已有邀请码？立即加入
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="px-4 pb-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex items-center justify-center gap-6 flex-wrap"
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 text-primary" />
            <span>实名认证</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="h-4 w-4 text-primary" />
            <span>隐私保护</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            <span>即时匹配</span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-3 mb-2">
          <button
            onClick={handlePrivacyPolicy}
            className="hover:text-primary transition-colors"
          >
            隐私政策
          </button>
          <span>·</span>
          <button
            onClick={handleTermsOfService}
            className="hover:text-primary transition-colors"
          >
            用户协议
          </button>
        </div>
        <p>© 2026 版权所有</p>
      </footer>

      {/* Keyframes for shimmer animation */}
      <style>{`
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (prefers-contrast: more) {
          .bg-gradient-to-r {
            background: var(--primary) !important;
          }
        }
      `}</style>
    </div>
  );
}
