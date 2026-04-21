import { useState } from 'react';
import MobilePrimaryButton from '@/components/mobile/MobilePrimaryButton';
import type { SocialSessionState } from '@shared/socialIcebreaker';

interface AuctionPhaseProps {
  state: SocialSessionState;
  userId: string;
  isHost: boolean;
  isAdvancing: boolean;
  onGenerateAuctionLots: () => Promise<void>;
  onPlaceAuctionBid: (amount: number) => Promise<void>;
  onCloseAuctionLot: () => Promise<void>;
  onAdvancePhase: () => Promise<void>;
}

export function AuctionPhase({
  state,
  userId,
  isHost,
  isAdvancing,
  onGenerateAuctionLots,
  onPlaceAuctionBid,
  onCloseAuctionLot,
  onAdvancePhase,
}: AuctionPhaseProps) {
  const [busy, setBusy] = useState<'gen' | 'bid' | 'close' | null>(null);
  const [bidInput, setBidInput] = useState('10');

  const lots = state.auctionLots || [];
  const idx = state.auctionCurrentLotIndex ?? 0;
  const currentLot = lots[idx];
  const high = state.auctionHighBid;
  const balance = state.auctionBalances?.[userId] ?? 0;
  const allClosed = state.auctionAllLotsClosed ?? false;

  const run = async (key: 'gen' | 'bid' | 'close', fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="flex flex-col min-h-full bg-gradient-to-br from-yellow-50 via-orange-50 to-rose-50 dark:from-yellow-950 dark:via-orange-950 dark:to-zinc-900 px-4 py-6 gap-4"
      data-testid="auction-phase"
    >
      <div className="text-center">
        <div className="text-6xl mb-2">🎪</div>
        <h2 className="text-2xl font-black text-foreground">脑洞拍卖会</h2>
        <p className="text-sm text-muted-foreground mt-1">虚拟币竞拍 · 仅供娱乐</p>
      </div>

      {lots.length === 0 && (
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto w-full">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            主持人生成今晚的竞拍条目后，大家用虚拟币出价；每一轮由主持人宣布落槌并进入下一标。
          </p>
          {isHost ? (
            <MobilePrimaryButton
              onClick={() => run('gen', onGenerateAuctionLots)}
              disabled={busy !== null}
              className="w-full"
            >
              {busy === 'gen' ? '生成中…' : '生成竞拍条目'}
            </MobilePrimaryButton>
          ) : (
            <p className="text-sm text-muted-foreground">等待主持人生成竞拍条目…</p>
          )}
        </div>
      )}

      {lots.length > 0 && !allClosed && currentLot && (
        <div className="flex flex-col gap-4 max-w-md mx-auto w-full">
          <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">
              第 {idx + 1} / {lots.length} 标
            </p>
            <p className="text-lg font-bold text-foreground">{currentLot.title}</p>
            {currentLot.teaser ? (
              <p className="text-sm text-muted-foreground mt-2">{currentLot.teaser}</p>
            ) : null}
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">当前最高：</span>
              {high ? (
                <span className="font-semibold">
                  {high.amount} 币（{high.userId === userId ? '你领先' : '其他玩家'}）
                </span>
              ) : (
                <span className="text-muted-foreground">暂无出价</span>
              )}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">我的余额：{balance} 币</div>
          </div>

          {!isHost && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-muted-foreground" htmlFor="auction-bid-amount">
                出价（须高于当前最高，且不超过余额）
              </label>
              <input
                id="auction-bid-amount"
                type="number"
                min={1}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-base"
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
              />
              <MobilePrimaryButton
                onClick={() => {
                  const n = Number.parseInt(bidInput, 10);
                  if (!Number.isFinite(n)) return;
                  void run('bid', () => onPlaceAuctionBid(n));
                }}
                disabled={busy !== null}
                className="w-full"
              >
                {busy === 'bid' ? '提交中…' : '出价'}
              </MobilePrimaryButton>
            </div>
          )}

          {isHost && (
            <button
              type="button"
              onClick={() => run('close', onCloseAuctionLot)}
              disabled={busy !== null}
              className="w-full rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground disabled:opacity-50"
            >
              {busy === 'close' ? '处理中…' : '关闭本标（落槌）'}
            </button>
          )}
        </div>
      )}

      {lots.length > 0 && allClosed && (
        <div className="flex flex-col items-center gap-4 max-w-md mx-auto w-full text-center">
          <p className="text-sm text-muted-foreground">全部竞拍已完成。</p>
          {isHost ? (
            <MobilePrimaryButton onClick={onAdvancePhase} disabled={isAdvancing} className="w-full">
              {isAdvancing ? '切换中…' : '进入下一阶段 →'}
            </MobilePrimaryButton>
          ) : (
            <p className="text-sm text-muted-foreground">等待主持人进入下一阶段…</p>
          )}
        </div>
      )}
    </div>
  );
}
