import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NetworkStatusBannerProps {
  isConnected: boolean;
  isReconnecting: boolean;
  onRetry?: () => void;
  isDemoMode?: boolean;
}

const isDevelopment = import.meta.env.DEV;

export function NetworkStatusBanner({ 
  isConnected, 
  isReconnecting,
  onRetry,
  isDemoMode = false,
}: NetworkStatusBannerProps) {
  // In development mode with demo mode enabled, show a friendlier banner
  // Demo mode takes precedence over error banner - ignoring isReconnecting state
  const showDemoBanner = isDevelopment && isDemoMode && !isConnected;
  const showErrorBanner = !showDemoBanner && (!isConnected || isReconnecting);

  return (
    <AnimatePresence>
      {showDemoBanner && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50"
          data-testid="network-status-banner-demo"
        >
          <div className="px-4 py-2 flex items-center justify-center gap-2 bg-purple-500/90 dark:bg-purple-600/90 backdrop-blur-sm">
            <Monitor className="w-4 h-4 text-white" />
            <span className="text-white text-sm font-medium">
              离线演示模式 - 可自由探索界面
            </span>
          </div>
        </motion.div>
      )}
      {showErrorBanner && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-50"
          data-testid="network-status-banner"
        >
          <div className={`px-4 py-3 flex items-center justify-center gap-3 ${
            isReconnecting 
              ? 'bg-yellow-500/90 dark:bg-yellow-600/90' 
              : 'bg-red-500/90 dark:bg-red-600/90'
          } backdrop-blur-sm`}>
            {isReconnecting ? (
              <>
                <RefreshCw className="w-4 h-4 text-white animate-spin" />
                <span className="text-white text-sm font-medium">
                  网络连接中断，正在重新连接...
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">
                  网络连接已断开
                </span>
                {onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="ml-2 bg-white/20 border-white/40 text-white hover:bg-white/30 text-xs"
                    data-testid="button-retry-connection"
                  >
                    重试
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function NetworkStatusIndicator({ 
  isConnected, 
  isReconnecting 
}: Omit<NetworkStatusBannerProps, 'onRetry'>) {
  if (isConnected && !isReconnecting) {
    return null;
  }

  return (
    <div 
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
        isReconnecting 
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' 
          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      }`}
      data-testid="network-status-indicator"
    >
      {isReconnecting ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>重连中</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3" />
          <span>离线</span>
        </>
      )}
    </div>
  );
}
