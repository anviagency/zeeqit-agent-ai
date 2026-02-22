import { useOnboardingStore } from '@/store/onboarding.store'
import { useAppStore } from '@/store/app.store'
import { StepArchitecture } from './StepArchitecture'
import { StepIntelligence } from './StepIntelligence'
import { StepAuthentication } from './StepAuthentication'
import { StepDeployment } from './StepDeployment'

const TOTAL_STEPS = 4

const stepMeta = [
  { num: '01', title: 'Architecture', desc: 'Select the operational capabilities you want to inject into the runtime.' },
  { num: '02', title: 'Intelligence', desc: 'Define the agent personality and supply core reasoning engine keys.' },
  { num: '03', title: 'Authentication', desc: 'Provide secure tokens for your selected external capabilities.' },
  { num: '04', title: 'Deployment', desc: 'Wiping legacy systems and injecting zeeqit orchestrator layer.' },
]

const stepComponents: Record<number, React.ComponentType> = {
  1: StepArchitecture,
  2: StepIntelligence,
  3: StepAuthentication,
  4: StepDeployment,
}

/**
 * Full-screen split-panel onboarding matching the spec HTML exactly.
 * Left: context pane with gradient bg. Right: action pane.
 */
export function OnboardingLayout(): React.JSX.Element {
  const { currentStep, nextStep, prevStep, isDeploying, deployComplete } = useOnboardingStore()
  const setCurrentView = useAppStore((s) => s.setCurrentView)

  const meta = stepMeta[currentStep - 1]
  const StepComponent = stepComponents[currentStep]
  const isLastStep = currentStep === TOTAL_STEPS
  const isLastBeforeTerminal = currentStep === TOTAL_STEPS - 1

  const handleNext = (): void => {
    if (isLastStep && deployComplete) {
      setCurrentView('topology')
      return
    }
    if (!isLastStep) nextStep()
  }

  const handleBack = (): void => {
    if (currentStep > 1) prevStep()
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden" style={{ backgroundColor: '#000' }}>
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute z-0"
        style={{
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 50%)',
          transition: 'transform 1s ease-out',
          transform: `translate(${currentStep * 5}%, ${currentStep * 10}%)`,
        }}
      />

      {/* Progress line */}
      <div
        className="absolute top-0 left-0 z-30 h-1"
        style={{
          background: '#fff',
          width: `${(currentStep / TOTAL_STEPS) * 100}%`,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      />

      {/* Left: Context pane */}
      <aside
        className="relative z-10 flex flex-col justify-between border-r"
        style={{
          flex: 1,
          padding: '5vw',
          borderColor: 'rgba(255,255,255,0.1)',
          background: 'linear-gradient(90deg, #000000 0%, rgba(0,0,0,0.8) 100%)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3" style={{ fontSize: '1.2rem', fontWeight: 600, letterSpacing: '-0.5px' }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 12 12 22 22 12 12 2" />
          </svg>
          zeeqit
        </div>

        {/* Step display */}
        <div style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <div
            key={`num-${currentStep}`}
            style={{
              fontSize: 'clamp(4rem, 10vw, 8rem)',
              fontWeight: 700,
              letterSpacing: '-4px',
              lineHeight: 1,
              color: currentStep === 4 ? '#fff' : 'rgba(255,255,255,0.1)',
              transition: 'color 0.5s ease',
            }}
          >
            {meta.num}
          </div>

          <h1
            key={`title-${currentStep}`}
            style={{
              fontSize: 'clamp(2rem, 4vw, 4rem)',
              fontWeight: 600,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginTop: '20px',
              color: '#fff',
            }}
          >
            {meta.title}
          </h1>

          <p
            key={`desc-${currentStep}`}
            style={{
              fontSize: '1.2rem',
              color: '#666',
              marginTop: '20px',
              maxWidth: '80%',
              lineHeight: 1.5,
            }}
          >
            {meta.desc}
          </p>
        </div>

        {/* Footer */}
        <div style={{ fontSize: '0.8rem', color: '#666', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Local AES-256 Encryption Active
        </div>
      </aside>

      {/* Right: Action pane */}
      <main className="relative z-10 flex flex-col" style={{ flex: 1.2 }}>
        {/* Step content panels (stacked absolutely, only active is mounted) */}
        {[1, 2, 3, 4].map((step) => {
          const isActive = currentStep === step
          const Component = stepComponents[step]
          return (
            <div
              key={step}
              className="absolute inset-0 flex flex-col justify-center"
              style={{
                padding: '5vw',
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? 'auto' : 'none',
                transform: isActive ? 'translateY(0)' : 'translateY(40px)',
                transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {isActive && <Component />}
            </div>
          )
        })}

        {/* Controls */}
        {!(isLastStep && !deployComplete) && (
          <div
            className="absolute z-20 flex items-center justify-between"
            style={{ bottom: '5vw', left: '5vw', right: '5vw' }}
          >
            {/* Back button */}
            <button
              type="button"
              onClick={handleBack}
              style={{
                opacity: currentStep > 1 && !isDeploying ? 1 : 0,
                pointerEvents: currentStep > 1 && !isDeploying ? 'auto' : 'none',
                background: 'transparent',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 500,
                borderRadius: '100px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              Back
            </button>

            {/* Continue / Initialize button */}
            <button
              type="button"
              onClick={handleNext}
              disabled={isDeploying}
              style={{
                background: '#fff',
                color: '#000',
                border: 'none',
                padding: '16px 32px',
                fontSize: '1rem',
                fontWeight: 500,
                borderRadius: '100px',
                cursor: isDeploying ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                opacity: isDeploying ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isDeploying) {
                  e.currentTarget.style.background = '#e0e0e0'
                  e.currentTarget.style.transform = 'scale(0.98)'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#fff'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              {isLastStep && deployComplete
                ? 'Enter Dashboard'
                : isLastBeforeTerminal
                  ? 'Initialize'
                  : 'Continue'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
