/**
 * EmptyStage - Displayed when no assessment result is found.
 */

import { Button } from '@/components/ui/button';
import { SearchX } from 'lucide-react';
import { useLocation } from 'wouter';

export function EmptyStage() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 gap-4">
      <SearchX className="w-12 h-12 text-muted-foreground" />
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">未找到测试结果</h2>
        <p className="text-sm text-muted-foreground">
          无法加载你的测试结果，请稍后重试
        </p>
      </div>
      <Button onClick={() => setLocation('/personality-test')}>
        返回测试
      </Button>
    </div>
  );
}
