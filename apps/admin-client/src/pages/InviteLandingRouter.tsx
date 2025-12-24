import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import InvitationLandingPage from "./InvitationLandingPage";
import ReferralLandingPage from "./ReferralLandingPage";

export default function InviteLandingRouter() {
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();

  const { data: referralCheck, isLoading, isError } = useQuery<{ exists: boolean }>({
    queryKey: ['/api/referrals/check', code],
    enabled: !!code,
    retry: 2,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-accent/10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-accent/10">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2 justify-center">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <h2 className="text-xl font-semibold">加载失败</h2>
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              无法验证邀请链接，请稍后重试
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                variant="outline"
                onClick={() => window.location.reload()}
                data-testid="button-retry"
              >
                重试
              </Button>
              <Button 
                onClick={() => setLocation("/")}
                data-testid="button-home"
              >
                返回首页
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (referralCheck?.exists) {
    return <ReferralLandingPage />;
  }

  return <InvitationLandingPage />;
}
