import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
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
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
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
          >
            <Input
              placeholder="你的微信号（选填）"
              value={wechatId}
              onChange={(e) => setWechatId(e.target.value)}
              maxLength={32}
              data-testid="input-wechat-id"
            />
          </motion.div>

          {/* Privacy note */}
          <motion.div
            className="flex items-start gap-3 bg-primary/5 border border-primary/20 rounded-lg p-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Lock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              微信号仅在双向匹配时才对对方可见，其他人看不到
            </p>
          </motion.div>

          {/* Buttons */}
          <motion.div
            className="flex gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSkip}
              data-testid="button-wechat-skip"
            >
              跳过
            </Button>
            <Button
              className="flex-1"
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
