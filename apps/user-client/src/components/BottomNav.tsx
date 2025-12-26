import { Compass, Calendar, MessageSquare, User } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";
import { queryClient } from "@/lib/queryClient";

interface NavItem {
  icon: any;
  label: string;
  path: string;
  testId: string;
  badgeCategory?: 'discover' | 'activities' | 'chat';
}

const navItems: NavItem[] = [
  { icon: Compass, label: "发现", path: "/", testId: "nav-discover", badgeCategory: 'discover' },
  { icon: Calendar, label: "活动", path: "/events", testId: "nav-events", badgeCategory: 'activities' },
  { icon: MessageSquare, label: "聊天", path: "/chats", testId: "nav-chats", badgeCategory: 'chat' },
  { icon: User, label: "我的", path: "/profile", testId: "nav-profile" }
];

export default function BottomNav() {
  const [location] = useLocation();
  const { data: notificationCounts } = useNotificationCounts();

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

  const [, setLocation] = useLocation();

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    setLocation(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          // For discover tab, match both "/" and "/discover"
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
      </div>
    </nav>
  );
}
