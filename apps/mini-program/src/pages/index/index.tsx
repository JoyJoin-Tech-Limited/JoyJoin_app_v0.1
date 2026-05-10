import { useEffect, useRef, useState } from 'react'
import BoxLogoEntryScreen from '../../components/loading/BoxLogoEntryScreen'
import { useAuth } from '../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import MiniProgramLandingPage from './LandingPage'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const [entryDone, setEntryDone] = useState(false)

  // Redirect authenticated users to their next onboarding/app step.
  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true
    void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' }).catch(() => {
      hasRedirectedRef.current = false
    })
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep])

  if (!entryDone) {
    return <BoxLogoEntryScreen onComplete={() => setEntryDone(true)} />
  }

  return <MiniProgramLandingPage />
}
