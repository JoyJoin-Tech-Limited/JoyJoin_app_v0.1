import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Suspense, useEffect } from "react";
import { preloadXiaoyueImages } from "@/lib/preloadImages";
import { AchievementProvider } from "@/contexts/AchievementContext";
import { AchievementPopup } from "@/components/achievements";
import { DynamicAccentProvider } from "@/contexts/DynamicAccentContext";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import MobileLandingPage from "@/pages/MobileLandingPage";
// RegistrationPage removed - using ChatRegistrationPage instead
// import RegistrationPage from "@/pages/RegistrationPage";
// RegistrationMethodPage kept for internal reference only - not imported in user routes
// ChatRegistrationPage moved to _backup_modules/chat-registration-legacy/ (2026-01-20) - no longer routed
// InterestsTopicsPage and EditInterestsPage moved to _backup_modules/interests-topics-legacy/ (2026-01-19)
import PersonalityTestPageV4 from "@/pages/PersonalityTestPageV4";
import PersonalityTestResultPage from "@/pages/PersonalityTestResultPage";
import ProfileSetupPage from "@/pages/ProfileSetupPage";
import EssentialDataPage from "@/pages/EssentialDataPage";
import ExtendedDataPage from "@/pages/ExtendedDataPage";
import DiscoverPage from "@/pages/DiscoverPage";
import EventsPage from "@/pages/EventsPage";
import ChatsPage from "@/pages/ChatsPage";
import EventChatDetailPage from "@/pages/EventChatDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import EditProfilePage from "@/pages/EditProfilePage";
import EditBasicInfoPage from "@/pages/EditBasicInfoPage";
import EditEducationPage from "@/pages/EditEducationPage";
import EditWorkPage from "@/pages/EditWorkPage";
import EditPersonalPage from "@/pages/EditPersonalPage";
import EditIntentPage from "@/pages/EditIntentPage";
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
import IcebreakerDemoPage from "@/pages/IcebreakerDemoPage";
import IcebreakerGamePage from "@/pages/IcebreakerGamePage";
import SocialIcebreakerRecapPage from "@/pages/SocialIcebreakerRecapPage";
import RewardsPage from "@/pages/RewardsPage";
import MatchingStatusPage from "@/pages/MatchingStatusPage";
import MyJourneyPage from "@/pages/MyJourneyPage";
import EventPoolRegistrationPage from "@/pages/EventPoolRegistrationPage";
import TestArchetypeOrbit from "@/pages/TestArchetypeOrbit";
import NotFound from "@/pages/not-found";
import LevelUpProvider from "@/components/LevelUpProvider";
import GuidePage from "@/pages/GuidePage";
import FinalProfileReviewPage from "@/pages/FinalProfileReviewPage";
import SquadUnboxingFlow from "@/pages/SquadUnboxingFlow";
import LoginPromptPage from "@/pages/LoginPromptPage";
import { LoadingScreen } from "@/components/LoadingScreen";
import CommunityJoinPage from "@/pages/CommunityJoinPage";
import WalletPage from "@/pages/WalletPage";
import FAQPage from "@/pages/FAQPage";
import TermsPage from "@/pages/TermsPage";

preloadXiaoyueImages();

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

function RedirectToDiscover() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/");
  }, [setLocation]);
  return null;
}

// @deprecated - Guide page replaced with inline coach marks (2026-02-16)
// function RedirectToGuide() {
//   const [, setLocation] = useLocation();
//   useEffect(() => {
//     setLocation("/guide");
//   }, [setLocation]);
//   return null;
// }

function RedirectToExtended() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/onboarding/extended");
  }, [setLocation]);
  return null;
}

function RedirectToReview() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/onboarding/review");
  }, [setLocation]);
  return null;
}

function AuthenticatedRouter() {
  const { user, nextStep, isLoading } = useAuth();
  const [location] = useLocation();

  // Show loading while fetching user state
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Server-driven navigation based on nextStep (B1)
  // This centralizes all onboarding flow logic on the server
  switch (nextStep) {
    case 'onboarding':
      return (
        <Switch>
          <Route path="/personality-test" component={PersonalityTestPageV4} />
          <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
          <Route path="/personality-test/results" component={PersonalityTestResultPage} />
          <Route path="*" component={RedirectToPersonalityTest} />
        </Switch>
      );

    case 'personality-test':
      return (
        <Switch>
          <Route path="/personality-test" component={PersonalityTestPageV4} />
          <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
          <Route path="/personality-test/results" component={PersonalityTestResultPage} />
          <Route path="/onboarding/setup" component={EssentialDataPage} />
          <Route path="/onboarding/extended" component={ExtendedDataPage} />
          <Route path="*" component={RedirectToPersonalityTest} />
        </Switch>
      );

    case 'essential-data':
      return (
        <Switch>
          <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
          <Route path="/personality-test/results" component={PersonalityTestResultPage} />
          <Route path="/onboarding/setup" component={EssentialDataPage} />
          <Route path="/onboarding/extended" component={ExtendedDataPage} />
          <Route path="/onboarding/review" component={FinalProfileReviewPage} />
          <Route path="/onboarding/login" component={LoginPromptPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="*" component={RedirectToSetup} />
        </Switch>
      );

    case 'extended-data':
      return (
        <Switch>
          <Route path="/onboarding/extended" component={ExtendedDataPage} />
          <Route path="/onboarding/review" component={FinalProfileReviewPage} />
          <Route path="*" component={RedirectToExtended} />
        </Switch>
      );

    case 'profile-review':
      return (
        <Switch>
          <Route path="/onboarding/review" component={FinalProfileReviewPage} />
          {/* Guide page deprecated - using inline coach marks instead */}
          <Route path="/guide" component={GuidePage} />
          <Route path="*" component={RedirectToReview} />
        </Switch>
      );

    case 'discover':
    default:
      // Main app routes - user has completed onboarding
      return (
        <Switch>
          <Route path="/" component={DiscoverPage} />
          <Route path="/discover" component={DiscoverPage} />
          {/* Guide page deprecated - kept for backward compatibility, redirects to / */}
          <Route path="/guide" component={GuidePage} />
          <Route path="/squad-unboxing" component={SquadUnboxingFlow} />
          <Route path="/pool-groups/:groupId" component={PoolGroupDetailPage} />
          <Route path="/pool-matching/:registrationId" component={MatchingStatusPage} />
          <Route path="/my-journey" component={MyJourneyPage} />
          <Route path="/squad-unboxing/:groupId" component={SquadUnboxingFlow} />
          {process.env.NODE_ENV !== "production" && (
            <Route path="/test/archetype-orbit" component={TestArchetypeOrbit} />
          )}
          <Route path="/blindbox/payment" component={BlindBoxPaymentPage} />
          <Route path="/blindbox/confirmation" component={BlindBoxConfirmationPage} />
          <Route path="/blind-box-events/:eventId" component={BlindBoxEventDetailPage} />
          <Route path="/events/:eventId/feedback" component={EventFeedbackFlow} />
          <Route path="/events/:eventId/deep-feedback" component={DeepFeedbackFlow} />
          <Route path="/icebreaker/:sessionId" component={IcebreakerSessionPage} />
          <Route path="/icebreaker-game" component={IcebreakerGamePage} />
          <Route path="/events" component={EventsPage} />
          <Route path="/chats" component={ChatsPage} />
          <Route path="/chats/:eventId" component={EventChatDetailPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/rewards" component={RewardsPage} />
          <Route path="/profile/edit" component={EditProfilePage} />
          <Route path="/profile/edit/basic" component={EditBasicInfoPage} />
          <Route path="/profile/edit/education" component={EditEducationPage} />
          <Route path="/profile/edit/work" component={EditWorkPage} />
          <Route path="/profile/edit/personal" component={EditPersonalPage} />
          <Route path="/profile/edit/intent" component={EditIntentPage} />
          <Route path="/profile/wallet" component={WalletPage} />
          <Route path="/profile/faq" component={FAQPage} />
          <Route path="/profile/terms" component={TermsPage} />
          <Route path="/community/join" component={CommunityJoinPage} />
          <Route path="/onboarding/extended" component={ExtendedDataPage} />
          <Route path="/onboarding/review" component={FinalProfileReviewPage} />
          <Route path="/onboarding/login" component={LoginPromptPage} />
          <Route path="/event/:id" component={EventDetailPage} />
          <Route path="/invite" component={InvitePage} />
          <Route path="/personality-test" component={PersonalityTestPageV4} />
          <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
          <Route path="/personality-test/results" component={PersonalityTestResultPage} />
          <Route component={NotFound} />
        </Switch>
      );
  }
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Admin routes - unconditional redirect to dedicated admin subdomain.
  // Must be before any isLoading / isAuthenticated checks so there is no
  // fallback path that lets user-client render admin UI.
  if (location.startsWith("/admin/login")) {
    window.location.replace("https://admin.yuejuapp.com/login");
    return null;
  }
  if (location.startsWith("/admin")) {
    window.location.replace("https://admin.yuejuapp.com");
    return null;
  }

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

  // Mobile landing page demo is publicly accessible for testing
  if (location === "/mobile-landing") {
    return <Route path="/mobile-landing" component={MobileLandingPage} />;
  }

  // Icebreaker demo is publicly accessible for testing
  if (location === "/icebreaker-demo") {
    return <Route path="/icebreaker-demo" component={IcebreakerDemoPage} />;
  }

  // Regular user routes
  if (!isAuthenticated) {
    return (
      <Switch>
        {/* Anonymous personality test (Option B: Post-Test Signup Flow - 2026-02-04) */}
        <Route path="/personality-test" component={PersonalityTestPageV4} />
        <Route path="/personality-test/results" component={PersonalityTestResultPage} />
        <Route path="/personality-test/complete" component={PersonalityTestResultPage} />
        
        {/* Legacy /onboarding route redirects to personality test */}
        <Route path="/onboarding" component={PersonalityTestPageV4} />
        {/* Registration routes redirect to personality test (new flow) */}
        <Route path="/registration" component={PersonalityTestPageV4} />
        <Route path="/registration/chat" component={PersonalityTestPageV4} />
        <Route path="/register" component={PersonalityTestPageV4} />
        {/* Legacy login page still accessible */}
        <Route path="/login" component={LoginPage} />
        {/* New landing page is the default entry point */}
        <Route path="*" component={LandingPage} />
      </Switch>
    );
  }

  return <AuthenticatedRouter />;
}

function App() {
  // Load dev tools in non-production environments for easier debugging
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      import('./utils/devTools').then(module => {
        (window as any).dev = module.devTools;
        console.log('🔧 Dev tools loaded! Type window.dev.help() for commands');
      }).catch(error => {
        console.error('Failed to load dev tools:', error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <DynamicAccentProvider enabled={true}>
          <AchievementProvider>
            <LevelUpProvider>
              <Toaster />
              <AchievementPopup />
              <Suspense fallback={<LoadingScreen />}>
                <Router />
              </Suspense>
            </LevelUpProvider>
          </AchievementProvider>
        </DynamicAccentProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
