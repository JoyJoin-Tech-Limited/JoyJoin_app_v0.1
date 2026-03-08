import { useAuth } from "@/hooks/useAuth";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (!isLoading && (!user || !user.isAdmin)) {
    window.location.replace("https://admin.yuejuapp.com");
    return null;
  }

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

  if (!user || !user.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
