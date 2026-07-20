import type { LucideIcon } from "lucide-react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/admin/EmptyState";

export function FlashListSkeleton() {
  return (
    <div className="grid gap-3" aria-label="正在加载闪现运营内容">
      {[0, 1, 2].map((index) => (
        <Card key={index}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FlashErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
        <div>
          <p className="font-medium">闪现内容暂时没加载出来</p>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {message || "请检查服务端连接后再试一次。"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-flash-retry">
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          重新加载
        </Button>
      </CardContent>
    </Card>
  );
}

export function FlashEmptyState({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <CardContent>
        <EmptyState
          title={title}
          description={description}
          icon={Icon ? <Icon className="mb-3 h-8 w-8 text-primary/50" aria-hidden="true" /> : undefined}
        />
      </CardContent>
    </Card>
  );
}
