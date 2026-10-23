import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, ArrowLeft, LayoutDashboard } from "lucide-react";
import { useLocation } from "wouter";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "超级管理员",
  operator: "运营",
  viewer: "只读",
};

export default function AdminForbidden({
  role,
  path,
}: {
  role?: string;
  path?: string;
}) {
  const [, setLocation] = useLocation();
  const roleLabel = role ? ROLE_LABEL[role] ?? role : "未知";

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center p-4"
      data-testid="admin-forbidden"
    >
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="space-y-4 text-center">
            <ShieldX className="mx-auto h-12 w-12 text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">403 · 无权访问该页面</h3>
              <p className="text-sm text-muted-foreground">
                你的角色（{roleLabel}）没有这一页的访问权限。这不是登录过期，
                重新登录也不会改变结果。
              </p>
              {path && (
                <p className="text-xs text-muted-foreground/80 break-all">{path}</p>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="default"
                onClick={() => setLocation("/admin/dashboard")}
                data-testid="button-forbidden-dashboard"
              >
                <LayoutDashboard className="mr-2 h-4 w-4" />
                返回数据看板
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                data-testid="button-forbidden-back"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回上一页
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              需要更高权限时，请联系超级管理员调整账号角色。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
