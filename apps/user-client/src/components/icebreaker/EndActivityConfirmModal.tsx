import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, LogOut, X } from 'lucide-react';

interface EndActivityConfirmModalProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  elapsedMinutes: number;
}

export function EndActivityConfirmModal({
  open,
  onConfirm,
  onCancel,
  elapsedMinutes,
}: EndActivityConfirmModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          data-testid="end-activity-confirm-modal"
        >
          <motion.div
            className="bg-background rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="h-8 w-8"
                data-testid="button-close-modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <LogOut className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">确定要结束活动吗？</h3>
              <p className="text-sm text-muted-foreground">
                大家已经交流了 {elapsedMinutes} 分钟
              </p>
            </div>

            <div className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-pink-500/10 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow">
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium text-primary">小悦说</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                结束活动后，大家可以继续自由交流哦！记得给这次活动留个反馈，帮助我们做得更好~
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={onCancel}
                data-testid="button-cancel-end"
              >
                再聊一会
              </Button>
              <Button
                className="flex-1"
                onClick={onConfirm}
                data-testid="button-confirm-end"
              >
                确认结束
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
