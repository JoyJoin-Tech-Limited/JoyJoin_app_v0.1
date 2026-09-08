import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Redirect, Route, Switch, useLocation, Link } from "wouter";
import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/auth/useAuth";
import { usePageTitle, getPageTitle } from "@/hooks/admin/usePageTitle";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminWarRoomPage = lazy(() => import("@/pages/admin/AdminWarRoomPage"));
const AdminUsersPage = lazy(() => import("@/pages/admin/AdminUsersPage"));
const AdminSubscriptionsPage = lazy(() => import("@/pages/admin/AdminSubscriptionsPage"));
const AdminCouponsPage = lazy(() => import("@/pages/admin/AdminCouponsPage"));
const AdminVenuesPage = lazy(() => import("@/pages/admin/AdminVenuesPage"));
const AdminEventTemplatesPage = lazy(() => import("@/pages/admin/AdminEventTemplatesPage"));
const AdminEventsPage = lazy(() => import("@/pages/admin/AdminEventsPage"));
const AdminEventPoolsPage = lazy(() => import("@/pages/admin/AdminEventPoolsPage"));
const AdminFinancePage = lazy(() => import("@/pages/admin/AdminFinancePage"));
const AdminDataInsightsPage = lazy(() => import("@/pages/admin/AdminDataInsightsPage"));
const AdminOutcomeAnalyticsPage = lazy(() => import("@/pages/admin/AdminOutcomeAnalyticsPage"));
const AdminIcebreakerAiFeedbackPage = lazy(() => import("@/pages/admin/AdminIcebreakerAiFeedbackPage"));
const AdminContentPage = lazy(() => import("@/pages/admin/AdminContentPage"));
const AdminModerationPage = lazy(() => import("@/pages/admin/AdminModerationPage"));
const AdminContentFilterLogsPage = lazy(() => import("@/pages/admin/AdminContentFilterLogsPage"));
const AdminMatchingLabPage = lazy(() => import("@/pages/admin/AdminMatchingLabPage"));
const AdminNotificationsPage = lazy(() => import("@/pages/admin/AdminNotificationsPage"));
const AdminInteractionLogsPage = lazy(() => import("@/pages/admin/AdminInteractionLogsPage"));
const AdminFeedbackPage = lazy(() => import("@/pages/admin/AdminFeedbackPage"));
const AdminMatchingConfigPage = lazy(() => import("@/pages/admin/AdminMatchingConfigPage"));
const AdminMatchingLogsPage = lazy(() => import("@/pages/admin/AdminMatchingLogsPage"));
const AdminMatchingReviewsPage = lazy(() => import("@/pages/admin/AdminMatchingReviewsPage"));
const AdminPricingPage = lazy(() => import("@/pages/admin/AdminPricingPage"));
const AdminEvolutionPage = lazy(() => import("@/pages/admin/AdminEvolutionPage"));
const AdminAccountsPage = lazy(() => import("@/pages/admin/AdminAccountsPage"));
const AdminAuditLogsPage = lazy(() => import("@/pages/admin/AdminAuditLogsPage"));
const AdminFeatureFlagsPage = lazy(() => import("@/pages/admin/AdminFeatureFlagsPage"));
const AdminFlashPage = lazy(() => import("@/pages/admin/AdminFlashPage"));
const AdminReferralsPage = lazy(() => import("@/pages/admin/AdminReferralsPage"));
const AdminDuoInvitesPage = lazy(() => import("@/pages/admin/AdminDuoInvitesPage"));
const AdminBannersPage = lazy(() => import("@/pages/admin/AdminBannersPage"));

function AdminNotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <Compass className="h-10 w-10 text-muted-foreground/50" />
      <div>
        <h2 className="text-lg font-semibold">页面不存在</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          您访问的页面不存在或已被移动。
        </p>
      </div>
      <Button asChild variant="default" data-testid="button-back-dashboard">
        <Link href="/admin/dashboard">返回数据看板</Link>
      </Button>
    </div>
  );
}

export default function AdminLayout() {
  const { user } = useAuth();
  const [location] = useLocation();
  usePageTitle(location);

  const pageTitle = getPageTitle(location).split(" · ")[0];
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <AdminGuard>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex min-h-[100dvh] w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-w-0 items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-medium">{pageTitle}</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="max-w-32 truncate text-sm text-muted-foreground">
                {user?.displayName || "管理员"}
              </span>
            </div>
          </header>
          <main className="min-w-0 flex-1 overflow-auto bg-muted/30">
            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
              <Switch>
                <Route path="/admin"><Redirect to="/admin/dashboard" /></Route>
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/war-room" component={AdminWarRoomPage} />
                <Route path="/admin/users" component={AdminUsersPage} />
                <Route path="/admin/subscription"><Redirect to="/admin/subscriptions" /></Route>
                <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
                <Route path="/admin/pricing" component={AdminPricingPage} />
                <Route path="/admin/coupons" component={AdminCouponsPage} />
                <Route path="/admin/venues" component={AdminVenuesPage} />
                <Route path="/admin/templates" component={AdminEventTemplatesPage} />
                <Route path="/admin/events" component={AdminEventsPage} />
                <Route path="/admin/event-pools" component={AdminEventPoolsPage} />
                <Route path="/admin/flash-ops"><Redirect to="/admin/alang" /></Route>
                <Route path="/admin/finance" component={AdminFinancePage} />
                <Route path="/admin/referrals" component={AdminReferralsPage} />
                <Route path="/admin/duo-invites" component={AdminDuoInvitesPage} />
                <Route path="/admin/banners" component={AdminBannersPage} />
                <Route path="/admin/insights" component={AdminDataInsightsPage} />
                <Route path="/admin/outcome-analytics" component={AdminOutcomeAnalyticsPage} />
                <Route path="/admin/icebreaker-ai-feedback" component={AdminIcebreakerAiFeedbackPage} />
                <Route path="/admin/feedback" component={AdminFeedbackPage} />
                <Route path="/admin/content" component={AdminContentPage} />
                <Route path="/admin/notifications" component={AdminNotificationsPage} />
                <Route path="/admin/moderation" component={AdminModerationPage} />
                <Route path="/admin/content-filter" component={AdminContentFilterLogsPage} />
                <Route path="/admin/reports"><Redirect to="/admin/moderation?tab=chat" /></Route>
                <Route path="/admin/interaction-logs" component={AdminInteractionLogsPage} />
                <Route path="/admin/matching" component={AdminMatchingLabPage} />
                <Route path="/admin/matching-config" component={AdminMatchingConfigPage} />
                <Route path="/admin/matching-logs" component={AdminMatchingLogsPage} />
                <Route path="/admin/matching-reviews" component={AdminMatchingReviewsPage} />
                <Route path="/admin/evolution" component={AdminEvolutionPage} />
                <Route path="/admin/accounts" component={AdminAccountsPage} />
                <Route path="/admin/audit-logs" component={AdminAuditLogsPage} />
                <Route path="/admin/feature-flags" component={AdminFeatureFlagsPage} />
                <Route path="/admin/alang" component={AdminFlashPage} />
                <Route component={AdminNotFound} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </AdminGuard>
  );
}
