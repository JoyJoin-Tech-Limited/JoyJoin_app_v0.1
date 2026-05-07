import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';

interface PersonalityDiceStubProps {
  isHost: boolean;
  onAdvance: () => void;
  isAdvancing: boolean;
}

export function PersonalityDiceStub({ isHost, onAdvance, isAdvancing }: PersonalityDiceStubProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-full bg-gradient-to-br from-pink-50 via-fuchsia-50 to-purple-50 dark:from-pink-950 dark:via-fuchsia-950 dark:to-zinc-900 px-6"
      data-testid="personality-dice-stub"
    >
      <div className="text-center max-w-sm">
        <div className="text-7xl mb-6">🎲</div>
        <h2 className="text-3xl font-black text-foreground mb-2">人格骰子</h2>
        <p className="text-base text-muted-foreground mb-2">即将到来 · v3 版本</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          掷出骰子，随机触发人格挑战——看看命运给你安排了什么！
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
