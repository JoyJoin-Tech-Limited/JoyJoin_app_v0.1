import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { 
  Copy, 
  Gift, 
  Users, 
  Check, 
  ChevronLeft,
  Ticket,
  Crown,
  Star,
  Share2,
  Sparkles,
  Loader2
} from "lucide-react";
import { Link } from "wouter";

interface InviteStats {
  referralCode: string;
  totalInvites: number;
  successfulInvites: number;
  platformTotal: number;
}

const TIER_REWARDS = [
  { count: 1, reward: "7折券", icon: Ticket, unlocked: false },
  { count: 3, reward: "5折券 x2", icon: Star, unlocked: false },
  { count: 5, reward: "免费月卡", icon: Crown, unlocked: false },
];

export default function InvitePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: stats, isLoading, isError } = useQuery<InviteStats>({
    queryKey: ['/api/referrals/stats'],
    enabled: !!user,
  });

  const referralCode = stats?.referralCode || "";
  const inviteLink = typeof window !== "undefined" && referralCode
    ? `${window.location.origin}/invite/${referralCode}` 
    : "";

  const successfulInvites = stats?.successfulInvites || 0;
  const platformTotal = stats?.platformTotal || 0;

  const tiersWithStatus = TIER_REWARDS.map(tier => ({
    ...tier,
    unlocked: successfulInvites >= tier.count
  }));

  const nextTier = tiersWithStatus.find(t => !t.unlocked);
  const progressToNextTier = nextTier 
    ? Math.min((successfulInvites / nextTier.count) * 100, 100)
    : 100;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "复制成功",
        description: "邀请链接已复制到剪贴板",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "复制失败",
        description: "请手动复制链接",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "邀请你来 JoyJoin",
          text: "和我一起参加有趣的盲盒社交活动吧！新人首单5折~",
          url: inviteLink,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10">
      <header className="sticky top-0 z-40 w-full bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4 gap-3">
          <Link href="/discover">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">邀请好友</h1>
        </div>
      </header>

      <div className="p-4 space-y-6 pb-24">
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 mb-2">
            <Gift className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">邀请好友 赢取奖励</h1>
          <p className="text-muted-foreground text-sm">
            分享邀请链接，好友注册即享双重福利
          </p>
        </div>

        <Card data-testid="card-rewards-info">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">邀请奖励</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Ticket className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">你获得：7折优惠券</div>
                  <p className="text-xs text-muted-foreground">每成功邀请1位好友</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/30">
                <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Star className="h-5 w-5 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">好友获得：首单5折</div>
                  <p className="text-xs text-muted-foreground">新用户专属首次报名优惠</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">双排奖励：免费月卡</div>
                  <p className="text-xs text-muted-foreground">和好友一起报名同场盲盒活动</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tier-progress">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-semibold">阶梯奖励</h2>
              </div>
              <Badge variant="secondary" className="text-xs">
                已邀请 {successfulInvites} 人
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {nextTier 
                    ? `距离下一奖励还差 ${nextTier.count - successfulInvites} 人`
                    : "已解锁所有奖励"
                  }
                </span>
                <span className="font-medium">{successfulInvites}/{nextTier?.count || 5}</span>
              </div>
              <Progress value={progressToNextTier} className="h-2" />
            </div>

            <div className="grid gap-2">
              {tiersWithStatus.map((tier, index) => (
                <div 
                  key={tier.count}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    tier.unlocked 
                      ? "bg-green-500/10 border border-green-500/30" 
                      : "bg-muted/50"
                  }`}
                  data-testid={`tier-reward-${tier.count}`}
                >
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    tier.unlocked ? "bg-green-500/20" : "bg-muted"
                  }`}>
                    {tier.unlocked ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <tier.icon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`font-medium text-sm ${tier.unlocked ? "text-green-700 dark:text-green-400" : ""}`}>
                      邀请 {tier.count} 人
                    </div>
                    <p className="text-xs text-muted-foreground">{tier.reward}</p>
                  </div>
                  {tier.unlocked && (
                    <Badge variant="outline" className="text-green-600 border-green-500/50 text-xs">
                      已解锁
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="text-center py-2">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>已有 <strong className="text-foreground">{platformTotal.toLocaleString()}</strong> 人成功邀请好友</span>
          </div>
        </div>

        <Card data-testid="card-invite-link">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">你的专属邀请链接</label>
              <div className="flex items-center gap-2">
                {isLoading ? (
                  <Skeleton className="flex-1 h-11 rounded-lg" />
                ) : (
                  <div className="flex-1 p-3 bg-muted rounded-lg text-sm text-muted-foreground truncate font-mono">
                    {inviteLink || "加载中..."}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyLink}
                  disabled={isLoading || !inviteLink}
                  data-testid="button-copy-link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleCopyLink}
                disabled={isLoading || !inviteLink}
                data-testid="button-copy"
              >
                <Copy className="h-4 w-4 mr-2" />
                复制链接
              </Button>
              <Button 
                className="w-full"
                onClick={handleShare}
                disabled={isLoading || !inviteLink}
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4 mr-2" />
                分享好友
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground space-y-1 px-4">
          <p>好友通过你的邀请链接注册后，双方自动获得奖励</p>
          <p>邀请奖励券可在"我的优惠"中查看和使用</p>
        </div>
      </div>
    </div>
  );
}
