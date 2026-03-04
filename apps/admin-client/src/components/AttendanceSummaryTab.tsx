import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PreAttendanceStatus = "confirmed" | "late" | "absent" | "pending";

interface AttendanceSummaryData {
  summary: {
    confirmed: number;
    late: number;
    absent: number;
    pending: number;
  };
  attendees: Array<{
    userId: string;
    displayName: string;
    status: PreAttendanceStatus;
    lateMinutes?: number;
  }>;
}

interface AttendanceSummaryTabProps {
  eventId: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStatusBadgeClass(status: PreAttendanceStatus): string {
  switch (status) {
    case "confirmed":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "late":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "absent":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function getStatusLabel(status: PreAttendanceStatus, lateMinutes?: number): string {
  switch (status) {
    case "confirmed":
      return "✅ 准时到";
    case "late":
      return lateMinutes ? `⏰ 迟到~${lateMinutes}min` : "⏰ 迟到";
    case "absent":
      return "❌ 缺席";
    default:
      return "⏳ 未回应";
  }
}

function getInitials(name: string): string {
  return name.slice(0, 2);
}

// ─── Summary Stats Counter ─────────────────────────────────────────────────────

interface StatCounterProps {
  emoji: string;
  count: number;
  label: string;
  index: number;
}

function StatCounter({ emoji, count, label, index }: StatCounterProps) {
  return (
    <motion.div
      className="flex flex-col items-center gap-1 flex-1"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        delay: index * 0.1,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xl font-bold">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AttendanceSummaryTab({ eventId }: AttendanceSummaryTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chaseSuccess, setChaseSuccess] = useState(false);

  const { data, isLoading } = useQuery<AttendanceSummaryData>({
    queryKey: ["/api/admin/blind-box-events", eventId, "attendance-summary"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/blind-box-events/${eventId}/attendance-summary`
      );
      if (!res.ok) throw new Error("Failed to fetch attendance summary");
      return res.json();
    },
  });

  const chaseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/admin/blind-box-events/${eventId}/chase-attendees`
      );
      return res.json();
    },
    onSuccess: () => {
      setChaseSuccess(true);
      toast({ title: "✓ 提醒已发送", description: "已通知所有未回应的桌友" });
    },
    onError: () => {
      toast({ title: "发送失败", description: "请稍后重试", variant: "destructive" });
    },
  });

  // Revert "全部催一下" success state after 2s
  useEffect(() => {
    if (!chaseSuccess) return;
    const timer = setTimeout(() => setChaseSuccess(false), 2000);
    return () => clearTimeout(timer);
  }, [chaseSuccess]);

  const overrideMutation = useMutation({
    mutationFn: async ({
      userId,
      status,
    }: {
      userId: string;
      status: PreAttendanceStatus;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/blind-box-events/${eventId}/attendees/${userId}/attendance`,
        { status }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/blind-box-events", eventId, "attendance-summary"],
      });
      toast({ title: "✓ 状态已更新" });
    },
    onError: () => {
      toast({ title: "更新失败", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground animate-pulse">
        加载出席情况…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        暂无数据
      </div>
    );
  }

  const { summary, attendees } = data;
  const STATS = [
    { emoji: "✅", count: summary.confirmed, label: "准时到" },
    { emoji: "⏰", count: summary.late, label: "迟到" },
    { emoji: "❌", count: summary.absent, label: "缺席" },
    { emoji: "⏳", count: summary.pending, label: "未响应" },
  ];

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="flex gap-3 py-3 px-1 bg-muted/40 rounded-2xl">
        {STATS.map((s, i) => (
          <StatCounter key={s.label} {...s} index={i} />
        ))}
      </div>

      {/* Chase button */}
      {summary.pending > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.4 }}
        >
          <button
            className={`w-full py-3 rounded-full text-sm font-semibold text-white transition-colors active:scale-[0.97] ${
              chaseSuccess
                ? "bg-green-500"
                : "bg-gradient-to-r from-purple-600 to-fuchsia-500"
            }`}
            onClick={() => !chaseSuccess && chaseMutation.mutate()}
            disabled={chaseMutation.isPending || chaseSuccess}
            aria-label="催促所有未回应桌友"
          >
            {chaseSuccess ? "✓ 已发送提醒" : "全部催一下"}
          </button>
        </motion.div>
      )}

      {/* Attendee list */}
      <div className="space-y-2">
        {attendees.map((attendee) => (
          <motion.div
            key={attendee.userId}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="flex items-center gap-3 py-2"
          >
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-medium">
                {getInitials(attendee.displayName)}
              </AvatarFallback>
            </Avatar>

            <span className="flex-1 text-sm font-medium truncate">
              {attendee.displayName}
            </span>

            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(
                attendee.status
              )}`}
            >
              {getStatusLabel(attendee.status, attendee.lateMinutes)}
            </span>

            <Select
              key={`${attendee.userId}-${attendee.status}`}
              value={attendee.status}
              onValueChange={(value) =>
                overrideMutation.mutate({
                  userId: attendee.userId,
                  status: value as PreAttendanceStatus,
                })
              }
            >
              <SelectTrigger
                className="h-7 w-24 text-xs rounded-full"
                aria-label={`覆盖 ${attendee.displayName} 的出席状态`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmed">准时到</SelectItem>
                <SelectItem value="late">迟到</SelectItem>
                <SelectItem value="absent">缺席</SelectItem>
                <SelectItem value="pending">未回应</SelectItem>
              </SelectContent>
            </Select>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
