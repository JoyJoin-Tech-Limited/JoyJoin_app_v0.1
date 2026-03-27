import { useLocation } from "wouter";
import discoverIcon from "@/assets/tab-icons/发现 icon.svg";
import journeyIcon from "@/assets/tab-icons/足迹 icon.svg";
import connectIcon from "@/assets/tab-icons/连接 icon.svg";
import profileIcon from "@/assets/tab-icons/我的 icon.svg";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import joyJoinLogo from "@/assets/JoyJoinapp_logo_chi_ZhanKuQingKeHuangYouTi.png";
import { getHongKongDateForComparison } from "@/lib/hongKongTime";
import {
  CENTER_TAB_EMPTY_STATE_ROUTE,
  DISCOVER_ROUTE,
  MS_PER_HOUR,
  VENUE_UNLOCK_HOURS,
  getCenterButtonDestination,
} from "@/lib/centerTabRouting";
import { motion, AnimatePresence } from "framer-motion";
import { prefetchEmptyStateAssets } from "@/lib/prefetchEmptyStateAssets";


interface NavItem {
  iconSrc: string;
  label: string;
  path: string;
  testId: string;
  badgeCategory?: 'discover' | 'activities' | 'chat';
}

const sideNavItems: NavItem[] = [
  { iconSrc: discoverIcon, label: "发现", path: "/", testId: "nav-discover", badgeCategory: 'discover' },
  { iconSrc: journeyIcon, label: "足迹", path: "/my-journey", testId: "nav-journey", badgeCategory: 'activities' },
  { iconSrc: connectIcon, label: "连接", path: "/connections", testId: "nav-connections", badgeCategory: 'chat' },
  { iconSrc: profileIcon, label: "我的", path: "/profile", testId: "nav-profile" }
];

interface PoolRegistration {
  id: string;
  poolId: string;
  matchStatus: "pending" | "matched" | "completed";
  assignedGroupId: string | null;
  poolDateTime: string;
}

interface BlindBoxEvent {
  id: string;
  status: string;
  dateTime: string;
}

export default function BottomNav() {
  const [location, setLocation] = useLocation();
  const { data: notificationCounts } = useNotificationCounts();
  const [showCenterBadge, setShowCenterBadge] = useState(false);

  // Fetch user data for smart routing
  const { data: poolRegistrations } = useQuery<Array<PoolRegistration>>({
    queryKey: ["/api/my-pool-registrations"],
  });

  const { data: events } = useQuery<Array<BlindBoxEvent>>({
    queryKey: ["/api/my-events"],
  });

  // Prefetch data for other tabs on mount using requestIdleCallback
  useEffect(() => {
    const prefetchData = () => {
      // Check network quality - skip prefetch on slow connections
      const connection = (navigator as any).connection;
      if (
        connection?.effectiveType === '2g' ||
        connection?.effectiveType === 'slow-2g' ||
        connection?.saveData
      ) {
        return;
      }

      // Prefetch in priority order: events -> chats -> profile
      // These keys match the actual queryKey arrays used in the pages
      const prefetchQueries = [
        ['/api/my-events'],           // EventsPage
        ['/api/my-pool-registrations'], // EventsPage
        ['/api/events/joined'],        // ConnectionsPage
        ['/api/auth/user'],            // ProfilePage (auth state)
      ];

      prefetchQueries.forEach((queryKey, index) => {
        // Stagger prefetch to avoid network congestion
        setTimeout(() => {
          queryClient.prefetchQuery({ queryKey });
        }, index * 150);
      });

    };

    // Use requestIdleCallback for non-blocking prefetch
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetchData, { timeout: 2000 });
    } else {
      // Fallback for Safari
      setTimeout(prefetchData, 100);
    }
  }, []);

  // Smart routing logic for center button
  const centerButtonDestination = useMemo(() => {
    if (!poolRegistrations || !events) {
      return '/discover';
    }

    const now = getHongKongDateForComparison(new Date());
    const matchedEvents = events.filter(e => e.status === "matched");
    const matchedPoolRegistrations = poolRegistrations.filter(r => r.matchStatus === "matched");

    // Priority 1: Matched event happening TODAY (HK timezone)
    const todayMatchedEvent = matchedEvents.find(e => {
      const eventDate = getHongKongDateForComparison(e.dateTime);
      // Compare dates in HK timezone by comparing the date string (YYYY-MM-DD)
      return eventDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
    });
    if (todayMatchedEvent) {
      return `/blind-box-events/${todayMatchedEvent.id}`;
    }

    // Priority 2: Matched pool event < 24h away (venue revealed)
    const upcomingMatchedPool = matchedPoolRegistrations.find(r => {
      const eventDate = getHongKongDateForComparison(r.poolDateTime);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / MS_PER_HOUR;
      return hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0;
    });
    if (upcomingMatchedPool && upcomingMatchedPool.assignedGroupId) {
      return `/pool-groups/${upcomingMatchedPool.assignedGroupId}`;
    }

    // Priority 3: Pending match in progress
    const pendingRegistration = poolRegistrations.find(r => r.matchStatus === "pending");
    if (pendingRegistration) {
      return `/pool-matching/${pendingRegistration.id}`;
    }

    // Priority 4: Matched event in future (> 24h away) — show squad unboxing experience
    const futureMatchedPool = matchedPoolRegistrations.find(r => {
      const eventDate = getHongKongDateForComparison(r.poolDateTime);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / MS_PER_HOUR;
      return hoursUntil >= VENUE_UNLOCK_HOURS;
    });
    if (futureMatchedPool && futureMatchedPool.assignedGroupId) {
      return `/squad-unboxing/${futureMatchedPool.assignedGroupId}`;
    }

    const futureMatchedEvent = matchedEvents.find(e => {
      const eventDate = getHongKongDateForComparison(e.dateTime);
      return eventDate > now;
    });
    if (futureMatchedEvent) {
      return `/blind-box-events/${futureMatchedEvent.id}`;
    }

    // Priority 5: No activity — navigate to dedicated empty state
    return CENTER_TAB_EMPTY_STATE_ROUTE;
  }, [poolRegistrations, events]);

  useEffect(() => {
    if (!poolRegistrations || !events) {
      return;
    }

    if (centerButtonDestination !== CENTER_TAB_EMPTY_STATE_ROUTE) {
      return;
    }

    let timeoutId: number | undefined = undefined;
    let idleCallbackId: number | undefined = undefined;

    const prefetchAfterDataWarmup = () => {
      // Let the existing query prefetches fire first so the large SVG requests
      // don't compete with the higher-priority API warmup work.
      timeoutId = window.setTimeout(() => {
        prefetchEmptyStateAssets();
      }, 700);
    };

    if ("requestIdleCallback" in window) {
      idleCallbackId = (window as any).requestIdleCallback(prefetchAfterDataWarmup, {
        timeout: 2500,
      });
    } else {
      prefetchAfterDataWarmup();
    }

    return () => {
      if (idleCallbackId !== undefined && "cancelIdleCallback" in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [centerButtonDestination, events, poolRegistrations]);

  // P2-1: Dynamic center button label
  const centerButtonLabel = useMemo(() => {
    if (!poolRegistrations || !events) return '去参与';
    const now = getHongKongDateForComparison(new Date());
    
    // 今日有活动
    const todayEvent = events.find(e => e.status === "matched" && 
      getHongKongDateForComparison(e.dateTime).toISOString().split('T')[0] === now.toISOString().split('T')[0]);
    if (todayEvent) {
      const hasStarted = now >= getHongKongDateForComparison(todayEvent.dateTime);
      if (hasStarted) return '🎲 破冰进行中！';
      return '今日出发！🎉';
    }
    
    // 24h 内场地揭晓 - must have assignedGroupId to match destination logic
    const upcomingPool = poolRegistrations.find(r => {
      if (r.matchStatus !== "matched" || !r.assignedGroupId) return false;
      const hoursUntil = (getHongKongDateForComparison(r.poolDateTime).getTime() - now.getTime()) / MS_PER_HOUR;
      return hoursUntil < VENUE_UNLOCK_HOURS && hoursUntil > 0;
    });
    if (upcomingPool) return '查看场地 📍';
    
    // 匹配中
    const pending = poolRegistrations.find(r => r.matchStatus === "pending");
    if (pending) return '匹配中…';
    
    // 已匹配未到时间 - must have assignedGroupId to match destination logic
    const matched = poolRegistrations.find(r => r.matchStatus === "matched" && r.assignedGroupId);
    if (matched) return '查看桌友 👥';
    
    // No-activity users now land on the dedicated empty state, whose primary
    // CTA sends them on to discover available activities.
    return '去发现';
  }, [poolRegistrations, events]);

  // Show notification badge when there's pending or matched activity
  useEffect(() => {
    if (!poolRegistrations || !events) return;

    const hasPendingMatch = poolRegistrations.some(r => r.matchStatus === "pending");
    const hasMatchedActivity = 
      poolRegistrations.some(r => r.matchStatus === "matched") ||
      events.some(e => e.status === "matched");

    setShowCenterBadge(hasPendingMatch || hasMatchedActivity);
  }, [poolRegistrations, events]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    setLocation(path);
  };

  const handleCenterClick = () => {
    const userState = !poolRegistrations || !events
      ? "loading"
      : centerButtonDestination === CENTER_TAB_EMPTY_STATE_ROUTE
        ? "no_activity"
        : "has_activity";

    console.log('[Analytics] center_button_tapped', {
      destination: centerButtonDestination,
      userState: centerButtonDestination === CENTER_TAB_EMPTY_STATE_ROUTE ? 'no_activity' : 'has_activity',
    });
    setLocation(centerButtonDestination);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-60 safe-area-pb">
      {/* Protruding center button wrapper */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-8 z-10">
        <button
          onClick={handleCenterClick}
          className="relative flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
          data-testid="nav-center-button"
        >
          {/* Background circle with border */}
          <div className="relative h-20 w-20 rounded-full bg-background border-[3px] border-border shadow-xl flex items-center justify-center">
            <img 
              src={joyJoinLogo} 
              alt="JoyJoin" 
              className="h-[62px] w-[62px] object-contain"
            />
            {/* Notification badge/pulse */}
            {showCenterBadge && (
              <div 
                className={`absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full border-2 border-background ${
                  centerButtonLabel === '匹配中…' ? 'animate-ping' : 'animate-pulse'
                }`}
              />
            )}
          </div>
          {/* P2-1: Dynamic label with animation */}
          <AnimatePresence mode="wait">
            <motion.span
              key={centerButtonLabel}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="text-xs font-medium text-foreground mt-1"
            >
              {centerButtonLabel}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <div className="flex items-center justify-around h-16">
        {/* Left side items */}
        {sideNavItems.slice(0, 2).map((item) => {
          const isActive = item.path === "/" 
            ? (location === "/" || location === DISCOVER_ROUTE)
            : location === item.path;
          const badgeCount = item.badgeCategory && notificationCounts 
            ? notificationCounts[item.badgeCategory] 
            : 0;
          const showBadge = badgeCount > 0;
          
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => handleNavClick(e, item.path)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={item.testId}
            >
              {/* Sliding active pill — shared layoutId creates the slide animation */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-x-1 inset-y-1.5 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <div className="relative h-5 w-5 z-10">
                <img
                  src={item.iconSrc}
                  alt={item.label}
                  className={`h-5 w-5 object-contain transition-all duration-200 ${isActive ? "opacity-100" : "opacity-40"}`}
                />
                {showBadge && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-[18px] min-w-[18px] px-1.5 flex items-center justify-center text-[11px] font-semibold bg-primary text-primary-foreground animate-pulse pointer-events-none"
                    data-testid={`badge-${item.testId}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium z-10">{item.label}</span>
            </a>
          );
        })}

        {/* Center spacer for protruding button */}
        <div className="flex-1" />

        {/* Right side items */}
        {sideNavItems.slice(2).map((item) => {
          const isActive = item.path === '/connections'
            ? location.startsWith('/connections')
            : location === item.path;
          const badgeCount = item.badgeCategory && notificationCounts 
            ? notificationCounts[item.badgeCategory] 
            : 0;
          const showBadge = badgeCount > 0;
          
          return (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => handleNavClick(e, item.path)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={item.testId}
            >
              {/* Sliding active pill — shared layoutId creates the slide animation */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-pill"
                  className="absolute inset-x-1 inset-y-1.5 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <div className="relative h-5 w-5 z-10">
                <img
                  src={item.iconSrc}
                  alt={item.label}
                  className={`h-5 w-5 object-contain transition-all duration-200 ${isActive ? "opacity-100" : "opacity-40"}`}
                />
                {showBadge && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-[18px] min-w-[18px] px-1.5 flex items-center justify-center text-[11px] font-semibold bg-primary text-primary-foreground animate-pulse pointer-events-none"
                    data-testid={`badge-${item.testId}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium z-10">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
