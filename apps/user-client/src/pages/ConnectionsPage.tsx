import MobileHeader from "@/components/MobileHeader";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Users, Copy, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { archetypeConfig } from "@/lib/archetypes";
import { archetypeAvatars, archetypeBgColors } from "@/lib/archetypeAvatars";
import {
  getGenderDisplay,
  formatAge,
  calculateAge,
  getEducationDisplay
} from "@/lib/userFieldMappings";
import { useToast } from "@/hooks/use-toast";

const listVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 28, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 26 },
  },
};

const archetypeCardShadow = (archetype: string | null | undefined): string => {
  const shadowMap: Record<string, string> = {
    '开心柯基': '0 4px 20px rgba(249,115,22,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '太阳鸡': '0 4px 20px rgba(245,158,11,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '夸夸豚': '0 4px 20px rgba(6,182,212,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '机智狐': '0 4px 20px rgba(239,68,68,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '淡定海豚': '0 4px 20px rgba(99,102,241,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '织网蛛': '0 4px 20px rgba(168,85,247,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '暖心熊': '0 4px 20px rgba(244,63,94,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '灵感章鱼': '0 4px 20px rgba(139,92,246,0.18), 0 1px 4px rgba(0,0,0,0.06)',
    '沉思猫头鹰': '0 4px 20px rgba(100,116,139,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '定心大象': '0 4px 20px rgba(107,114,128,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '稳如龟': '0 4px 20px rgba(16,185,129,0.15), 0 1px 4px rgba(0,0,0,0.06)',
    '隐身猫': '0 4px 20px rgba(99,102,241,0.15), 0 1px 4px rgba(0,0,0,0.06)',
  };
  return archetype ? (shadowMap[archetype] || '0 2px 12px rgba(0,0,0,0.08)') : '0 2px 12px rgba(0,0,0,0.08)';
};

const archetypeAccentBorder = (archetype: string | null | undefined): string => {
  const defaultBorder = "border-t-primary/30";
  if (!archetype) return defaultBorder;
  const bgColors = archetypeBgColors as Record<string, unknown>;
  const bgClass = bgColors[archetype];
  if (typeof bgClass === "string") {
    const borderClass = bgClass.replace(/^bg-/, "border-t-");
    if (borderClass !== bgClass) return borderClass;
  }
  return defaultBorder;
};

type ConnectionItem = {
  connectionId: string;
  eventId: string;
  connectedAt: string | Date;
  revealedAt: string | Date | null;
  wechatContactId: string | null;
  otherUser: {
    id: string;
    displayName: string | null;
    archetype: string | null;
    gender: string | null;
    birthdate: string | null;
    educationLevel: string | null;
    industryNicheLabel: string | null;
    industryCategoryLabel: string | null;
    currentCity: string | null;
  } | null;
  sourceEvent: {
    title: string;
    eventType: string;
    district: string;
    dateTime: string | Date;
  } | null;
};

/**
 * 连接 — Structured post-event connections page.
 *
 * This surface shows mutual post-event connections and any revealed
 * WeChat contact IDs. It does not provide any in-app chat experience.
 */
export default function ConnectionsPage() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: connections, isLoading } = useQuery<ConnectionItem[]>({
    queryKey: ["/api/connections/my"],
  });

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    const chars = name.trim().split('');
    return chars.length > 0 ? chars[0].toUpperCase() : "?";
  };

  const formatConnectedTime = (date: string | Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const handleCopyWechat = (wechatId: string, connectionId: string) => {
    if (!navigator.clipboard?.writeText) {
      toast({
        title: "复制失败",
        description: "当前环境不支持一键复制，请手动复制微信号",
        variant: "destructive",
      });
      return;
    }
    navigator.clipboard
      .writeText(wechatId)
      .then(() => {
        setCopiedId(connectionId);
        toast({ title: "已复制微信号", description: wechatId });
        setTimeout(() => setCopiedId(null), 2500);
      })
      .catch((err) => {
        console.error("Failed to copy WeChat ID:", err);
        toast({
          title: "复制失败",
          description: "请手动复制微信号",
          variant: "destructive",
        });
      });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf8] pb-16 flex flex-col">
        <MobileHeader title="连接" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const hasConnections = connections && connections.length > 0;

  return (
    <div className="min-h-screen bg-[#fafaf8] pb-16">
      <MobileHeader title="连接" />

      {!hasConnections ? (
        <div className="px-4 py-16 flex flex-col items-center justify-center text-center">
          <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Users className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="font-semibold mb-2">暂无连接</h3>
          <p className="text-sm text-muted-foreground max-w-[260px]">
            参加活动后与其他参与者互相选择，就可以在这里看到你们的连接
          </p>
        </div>
      ) : (
        <motion.div
          className="px-4 pb-4 pt-4 space-y-3"
          variants={listVariants}
          initial="hidden"
          animate="visible"
        >
          {connections.map((conn) => {
            const other = conn.otherUser;
            const isExpanded = expandedId === conn.connectionId;
            const archetypeData =
              other?.archetype && archetypeConfig[other.archetype]
                ? archetypeConfig[other.archetype]
                : null;

            return (
              <motion.div
                key={conn.connectionId}
                variants={cardVariants}
                className={`rounded-2xl overflow-hidden border-t-[3px] ${archetypeAccentBorder(other?.archetype)}`}
                style={{ background: 'white', boxShadow: archetypeCardShadow(other?.archetype) }}
                data-testid={`card-connection-${conn.connectionId}`}
              >
                <div className="p-4">
                  {conn.sourceEvent && (
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                        <span aria-hidden="true">✨</span> {conn.sourceEvent.title}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : conn.connectionId)}
                      className="cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full"
                      aria-label={`查看 ${other?.displayName || '用户'} 的资料`}
                      aria-expanded={isExpanded}
                    >
                      {other?.archetype && archetypeAvatars[other.archetype] ? (
                        <div
                          className={`h-16 w-16 rounded-full ${
                            archetypeBgColors[other.archetype] || 'bg-muted'
                          } flex items-center justify-center overflow-hidden shadow-lg ring-2 ring-offset-2 ring-primary/30`}
                        >
                          <img
                            src={archetypeAvatars[other.archetype]}
                            alt={other.archetype}
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                      ) : (
                        <Avatar className="h-16 w-16 flex-shrink-0 shadow-lg ring-2 ring-offset-2 ring-primary/30">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(other?.displayName ?? null)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="font-semibold truncate">
                          {other?.displayName || "参与者"}
                        </h3>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatConnectedTime(conn.connectedAt)}
                        </span>
                      </div>

                      {other?.archetype && (
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold mb-2 px-2 py-0.5 rounded-full bg-muted/60 ${archetypeData?.color || 'text-foreground'}`}>
                          <span aria-hidden="true">{archetypeData?.icon || '✨'}</span>
                          {other.archetype}
                        </span>
                      )}

                      {conn.wechatContactId && conn.wechatContactId.trim() ? (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">微信号：</span>
                          <span className="text-xs font-medium">{conn.wechatContactId}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyWechat(conn.wechatContactId as string, conn.connectionId)}
                            className="ml-1 p-1 rounded hover:bg-muted/50 transition-colors"
                            aria-label="复制微信号"
                          >
                            {copiedId === conn.connectionId
                              ? <Check className="h-3.5 w-3.5 text-green-500" />
                              : <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            }
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-1">互相选择后可查看微信号</p>
                      )}

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 mt-3 border-t space-y-2">
                              {archetypeData && (
                                <div className="bg-muted/30 rounded-lg p-2.5">
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {archetypeData.description}
                                  </p>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {other?.gender && other?.birthdate && (
                                  <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                    {getGenderDisplay(other.gender)} · {formatAge(calculateAge(other.birthdate))}
                                  </span>
                                )}
                                {other?.educationLevel && (
                                  <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                    {getEducationDisplay(other.educationLevel)}
                                  </span>
                                )}
                                {other?.currentCity && (
                                  <span className="text-xs bg-muted/50 px-2.5 py-1 rounded-full">
                                    {other.currentCity}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <BottomNav />
    </div>
  );
}
