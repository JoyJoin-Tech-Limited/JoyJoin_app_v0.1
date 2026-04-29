import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/LoginPage";
import { useEffect } from "react";
// Legacy registration pages removed:
//   - ChatRegistrationPage removed (2026-01-20)
//   - RegistrationMethodPage removed (2026-03-18)
//   - RegistrationPage removed (2026-01-20)
import PersonalityTestPage from "@/pages/PersonalityTestPage";
import PersonalityTestResultPage from "@/pages/PersonalityTestResultPage";
import DiscoverPage from "@/pages/DiscoverPage";
import EventsPage from "@/pages/EventsPage";
import EventCoordinationListPage from "@/pages/EventCoordinationListPage";
import EventCoordinationDetailPage from "@/pages/EventCoordinationDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import EditProfilePage from "@/pages/EditProfilePage";
import EditBasicInfoPage from "@/pages/EditBasicInfoPage";
import EditEducationPage from "@/pages/EditEducationPage";
import EditWorkPage from "@/pages/EditWorkPage";
import EditPersonalPage from "@/pages/EditPersonalPage";
import EditIntentPage from "@/pages/EditIntentPage";
import EditInterestsPage from "@/pages/EditInterestsPage";
import EventDetailPage from "@/pages/EventDetailPage";
import BlindBoxPaymentPage from "@/pages/BlindBoxPaymentPage";
import BlindBoxConfirmationPage from "@/pages/BlindBoxConfirmationPage";
import BlindBoxEventDetailPage from "@/pages/BlindBoxEventDetailPage";
import PoolGroupDetailPage from "@/pages/PoolGroupDetailPage";
import InvitationLandingPage from "@/pages/InvitationLandingPage";
import InviteLandingRouter from "@/pages/InviteLandingRouter";
import InvitePage from "@/pages/InvitePage";
import EventFeedbackFlow from "@/pages/EventFeedbackFlow";
import DeepFeedbackFlow from "@/pages/DeepFeedbackFlow";
import IcebreakerSessionPage from "@/pages/IcebreakerSessionPage";
import RewardsPage from "@/pages/RewardsPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import NotFound from "@/pages/not-found";
import LevelUpProvider from "@/components/LevelUpProvider";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);

  return null;
}

function AuthenticatedRouter() {
  const { user } = useAuth();
  const [location] = useLocation();

  // Admin routes - separate from user flow
  if (user?.isAdmin && location.startsWith("/admin")) {
    return <AdminLayout />;
  }

  return (
    <Switch>
      <Route path="/" component={DiscoverPage} />
      <Route path="/discover" component={DiscoverPage} />
      <Route path="/registration">
        {() => <Redirect to="/" />}
      </Route>
      <Route path="/registration/method">
        {() => <Redirect to="/" />}
      </Route>
      <Route path="/pool-groups/:groupId" component={PoolGroupDetailPage} />
      <Route path="/blindbox/payment" component={BlindBoxPaymentPage} />
      <Route path="/blindbox/confirmation" component={BlindBoxConfirmationPage} />
      <Route path="/blind-box-events/:eventId" component={BlindBoxEventDetailPage} />
      <Route path="/events/:eventId/feedback" component={EventFeedbackFlow} />
      <Route path="/events/:eventId/deep-feedback" component={DeepFeedbackFlow} />
      <Route path="/icebreaker/:sessionId" component={IcebreakerSessionPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/chats" component={EventCoordinationListPage} />
      <Route path="/chats/:eventId" component={EventCoordinationDetailPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/profile/edit" component={EditProfilePage} />
      <Route path="/profile/edit/basic" component={EditBasicInfoPage} />
      <Route path="/profile/edit/education" component={EditEducationPage} />
      <Route path="/profile/edit/work" component={EditWorkPage} />
      <Route path="/profile/edit/personal" component={EditPersonalPage} />
      <Route path="/profile/edit/intent" component={EditIntentPage} />
      <Route path="/profile/edit/interests" component={EditInterestsPage} />
      <Route path="/event/:id" component={EventDetailPage} />
      <Route path="/invite" component={InvitePage} />
      <Route path="/personality-test" component={PersonalityTestPage} />
      <Route path="/personality-test/results" component={PersonalityTestResultPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // Preview login page (for demo purposes - shows complete login flow)
  if (location === "/preview-login") {
    return <Route path="/preview-login" component={LoginPage} />;
  }

  // Invite landing page is publicly accessible (handles both referrals and event invitations)
  if (location.startsWith("/invite/")) {
    return <Route path="/invite/:code" component={InviteLandingRouter} />;
  }

  // Admin login is always accessible (even when not authenticated)
  if (location.startsWith("/admin/login") || location === "/admin/login") {
    return <Route path="/admin/login" component={AdminLoginPage} />;
  }

  // Admin routes require authentication
  if (location.startsWith("/admin")) {
    if (!isAuthenticated) {
      return <Route path="*" component={AdminLoginPage} />;
    }
    return <AuthenticatedRouter />;
  }

  // Regular user routes
  if (!isAuthenticated) {
    return <Route path="*" component={LoginPage} />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LevelUpProvider>
          <Toaster />
          <Router />
        </LevelUpProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
