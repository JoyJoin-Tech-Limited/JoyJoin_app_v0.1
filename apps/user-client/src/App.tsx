import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Suspense, lazy, useEffect } from "react";
import { preloadXiaoyueImages } from "@/lib/preloadImages";
import { LoadingScreen } from "@/components/LoadingScreen";
import LevelUpProvider from "@/components/LevelUpProvider";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegistrationPage = lazy(() => import("@/pages/RegistrationPage"));
const ChatRegistrationPage = lazy(() => import("@/pages/ChatRegistrationPage"));
const PersonalityTestPageV4 = lazy(() => import("@/pages/PersonalityTestPageV4"));
const PersonalityTestResultPage = lazy(() => import("@/pages/PersonalityTestResultPage"));
const EssentialDataPage = lazy(() => import("@/pages/EssentialDataPage"));
const ExtendedDataPage = lazy(() => import("@/pages/ExtendedDataPage"));
const DiscoverPage = lazy(() => import("@/pages/DiscoverPage"));
const EventsPage = lazy(() => import("@/pages/EventsPage"));
const ChatsPage = lazy(() => import("@/pages/ChatsPage"));
const EventChatDetailPage = lazy(() => import("@/pages/EventChatDetailPage"));
const DirectChatPage = lazy(() => import("@/pages/DirectChatPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const EditProfilePage = lazy(() => import("@/pages/EditProfilePage"));
const EditBasicInfoPage = lazy(() => import("@/pages/EditBasicInfoPage"));
const EditEducationPage = lazy(() => import("@/pages/EditEducationPage"));
const EditWorkPage = lazy(() => import("@/pages/EditWorkPage"));
const EditPersonalPage = lazy(() => import("@/pages/EditPersonalPage"));
const EditIntentPage = lazy(() => import("@/pages/EditIntentPage"));
const EditInterestsPage = lazy(() => import("@/pages/EditInterestsPage"));
const EditSocialPage = lazy(() => import("@/pages/EditSocialPage"));
const EventDetailPage = lazy(() => import("@/pages/EventDetailPage"));
const BlindBoxPaymentPage = lazy(() => import("@/pages/BlindBoxPaymentPage"));
const BlindBoxConfirmationPage = lazy(() => import("@/pages/BlindBoxConfirmationPage"));
const BlindBoxEventDetailPage = lazy(() => import("@/pages/BlindBoxEventDetailPage"));
const EventPoolRegistrationPage = lazy(() => import("@/pages/EventPoolRegistrationPage"));
const PoolGroupDetailPage = lazy(() => import("@/pages/PoolGroupDetailPage"));
const InviteLandingRouter = lazy(() => import("@/pages/InviteLandingRouter"));
const InvitePage = lazy(() => import("@/pages/InvitePage"));
const EventFeedbackFlow = lazy(() => import("@/pages/EventFeedbackFlow"));
const DeepFeedbackFlow = lazy(() => import("@/pages/DeepFeedbackFlow"));
const IcebreakerSessionPage = lazy(() => import("@/pages/IcebreakerSessionPage"));
const IcebreakerDemoPage = lazy(() => import("@/pages/IcebreakerDemoPage"));
const RewardsPage = lazy(() => import("@/pages/RewardsPage"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminLoginPage = lazy(() => import("@/pages/admin/AdminLoginPage"));
const NotFound = lazy(() => import("@/pages/not-found"));
const DuolingoOnboardingPage = lazy(() => import("@/pages/DuolingoOnboardingPage"));

preloadXiaoyueImages();

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
        <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
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
        <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
        <Route path="/personality-test/results" component={PersonalityTestResultPage} />
        <Route path="*" component={RedirectToPersonalityTest} />
      </Switch>
    );
  }

  if (needsProfileSetup) {
    return (
      <Switch>
        {/* 保留测试结果页面访问权限，让用户能看到结果后再继续设置 */}
        <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
        <Route path="/personality-test/results" component={PersonalityTestResultPage} />
        <Route path="/onboarding/setup" component={EssentialDataPage} />
        <Route path="/onboarding/extended" component={ExtendedDataPage} />
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
      <Route path="/onboarding/extended" component={ExtendedDataPage} />
      <Route path="/registration/chat" component={ChatRegistrationPage} />
      <Route path="/event/:id" component={EventDetailPage} />
      <Route path="/invite" component={InvitePage} />
      <Route path="/personality-test" component={PersonalityTestPageV4} />
      <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
      <Route path="/personality-test/results" component={PersonalityTestResultPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
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
          <Suspense fallback={<LoadingScreen />}>
            <Router />
          </Suspense>
        </LevelUpProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
