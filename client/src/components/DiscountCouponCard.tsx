import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clock } from "lucide-react";

interface DiscountCouponCardProps {
  discount: number;
  reason: string;
  expiresIn?: string;
}

export default function DiscountCouponCard({ discount, reason, expiresIn }: DiscountCouponCardProps) {
  return (
    <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">能量奖励</span>
            </div>
            <p className="text-xs text-muted-foreground">{reason}</p>
            {expiresIn && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{expiresIn}内有效</span>
              </div>
            )}
          </div>
          <Badge className="bg-primary text-primary-foreground text-lg font-bold px-3 py-1">
            -{discount}%
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
