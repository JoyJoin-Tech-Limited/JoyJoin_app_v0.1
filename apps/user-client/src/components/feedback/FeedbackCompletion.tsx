import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Sparkles, Gift, Star, Target } from "lucide-react";

interface FeedbackCompletionProps {
  onDone: () => void;
  onDeepFeedback?: () => void;
}

export default function FeedbackCompletion({ onDone, onDeepFeedback }: FeedbackCompletionProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full"
      >
        <Card>
          <CardContent className="p-8 space-y-6">
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
              <h1 className="text-2xl font-bold">反馈完成！</h1>
              <p className="text-sm text-muted-foreground">
                感谢你的宝贵意见，帮助我们变得更好
              </p>
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
