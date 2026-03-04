import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttendanceStatusButtonsProps {
  eventId: string;
  eventDateTime: string;
}

type AttendanceStatus = 'pending' | 'confirmed' | 'late' | 'absent';

interface AttendanceStatusResponse {
  status: AttendanceStatus;
  estimatedLateMinutes?: number | null;
  absentReason?: string | null;
}

interface UpdatePayload {
  status: AttendanceStatus;
  estimatedLateMinutes?: number | null;
  absentReason?: string | null;
}

const LATE_OPTIONS = [
  { label: "⏰ 5–10分钟", value: 10 },
  { label: "⏰ 15–20分钟", value: 20 },
  { label: "⏰ 30分钟以上", value: 30 },
];

const ABSENT_OPTIONS = [
  { label: "突发事情", value: "突发事情" },
  { label: "身体不适", value: "身体不适" },
  { label: "其他", value: "其他" },
];

export default function AttendanceStatusButtons({ eventId, eventDateTime }: AttendanceStatusButtonsProps) {
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = useState<AttendanceStatus>('pending');
  const [lateSheetOpen, setLateSheetOpen] = useState(false);
  const [absentSheetOpen, setAbsentSheetOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const eventStart = new Date(eventDateTime).getTime();
  const twoHoursBefore = eventStart - 2 * 60 * 60 * 1000;
  const fortyFiveMinAfter = eventStart + 45 * 60 * 1000;

  const showAbsentButton = now < eventStart;
  const showLateAndConfirmButtons = now >= twoHoursBefore && now <= fortyFiveMinAfter;

  // Update `now` every 30s so visibility windows re-evaluate without a full page reload
  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  // Fetch current status on mount
  useEffect(() => {
    apiRequest("GET", `/api/blind-box-events/${eventId}/my-attendance-status`)
      .then((res) => res.json())
      .then((data: AttendanceStatusResponse) => {
        if (data?.status) setCurrentStatus(data.status);
      })
      .catch(() => {
        // silently ignore fetch errors
      });
  }, [eventId]);

  const updateStatusMutation = useMutation({
    mutationFn: async (payload: UpdatePayload) => {
      const res = await apiRequest("POST", `/api/blind-box-events/${eventId}/attendance-status`, payload);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setCurrentStatus(variables.status);
      setLateSheetOpen(false);
      setAbsentSheetOpen(false);
      toast({
        title: "状态已更新",
        description:
          variables.status === 'confirmed' ? "✅ 已确认准时到达"
          : variables.status === 'late' ? `⏰ 已告知队友你会迟到约${variables.estimatedLateMinutes}分钟`
          : "🔴 已告知队友你无法出席",
      });
    },
    onError: () => {
      toast({ title: "更新失败", description: "请稍后再试", variant: "destructive" });
    },
  });

  if (!showAbsentButton && !showLateAndConfirmButtons) {
    return null;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {showLateAndConfirmButtons && currentStatus !== 'confirmed' && (
          <Button
            variant="outline"
            className="w-full border-amber-400 text-amber-600 hover:bg-amber-50"
            onClick={() => setLateSheetOpen(true)}
            disabled={updateStatusMutation.isPending}
          >
            ⏰ 我会迟到
          </Button>
        )}
        {showLateAndConfirmButtons && currentStatus !== 'confirmed' && (
          <Button
            className="w-full bg-green-500 hover:bg-green-600 text-white"
            onClick={() => updateStatusMutation.mutate({ status: 'confirmed' })}
            disabled={updateStatusMutation.isPending}
          >
            ✅ 准时到
          </Button>
        )}
        {showAbsentButton && currentStatus !== 'absent' && (
          <Button
            variant="outline"
            className="w-full border-red-400 text-red-500 hover:bg-red-50"
            onClick={() => setAbsentSheetOpen(true)}
            disabled={updateStatusMutation.isPending}
          >
            🔴 我不来了
          </Button>
        )}
        {currentStatus === 'confirmed' && (
          <div className="text-center text-sm text-green-600 font-medium py-2">✅ 已确认准时到达</div>
        )}
        {currentStatus === 'absent' && (
          <div className="text-center text-sm text-red-500 font-medium py-2">🔴 已告知队友你无法出席</div>
        )}
        {currentStatus === 'late' && (
          <div className="text-center text-sm text-amber-600 font-medium py-2">⏰ 已告知队友你会迟到</div>
        )}
      </div>

      {/* 迟到底部弹窗 */}
      <Sheet open={lateSheetOpen} onOpenChange={setLateSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>预计迟到多久？</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            {LATE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => updateStatusMutation.mutate({ status: 'late', estimatedLateMinutes: opt.value })}
                disabled={updateStatusMutation.isPending}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* 缺席底部弹窗 */}
      <Sheet open={absentSheetOpen} onOpenChange={setAbsentSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>无法出席的原因</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3">
            {ABSENT_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="outline"
                className="w-full h-12 text-base"
                onClick={() => updateStatusMutation.mutate({ status: 'absent', absentReason: opt.value })}
                disabled={updateStatusMutation.isPending}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
