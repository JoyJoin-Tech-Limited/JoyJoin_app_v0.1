/**
 * ErrorStage - Displayed when result fetch fails or times out.
 */

import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { StageProps } from './stageTypes';

interface ErrorStageProps extends StageProps {
  errorMessage?: string;
  isFetching?: boolean;
  onRetry?: () => void;
}

export function ErrorStage({ errorMessage, onRetry, onSkip, isFetching }: ErrorStageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
      <AlertCircle className="w-12 h-12 text-destructive" />
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">结果加载出错</h2>
        <p className="text-sm text-muted-foreground">
          {errorMessage || '无法加载你的测试结果，请稍后重试'}
        </p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <Button onClick={onRetry} disabled={isFetching}>
            {isFetching ? '重试中...' : '重新加载'}
          </Button>
        )}
        {onSkip && <Button variant="outline" onClick={onSkip}>跳过</Button>}
      </div>
    </div>
  );
}
