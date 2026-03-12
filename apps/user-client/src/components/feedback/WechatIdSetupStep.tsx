import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";

interface WechatIdSetupStepProps {
  onNext: (data: { wechatContactId: string | null }) => void;
}

export default function WechatIdSetupStep({ onNext }: WechatIdSetupStepProps) {
  const [wechatId, setWechatId] = useState("");

  const handleSkip = () => {
    onNext({ wechatContactId: null });
  };

  const handleSave = () => {
    const trimmed = wechatId.trim();
    onNext({ wechatContactId: trimmed || null });
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <motion.div
              className="flex justify-center text-4xl"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: [1, 1.15, 0.95, 1.05, 1] }}
              transition={{ delay: 0.5, duration: 0.6, ease: "easeInOut" }}
            >
              🤝
            </motion.div>
            <motion.h2
              className="text-xl font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              留下微信号，方便互相添加
            </motion.h2>
            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              只有双方互选时，你的微信号才会对对方显示
            </motion.p>
          </div>

          {/* Input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-1"
          >
            <div className="relative">
              <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="你的微信号（选填）"
                value={wechatId}
                onChange={(e) => setWechatId(e.target.value)}
                maxLength={32}
                className="rounded-2xl border-2 focus:ring-2 focus:ring-primary/40 focus:bg-primary/5 pl-10"
                data-testid="input-wechat-id"
              />
            </div>
            <p className={`text-xs text-right pr-1 ${wechatId.length >= 28 ? "text-amber-500" : "text-muted-foreground"}`}>
              {wechatId.length}/32
            </p>
          </motion.div>

          {/* Privacy note */}
          <motion.div
            className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm text-emerald-800 leading-relaxed">
                微信号仅在双向匹配时才对对方可见，其他人看不到
              </p>
              <a href="/privacy" className="text-xs text-emerald-600 underline">了解隐私政策</a>
            </div>
          </motion.div>

          {/* Buttons */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={handleSkip}
              data-testid="button-wechat-skip"
            >
              暂时跳过（可在设置中补充）
            </Button>
            <Button
              className="flex-1 h-12 shadow-md font-semibold"
              onClick={handleSave}
              data-testid="button-wechat-save"
            >
              保存并继续
            </Button>
          </motion.div>
        </CardContent>
      </Card>
    </div>
  );
}
