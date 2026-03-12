import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Users } from "lucide-react";
import { useEffect } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";

/**
 * 圈子 — Community / connections page.
 *
 * In-app private/direct chat has been removed. Connections are now
 * structured post-event mutual selections with WeChat contact reveal
 * (see the `connections` table; mutual selection via `/api/events/:eventId/feedback`).
 */
export default function ChatsPage() {
  const markAsRead = useMarkNotificationsAsRead();

  useEffect(() => {
    markAsRead.mutate('chat');
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-16 flex flex-col">
      <MobileHeader title="圈子" />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-10 w-10 text-primary/40" />
        </div>
        <h3 className="font-semibold text-lg">你的连接</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          参加活动、互相选择后，即可交换微信联系方式，在活动详情页查看你的连接。
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
