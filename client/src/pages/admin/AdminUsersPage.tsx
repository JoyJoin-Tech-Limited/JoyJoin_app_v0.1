import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Search, UserX, UserCheck, Calendar, Crown, AlertCircle, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  gender?: string;
  dateOfBirth?: string;
  primaryRole?: string;
  isAdmin: boolean;
  isBanned: boolean;
  hasCompletedRegistration: boolean;
  createdAt: string;
}

interface UserDetails extends User {
  events: any[];
  subscriptions: any[];
  payments: any[];
}

export default function AdminUsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "subscribed" | "banned">("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const { data: users = [], isLoading, isError, error, refetch } = useQuery<User[]>({
    queryKey: ["/api/admin/users", { search: searchQuery, filter: filterStatus === "all" ? undefined : filterStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (filterStatus !== "all") params.append("filter", filterStatus);
      const response = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.users || [];
    },
    retry: 2,
  });

  const { data: userDetails, isLoading: isLoadingDetails } = useQuery<UserDetails>({
    queryKey: ["/api/admin/users", selectedUser],
    enabled: !!selectedUser,
  });

  const banMutation = useMutation({
    mutationFn: (userId: string) => 
      fetch(`/api/admin/users/${userId}/ban`, { 
        method: "PATCH",
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) => 
      fetch(`/api/admin/users/${userId}/unban`, { 
        method: "PATCH",
        credentials: "include",
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
  });

  const handleBanToggle = (user: User) => {
    if (user.isBanned) {
      unbanMutation.mutate(user.id);
    } else {
      banMutation.mutate(user.id);
    }
  };

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">加载失败</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error && error.message.includes("401") 
                    ? "您没有访问权限"
                    : "无法加载用户数据，请稍后重试"}
                </p>
              </div>
              <Button 
                onClick={() => refetch()} 
                variant="default"
                data-testid="button-retry-users"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理所有用户账户</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户（姓名、邮箱、手机号）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-users"
          />
        </div>
        <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
            <TabsTrigger value="subscribed" data-testid="filter-subscribed">会员</TabsTrigger>
            <TabsTrigger value="banned" data-testid="filter-banned">已封禁</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? "未找到匹配的用户" : "暂无用户"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card
              key={user.id}
              className="cursor-pointer hover-elevate active-elevate-2 transition-all"
              onClick={() => setSelectedUser(user.id)}
              data-testid={`card-user-${user.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {user.firstName} {user.lastName}
                    {user.isAdmin && <Crown className="h-4 w-4 text-amber-500" />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <div className="flex flex-col gap-1">
                  {user.isBanned && <Badge variant="destructive">已封禁</Badge>}
                  {!user.hasCompletedRegistration && <Badge variant="secondary">未完成注册</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">手机号</span>
                  <span className="font-medium">{user.phoneNumber}</span>
                </div>
                {user.gender && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">性别</span>
                    <span className="font-medium">
                      {user.gender === "male" ? "男" : user.gender === "female" ? "女" : "其他"}
                    </span>
                  </div>
                )}
                {user.dateOfBirth && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">年龄</span>
                    <span className="font-medium">{calculateAge(user.dateOfBirth)}岁</span>
                  </div>
                )}
                {user.primaryRole && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">社交角色</span>
                    <Badge variant="outline">{user.primaryRole}</Badge>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">注册时间</span>
                  <span className="text-xs">{format(new Date(user.createdAt), "yyyy/MM/dd")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              用户详情
              {userDetails?.isAdmin && <Crown className="h-5 w-5 text-amber-500" />}
              {userDetails?.isBanned && <Badge variant="destructive">已封禁</Badge>}
            </DialogTitle>
            <DialogDescription>查看用户的完整信息和活动记录</DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="space-y-4 py-4">
              <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">姓名</p>
                  <p className="font-medium">{userDetails.firstName} {userDetails.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">邮箱</p>
                  <p className="font-medium">{userDetails.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">手机号</p>
                  <p className="font-medium">{userDetails.phoneNumber}</p>
                </div>
                {userDetails.gender && (
                  <div>
                    <p className="text-sm text-muted-foreground">性别</p>
                    <p className="font-medium">
                      {userDetails.gender === "male" ? "男" : userDetails.gender === "female" ? "女" : "其他"}
                    </p>
                  </div>
                )}
                {userDetails.dateOfBirth && (
                  <div>
                    <p className="text-sm text-muted-foreground">年龄</p>
                    <p className="font-medium">{calculateAge(userDetails.dateOfBirth)}岁</p>
                  </div>
                )}
                {userDetails.primaryRole && (
                  <div>
                    <p className="text-sm text-muted-foreground">社交角色</p>
                    <Badge variant="outline">{userDetails.primaryRole}</Badge>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">注册时间</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(userDetails.createdAt), "yyyy年MM月dd日")}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">参与活动</h3>
                {userDetails.events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">尚未参与任何活动</p>
                ) : (
                  <div className="space-y-2">
                    {userDetails.events.map((event) => (
                      <div key={event.id} className="flex justify-between text-sm border-l-2 border-primary pl-3 py-1">
                        <span>{event.eventType}</span>
                        <span className="text-muted-foreground">
                          {format(new Date(event.dateTime), "yyyy/MM/dd")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">订阅状态</h3>
                {userDetails.subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">暂无活跃订阅</p>
                ) : (
                  <div className="space-y-2">
                    {userDetails.subscriptions.map((sub) => (
                      <div key={sub.id} className="flex justify-between text-sm">
                        <span>{sub.planType}</span>
                        <Badge variant="outline">{sub.isActive ? "活跃" : "已过期"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedUser(null)} data-testid="button-close-details">
              关闭
            </Button>
            {userDetails && !userDetails.isAdmin && (
              <Button
                variant={userDetails.isBanned ? "default" : "destructive"}
                onClick={() => handleBanToggle(userDetails)}
                disabled={banMutation.isPending || unbanMutation.isPending}
                data-testid={userDetails.isBanned ? "button-unban-user" : "button-ban-user"}
              >
                {userDetails.isBanned ? (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    解除封禁
                  </>
                ) : (
                  <>
                    <UserX className="h-4 w-4 mr-2" />
                    封禁用户
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
