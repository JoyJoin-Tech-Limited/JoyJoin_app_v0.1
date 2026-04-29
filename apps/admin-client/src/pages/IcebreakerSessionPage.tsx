import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function IcebreakerSessionPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <h1 className="text-xl font-semibold">页面升级中</h1>
      <p className="text-sm text-muted-foreground text-center">
        旧版破冰游戏工具已被全新的 Social Icebreaker 会话系统取代。
      </p>
      <Button onClick={() => setLocation("/dashboard")}>返回仪表盘</Button>
    </div>
  );
}
