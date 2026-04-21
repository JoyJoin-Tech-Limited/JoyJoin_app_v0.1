'use client';

import { useMemo, useState } from 'react';
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_MINI_SCRIPT_GENRES,
  MINI_SCRIPT_GENRE_OPTIONS,
  MINI_SCRIPT_STYLE_OPTIONS,
} from './miniscriptLabels';

export type MiniScriptConfigModalProps = {
  open: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  onSubmit: (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[] }) => void;
};

export function MiniScriptConfigModal({
  open,
  onClose,
  isSubmitting,
  onSubmit,
}: MiniScriptConfigModalProps) {
  const [style, setStyle] = useState<MiniScriptStyle>('modern_urban');
  const [genres, setGenres] = useState<MiniScriptGenre[]>(() => [...DEFAULT_MINI_SCRIPT_GENRES]);
  const genreSet = useMemo(() => new Set(genres), [genres]);

  if (!open) return null;

  const toggleGenre = (value: MiniScriptGenre) => {
    setGenres((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      const ordered = MINI_SCRIPT_GENRE_OPTIONS.map((g) => g.value).filter((g) => next.has(g));
      return ordered.length > 0 ? ordered : current;
    });
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center">
      <button
        type="button"
        aria-label="关闭"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />
      <div className="relative z-[1] w-full max-h-[85vh] rounded-t-3xl bg-background border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl flex flex-col gap-2">
        <div className="mx-auto h-1 w-12 rounded-full bg-muted mb-1" />
        <h2 className="text-lg font-bold text-foreground">迷你剧本杀</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          选择风格与题材，生成你们的轻量剧本（低冲突、无暴力）。
        </p>
        <div className="overflow-y-auto max-h-[48vh] mt-2 space-y-4">
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">风格（单选）</p>
            <div className="flex flex-wrap gap-2">
              {MINI_SCRIPT_STYLE_OPTIONS.map((option) => {
                const selected = option.value === style;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStyle(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm border transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100'
                        : 'border-transparent bg-muted/60 text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">题材（多选）</p>
            <div className="flex flex-wrap gap-2">
              {MINI_SCRIPT_GENRE_OPTIONS.map((option) => {
                const selected = genreSet.has(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleGenre(option.value)}
                    className={`rounded-full px-3 py-1.5 text-sm border transition ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 text-indigo-900 dark:text-indigo-100'
                        : 'border-transparent bg-muted/60 text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="pt-3 mt-1 border-t border-border">
          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            loading={isSubmitting}
            onClick={() => onSubmit({ style, genres })}
          >
            生成我们的剧本
          </Button>
        </div>
      </div>
    </div>
  );
}
