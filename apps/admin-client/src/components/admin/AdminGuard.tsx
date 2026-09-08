import { useAuth } from "@/hooks/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/ui/use-toast";
import { canAccessAdminPath } from "@/lib/adminNavConfig";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/admin/login");
    }
  }, [isLoading, user, setLocation]);

  useEffect(() => {
    if (!isLoading && user && !user.isAdmin) {
      const timer = setTimeout(() => setLocation("/admin/login"), 2000);
      return () => clearTimeout(timer);
    }
  }, [isLoading, user, setLocation]);

  // Route-level role guard — derived from the shared nav config so the
  // sidebar and this guard can never drift apart.
  useEffect(() => {
    if (!isLoading && user && user.isAdmin && !canAccessAdminPath(location, user.adminRole)) {
      toast({
        title: "无权访问该页面",
        description: "你的角色无法访问该页面，已返回数据看板。",
        variant: "destructive",
      });
      setLocation("/admin/dashboard");
    }
  }, [isLoading, user, location, setLocation, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">验证权限中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!user.isAdmin) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-warning" />
              <div>
                <h3 className="text-lg font-semibold">无权访问</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  您没有访问管理后台的权限
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  即将自动跳转至登录页...
                </p>
              </div>
              <Button
                onClick={() => setLocation("/admin/login")}
                variant="default"
                data-testid="button-goto-login"
              >
                <LogIn className="mr-2 h-4 w-4" />
                返回登录页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
