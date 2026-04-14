import { useEffect, useRef } from 'react'
import LoadingScreen from '../../components/LoadingScreen'
import { useAuth } from '../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../lib/onboardingNavigation'
import MiniProgramLandingPage from './LandingPage'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true
    void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' }).catch(() => {
      hasRedirectedRef.current = false
    })
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep])

  if (auth.isLoading || auth.isAuthenticated) {
    return <LoadingScreen />
  }

  return <MiniProgramLandingPage />
}
