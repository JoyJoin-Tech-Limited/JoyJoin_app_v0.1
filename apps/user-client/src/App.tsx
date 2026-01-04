import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import LoginPage from "@/pages/LoginPage";
import RegistrationPage from "@/pages/RegistrationPage";
// RegistrationMethodPage kept for internal reference only - not imported in user routes
import ChatRegistrationPage from "@/pages/ChatRegistrationPage";
import InterestsTopicsPage from "@/pages/InterestsTopicsPage";
import PersonalityTestPageV4 from "@/pages/PersonalityTestPageV4";
import PersonalityTestResultPage from "@/pages/PersonalityTestResultPage";
import PostTestFlowPage from "@/pages/PostTestFlowPage";
import ProfileSetupPage from "@/pages/ProfileSetupPage";
import DiscoverPage from "@/pages/DiscoverPage";
import EventsPage from "@/pages/EventsPage";
import ChatsPage from "@/pages/ChatsPage";
import EventChatDetailPage from "@/pages/EventChatDetailPage";
import DirectChatPage from "@/pages/DirectChatPage";
import ProfilePage from "@/pages/ProfilePage";
import EditProfilePage from "@/pages/EditProfilePage";
import EditBasicInfoPage from "@/pages/EditBasicInfoPage";
import EditEducationPage from "@/pages/EditEducationPage";
import EditWorkPage from "@/pages/EditWorkPage";
import EditPersonalPage from "@/pages/EditPersonalPage";
import EditIntentPage from "@/pages/EditIntentPage";
import EditInterestsPage from "@/pages/EditInterestsPage";
import EditSocialPage from "@/pages/EditSocialPage";
import EventDetailPage from "@/pages/EventDetailPage";
import BlindBoxPaymentPage from "@/pages/BlindBoxPaymentPage";
import BlindBoxConfirmationPage from "@/pages/BlindBoxConfirmationPage";
import BlindBoxEventDetailPage from "@/pages/BlindBoxEventDetailPage";
import EventPoolRegistrationPage from "@/pages/EventPoolRegistrationPage";
import PoolGroupDetailPage from "@/pages/PoolGroupDetailPage";
import InvitationLandingPage from "@/pages/InvitationLandingPage";
import InviteLandingRouter from "@/pages/InviteLandingRouter";
import InvitePage from "@/pages/InvitePage";
import EventFeedbackFlow from "@/pages/EventFeedbackFlow";
import DeepFeedbackFlow from "@/pages/DeepFeedbackFlow";
import IcebreakerSessionPage from "@/pages/IcebreakerSessionPage";
import IcebreakerDemoPage from "@/pages/IcebreakerDemoPage";
import RewardsPage from "@/pages/RewardsPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import NotFound from "@/pages/not-found";
import LevelUpProvider from "@/components/LevelUpProvider";
import DuolingoOnboardingPage from "@/pages/DuolingoOnboardingPage";

function RedirectToOnboarding() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/onboarding");
  }, [setLocation]);
  return null;
}

function RedirectToPersonalityTest() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/personality-test");
  }, [setLocation]);
  return null;
}

function RedirectToSetup() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/onboarding/setup");
  }, [setLocation]);
  return null;
}

function AuthenticatedRouter() {
  const { user, needsRegistration, needsPersonalityTest, needsProfileSetup } = useAuth();
  const [location] = useLocation();

  // Admin routes - separate from user flow
  if (user?.isAdmin && location.startsWith("/admin")) {
    return <AdminLayout />;
  }

  if (needsRegistration) {
    return (
      <Switch>
        {/* 新版 Duolingo-style Onboarding 流程 */}
        <Route path="/onboarding" component={DuolingoOnboardingPage} />
        {/* 性格测试 - onboarding 完成后进入 */}
        <Route path="/personality-test" component={PersonalityTestPageV4} />
        <Route path="/personality-test/complete" component={PostTestFlowPage} />
        <Route path="/personality-test/results" component={PersonalityTestResultPage} />
        {/* 保留旧版注册供内部测试使用 */}
        <Route path="/chat-registration" component={ChatRegistrationPage} />
        <Route path="/registration" component={ChatRegistrationPage} />
        <Route path="/registration/chat" component={ChatRegistrationPage} />
        <Route path="/registration/form" component={RegistrationPage} />
        <Route path="*" component={RedirectToOnboarding} />
      </Switch>
    );
  }

  if (needsPersonalityTest) {
    return (
      <Switch>
        <Route path="/personality-test" component={PersonalityTestPageV4} />
        <Route path="/personality-test/complete" component={PostTestFlowPage} />
        <Route path="/personality-test/results" component={PersonalityTestResultPage} />
        <Route path="*" component={RedirectToPersonalityTest} />
      </Switch>
    );
  }

  if (needsProfileSetup) {
    return (
      <Switch>
        <Route path="/onboarding/setup" component={ProfileSetupPage} />
        <Route path="*" component={RedirectToSetup} />
      </Switch>
    );
  }

  return (
    <Switch>
      <Route path="/" component={DiscoverPage} />
      <Route path="/discover" component={DiscoverPage} />
      <Route path="/event-pool/:id/register" component={EventPoolRegistrationPage} />
      <Route path="/pool-groups/:groupId" component={PoolGroupDetailPage} />
      <Route path="/blindbox/payment" component={BlindBoxPaymentPage} />
      <Route path="/blindbox/confirmation" component={BlindBoxConfirmationPage} />
      <Route path="/blind-box-events/:eventId" component={BlindBoxEventDetailPage} />
      <Route path="/events/:eventId/feedback" component={EventFeedbackFlow} />
      <Route path="/events/:eventId/deep-feedback" component={DeepFeedbackFlow} />
      <Route path="/icebreaker/:sessionId" component={IcebreakerSessionPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/chats" component={ChatsPage} />
      <Route path="/chats/:eventId" component={EventChatDetailPage} />
      <Route path="/direct-chat/:threadId" component={DirectChatPage} />
      <Route path="/chat-registration" component={ChatRegistrationPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/rewards" component={RewardsPage} />
      <Route path="/profile/edit" component={EditProfilePage} />
      <Route path="/profile/edit/basic" component={EditBasicInfoPage} />
      <Route path="/profile/edit/education" component={EditEducationPage} />
      <Route path="/profile/edit/work" component={EditWorkPage} />
      <Route path="/profile/edit/personal" component={EditPersonalPage} />
      <Route path="/profile/edit/intent" component={EditIntentPage} />
      <Route path="/profile/edit/interests" component={EditInterestsPage} />
      <Route path="/profile/edit/social" component={EditSocialPage} />
      <Route path="/registration/chat" component={ChatRegistrationPage} />
      <Route path="/event/:id" component={EventDetailPage} />
      <Route path="/invite" component={InvitePage} />
      <Route path="/personality-test" component={PersonalityTestPageV4} />
      <Route path="/personality-test/complete" component={PostTestFlowPage} />
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
      <div className="min-h-screen flex items-center justify-center">
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

  // Icebreaker demo is publicly accessible for testing
  if (location === "/icebreaker-demo") {
    return <Route path="/icebreaker-demo" component={IcebreakerDemoPage} />;
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
    return (
      <Switch>
        {/* 新版 Duolingo-style Onboarding 流程 */}
        <Route path="/onboarding" component={DuolingoOnboardingPage} />
        {/* AI对话注册（小悦）为唯一用户入口 */}
        <Route path="/registration" component={ChatRegistrationPage} />
        <Route path="/registration/chat" component={ChatRegistrationPage} />
        <Route path="/register" component={ChatRegistrationPage} />
        {/* 保留表单注册供内部测试使用 */}
        <Route path="/registration/form" component={RegistrationPage} />
        {/* All other routes show login page */}
        <Route path="*" component={LoginPage} />
      </Switch>
    );
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
