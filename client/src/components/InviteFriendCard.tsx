import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Gift, ChevronRight } from "lucide-react";
import { Link } from "wouter";

interface InviteFriendCardProps {
  className?: string;
}

export default function InviteFriendCard({ className }: InviteFriendCardProps) {
  return (
    <Card className={`border-dashed border-primary/30 bg-primary/5 ${className}`} data-testid="card-invite-friend">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 font-medium text-sm">
                <span>邀请好友，一起玩</span>
                <Gift className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                成功邀请可获得专属折扣券
              </p>
            </div>
          </div>
          <Link href="/invite">
            <Button variant="ghost" size="sm" className="text-primary" data-testid="button-invite">
              去邀请
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
