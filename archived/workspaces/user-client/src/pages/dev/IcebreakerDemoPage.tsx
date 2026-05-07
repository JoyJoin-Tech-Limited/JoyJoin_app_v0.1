import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function IcebreakerDemoPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
      <h1 className="text-xl font-semibold">演示已下线</h1>
      <p className="text-sm text-muted-foreground text-center">
        旧版破冰演示页面已被全新的 Social Icebreaker 会话系统取代。
      </p>
      <Button onClick={() => setLocation("/")}>返回首页</Button>
    </div>
  );
}
