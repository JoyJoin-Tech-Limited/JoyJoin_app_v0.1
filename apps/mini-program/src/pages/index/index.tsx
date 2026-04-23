import { useEffect, useRef } from 'react'
import LoadingScreen from '../../components/LoadingScreen'
import { useAuth } from '../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../lib/onboardingNavigation'
import MiniProgramLandingPage from './LandingPage'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const isAuthPending = auth.isLoading || auth.isRefreshing

  useEffect(() => {
    if (isAuthPending || !auth.isAuthenticated || hasRedirectedRef.current) {
      return
    }

    hasRedirectedRef.current = true
    void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' }).catch(() => {
      hasRedirectedRef.current = false
    })
  }, [auth.isAuthenticated, auth.nextStep, isAuthPending])

  if (auth.isLoading || auth.isAuthenticated) {
    return <LoadingScreen />
  }

  return <MiniProgramLandingPage />
}
