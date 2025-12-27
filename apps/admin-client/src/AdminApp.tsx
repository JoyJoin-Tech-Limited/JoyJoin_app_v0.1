import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import { Button } from "@/components/ui/button";

function AdminRouter() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();

  // 登出mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/login");
    },
    onError: () => {
      // 即使登出失败，也清除本地状态并跳转
      queryClient.clear();
      setLocation("/login");
    },
  });

  const handleBackToLogin = () => {
    queryClient.clear();
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (location === "/login" || location === "/admin/login") {
    return <AdminLoginPage />;
  }

  if (!isAuthenticated) {
    return <AdminLoginPage />;
  }

  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">无权限访问</h1>
          <p className="text-muted-foreground">您没有管理员权限</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button
              variant="outline"
              onClick={handleBackToLogin}
              data-testid="button-back-to-login"
            >
              返回登录
            </Button>
            <Button
              variant="destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              {logoutMutation.isPending ? "登出中..." : "登出并重试"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <AdminLayout />;
}

function AdminApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AdminRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AdminApp;
