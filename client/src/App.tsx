import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import LoginPage from "@/pages/LoginPage";
import RegistrationPage from "@/pages/RegistrationPage";
import InterestsTopicsPage from "@/pages/InterestsTopicsPage";
import PersonalityTestPage from "@/pages/PersonalityTestPage";
import PersonalityTestResultPage from "@/pages/PersonalityTestResultPage";
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
import EventDetailPage from "@/pages/EventDetailPage";
import BlindBoxPaymentPage from "@/pages/BlindBoxPaymentPage";
import BlindBoxConfirmationPage from "@/pages/BlindBoxConfirmationPage";
import BlindBoxEventDetailPage from "@/pages/BlindBoxEventDetailPage";
import EventPoolRegistrationPage from "@/pages/EventPoolRegistrationPage";
import PoolGroupDetailPage from "@/pages/PoolGroupDetailPage";
import InvitationLandingPage from "@/pages/InvitationLandingPage";
import EventFeedbackFlow from "@/pages/EventFeedbackFlow";
import DeepFeedbackFlow from "@/pages/DeepFeedbackFlow";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminLoginPage from "@/pages/admin/AdminLoginPage";
import NotFound from "@/pages/not-found";

function RedirectToRegistration() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/registration");
  }, [setLocation]);
  return null;
}

function RedirectToInterestsTopics() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/interests-topics");
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
  const { user, needsRegistration, needsInterestsTopics, needsPersonalityTest, needsProfileSetup } = useAuth();
  const [location] = useLocation();

  // Admin routes - separate from user flow
  if (user?.isAdmin && location.startsWith("/admin")) {
    return <AdminLayout />;
  }

  if (needsRegistration) {
    return (
      <Switch>
        <Route path="/registration" component={RegistrationPage} />
        <Route path="*" component={RedirectToRegistration} />
      </Switch>
    );
  }

  if (needsInterestsTopics) {
    return (
      <Switch>
        <Route path="/interests-topics" component={InterestsTopicsPage} />
        <Route path="*" component={RedirectToInterestsTopics} />
      </Switch>
    );
  }

  if (needsPersonalityTest) {
    return (
      <Switch>
        <Route path="/personality-test" component={PersonalityTestPage} />
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
      <Route path="/events" component={EventsPage} />
      <Route path="/chats" component={ChatsPage} />
      <Route path="/chats/:eventId" component={EventChatDetailPage} />
      <Route path="/direct-chat/:threadId" component={DirectChatPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/profile/edit" component={EditProfilePage} />
      <Route path="/profile/edit/basic" component={EditBasicInfoPage} />
      <Route path="/profile/edit/education" component={EditEducationPage} />
      <Route path="/profile/edit/work" component={EditWorkPage} />
      <Route path="/profile/edit/personal" component={EditPersonalPage} />
      <Route path="/profile/edit/intent" component={EditIntentPage} />
      <Route path="/profile/edit/interests" component={EditInterestsPage} />
      <Route path="/event/:id" component={EventDetailPage} />
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // Invitation landing page is publicly accessible
  if (location.startsWith("/invite/")) {
    return <Route path="/invite/:code" component={InvitationLandingPage} />;
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
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
