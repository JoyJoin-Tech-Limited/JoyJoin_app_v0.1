import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { Route, Switch } from "wouter";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminSubscriptionsPage from "@/pages/admin/AdminSubscriptionsPage";
import AdminCouponsPage from "@/pages/admin/AdminCouponsPage";
import AdminVenuesPage from "@/pages/admin/AdminVenuesPage";
import AdminEventTemplatesPage from "@/pages/admin/AdminEventTemplatesPage";
import AdminEventsPage from "@/pages/admin/AdminEventsPage";
import AdminEventPoolsPage from "@/pages/admin/AdminEventPoolsPage";
import AdminFinancePage from "@/pages/admin/AdminFinancePage";
import AdminDataInsightsPage from "@/pages/admin/AdminDataInsightsPage";
import AdminContentPage from "@/pages/admin/AdminContentPage";
import AdminModerationPage from "@/pages/admin/AdminModerationPage";
import AdminMatchingLabPage from "@/pages/admin/AdminMatchingLabPage";
import AdminNotificationsPage from "@/pages/admin/AdminNotificationsPage";
import AdminReportsPage from "@/pages/admin/AdminReportsPage";
import AdminChatLogsPage from "@/pages/admin/AdminChatLogsPage";
import AdminFeedbackPage from "@/pages/admin/AdminFeedbackPage";
import AdminMatchingConfigPage from "@/pages/admin/AdminMatchingConfigPage";
import AdminMatchingLogsPage from "@/pages/admin/AdminMatchingLogsPage";

export default function AdminLayout() {
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
              <span className="text-sm text-muted-foreground">管理员</span>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/dashboard" component={AdminDashboard} />
              <Route path="/admin/users" component={AdminUsersPage} />
              <Route path="/admin/subscriptions" component={AdminSubscriptionsPage} />
              <Route path="/admin/coupons" component={AdminCouponsPage} />
              <Route path="/admin/venues" component={AdminVenuesPage} />
              <Route path="/admin/templates" component={AdminEventTemplatesPage} />
              <Route path="/admin/events" component={AdminEventsPage} />
              <Route path="/admin/event-pools" component={AdminEventPoolsPage} />
              <Route path="/admin/finance" component={AdminFinancePage} />
              <Route path="/admin/insights" component={AdminDataInsightsPage} />
              <Route path="/admin/feedback" component={AdminFeedbackPage} />
              <Route path="/admin/content" component={AdminContentPage} />
              <Route path="/admin/notifications" component={AdminNotificationsPage} />
              <Route path="/admin/moderation" component={AdminModerationPage} />
              <Route path="/admin/reports" component={AdminReportsPage} />
              <Route path="/admin/chat-logs" component={AdminChatLogsPage} />
              <Route path="/admin/matching" component={AdminMatchingLabPage} />
              <Route path="/admin/matching-config" component={AdminMatchingConfigPage} />
              <Route path="/admin/matching-logs" component={AdminMatchingLogsPage} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </AdminGuard>
  );
}
