import { Compass, Calendar, MessageSquare, User } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import joyJoinLogo from "@/assets/joyjoin-logo.png";

// Constants
const MS_PER_HOUR = 1000 * 60 * 60;
const VENUE_UNLOCK_HOURS = 24;

interface NavItem {
  icon: any;
  label: string;
  path: string;
  testId: string;
  badgeCategory?: 'discover' | 'activities' | 'chat';
}

const sideNavItems: NavItem[] = [
  { icon: Compass, label: "发现", path: "/", testId: "nav-discover", badgeCategory: 'discover' },
  { icon: Calendar, label: "活动", path: "/events", testId: "nav-events", badgeCategory: 'activities' },
  { icon: MessageSquare, label: "聊天", path: "/chats", testId: "nav-chats", badgeCategory: 'chat' },
  { icon: User, label: "我的", path: "/profile", testId: "nav-profile" }
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
  const [location] = useLocation();
  const [, setLocation] = useLocation();
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
      if (connection?.effectiveType === '2g' || connection?.saveData) {
        return;
      }

      // Prefetch in priority order: events -> chats -> profile
      // These keys match the actual queryKey arrays used in the pages
      const prefetchQueries = [
        ['/api/my-events'],           // EventsPage
        ['/api/my-pool-registrations'], // EventsPage
        ['/api/events/joined'],        // ChatsPage
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
      return '/my-journey';
    }

    const now = new Date();
    const matchedEvents = events.filter(e => e.status === "matched");
    const matchedPoolRegistrations = poolRegistrations.filter(r => r.matchStatus === "matched");

    // Priority 1: Matched event happening TODAY
    const todayMatchedEvent = matchedEvents.find(e => {
      const eventDate = new Date(e.dateTime);
      return eventDate.toDateString() === now.toDateString();
    });
    if (todayMatchedEvent) {
      return `/blind-box-events/${todayMatchedEvent.id}`;
    }

    // Priority 2: Matched pool event < 24h away (venue revealed)
    const upcomingMatchedPool = matchedPoolRegistrations.find(r => {
      const eventDate = new Date(r.poolDateTime);
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

    // Priority 4: Matched event in future (> 24h away)
    const futureMatchedPool = matchedPoolRegistrations.find(r => {
      const eventDate = new Date(r.poolDateTime);
      const hoursUntil = (eventDate.getTime() - now.getTime()) / MS_PER_HOUR;
      return hoursUntil >= VENUE_UNLOCK_HOURS;
    });
    if (futureMatchedPool && futureMatchedPool.assignedGroupId) {
      return `/pool-groups/${futureMatchedPool.assignedGroupId}`;
    }

    const futureMatchedEvent = matchedEvents.find(e => {
      const eventDate = new Date(e.dateTime);
      return eventDate > now;
    });
    if (futureMatchedEvent) {
      return `/blind-box-events/${futureMatchedEvent.id}`;
    }

    // Priority 5: No activity — show empty state
    return '/my-journey';
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
    console.log('[Analytics] center_button_tapped', {
      destination: centerButtonDestination,
      userState: centerButtonDestination.includes('my-journey') ? 'no_activity' : 'has_activity',
    });
    setLocation(centerButtonDestination);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-pb">
      {/* Protruding center button wrapper */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10">
        <button
          onClick={handleCenterClick}
          className="relative flex flex-col items-center justify-center gap-1 transition-transform active:scale-95"
          data-testid="nav-center-button"
        >
          {/* Background circle with border */}
          <div className="relative h-16 w-16 rounded-full bg-gray-900 dark:bg-gray-100 border-4 border-background shadow-lg flex items-center justify-center">
            <img 
              src={joyJoinLogo} 
              alt="JoyJoin" 
              className="h-10 w-10 object-contain"
            />
            {/* Notification badge/pulse */}
            {showCenterBadge && (
              <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full border-2 border-background animate-pulse" />
            )}
          </div>
          {/* Label */}
          <span className="text-xs font-medium text-foreground mt-1">JoyJoin</span>
        </button>
      </div>

      <div className="flex items-center justify-around h-16">
        {/* Left side items */}
        {sideNavItems.slice(0, 2).map((item) => {
          const isActive = item.path === "/" 
            ? (location === "/" || location === "/discover")
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
              <div className="relative h-5 w-5">
                <item.icon className={`h-5 w-5 ${isActive ? "fill-primary/20" : ""}`} />
                {showBadge && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-[18px] min-w-[18px] px-1.5 flex items-center justify-center text-[11px] font-semibold bg-primary text-primary-foreground animate-pulse pointer-events-none"
                    data-testid={`badge-${item.testId}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </a>
          );
        })}

        {/* Center spacer for protruding button */}
        <div className="flex-1" />

        {/* Right side items */}
        {sideNavItems.slice(2).map((item) => {
          const isActive = location === item.path;
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
              <div className="relative h-5 w-5">
                <item.icon className={`h-5 w-5 ${isActive ? "fill-primary/20" : ""}`} />
                {showBadge && (
                  <Badge 
                    className="absolute -top-2 -right-2 h-[18px] min-w-[18px] px-1.5 flex items-center justify-center text-[11px] font-semibold bg-primary text-primary-foreground animate-pulse pointer-events-none"
                    data-testid={`badge-${item.testId}`}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
