import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/ui/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/auth/useAuth";

export default function AdminLoginPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      setLocation("/admin");
    }
  }, [isAuthenticated, user, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/admin/login", data);
      return await res.json();
    },
    onSuccess: async () => {
      toast({
        title: "登录成功",
        description: "欢迎访问管理后台",
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      setTimeout(() => {
        setLocation("/admin");
      }, 500);
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "登录失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast({
        title: "信息不完整",
        description: "请输入用户名和密码",
        variant: "destructive",
      });
      return;
    }

    setError("");
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-4 text-center pb-6">
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-600 dark:to-slate-800 flex items-center justify-center shadow-md">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>

          <div>
            <CardTitle className="text-2xl font-bold">管理后台</CardTitle>
            <CardDescription className="mt-2">
              悦聚·Joy Admin Portal
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-username" className="text-sm font-medium">
                管理员用户名
              </Label>
              <Input
                id="admin-username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-11"
                autoComplete="username"
                data-testid="input-admin-username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-sm font-medium">
                密码
              </Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11"
                autoComplete="current-password"
                data-testid="input-admin-password"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-11"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? "登录中..." : "登录管理后台"}
            </Button>
          </form>

          <div className="pt-4 border-t">
            <p className="text-xs text-center text-muted-foreground">
              仅限授权管理员访问 · 所有操作将被记录
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
