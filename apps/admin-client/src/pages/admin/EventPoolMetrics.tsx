import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users } from "lucide-react";

interface EventPoolMetricsProps {
  totalPools: number;
  activePools: number;
  poolsWithWaiting: number;
  poolsWithEvents: number;
}

export default function EventPoolMetrics({
  totalPools,
  activePools,
  poolsWithWaiting,
  poolsWithEvents,
}: EventPoolMetricsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card data-testid="metric-total">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">总活动池数</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalPools}</div>
        </CardContent>
      </Card>

      <Card data-testid="metric-active">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">招募中池子</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{activePools}</div>
        </CardContent>
      </Card>

      <Card data-testid="metric-waiting">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            有人等待报名的池
          </CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{poolsWithWaiting}</div>
        </CardContent>
      </Card>

      <Card data-testid="metric-with-events">
        <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            已有成局/小组的池
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{poolsWithEvents}</div>
        </CardContent>
      </Card>
    </div>
  );
}
