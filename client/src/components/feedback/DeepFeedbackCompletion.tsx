import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Heart, TrendingUp, Users } from "lucide-react";

interface DeepFeedbackCompletionProps {
  onDone: () => void;
}

export default function DeepFeedbackCompletion({ onDone }: DeepFeedbackCompletionProps) {
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
                <Heart className="h-12 w-12 text-primary-foreground fill-current" />
                
                {/* Pulse effect */}
                <motion.div
                  className="absolute inset-0 rounded-full border-4 border-primary"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center space-y-2"
            >
              <h1 className="text-2xl font-bold">💫 感谢你的深度分享</h1>
              <p className="text-sm text-muted-foreground">
                你的反馈已加入我们的改进分析
              </p>
            </motion.div>

            {/* Impact Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <div className="text-xs text-muted-foreground mt-1">模块完成</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <div className="text-2xl font-bold text-primary">8+</div>
                  <div className="text-xs text-muted-foreground mt-1">有效洞察</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-primary/5">
                  <div className="text-2xl font-bold text-primary">5</div>
                  <div className="text-xs text-muted-foreground mt-1">维度优化</div>
                </div>
              </div>
            </motion.div>

            {/* Value Loop */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-5 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 space-y-3"
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">你的反馈正在发挥作用</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>已归入「契合点有效性」分析池</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>将用于校准「交流动态」预测模型</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>帮助设计「个性化偏好」匹配算法</span>
                </div>
              </div>
            </motion.div>

            {/* Community Impact */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="p-4 rounded-lg bg-muted/50 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">社区共建</span>
              </div>
              <p className="text-sm text-muted-foreground">
                基于像你一样的用户反馈，我们持续改进匹配质量、优化活动体验，让每个人都能找到真正契合的伙伴
              </p>
            </motion.div>

            {/* Action Button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button 
                onClick={onDone} 
                size="lg" 
                className="w-full"
                data-testid="button-done"
              >
                返回活动列表
              </Button>
            </motion.div>

            {/* Thank you message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center text-xs text-muted-foreground"
            >
              你的每个分享都让 JoyJoin 变得更好 ✨
            </motion.p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
