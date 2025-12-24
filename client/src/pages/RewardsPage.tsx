import BottomNav from "@/components/BottomNav";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Coins, Gift, ArrowLeft, History, Check, ChevronRight } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface RedeemableItem {
  id: string;
  name: string;
  nameCn: string;
  description: string;
  descriptionCn: string;
  costCoins: number;
  type: 'discount_coupon' | 'free_event' | 'priority_access';
  value: number;
  validDays: number;
}

interface LevelConfig {
  level: number;
  nameCn: string;
  icon: string;
}

interface GamificationInfo {
  experiencePoints: number;
  joyCoins: number;
  currentLevel: number;
  levelConfig: LevelConfig;
  nextLevelInfo: { progress: number; xpNeeded: number } | null;
}

interface Transaction {
  id: string;
  transactionType: string;
  xpAmount: number;
  coinsAmount: number;
  descriptionCn: string;
  createdAt: string;
}

export default function RewardsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<RedeemableItem | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const { data: gamification, isLoading: gamificationLoading } = useQuery<GamificationInfo>({
    queryKey: ["/api/user/gamification"],
  });

  const { data: redeemableItems, isLoading: itemsLoading } = useQuery<RedeemableItem[]>({
    queryKey: ["/api/user/gamification/redeemable-items"],
  });

  const { data: history } = useQuery<Transaction[]>({
    queryKey: ["/api/user/gamification/history"],
  });

  const redeemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest("POST", "/api/user/gamification/redeem", { itemId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/gamification"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/coupons"] });
      setConfirmDialogOpen(false);
      setSelectedItem(null);
      toast({
        title: "兑换成功",
        description: `已兑换 ${data.redeemedItem?.nameCn}，优惠券已添加到您的账户`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "兑换失败",
        description: error.message || "悦币不足或兑换出错",
        variant: "destructive",
      });
    },
  });

  const handleRedeemClick = (item: RedeemableItem) => {
    setSelectedItem(item);
    setConfirmDialogOpen(true);
  };

  const handleConfirmRedeem = () => {
    if (selectedItem) {
      redeemMutation.mutate(selectedItem.id);
    }
  };

  const joyCoins = gamification?.joyCoins || 0;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'discount_coupon': return '折扣券';
      case 'free_event': return '免费名额';
      case 'priority_access': return '优先权';
      default: return '奖励';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'discount_coupon': return 'bg-purple-500/10 text-purple-600';
      case 'free_event': return 'bg-green-500/10 text-green-600';
      case 'priority_access': return 'bg-blue-500/10 text-blue-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-16 px-4 gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/profile')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">悦币商城</h1>
        </div>
      </header>

      <main className="flex-1 p-4 pb-24 space-y-4">
        {gamificationLoading ? (
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ) : gamification && (
          <Card className="border-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm opacity-80">我的悦币</div>
                  <div className="text-3xl font-bold flex items-center gap-2" data-testid="text-total-coins">
                    <Coins className="h-6 w-6" />
                    {joyCoins}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm opacity-80">
                    Lv.{gamification.levelConfig.level} {gamification.levelConfig.nameCn}
                  </div>
                  <div className="text-2xl">{gamification.levelConfig.icon}</div>
                </div>
              </div>
              
              {gamification.nextLevelInfo && (
                <div className="mt-3">
                  <Progress 
                    value={gamification.nextLevelInfo.progress} 
                    className="h-2 bg-white/20 [&>div]:bg-white"
                  />
                  <div className="text-xs mt-1 opacity-80">
                    距离下一级还需 {gamification.nextLevelInfo.xpNeeded} XP
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">可兑换奖励</h2>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-view-history">
                <History className="h-4 w-4 mr-1" />
                记录
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>悦币记录</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 max-h-[70vh] overflow-y-auto">
                {history?.map((tx) => (
                  <div 
                    key={tx.id} 
                    className="flex items-center justify-between py-2 border-b"
                    data-testid={`transaction-${tx.id}`}
                  >
                    <div>
                      <div className="text-sm font-medium">{tx.descriptionCn}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString('zh-CN')}
                      </div>
                    </div>
                    <div className="text-right">
                      {tx.xpAmount !== 0 && (
                        <div className={`text-sm ${tx.xpAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.xpAmount > 0 ? '+' : ''}{tx.xpAmount} XP
                        </div>
                      )}
                      {tx.coinsAmount !== 0 && (
                        <div className={`text-sm ${tx.coinsAmount > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {tx.coinsAmount > 0 ? '+' : ''}{tx.coinsAmount} 悦币
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(!history || history.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    暂无记录
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {itemsLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {redeemableItems?.map((item) => {
              const canAfford = joyCoins >= item.costCoins;
              return (
                <Card 
                  key={item.id} 
                  className={`transition-all ${canAfford ? 'hover-elevate cursor-pointer' : 'opacity-60'}`}
                  onClick={() => canAfford && handleRedeemClick(item)}
                  data-testid={`reward-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Gift className="h-6 w-6 text-purple-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.nameCn}</span>
                          <Badge variant="secondary" className={`text-xs ${getTypeColor(item.type)}`}>
                            {getTypeLabel(item.type)}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{item.descriptionCn}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          有效期 {item.validDays} 天
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-yellow-600 font-bold">
                          <Coins className="h-4 w-4" />
                          {item.costCoins}
                        </div>
                        {canAfford ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground mt-1 ml-auto" />
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">悦币不足</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2">如何获得悦币？</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                完成活动签到 +30 悦币
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                提交活动反馈 +20 悦币
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                连续参加活动获得额外奖励
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" />
                深度模式注册 +50 悦币
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认兑换</DialogTitle>
            <DialogDescription>
              确定要使用 {selectedItem?.costCoins} 悦币兑换「{selectedItem?.nameCn}」吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">当前悦币</span>
              <span className="font-medium">{joyCoins}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-muted-foreground">消耗</span>
              <span className="font-medium text-red-500">-{selectedItem?.costCoins}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
              <span className="text-muted-foreground">兑换后</span>
              <span className="font-medium">{joyCoins - (selectedItem?.costCoins || 0)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleConfirmRedeem} 
              disabled={redeemMutation.isPending}
              data-testid="button-confirm-redeem"
            >
              {redeemMutation.isPending ? "兑换中..." : "确认兑换"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
