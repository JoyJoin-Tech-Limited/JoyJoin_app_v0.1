import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GroupSparkMeterProps {
  energizers: number;
  connectors: number;
  reflectors: number;
}

export default function GroupSparkMeter({ energizers, connectors, reflectors }: GroupSparkMeterProps) {
  const total = energizers + connectors + reflectors;
  const energizerPercent = (energizers / total) * 100;
  const reflectorPercent = (reflectors / total) * 100;

  return (
    <Card className="border-0 bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">今晚组合</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">能量平衡</span>
            <span className="font-medium">均衡</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            <div className="bg-gradient-to-r from-orange-400 to-red-500" style={{ width: `${energizerPercent}%` }} />
            <div className="bg-gradient-to-r from-purple-400 to-indigo-400" style={{ width: `${100 - energizerPercent - reflectorPercent}%` }} />
            <div className="bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${reflectorPercent}%` }} />
          </div>
        </div>

        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span>⚡</span>
            <span>{energizers}位启动者</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🤝</span>
            <span>{connectors}位连接者</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🌿</span>
            <span>{reflectors}位思考者</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">共同兴趣：</span>桌游、居酒屋、中英双语
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
