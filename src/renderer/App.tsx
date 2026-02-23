import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '@/store/app.store'
import { useInstallState } from '@/hooks/useInstallState'
import { OnboardingLayout } from '@/views/Onboarding/OnboardingLayout'
import { DashboardLayout } from '@/views/Dashboard/DashboardLayout'

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.25, ease: 'easeInOut' }
} as const

/**
 * Root application component.
 *
 * Resolves installation state on mount and routes between the
 * onboarding wizard and the main dashboard with animated transitions.
 */
export function App(): React.JSX.Element {
  const currentView = useAppStore((s) => s.currentView)
  const setCurrentView = useAppStore((s) => s.setCurrentView)
  const { state: installState, loading } = useInstallState()

  useEffect(() => {
    if (loading) return

    if (installState === 'not_installed' || installState === 'interrupted') {
      setCurrentView('onboarding')
    } else if (currentView === 'onboarding') {
      setCurrentView('workflows')
    }
  }, [installState, loading, currentView, setCurrentView])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="animate-pulse font-mono text-sm text-text-muted">
          Initializing…
        </span>
      </div>
    )
  }

  const isOnboarding = currentView === 'onboarding'

  return (
    <AnimatePresence mode="wait">
      {isOnboarding ? (
        <motion.div key="onboarding" className="h-full" {...PAGE_TRANSITION}>
          <OnboardingLayout />
        </motion.div>
      ) : (
        <motion.div key="dashboard" className="h-full" {...PAGE_TRANSITION}>
          <DashboardLayout />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
