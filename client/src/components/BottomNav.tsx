import { Compass, Calendar, MessageSquare, User } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { useNotificationCounts } from "@/hooks/useNotificationCounts";

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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = location === item.path;
          const badgeCount = item.badgeCategory && notificationCounts 
            ? notificationCounts[item.badgeCategory] 
            : 0;
          const showBadge = badgeCount > 0;
          
          return (
            <a
              key={item.path}
              href={item.path}
              className={`relative flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid={item.testId}
            >
              <div className="relative w-6 h-6 flex items-center justify-center">
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
