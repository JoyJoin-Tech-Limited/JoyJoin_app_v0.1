'use client';

import { useEffect, useState } from 'react';
import type { SocialSessionState } from '@shared/socialIcebreaker';
import { PHASE_CONFIG } from '@shared/socialIcebreaker';
import { Button } from '@/components/ui/button';
import { IcebreakerToolSelector } from './IcebreakerToolSelector';
import { MiniScriptConfigModal } from './MiniScriptConfigModal';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';

export function MiniScriptPhasePanel({
  state,
  isHost,
  isAdvancing,
  onAdvancePhase,
  onGenerateMiniScript,
}: {
  state: SocialSessionState;
  isHost: boolean;
  isAdvancing: boolean;
  onAdvancePhase: () => Promise<void>;
  onGenerateMiniScript: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[] }) => Promise<void>;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const timeoutMinutes = PHASE_CONFIG.mini_script.timeoutMinutes;
  const endMs = state.phaseStartedAt + timeoutMinutes * 60 * 1000;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const remainSec = Math.max(0, Math.ceil((endMs - now) / 1000));
  const mm = Math.floor(remainSec / 60);
  const ss = remainSec % 60;
  const framework = state.miniScriptFramework;
  const miniScriptEnabled = state.enabledPhases?.includes('mini_script') ?? false;

  const handleSubmit = async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[] }) => {
    setSubmitting(true);
    try {
      await onGenerateMiniScript(payload);
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-indigo-50 via-slate-50 to-violet-50 dark:from-slate-950 dark:via-indigo-950 dark:to-zinc-900 px-4 py-4"
      data-testid="mini-script-phase-panel"
    >
      {isHost && miniScriptEnabled ? (
        <IcebreakerToolSelector onOpenMiniScript={() => setModalOpen(true)} />
      ) : null}

      <MiniScriptConfigModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        isSubmitting={submitting}
        onSubmit={handleSubmit}
      />

      {!framework ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center max-w-md mx-auto gap-3">
          <div className="text-5xl">🎭</div>
          <h2 className="text-xl font-black text-foreground">剧本尚未生成</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isHost
              ? '点击上方「迷你剧本杀」选择风格与题材，生成你们的剧本。'
              : '请等待主持人生成剧本…'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-8 max-w-lg mx-auto w-full">
          <div className="rounded-2xl border border-indigo-200/80 bg-white/90 dark:bg-zinc-900/80 dark:border-indigo-800 p-4 shadow-sm">
            <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mb-1">剧本大纲</p>
            <p className="text-xs text-muted-foreground mb-2">
              剩余 {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
            </p>
            <p className="text-sm text-foreground leading-relaxed">{framework.premise}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-foreground">角色与「小麻烦」钩子</p>
            {framework.characters.map((c) => (
              <div key={c.slotIndex} className="border-t border-border/60 pt-3 first:border-0 first:pt-0 text-sm space-y-1">
                <p className="font-semibold text-foreground">{c.roleLabel}</p>
                <p className="text-muted-foreground text-xs">钩子：{c.sinHook}</p>
                <p className="text-muted-foreground text-xs">表面：{c.alibi}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <p className="text-sm font-bold text-foreground">流程节拍</p>
            {framework.act_flow.map((act) => (
              <div key={act.actNumber} className="text-sm space-y-1">
                <p className="font-semibold">
                  第{act.actNumber}幕 · {act.title}
                </p>
                {act.beats.map((beat, i) => (
                  <p key={i} className="text-xs text-muted-foreground pl-1">
                    · {beat}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm text-sm space-y-2">
            <p className="font-bold text-foreground">结局机制</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{framework.ending.resolutionSummary}</p>
            <p className="text-muted-foreground text-xs leading-relaxed">{framework.ending.confessionMechanic}</p>
          </div>

          {isHost ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              disabled={isAdvancing}
              loading={isAdvancing}
              onClick={() => void onAdvancePhase()}
            >
              {isAdvancing ? '切换中…' : '进入回顾'}
            </Button>
          ) : (
            <p className="text-center text-xs text-muted-foreground">结束由主持人推进到回顾。</p>
          )}
        </div>
      )}
    </div>
  );
}
