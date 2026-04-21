type IcebreakerToolSelectorProps = {
  onOpenMiniScript: () => void;
};

export function IcebreakerToolSelector({ onOpenMiniScript }: IcebreakerToolSelectorProps) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted-foreground mb-2">同桌工具</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onOpenMiniScript}
          className="relative flex-1 min-w-[140px] max-w-full rounded-2xl border border-indigo-200/80 bg-white/90 dark:bg-zinc-900/80 dark:border-indigo-800 p-4 text-left shadow-sm active:scale-[0.99] transition"
        >
          <span className="absolute top-2 right-2 rounded-full bg-indigo-100 dark:bg-indigo-950 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
            抓马
          </span>
          <span className="text-2xl">🎭</span>
          <p className="mt-1 text-sm font-bold text-foreground">迷你剧本杀</p>
          <p className="text-xs text-muted-foreground mt-0.5">轻量共创剧本</p>
        </button>
      </div>
    </div>
  );
}
