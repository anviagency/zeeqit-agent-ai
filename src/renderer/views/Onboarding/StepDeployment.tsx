import { useEffect, useRef, useState, useCallback } from 'react'
import { useOnboardingStore } from '@/store/onboarding.store'
import { api } from '@/api'

interface TermLine {
  text: string
  type: 'info' | 'success' | 'error' | 'bold'
}

const INSTALL_STEPS = ['runtime', 'openclaw', 'config', 'credentials', 'daemon', 'health', 'complete'] as const
const STEP_LABELS: Record<string, string> = {
  runtime: 'Resolving runtime',
  openclaw: 'Installing OpenClaw',
  config: 'Configuring gateway',
  credentials: 'Securing credentials',
  daemon: 'Starting service',
  health: 'Health check',
  complete: 'Finalizing',
}

const METHOD_LABELS = {
  npm: 'npm global install',
  curl: 'install script (curl)',
  git: 'git clone + build from source',
} as const

/**
 * Step 4: Real deployment with live terminal output, progress bar,
 * and real-time SSE/IPC event streaming.
 */
export function StepDeployment(): React.JSX.Element {
  const { getConfig, setDeploying, setDeployComplete, modules, installMethod } = useOnboardingStore()
  const termRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)
  const [lines, setLines] = useState<TermLine[]>([])
  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [finished, setFinished] = useState(false)

  const push = useCallback((text: string, type: TermLine['type'] = 'info') => {
    setLines((prev) => [...prev, { text, type }])
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight
    }
  }, [lines])

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    setDeploying(true)

    const run = async (): Promise<void> => {
      let unsubscribe: (() => void) | null = null

      try {
        const methodLabel = METHOD_LABELS[installMethod] ?? installMethod
        push(`$ zeeqit install --method ${installMethod}`, 'bold')
        push('', 'info')
        push(`  Method : ${methodLabel}`, 'info')
        push(`  Modules: ${['core', modules.browser && 'browser', modules.telegram && 'telegram', modules.apify && 'apify'].filter(Boolean).join(', ')}`, 'info')
        push('', 'info')

        unsubscribe = api.events.onInstallProgress(
          (...args: unknown[]) => {
            const event = args[0] as { step: string; status: string; message: string } | undefined
            if (!event) return

            const stepIdx = INSTALL_STEPS.indexOf(event.step as typeof INSTALL_STEPS[number])
            if (stepIdx >= 0) {
              setCurrentStepIdx(stepIdx)
            }

            if (event.status === 'completed') {
              push(`  ✓ ${event.message}`, 'success')
            } else if (event.status === 'failed') {
              push(`  ✗ ${event.message}`, 'error')
            } else {
              push(`  → ${event.message}`, 'info')
            }
          }
        )

        const config = getConfig()
        const result = await api.openclaw.install(config)

        setFinished(true)
        setCurrentStepIdx(INSTALL_STEPS.length - 1)

        push('', 'info')
        if (result.success) {
          push('  ✓ Configuration written to ~/.openclaw/openclaw.json', 'success')
          push('  ✓ Gateway service installed and running', 'success')
          push('', 'info')
          push('ZEEQIT ONLINE', 'bold')
          setDeployComplete(true)
        } else {
          const errMsg = result.error?.message ?? 'Unknown error'
          push(`  ✗ ${errMsg}`, 'error')
          push('', 'info')
          push('ZEEQIT READY (with warnings)', 'bold')
          setDeployComplete(true)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        setFinished(true)
        push('', 'info')
        push(`  ✗ ${message}`, 'error')
        push('', 'info')
        push('ZEEQIT READY', 'bold')
        setDeployComplete(true)
      } finally {
        setDeploying(false)
        unsubscribe?.()
      }
    }

    run()
  }, [getConfig, setDeploying, setDeployComplete, modules, installMethod, push])

  const progress = finished ? 100 : Math.round(((currentStepIdx + 0.5) / INSTALL_STEPS.length) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '60vh', gap: 16 }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: '0.85rem', color: '#999', fontFamily: 'monospace' }}>
            {finished ? 'Complete' : STEP_LABELS[INSTALL_STEPS[currentStepIdx]] ?? 'Installing...'}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#999', fontFamily: 'monospace' }}>
            {progress}%
          </span>
        </div>
        <div style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 2,
            background: finished ? '#32d74b' : '#fff',
            width: `${progress}%`,
            transition: 'width 0.4s ease, background 0.3s ease',
          }} />
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
          {INSTALL_STEPS.map((step, i) => {
            let bg = 'rgba(255,255,255,0.08)'
            if (i < currentStepIdx || finished) bg = '#32d74b'
            else if (i === currentStepIdx) bg = '#fff'
            return (
              <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  height: 3,
                  width: '100%',
                  borderRadius: 2,
                  background: bg,
                  transition: 'background 0.3s ease',
                }} />
                <span style={{
                  fontSize: '0.65rem',
                  color: i <= currentStepIdx || finished ? '#999' : '#333',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  transition: 'color 0.3s ease',
                }}>
                  {STEP_LABELS[step]?.split(' ')[0]}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          fontFamily: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
          fontSize: '0.95rem',
          lineHeight: 1.7,
          overflowY: 'auto',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 8,
          padding: '16px 20px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color:
                line.type === 'success' ? '#32d74b' :
                line.type === 'error' ? '#ff453a' :
                line.type === 'bold' ? '#fff' :
                'rgba(255,255,255,0.5)',
              fontSize: line.type === 'bold' && line.text.startsWith('ZEEQIT') ? '1.6rem' : undefined,
              fontWeight: line.type === 'bold' ? 700 : 400,
              marginTop: line.type === 'bold' && line.text.startsWith('ZEEQIT') ? '8px' : undefined,
            }}
          >
            {line.text || '\u00A0'}
          </div>
        ))}
        {!finished && (
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="animate-pulse">▌</span>
          </div>
        )}
      </div>
    </div>
  )
}
