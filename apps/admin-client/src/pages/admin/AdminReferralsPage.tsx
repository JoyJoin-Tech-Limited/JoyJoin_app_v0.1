import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Send, UserPlus, Users, AlertTriangle, Trophy } from "lucide-react";
import AdminQueryError from "@/components/admin/AdminQueryError";
import EmptyState from "@/components/admin/EmptyState";

interface ReferralStats {
  invitations: {
    totalSent: number;
    totalClicks: number;
    totalUses: number;
    matchedTogether: number;
    duoInvites: number;
  };
  referrals: {
    totalCodes: number;
    totalClicks: number;
    totalConversions: number;
    inviterRewardsIssued: number;
    inviteeRewardsIssued: number;
  };
  funnel: {
    invitationClickToUse: number | null;
    referralClickToConversion: number | null;
  };
  abuse: {
    selfInvitationUses: number;
    selfReferralConversions: number;
    totalSelfReferralFlags: number;
  };
  topInviters: Array<{ userId: string; displayName: string | null; count: number }>;
  topReferrers: Array<{ userId: string; displayName: string | null; count: number }>;
}

function pct(ratio: number | null): string {
  if (ratio === null) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

export default function AdminReferralsPage() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery<ReferralStats>({
    queryKey: ["/api/admin/referrals/stats"],
  });

  if (isError) {
    return (
      <div className="p-6">
        <AdminQueryError
          title="邀请裂变数据加载失败"
          error={error}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const totalSent = stats ? stats.invitations.totalSent + stats.referrals.totalCodes : 0;
  const totalSignups = stats ? stats.invitations.totalUses + stats.referrals.totalConversions : 0;
  const matchedTogether = stats?.invitations.matchedTogether ?? 0;
  const signupRate = stats && totalSent > 0 ? totalSignups / totalSent : null;
  const matchedRate = stats && totalSignups > 0 ? matchedTogether / totalSignups : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">邀请裂变</h1>
        <p className="text-muted-foreground mt-1">邀请链接与推荐码的转化漏斗及达人排行</p>
      </div>

      {isLoading || !stats ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-funnel-sent">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">邀请发送</CardTitle>
              <Send className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSent}</div>
              <p className="text-xs text-muted-foreground">
                邀请链接 {stats.invitations.totalSent}（含双人成行 {stats.invitations.duoInvites}）· 推荐码 {stats.referrals.totalCodes}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-funnel-signup">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">注册转化</CardTitle>
              <UserPlus className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalSignups}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{pct(signupRate)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                邀请接受 {stats.invitations.totalUses}（点击率转化 {pct(stats.funnel.invitationClickToUse)}）· 推荐注册 {stats.referrals.totalConversions}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-funnel-matched">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">排桌转化</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {matchedTogether}
                <span className="ml-2 text-sm font-normal text-muted-foreground">{pct(matchedRate)}</span>
              </div>
              <p className="text-xs text-muted-foreground">邀请双方被排进同一场活动的次数</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" data-testid="card-top-inviters">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              邀请达人
            </CardTitle>
            <Badge variant="outline" className="font-normal">Top 20</Badge>
          </CardHeader>
          <CardContent>
            {isLoading || !stats ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : stats.topInviters.length === 0 ? (
              <EmptyState title="暂无邀请转化记录" description="有用户成功邀请好友后会显示在这里" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead className="text-right">成功邀请</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topInviters.map((inviter, index) => (
                    <TableRow key={inviter.userId} data-testid={`row-inviter-${inviter.userId}`}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{inviter.displayName || "未设置昵称"}</p>
                          <p className="text-xs text-muted-foreground">{inviter.userId.slice(0, 12)}…</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{inviter.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card
          className={stats && stats.abuse.totalSelfReferralFlags > 0 ? "border-amber-500/50 bg-amber-500/5" : ""}
          data-testid="card-abuse-flags"
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stats && stats.abuse.totalSelfReferralFlags > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              异常提示
            </CardTitle>
            {stats && (
              <Badge variant={stats.abuse.totalSelfReferralFlags > 0 ? "default" : "secondary"} className={stats.abuse.totalSelfReferralFlags > 0 ? "bg-amber-500 hover:bg-amber-500" : ""}>
                {stats.abuse.totalSelfReferralFlags}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading || !stats ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自己接受自己的邀请</span>
                  <span className="font-medium">{stats.abuse.selfInvitationUses}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">自己使用自己的推荐码</span>
                  <span className="font-medium">{stats.abuse.selfReferralConversions}</span>
                </div>
                <p className="text-xs text-muted-foreground border-t pt-3">
                  自邀自用属于异常信号，可能为刷奖励行为。数量大于 0 时建议结合用户详情进一步核查；当前仅作提示，不自动处理。
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" data-testid="card-top-referrers">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              推荐达人
            </CardTitle>
            <Badge variant="outline" className="font-normal">Top 20</Badge>
          </CardHeader>
          <CardContent>
            {isLoading || !stats ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : stats.topReferrers.length === 0 ? (
              <EmptyState title="暂无推荐转化记录" description="有用户通过推荐码成功拉新后会显示在这里" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">排名</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead className="text-right">成功推荐</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.topReferrers.map((referrer, index) => (
                    <TableRow key={referrer.userId} data-testid={`row-referrer-${referrer.userId}`}>
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{referrer.displayName || "未设置昵称"}</p>
                          <p className="text-xs text-muted-foreground">{referrer.userId.slice(0, 12)}…</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{referrer.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
