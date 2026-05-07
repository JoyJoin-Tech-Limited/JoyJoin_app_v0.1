import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface IcebreakerResponse {
  question: string;
  category: string;
  categoryColor: string;
}

export default function IcebreakerTool() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading } = useQuery<IcebreakerResponse>({
    queryKey: ["/api/icebreakers/random", refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/icebreakers/random", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return await res.json();
    },
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const getCategoryVariant = (color: string): "default" | "secondary" | "destructive" | "outline" => {
    // Map color to badge variants for visual distinction
    if (color === "red" || color === "orange") return "destructive";
    if (color === "green" || color === "blue" || color === "purple") return "default";
    return "secondary";
  };

  return (
    <Card className="border bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">今天开场聊点啥？</h3>
          </div>
          {data?.category && (
            <Badge 
              variant={getCategoryVariant(data.categoryColor)}
              className="text-xs"
              data-testid="badge-question-category"
            >
              {data.category}
            </Badge>
          )}
        </div>

        <div className="bg-background rounded-lg p-4 min-h-[60px] flex items-center justify-center">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">加载中...</div>
          ) : (
            <p className="text-sm text-center">{data?.question || "点击下方按钮获取破冰问题"}</p>
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="button-draw-question"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            抽一个问题
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
            data-testid="button-refresh-question"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          轻松破冰，让初次见面不再尴尬
        </p>
      </CardContent>
    </Card>
  );
}
