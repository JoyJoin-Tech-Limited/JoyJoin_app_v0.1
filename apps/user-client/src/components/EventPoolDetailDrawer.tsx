import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Sheet,
  SheetContent,
  SheetPortal,
  SheetOverlay,
} from "@/components/ui/sheet";
import HeroSection from "./drawer-sections/HeroSection";
import TabNavigation from "./drawer-sections/TabNavigation";
import PoolStatusSection from "./drawer-sections/PoolStatusSection";
import HowItWorksMinimal from "./drawer-sections/HowItWorksMinimal";
import FAQMinimal from "./drawer-sections/FAQMinimal";
import CTAButton from "./drawer-sections/CTAButton";
import AmbientFloatingTags from "./AmbientFloatingTags";

interface PoolStats {
  totalRegistrations: number;
  archetypeBreakdown: Record<string, number>;
  estimatedGroups: number;
  avgMatchScore: number;
  recentThemeTitles: Array<{
    themeTitle: string;
    themeEmoji: string;
  }>;
}

interface EventPoolDetailDrawerProps {
  poolId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRegister: () => void;
  eventData?: {
    eventType: string;
    title: string;
    date: string;
    location: string;
    groupSize: string;
    minGroupSize: number;
  };
}

export default function EventPoolDetailDrawer({
  poolId,
  isOpen,
  onClose,
  onRegister,
  eventData,
}: EventPoolDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"pool" | "flow" | "faq">("pool");
  const { toast } = useToast();
  
  // Fetch pool stats
  const { data: stats, isLoading: isStatsLoading, isError: isStatsError, refetch: refetchStats } = useQuery<PoolStats>({
    queryKey: [`/api/event-pools/${poolId}/stats`],
    queryFn: async () => {
      if (!poolId) throw new Error("No pool ID");
      const res = await fetch(`/api/event-pools/${poolId}/stats`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!poolId && isOpen,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
  
  // WebSocket subscription
  const { subscribe } = useWebSocket({ autoConnect: isOpen });
  
  useEffect(() => {
    if (!isOpen || !poolId) return;
    
    const unsubscribe = subscribe("POOL_REGISTRATION_ADDED", async (message) => {
      if (message.data?.poolId === poolId) {
        await refetchStats();
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        
        // Toast notification
        toast({
          title: "🎉 新朋友加入",
          description: `${message.data.archetype || "新朋友"} 刚刚报名`,
          duration: 3000,
        });
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOpen, poolId, subscribe, refetchStats, toast]);
  
  // Reset tab when drawer closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab("pool");
    }
  }, [isOpen]);
  
  if (!poolId || !eventData) {
    return null;
  }
  
  // Show loading state while fetching stats
  if (isStatsLoading && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent
            side="bottom"
            className="h-[92vh] p-0 border-t-0 rounded-t-[32px] overflow-hidden flex items-center justify-center"
          >
            <div className="text-center">
              <div className="h-12 w-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">加载活动池信息...</p>
            </div>
          </SheetContent>
        </SheetPortal>
      </Sheet>
    );
  }
  
  if (isStatsError && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetPortal>
          <SheetOverlay />
          <SheetContent
            side="bottom"
            className="h-[92vh] p-0 border-t-0 rounded-t-[32px] overflow-hidden flex items-center justify-center"
          >
            <div className="text-center space-y-4 px-6">
              <p className="font-medium">活动池信息加载失败</p>
              <p className="text-sm text-muted-foreground">请重试，或先返回发现页继续浏览。</p>
              <Button variant="outline" onClick={() => refetchStats()}>重新加载</Button>
            </div>
          </SheetContent>
        </SheetPortal>
      </Sheet>
    );
  }

  if (!stats) return null;
  
  const spotsNeeded = eventData.minGroupSize - (stats.totalRegistrations % eventData.minGroupSize);
  const isHot = spotsNeeded <= 2 && spotsNeeded > 0;
  
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetPortal>
        <SheetOverlay />
        <SheetContent
          side="bottom"
          className="p-0 border-t-0 overflow-hidden flex flex-col"
          style={{
            height: 'var(--drawer-height)',
            borderTopLeftRadius: 'var(--drawer-radius-top)',
            borderTopRightRadius: 'var(--drawer-radius-top)',
          }}
          onPointerDownOutside={(e) => {
            // Prevent closing the sheet when clicking on the overlay/outside
            e.preventDefault();
          }}
        >
          {/* Drag Handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-700 z-50" />
          
          {/* Ambient Floating Tags Background */}
          {stats.recentThemeTitles.length > 0 && (
            <AmbientFloatingTags themeTags={stats.recentThemeTitles} />
          )}
          
          {/* Main Content */}
          <div className="relative z-10 flex flex-col h-full">
            {/* Hero Section (Sticky) */}
            <HeroSection
              eventType={eventData.eventType}
              title={eventData.title}
              date={eventData.date}
              location={eventData.location}
              groupSize={eventData.groupSize}
              liveCount={stats.totalRegistrations}
              onClose={onClose}
            />
            
            {/* Tab Navigation (Sticky) */}
            <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="px-6 py-6 pb-24">
                <AnimatePresence mode="wait">
                  {activeTab === "pool" && (
                    <motion.div
                      key="pool"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <PoolStatusSection
                        poolId={poolId}
                        stats={stats}
                        minGroupSize={eventData.minGroupSize}
                      />
                    </motion.div>
                  )}
                  
                  {activeTab === "flow" && (
                    <motion.div
                      key="flow"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <HowItWorksMinimal />
                    </motion.div>
                  )}
                  
                  {activeTab === "faq" && (
                    <motion.div
                      key="faq"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FAQMinimal />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
            
            {/* Fixed CTA Button */}
            <CTAButton
              onRegister={onRegister}
              registrationCount={stats.totalRegistrations}
              isHot={isHot}
            />
          </div>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
