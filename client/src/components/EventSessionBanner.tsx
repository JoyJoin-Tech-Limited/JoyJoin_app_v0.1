import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle2, Sparkles, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EventSessionBannerProps {
  eventId: string;
  eventDateTime: string;
  eventStatus: string;
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "活动进行中";
  
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}小时${minutes}分钟后开始`;
  }
  return `${minutes}分钟后开始`;
}

export default function EventSessionBanner({ eventId, eventDateTime, eventStatus }: EventSessionBannerProps) {
  const [, setLocation] = useLocation();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const eventTime = new Date(eventDateTime).getTime();
    
    const updateTime = () => {
      const now = Date.now();
      const diff = eventTime - now;
      setTimeRemaining(diff);
      
      // Show banner whenever event status is "matched" (until event is completed)
      setIsVisible(eventStatus === "matched");
    };

    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, [eventDateTime, eventStatus]);

  const { data: sessionData } = useQuery<{ sessionId: string } | null>({
    queryKey: ["/api/events", eventId, "session"],
    enabled: isVisible,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/session`);
      return res.json();
    },
    onSuccess: (data: { sessionId: string }) => {
      setLocation(`/icebreaker/${data.sessionId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "签到失败",
        description: "无法创建活动会话，请稍后重试",
        variant: "destructive",
      });
      console.error("[Checkin] Error:", error);
    },
  });

  const handleCheckin = () => {
    if (sessionData?.sessionId) {
      setLocation(`/icebreaker/${sessionData.sessionId}`);
    } else {
      createSessionMutation.mutate();
    }
  };

  if (!isVisible) return null;

  const isEventStarted = timeRemaining <= 0;
  const isLoading = createSessionMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-violet-600 to-fuchsia-500 p-4 shadow-lg"
      data-testid="event-session-banner"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_50%)]" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEventStarted ? (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                <Sparkles className="h-4 w-4 text-yellow-300" />
              </motion.div>
            ) : (
              <Clock className="h-4 w-4 text-white/80" />
            )}
            <span className="text-sm font-medium text-white/90">
              {isEventStarted ? "活动进行中" : formatTimeRemaining(timeRemaining)}
            </span>
          </div>
          <p className="text-white text-base font-semibold truncate">
            {isEventStarted ? "小伙伴们在等你！" : "准备好认识新朋友了吗？"}
          </p>
        </div>

        <motion.div
          animate={isEventStarted ? { scale: [1, 1.05, 1] } : {}}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Button
            onClick={handleCheckin}
            disabled={isLoading}
            className="bg-white hover:bg-white/90 text-purple-700 font-semibold px-6 shadow-md"
            data-testid="button-checkin"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="h-4 w-4 border-2 border-purple-700 border-t-transparent rounded-full"
                />
                加载中
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4" />
                签到
                <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

export function FloatingCheckinButton({ eventId, eventDateTime, eventStatus }: EventSessionBannerProps) {
  const [, setLocation] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Show floating button whenever event status is "matched"
    setIsVisible(eventStatus === "matched");
  }, [eventStatus]);

  const { data: sessionData } = useQuery<{ sessionId: string } | null>({
    queryKey: ["/api/events", eventId, "session"],
    enabled: isVisible,
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/session`);
      return res.json();
    },
    onSuccess: (data: { sessionId: string }) => {
      setLocation(`/icebreaker/${data.sessionId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "签到失败",
        description: "无法创建活动会话，请稍后重试",
        variant: "destructive",
      });
      console.error("[Checkin] Error:", error);
    },
  });

  const handleCheckin = () => {
    if (sessionData?.sessionId) {
      setLocation(`/icebreaker/${sessionData.sessionId}`);
    } else {
      createSessionMutation.mutate();
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-24 right-4 z-50"
      data-testid="floating-checkin-button"
    >
      <motion.button
        onClick={handleCheckin}
        disabled={createSessionMutation.isPending}
        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-5 py-3 rounded-full shadow-lg font-semibold"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        data-testid="button-floating-checkin"
        animate={{ 
          boxShadow: [
            "0 4px 14px rgba(147, 51, 234, 0.3)",
            "0 4px 20px rgba(147, 51, 234, 0.5)",
            "0 4px 14px rgba(147, 51, 234, 0.3)"
          ]
        }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <CheckCircle2 className="h-5 w-5" />
        签到
      </motion.button>
    </motion.div>
  );
}
