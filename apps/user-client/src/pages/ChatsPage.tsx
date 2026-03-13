import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Users, Copy, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useMarkNotificationsAsRead } from "@/hooks/useNotificationCounts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface MyConnection {
  id: string;
  eventId: string;
  eventName?: string;
  eventDate?: string;
  peerId: string;
  peerDisplayName: string;
  peerArchetype?: string;
  peerWechatId?: string | null;
  connectionReasons?: string[] | null;
  nextStepPreference?: string | null;
  createdAt: string;
}

const CONNECTION_REASON_OPTIONS = [
  "聊天很自然",
  "价值观有共鸣",
  "兴趣很投缘",
  "幽默感很合拍",
  "相处节奏很舒服",
  "有被理解的感觉",
  "当下状态很合适",
  "想继续了解 Ta",
  "想再一起参加活动",
  "其他（可补充）",
];

const NEXT_STEP_OPTIONS = [
  "微信聊聊",
  "约喝咖啡",
  "下次一起参加活动",
  "保持关注，随缘",
];

const MAX_REASONS = 3;

/**
 * 连接 — Structured connections page.
 *
 * Connections are structured post-event mutual selections with WeChat contact reveal
 * (see the `connections` table; mutual selection via `/api/events/:eventId/feedback`).
 * This page shows your mutual connections and lets you optionally record why a connection
 * stood out and how you'd like to continue it.
 */
export default function ChatsPage() {
  const markAsRead = useMarkNotificationsAsRead();
  const { toast } = useToast();

  useEffect(() => {
    markAsRead.mutate('chat');
  }, []);

  const { data: myConnections, isLoading } = useQuery<MyConnection[]>({
    queryKey: ["/api/my-connections"],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] pb-16 flex flex-col">
        <MobileHeader title="连接" />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <BottomNav />
      </div>
    );
  }

  const hasConnections = myConnections && myConnections.length > 0;

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-20 flex flex-col">
      <MobileHeader title="连接" />

      {!hasConnections ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="font-semibold text-lg">你的连接</h3>
          <p className="text-sm text-muted-foreground max-w-[280px]">
            参加活动、互相选择后，即可在这里看到你的连接，并记录你们的故事。
          </p>
        </div>
      ) : (
        <div className="flex-1 px-4 py-4 space-y-3">
          <p className="text-xs text-muted-foreground px-1">
            共 {myConnections.length} 个连接 · 可选择记录连接的意义和下一步
          </p>
          {myConnections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onFeedbackSaved={() =>
                queryClient.invalidateQueries({ queryKey: ["/api/my-connections"] })
              }
            />
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

// ── Connection Card ────────────────────────────────────────────────────────────

function ConnectionCard({
  connection,
  onFeedbackSaved,
}: {
  connection: MyConnection;
  onFeedbackSaved: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [selectedReasons, setSelectedReasons] = useState<string[]>(
    connection.connectionReasons ?? []
  );
  const [nextStep, setNextStep] = useState<string>(
    connection.nextStepPreference ?? ""
  );
  const [otherText, setOtherText] = useState("");

  const hasOther = selectedReasons.includes("其他（可补充）");

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) => {
      if (prev.includes(reason)) return prev.filter((r) => r !== reason);
      if (prev.length >= MAX_REASONS) {
        toast({ title: `最多选 ${MAX_REASONS} 项`, variant: "destructive" });
        return prev;
      }
      return [...prev, reason];
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const reasons = selectedReasons.slice();
      if (hasOther && otherText.trim()) {
        const idx = reasons.indexOf("其他（可补充）");
        if (idx !== -1) reasons[idx] = `其他：${otherText.trim()}`;
      }
      return apiRequest("PATCH", `/api/connections/${connection.id}/feedback`, {
        connectionReasons: reasons,
        nextStepPreference: nextStep || null,
      });
    },
    onSuccess: () => {
      toast({ title: "已保存" });
      setExpanded(false);
      onFeedbackSaved();
    },
    onError: () => {
      toast({ title: "保存失败，请重试", variant: "destructive" });
    },
  });

  const copyWechat = async () => {
    if (!connection.peerWechatId) return;
    await navigator.clipboard.writeText(connection.peerWechatId);
    toast({ title: "微信号已复制" });
  };

  const hasSavedFeedback =
    (connection.connectionReasons?.length ?? 0) > 0 ||
    !!connection.nextStepPreference;

  return (
    <motion.div
      layout
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
    >
      {/* Card header */}
      <div className="p-4 flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-xl flex-shrink-0">
          {connection.peerArchetype ? "✨" : <Users className="h-6 w-6 text-primary/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{connection.peerDisplayName}</p>
          {connection.peerArchetype && (
            <Badge variant="secondary" className="text-xs mt-0.5">
              {connection.peerArchetype}
            </Badge>
          )}
          {connection.eventName && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              来自：{connection.eventName}
            </p>
          )}
        </div>
        {connection.peerWechatId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={copyWechat}
            className="flex-shrink-0 text-xs gap-1"
          >
            <Copy className="h-3.5 w-3.5" />
            复制微信号
          </Button>
        )}
      </div>

      {/* Saved feedback summary (collapsed) */}
      {hasSavedFeedback && !expanded && (
        <div className="px-4 pb-3 space-y-1">
          {(connection.connectionReasons?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1">
              {connection.connectionReasons!.map((r) => (
                <Badge key={r} variant="outline" className="text-xs">
                  {r}
                </Badge>
              ))}
            </div>
          )}
          {connection.nextStepPreference && (
            <p className="text-xs text-muted-foreground">
              下一步：{connection.nextStepPreference}
            </p>
          )}
        </div>
      )}

      {/* Expand / collapse toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? '收起连接详情' : (hasSavedFeedback ? '编辑连接记录' : '展开记录连接详情')}
        aria-expanded={expanded}
        className="w-full px-4 py-2 text-xs text-muted-foreground flex items-center justify-center gap-1 border-t border-gray-50 hover:bg-gray-50 transition-colors"
      >
        {expanded ? (
          <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
        ) : (
          <>{hasSavedFeedback ? "编辑记录" : "记录这段连接"} <ChevronDown className="h-3.5 w-3.5" /></>
        )}
      </button>

      {/* Feedback form (expanded) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-gray-50 pt-4">
              {/* Reasons */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  是什么让这段连接显得特别？
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    （最多选 {MAX_REASONS} 项，可跳过）
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {CONNECTION_REASON_OPTIONS.map((opt) => {
                    const isSelected = selectedReasons.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleReason(opt)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-gray-200 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {hasOther && (
                  <Textarea
                    placeholder="补充说明（可选）"
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className="text-sm mt-2 resize-none h-16"
                  />
                )}
              </div>

              {/* Next step */}
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  你希望怎么继续？
                  <span className="text-xs text-muted-foreground font-normal ml-1">
                    （可跳过）
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {NEXT_STEP_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setNextStep((v) => (v === opt ? "" : opt))}
                      className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                        nextStep === opt
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-gray-200 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save button */}
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                size="sm"
                className="w-full"
              >
                {saveMutation.isPending ? "保存中…" : "保存记录"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
