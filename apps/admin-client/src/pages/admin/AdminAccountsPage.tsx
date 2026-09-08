import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/ui/use-toast";
import { Shield, Plus, Key, ToggleLeft, ToggleRight } from "lucide-react";
import AdminQueryError from "@/components/admin/AdminQueryError";

interface AdminAccount {
  id: string;
  username: string;
  role: string;
  status: string;
  displayName?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "超级管理员",
  operator: "运营",
  viewer: "只读",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  operator: "secondary",
  viewer: "outline",
};

export default function AdminAccountsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState({ username: "", password: "", role: "operator", displayName: "" });
  const [newPassword, setNewPassword] = useState("");
  const [pendingRoleChange, setPendingRoleChange] = useState<{ account: AdminAccount; newRole: string } | null>(null);
  const [pendingStatusToggle, setPendingStatusToggle] = useState<AdminAccount | null>(null);

  const {
    data: accounts = [],
    isLoading,
    isError,
    error: accountsError,
    refetch: refetchAccounts,
  } = useQuery<AdminAccount[]>({
    queryKey: ["/api/admin/accounts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/accounts");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof newAccount) => {
      const res = await apiRequest("POST", "/api/admin/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "账号已创建" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
      setCreateOpen(false);
      setNewAccount({ username: "", password: "", role: "operator", displayName: "" });
    },
    onError: (e: Error) => toast({ title: "创建失败", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, string> }) => {
      const res = await apiRequest("PATCH", `/api/admin/accounts/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/accounts"] });
    },
    onError: (e: Error) => toast({ title: "更新失败", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ id, newPassword: pwd }: { id: string; newPassword: string }) => {
      const res = await apiRequest("POST", `/api/admin/accounts/${id}/reset-password`, { newPassword: pwd });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "密码已重置" });
      setResetOpen(null);
      setNewPassword("");
    },
    onError: (e: Error) => toast({ title: "重置失败", description: e.message, variant: "destructive" }),
  });

  const handleRoleChange = (account: AdminAccount, newRole: string) => {
    if (newRole === account.role) return;
    if (account.role === "super_admin" || newRole === "super_admin") {
      setPendingRoleChange({ account, newRole });
      return;
    }
    updateMutation.mutate(
      { id: account.id, updates: { role: newRole } },
      {
        onSuccess: () =>
          toast({
            title: "角色已更新",
            description: `${account.username} 已调整为「${ROLE_LABELS[newRole] || newRole}」`,
          }),
      },
    );
  };

  const handleCreateAccount = () => {
    if (newAccount.password.length < 8) {
      toast({
        title: "密码不符合要求",
        description: "初始密码至少需要 8 个字符",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newAccount);
  };

  if (user?.adminRole !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>仅超级管理员可访问此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">管理员账号</h1>
          <p className="text-sm text-muted-foreground mt-1">管理后台账号及权限</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-admin-account">
              <Plus className="h-4 w-4 mr-2" />
              新增账号
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新增管理员账号</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="new-username">用户名</Label>
                <Input
                  id="new-username"
                  value={newAccount.username}
                  onChange={(e) => setNewAccount({ ...newAccount, username: e.target.value })}
                  placeholder="英文用户名"
                  data-testid="input-new-username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-displayname">显示名称（可选）</Label>
                <Input
                  id="new-displayname"
                  value={newAccount.displayName}
                  onChange={(e) => setNewAccount({ ...newAccount, displayName: e.target.value })}
                  placeholder="显示名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">初始密码</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newAccount.password}
                  onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                  placeholder="至少8个字符"
                  data-testid="input-new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>角色</Label>
                <Select
                  value={newAccount.role}
                  onValueChange={(v) => setNewAccount({ ...newAccount, role: v })}
                >
                  <SelectTrigger data-testid="select-new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">超级管理员</SelectItem>
                    <SelectItem value="operator">运营</SelectItem>
                    <SelectItem value="viewer">只读</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreateAccount}
                disabled={createMutation.isPending || newAccount.password.length < 8}
                data-testid="button-confirm-create-admin"
              >
                {createMutation.isPending ? "创建中..." : "创建账号"}
              </Button>
              {newAccount.password.length > 0 && newAccount.password.length < 8 && (
                <p className="text-xs text-destructive" data-testid="text-password-error">
                  密码至少需要 8 个字符
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="p-4">
              <AdminQueryError
                title="管理员账号加载失败"
                error={accountsError}
                onRetry={() => refetchAccounts()}
              />
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">加载中...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>显示名称</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后登录</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} data-testid={`admin-account-row-${account.username}`}>
                    <TableCell className="font-medium">{account.username}</TableCell>
                    <TableCell>{account.displayName || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={account.role}
                        onValueChange={(role) => handleRoleChange(account, role)}
                        disabled={account.id === user?.id}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <Badge variant={ROLE_COLORS[account.role] || "outline"}>
                            {ROLE_LABELS[account.role] || account.role}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="super_admin">超级管理员</SelectItem>
                          <SelectItem value="operator">运营</SelectItem>
                          <SelectItem value="viewer">只读</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.status === "active" ? "default" : "secondary"}>
                        {account.status === "active" ? "启用" : "禁用"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {account.lastLoginAt
                        ? new Date(account.lastLoginAt).toLocaleString("zh-CN")
                        : "从未登录"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        {/* Toggle enable/disable – cannot disable yourself */}
                        {account.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingStatusToggle(account)}
                            aria-label={account.status === "active" ? `禁用账号 ${account.username}` : `启用账号 ${account.username}`}
                            title={account.status === "active" ? "禁用账号" : "启用账号"}
                          >
                            {account.status === "active" ? (
                              <ToggleRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}

                        {/* Reset password */}
                        <Dialog
                          open={resetOpen === account.id}
                          onOpenChange={(open) => {
                            setResetOpen(open ? account.id : null);
                            if (!open) setNewPassword("");
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" title="重置密码">
                              <Key className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>重置密码 – {account.username}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-2">
                              <div className="space-y-2">
                                <Label htmlFor="reset-password">新密码</Label>
                                <Input
                                  id="reset-password"
                                  type="password"
                                  value={newPassword}
                                  onChange={(e) => setNewPassword(e.target.value)}
                                  placeholder="至少8个字符"
                                />
                              </div>
                              <Button
                                className="w-full"
                                onClick={() =>
                                  resetPasswordMutation.mutate({ id: account.id, newPassword })
                                }
                                disabled={resetPasswordMutation.isPending}
                              >
                                {resetPasswordMutation.isPending ? "重置中..." : "确认重置"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      暂无管理员账号
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingRoleChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRoleChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认变更超级管理员权限</AlertDialogTitle>
            <AlertDialogDescription>
              将账号 <strong>{pendingRoleChange?.account.username}</strong>
              {pendingRoleChange?.account.displayName
                ? `（${pendingRoleChange.account.displayName}）`
                : ""}{" "}
              的角色从「{pendingRoleChange ? ROLE_LABELS[pendingRoleChange.account.role] || pendingRoleChange.account.role : ""}」
              变更为「{pendingRoleChange ? ROLE_LABELS[pendingRoleChange.newRole] || pendingRoleChange.newRole : ""}」。
              {pendingRoleChange?.newRole === "super_admin"
                ? "超级管理员拥有全部权限，包括管理员账号管理。"
                : "移除超级管理员后，该账号将失去管理员账号管理等高权限。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-role-change">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingRoleChange) return;
                const { account, newRole } = pendingRoleChange;
                updateMutation.mutate(
                  { id: account.id, updates: { role: newRole } },
                  {
                    onSuccess: () =>
                      toast({
                        title: "角色已更新",
                        description: `${account.username} 已调整为「${ROLE_LABELS[newRole] || newRole}」`,
                      }),
                  },
                );
                setPendingRoleChange(null);
              }}
              data-testid="button-confirm-role-change"
            >
              确认变更
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingStatusToggle !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStatusToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatusToggle?.status === "active" ? "确认禁用账号" : "确认启用账号"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatusToggle?.status === "active" ? (
                <>
                  禁用后，账号 <strong>{pendingStatusToggle?.username}</strong> 将无法登录管理后台。
                </>
              ) : (
                <>
                  启用后，账号 <strong>{pendingStatusToggle?.username}</strong> 将恢复管理后台访问权限。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-status-toggle">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingStatusToggle) return;
                const account = pendingStatusToggle;
                const nextStatus = account.status === "active" ? "disabled" : "active";
                updateMutation.mutate(
                  { id: account.id, updates: { status: nextStatus } },
                  {
                    onSuccess: () =>
                      toast({
                        title: nextStatus === "active" ? "账号已启用" : "账号已禁用",
                        description: account.username,
                      }),
                  },
                );
                setPendingStatusToggle(null);
              }}
              data-testid="button-confirm-status-toggle"
            >
              确认
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
