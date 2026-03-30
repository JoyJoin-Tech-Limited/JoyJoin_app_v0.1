import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';

interface MiniScriptBetaStubProps {
  isHost: boolean;
  onAdvance: () => void;
  isAdvancing: boolean;
}

export function MiniScriptBetaStub({ isHost, onAdvance, isAdvancing }: MiniScriptBetaStubProps) {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-full bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 dark:from-slate-950 dark:via-indigo-950 dark:to-zinc-900 px-6"
      data-testid="mini-script-beta-stub"
    >
      <div className="text-center max-w-sm">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 text-xs font-bold mb-4">
          <span>🧪</span>
          <span>Beta Lab</span>
        </div>
        <div className="text-7xl mb-6">🎭</div>
        <h2 className="text-3xl font-black text-foreground mb-2">迷你剧本杀</h2>
        <p className="text-base text-muted-foreground mb-2">实验阶段 · 可选体验</p>
        <p className="text-sm text-muted-foreground leading-relaxed mb-8">
          一场 15–20 分钟的轻量推理故事正在打磨中，未来会以限量 Beta 的方式逐步开放。
        </p>

        {isHost ? (
          <MobilePrimaryButton
            onClick={onAdvance}
            disabled={isAdvancing}
            className="w-full"
          >
            {isAdvancing ? '切换中...' : '继续下一环节 →'}
          </MobilePrimaryButton>
        ) : (
          <p className="text-sm text-muted-foreground">等主持人继续...</p>
        )}
      </div>
    </div>
  );
}
