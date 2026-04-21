import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Route, Switch } from "wouter";
import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";

const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
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
const AdminMatchingLabPage = lazy(() => import("@/pages/admin/AdminMatchingLabPage"));
const AdminNotificationsPage = lazy(() => import("@/pages/admin/AdminNotificationsPage"));
const AdminReportsPage = lazy(() => import("@/pages/admin/AdminReportsPage"));
const AdminInteractionLogsPage = lazy(() => import("@/pages/admin/AdminInteractionLogsPage"));
const AdminFeedbackPage = lazy(() => import("@/pages/admin/AdminFeedbackPage"));
const AdminMatchingConfigPage = lazy(() => import("@/pages/admin/AdminMatchingConfigPage"));
const AdminMatchingLogsPage = lazy(() => import("@/pages/admin/AdminMatchingLogsPage"));
const AdminPricingPage = lazy(() => import("@/pages/admin/AdminPricingPage"));
const AdminEvolutionPage = lazy(() => import("@/pages/admin/AdminEvolutionPage"));
const AdminAccountsPage = lazy(() => import("@/pages/admin/AdminAccountsPage"));

export default function AdminLayout() {
  const { user } = useAuth();
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <AdminGuard>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-lg font-medium">管理后台</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user?.displayName || "管理员"}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Suspense fallback={<div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
              <Switch>
                <Route path="/admin" component={AdminDashboard} />
                <Route path="/admin/dashboard" component={AdminDashboard} />
                <Route path="/admin/users" component={AdminUsersPage} />
                <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
                <Route path="/admin/pricing" component={AdminPricingPage} />
                <Route path="/admin/coupons" component={AdminCouponsPage} />
                <Route path="/admin/venues" component={AdminVenuesPage} />
                <Route path="/admin/templates" component={AdminEventTemplatesPage} />
                <Route path="/admin/events" component={AdminEventsPage} />
                <Route path="/admin/event-pools" component={AdminEventPoolsPage} />
                <Route path="/admin/finance" component={AdminFinancePage} />
                <Route path="/admin/insights" component={AdminDataInsightsPage} />
                <Route path="/admin/outcome-analytics" component={AdminOutcomeAnalyticsPage} />
                <Route path="/admin/icebreaker-ai-feedback" component={AdminIcebreakerAiFeedbackPage} />
                <Route path="/admin/feedback" component={AdminFeedbackPage} />
                <Route path="/admin/content" component={AdminContentPage} />
                <Route path="/admin/notifications" component={AdminNotificationsPage} />
                <Route path="/admin/moderation" component={AdminModerationPage} />
                <Route path="/admin/reports" component={AdminReportsPage} />
                <Route path="/admin/interaction-logs" component={AdminInteractionLogsPage} />
                <Route path="/admin/matching" component={AdminMatchingLabPage} />
                <Route path="/admin/matching-config" component={AdminMatchingConfigPage} />
                <Route path="/admin/matching-logs" component={AdminMatchingLogsPage} />
                <Route path="/admin/evolution" component={AdminEvolutionPage} />
                <Route path="/admin/accounts" component={AdminAccountsPage} />
              </Switch>
            </Suspense>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </AdminGuard>
  );
}
