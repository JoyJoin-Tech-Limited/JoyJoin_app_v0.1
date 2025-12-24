import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

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

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">验证权限中...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/admin/login");
    }
  }, [isLoading, user, setLocation]);

  if (!user) {
    return null;
  }

  if (!user.isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
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
                  即将自动跳转至首页...
                </p>
              </div>
              <Button 
                onClick={() => setLocation("/")} 
                variant="default"
                data-testid="button-goto-home"
              >
                <Home className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
