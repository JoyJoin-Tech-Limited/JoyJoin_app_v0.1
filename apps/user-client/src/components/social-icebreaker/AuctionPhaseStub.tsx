import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';

interface AuctionPhaseStubProps {
  isHost: boolean;
  onAdvance: () => void;
  isAdvancing: boolean;
}

export function AuctionPhaseStub({ isHost, onAdvance, isAdvancing }: AuctionPhaseStubProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-full bg-gradient-to-br from-yellow-50 via-orange-50 to-rose-50 dark:from-yellow-950 dark:via-orange-950 dark:to-zinc-900 px-6"
      data-testid="auction-phase-stub"
    >
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6">🎪</div>
        <h2 className="text-3xl font-black text-foreground mb-2">脑洞拍卖会</h2>
        <p className="text-base text-muted-foreground mb-2">即将到来 · v2 版本</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          用虚拟货币竞拍最离谱的人生经历——谁的故事最精彩，谁就赢得全场掌声！
        </p>

        {isHost && (
          <MobilePrimaryButton
            onClick={onAdvance}
            disabled={isAdvancing}
            className="w-full"
          >
            {isAdvancing ? '切换中...' : '继续下一环节 →'}
          </MobilePrimaryButton>
        )}
        {!isHost && (
          <p className="text-sm text-muted-foreground">等主持人继续...</p>
        )}
      </div>
    </div>
  );
}
