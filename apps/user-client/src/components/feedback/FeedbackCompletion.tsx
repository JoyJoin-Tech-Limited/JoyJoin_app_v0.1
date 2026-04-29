import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Sparkles, Gift, Target, MessageCircle, Copy, Check } from "lucide-react";
import { archetypeConfig } from "@/lib/archetypes";

interface MutualMatch {
  userId: string;
  displayName: string;
  archetype?: string;
  wechatContactId?: string | null;
}

interface FeedbackCompletionProps {
  onDone: () => void;
  onDeepFeedback?: () => void;
  mutualMatches?: MutualMatch[];
}

function MutualMatchCard({ match }: { match: MutualMatch }) {
  const [copied, setCopied] = useState(false);
  const [copyFlash, setCopyFlash] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  const archetypeData = match.archetype && archetypeConfig[match.archetype]
    ? archetypeConfig[match.archetype]
    : { icon: "✨", bgColor: "bg-muted" };

  const handleCopy = async () => {
    if (match.wechatContactId) {
      try {
        await navigator.clipboard.writeText(match.wechatContactId);
        setCopied(true);
        setCopyFlash(true);
        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
        flashTimeoutRef.current = setTimeout(() => setCopyFlash(false), 1000);
      } catch {
        // Clipboard write failed (e.g., permission denied or non-secure context) — no-op
      }
    }
  };

  return (
    <div className="border-2 border-rose-200 bg-rose-50/50 rounded-xl p-4 space-y-3">
      {/* User info row */}
      <div className="flex items-center gap-3">
        <motion.div className="ring-2 ring-rose-300 rounded-full animate-pulse">
          <div className={`h-16 w-16 rounded-full ${archetypeData.bgColor} flex items-center justify-center text-2xl`}>
            {archetypeData.icon}
          </div>
        </motion.div>
        <div>
          <p className="font-semibold">{match.displayName}</p>
          {match.archetype && (
            <Badge
              className={`text-xs ${archetypeData.bgColor} border-0`}
            >
              {match.archetype}
            </Badge>
          )}
        </div>
      </div>

      {/* WeChat ID reveal */}
      {match.wechatContactId ? (
        <div className={`rounded-lg p-3 flex flex-col gap-1 border border-dashed border-rose-200 transition-colors duration-300 ${copyFlash ? "bg-green-50" : "bg-white"}`}>
          <span className="text-[10px] text-muted-foreground">微信号</span>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <MessageCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-base font-mono font-medium truncate">{match.wechatContactId}</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="flex-shrink-0 h-8 px-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center space-y-1">
          <p className="text-xs text-amber-700">对方暂未设置微信号</p>
          <p className="text-xs text-muted-foreground">可截图此页面，在活动群中向Ta打招呼 👋</p>
        </div>
      )}
    </div>
  );
}

// Confetti particle colors for mutual match celebration (defined outside component to avoid recreation)
const CONFETTI_COLORS = ["bg-rose-400", "bg-amber-400", "bg-purple-400", "bg-green-400"];

export default function FeedbackCompletion({ onDone, onDeepFeedback, mutualMatches }: FeedbackCompletionProps) {
  const hasMutualMatches = mutualMatches && mutualMatches.length > 0;

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full"
      >
        <Card>
          <CardContent className="p-8 space-y-6">

            {/* Mutual Matches Section — shown FIRST when matches exist */}
            {hasMutualMatches && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 15 }}
                className="space-y-3 relative"
              >
                {/* Confetti burst */}
                <div className="absolute inset-0 pointer-events-none overflow-visible">
                  {[...Array(12)].map((_, i) => {
                    const angle = (i / 12) * 2 * Math.PI;
                    const distance = 60 + Math.random() * 40;
                    return (
                      <motion.div
                        key={i}
                        className={`absolute w-2 h-2 rounded-full ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
                        style={{ top: "50%", left: "50%" }}
                        initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                        animate={{
                          scale: [0, 1, 0],
                          x: [0, Math.cos(angle) * distance],
                          y: [0, Math.sin(angle) * distance],
                          opacity: [0, 1, 0],
                        }}
                        transition={{
                          duration: 0.8,
                          delay: 0.1 + i * 0.04,
                          ease: "easeOut",
                        }}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-1 pb-2">
                  <h1 className="text-2xl font-black tracking-tight text-rose-600">💞 你们互相选择了彼此！</h1>
                  <p className="text-sm text-muted-foreground">微信号已为你准备好了 ✨</p>
                </div>
                {mutualMatches.map((match, idx) => (
                  <motion.div
                    key={match.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + idx * 0.1, type: "spring", stiffness: 300, damping: 15 }}
                  >
                    <MutualMatchCard match={match} />
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Success Animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center"
            >
              <div className="relative mx-auto w-24 h-24 bg-gradient-to-br from-primary to-primary/50 rounded-full flex items-center justify-center">
                <Sparkles className="h-12 w-12 text-primary-foreground" />
                
                {/* Confetti particles */}
                {[...Array(8)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-primary rounded-full"
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: [0, Math.cos(i * 45 * Math.PI / 180) * 40],
                      y: [0, Math.sin(i * 45 * Math.PI / 180) * 40],
                    }}
                    transition={{
                      duration: 0.8,
                      delay: 0.3 + i * 0.05,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-center space-y-2"
            >
              {hasMutualMatches ? (
                <>
                  <h1 className="text-2xl font-bold">反馈完成！</h1>
                  <p className="text-sm text-muted-foreground">感谢你的宝贵意见，帮助我们变得更好</p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold">反馈完成！</h1>
                  <p className="text-sm text-muted-foreground">
                    感谢你的宝贵意见，帮助我们变得更好
                  </p>
                </>
              )}
            </motion.div>

            {/* Rewards Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 mb-4">
                <Gift className="h-5 w-5 text-primary" />
                <span className="font-semibold">感谢奖励</span>
              </div>

              {/* Reward Cards */}
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="text-3xl">🎁</div>
                  <div className="flex-1">
                    <p className="font-medium text-primary">50 积分</p>
                    <p className="text-xs text-muted-foreground">可用于下次活动</p>
                  </div>
                  <Badge className="bg-primary/20 text-primary">已获得</Badge>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                  <div className="text-3xl">⭐</div>
                  <div className="flex-1">
                    <p className="font-medium">「优质反馈者」标识</p>
                    <p className="text-xs text-muted-foreground">展示你的贡献</p>
                  </div>
                  <Badge variant="outline">已激活</Badge>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                  <div className="text-3xl">🎯</div>
                  <div className="flex-1">
                    <p className="font-medium">下期活动匹配优先权</p>
                    <p className="text-xs text-muted-foreground">更快找到心仪活动</p>
                  </div>
                  <Badge variant="outline">已激活</Badge>
                </div>
              </div>
            </motion.div>

            {/* Impact Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-lg bg-muted/50 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">你的反馈将帮助优化：</span>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>匹配算法精准度</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>活动体验质量</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>未来伙伴推荐</span>
                </li>
              </ul>
            </motion.div>

            {/* Deep Feedback Invitation */}
            {onDeepFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="p-6 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl">💫</div>
                  <div className="flex-1 space-y-2">
                    <h3 className="font-semibold text-lg">帮助我们让匹配更精准</h3>
                    <p className="text-sm text-muted-foreground italic">
                      可选 · 约3分钟 · 匿名处理
                    </p>
                    <div className="text-sm space-y-1">
                      <p className="text-muted-foreground">你的深度见解将直接帮助我们：</p>
                      <ul className="space-y-1 ml-2">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="text-muted-foreground">校准契合点系统的准确性</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="text-muted-foreground">理解真实社交中的连接逻辑</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          <span className="text-muted-foreground">为未来用户创造更好的体验</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    onClick={onDeepFeedback}
                    variant="default"
                    className="flex-1"
                    data-testid="button-deep-feedback"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    参与深度反馈，共建更好体验
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: onDeepFeedback ? 0.8 : 0.7 }}
            >
              <Button 
                onClick={onDone} 
                size="lg" 
                variant={onDeepFeedback ? "outline" : "default"}
                className="w-full"
                data-testid="button-done"
              >
                {onDeepFeedback ? "暂时不用，谢谢" : "返回活动列表"}
              </Button>
            </motion.div>

            {/* Thank you message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center text-xs text-muted-foreground"
            >
              期待下次与你相遇 ✨
            </motion.p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
