import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminQueryErrorProps {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

function toDisplayMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/^\d{3}:\s*/, "");
}

export default function AdminQueryError({
  title = "数据加载失败",
  error,
  onRetry,
  className,
}: AdminQueryErrorProps) {
  const message = toDisplayMessage(error);
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center rounded-lg border border-destructive/20 bg-destructive/5",
        className
      )}
      data-testid="admin-query-error"
    >
      <AlertCircle className="h-8 w-8 text-destructive/70 mb-3" />
      <p className="text-sm font-medium text-destructive">{title}</p>
      {message && (
        <p className="text-xs text-muted-foreground mt-1 max-w-md">{message}</p>
      )}
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
          data-testid="button-retry-query"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          重试
        </Button>
      )}
    </div>
  );
}
