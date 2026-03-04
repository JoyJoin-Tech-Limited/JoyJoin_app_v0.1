import { useState, useEffect, useCallback } from "react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// Safe wrapper around the Web Vibration API
const hapticVibrate = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    navigator.vibrate(pattern);
  }
};

// Stagger entrance animation helper
const staggerChild = (i: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: i * 0.08, type: "spring" as const, stiffness: 400, damping: 30 },
});

export type AttendanceStatus = "pending" | "confirmed" | "late" | "absent";

interface AttendanceStatusButtonsProps {
  eventId: string;
  initialStatus?: AttendanceStatus;
  lateMinutes?: number;
  onStatusChange?: (status: AttendanceStatus) => void;
}

// ─── Late Options Sheet ────────────────────────────────────────────────────────

interface LateOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (minutes: number) => void;
  isSubmitting: boolean;
}

const LATE_OPTIONS = [
  { label: "约10分钟", minutes: 10, color: "bg-amber-400 text-white shadow-md shadow-amber-200" },
  { label: "约20分钟", minutes: 20, color: "bg-amber-500 text-white shadow-md shadow-amber-200" },
  { label: "30分钟以上", minutes: 30, color: "bg-orange-500 text-white shadow-md shadow-orange-200" },
];

function LateOptionsSheet({ open, onOpenChange, onSelect, isSubmitting }: LateOptionsSheetProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const pendingRef = React.useRef(false);

  const handleSelect = (minutes: number) => {
    // Prevent multiple submissions from rapid taps
    if (pendingRef.current) return;
    pendingRef.current = true;
    setSelectedMinutes(minutes);
    // Confirm flash: visual feedback then 300ms delay before closing
    setTimeout(() => {
      onSelect(minutes);
      pendingRef.current = false;
    }, 300);
  };

  // Reset selection when sheet closes
  useEffect(() => {
    if (!open) {
      setSelectedMinutes(null);
      pendingRef.current = false;
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader className="mb-5">
          <SheetTitle className="text-lg">⏰ 大概几分钟后到？</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3">
          {LATE_OPTIONS.map((option, i) => (
            <motion.div key={option.minutes} {...staggerChild(i)}>
              <button
                className={`w-full py-4 rounded-full text-base font-semibold transition-all active:scale-[0.98] ${
                  selectedMinutes === option.minutes
                    ? option.color + " scale-[1.02]"
                    : "bg-muted text-muted-foreground border border-border"
                }`}
                onClick={() => handleSelect(option.minutes)}
                disabled={isSubmitting}
                aria-label={`选择迟到${option.label}`}
                aria-pressed={selectedMinutes === option.minutes}
              >
                {option.label}
              </button>
            </motion.div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Absent Reason Dialog ──────────────────────────────────────────────────────

interface AbsentReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isSubmitting: boolean;
}

const ABSENT_REASONS = [
  { id: "临时有事", label: "临时有事" },
  { id: "身体不适", label: "身体不适" },
  { id: "其他原因", label: "其他原因" },
];

function AbsentReasonDialog({ open, onOpenChange, onConfirm, isSubmitting }: AbsentReasonDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setSelectedReason(null);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <DialogTitle>🔴 无法出席的原因</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {ABSENT_REASONS.map((reason, i) => (
            <motion.div key={reason.id} {...staggerChild(i)}>
              <button
                className={`w-full py-4 rounded-full text-base font-semibold border-2 transition-all active:scale-[0.98] ${
                  selectedReason === reason.id
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300"
                    : "border-border bg-muted text-muted-foreground"
                }`}
                onClick={() => setSelectedReason(reason.id)}
                aria-label={`选择缺席原因：${reason.label}`}
                aria-pressed={selectedReason === reason.id}
              >
                {reason.label}
              </button>
            </motion.div>
          ))}
        </div>
        <DialogFooter>
          <AnimatePresence>
            {selectedReason && (
              <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <Button
                  className="w-full rounded-full bg-destructive text-destructive-foreground active:scale-[0.98]"
                  onClick={() => selectedReason && onConfirm(selectedReason)}
                  disabled={isSubmitting}
                  aria-label="确认缺席"
                >
                  确认缺席
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {!selectedReason && (
            <Button
              className="w-full rounded-full opacity-50"
              disabled
              aria-label="请先选择原因"
            >
              确认缺席
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main AttendanceStatusButtons ─────────────────────────────────────────────

export default function AttendanceStatusButtons({
  eventId,
  initialStatus = "pending",
  lateMinutes: initialLateMinutes,
  onStatusChange,
}: AttendanceStatusButtonsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const [status, setStatus] = useState<AttendanceStatus>(initialStatus);
  const [lateMinutes, setLateMinutes] = useState<number | undefined>(initialLateMinutes);
  const [showLateSheet, setShowLateSheet] = useState(false);
  const [showAbsentDialog, setShowAbsentDialog] = useState(false);
  const [confirmBurstKey, setConfirmBurstKey] = useState(0);
  const [showNudge, setShowNudge] = useState(false);

  // "Tap to respond" nudge: trigger after 2s if still pending
  useEffect(() => {
    if (status !== "pending" || prefersReducedMotion) return;
    const timer = setTimeout(() => setShowNudge(true), 2000);
    return () => clearTimeout(timer);
  }, [status, prefersReducedMotion]);

  const attendanceMutation = useMutation({
    mutationFn: async (payload: {
      status: AttendanceStatus;
      lateMinutes?: number;
      absentReason?: string;
    }) => {
      const res = await apiRequest(
        "POST",
        `/api/blind-box-events/${eventId}/pre-attendance`,
        payload
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blind-box-events", eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-events"] });
    },
    onError: () => {
      toast({
        title: "提交失败",
        description: "出席状态提交失败，请稍后重试。",
        variant: "destructive",
      });
    },
  });

  const { mutate: submitAttendance } = attendanceMutation;

  const handleConfirm = useCallback(() => {
    setShowNudge(false);
    hapticVibrate(30);
    setConfirmBurstKey((k) => k + 1);

    submitAttendance(
      { status: "confirmed" },
      {
        onSuccess: () => {
          setStatus("confirmed");
          onStatusChange?.("confirmed");
          toast({
            title: "🎉 已确认出席！",
            description: "桌友们期待见到你！",
          });
        },
      }
    );
  }, [submitAttendance, onStatusChange, toast]);

  const handleLateSelect = useCallback(
    (minutes: number) => {
      setShowLateSheet(false);
      submitAttendance(
        { status: "late", lateMinutes: minutes },
        {
          onSuccess: () => {
            setStatus("late");
            setLateMinutes(minutes);
            onStatusChange?.("late");
            const toastMap: Record<number, { title: string; description: string }> = {
              10: { title: "⏰ 我们会等你！", description: "已通知桌友约10分钟后到 👍" },
              20: { title: "⏰ 慢慢来！", description: "已通知桌友约20分钟后到" },
              30: { title: "⏰ 没关系！", description: "已通知桌友你会晚点到 🙌" },
            };
            const t = toastMap[minutes] ?? toastMap[30];
            toast({ title: t.title, description: t.description });
          },
        }
      );
    },
    [submitAttendance, onStatusChange, toast]
  );

  const handleAbsent = useCallback(
    (reason: string) => {
      setShowAbsentDialog(false);
      submitAttendance(
        { status: "absent", absentReason: reason },
        {
          onSuccess: () => {
            setStatus("absent");
            onStatusChange?.("absent");
            toast({
              title: "收到，保重！",
              description: "已记录缺席，下次活动见 💙",
            });
          },
        }
      );
    },
    [submitAttendance, onStatusChange, toast]
  );

  // Confirmed state: collapse to single green pill
  if (status === "confirmed") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
      >
        <div
          className="w-full py-3 rounded-full bg-green-500 text-white text-center text-sm font-semibold select-none"
          aria-label="已确认出席"
        >
          ✅ 已确认出席
        </div>
      </motion.div>
    );
  }

  const buttons = [
    {
      key: "confirmed" as const,
      emoji: "✅",
      label: "准时到",
      selectedClass: "bg-green-500 text-white shadow-md shadow-green-200",
      ariaLabel: "确认准时出席",
      onClick: handleConfirm,
    },
    {
      key: "late" as const,
      emoji: "⏰",
      label: status === "late" && lateMinutes ? `迟到~${lateMinutes}min` : "我会迟到",
      selectedClass: "bg-amber-500 text-white shadow-md shadow-amber-200",
      ariaLabel: "通知会迟到",
      onClick: () => { setShowNudge(false); setShowLateSheet(true); },
    },
    {
      key: "absent" as const,
      emoji: "🔴",
      label: "我不来了",
      selectedClass: "bg-destructive text-destructive-foreground shadow-md shadow-red-200",
      ariaLabel: "标记不出席",
      onClick: () => { setShowNudge(false); setShowAbsentDialog(true); },
    },
  ];

  return (
    <>
      <div className="flex gap-2">
        {buttons.map((btn, i) => {
          const isSelected = status === btn.key;
          const isConfirmBtn = btn.key === "confirmed";

          return (
            <motion.div
              key={btn.key}
              className="flex-1"
              {...staggerChild(i)}
            >
              <motion.button
                key={isConfirmBtn ? confirmBurstKey : undefined}
                className={`w-full py-2.5 rounded-full text-sm font-semibold transition-colors active:scale-[0.98] ${
                  isSelected
                    ? btn.selectedClass
                    : "bg-muted text-muted-foreground border border-border"
                }`}
                onClick={btn.onClick}
                disabled={attendanceMutation.isPending}
                aria-label={btn.ariaLabel}
                aria-pressed={isSelected}
                // Nudge pulse on confirm button when still pending
                animate={
                  isConfirmBtn && showNudge && !prefersReducedMotion
                    ? { scale: [1, 1.03, 1] }
                    : isConfirmBtn && confirmBurstKey > 0
                    ? { scale: [1, 1.15, 1] }
                    : {}
                }
                transition={
                  isConfirmBtn && showNudge
                    ? { repeat: 2, duration: 0.4 }
                    : { type: "spring", stiffness: 500, damping: 15 }
                }
              >
                <span>{btn.emoji} {btn.label}</span>
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      <LateOptionsSheet
        open={showLateSheet}
        onOpenChange={setShowLateSheet}
        onSelect={handleLateSelect}
        isSubmitting={attendanceMutation.isPending}
      />

      <AbsentReasonDialog
        open={showAbsentDialog}
        onOpenChange={setShowAbsentDialog}
        onConfirm={handleAbsent}
        isSubmitting={attendanceMutation.isPending}
      />
    </>
  );
}
