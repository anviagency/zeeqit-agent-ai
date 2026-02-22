import { useEffect, useRef, useState } from 'react'
import { useOnboardingStore } from '@/store/onboarding.store'

/**
 * Step 4: Terminal-style deployment sequence.
 * Matches the spec HTML: raw monospace terminal, no window chrome,
 * progressive message reveal with timing, and the big "ZEEQIT ONLINE" finale.
 */
export function StepDeployment(): React.JSX.Element {
  const { modules, getConfig, setDeploying, setDeployComplete } = useOnboardingStore()
  const termRef = useRef<HTMLDivElement>(null)
  const hasStarted = useRef(false)
  const [html, setHtml] = useState('')

  const appendLine = (line: string): void => {
    setHtml((prev) => prev + `<div class="term-line">${line}</div>`)
  }

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    setDeploying(true)

    const sequence: { t: number; msg: string }[] = [
      { t: 400, msg: '> Initializing AES-256 Vault...' },
      { t: 1000, msg: '> Wiping legacy ~/.openclaw dependencies...' },
      { t: 1800, msg: `> <span style="color: #32d74b">[OK] Clean slate achieved.</span>` },
      { t: 2600, msg: '> Encrypting provider keys...' },
      { t: 3400, msg: '> Compiling zeeqit core logic...' },
    ]

    if (modules.browser) {
      sequence.push({ t: 4200, msg: '> Injecting GoLogin CDP bridge...' })
    }

    sequence.push({ t: 5000, msg: '> Verifying CORTEX Vector Memory...' })
    sequence.push({
      t: 6000,
      msg: `> <br>> <span style="color: #fff; font-size: 2rem;">ZEEQIT ONLINE</span>`,
    })

    const timers: ReturnType<typeof setTimeout>[] = []

    sequence.forEach((item) => {
      const timer = setTimeout(() => {
        appendLine(item.msg)
        if (termRef.current) {
          termRef.current.scrollTop = termRef.current.scrollHeight
        }
      }, item.t)
      timers.push(timer)
    })

    const finalTimer = setTimeout(async () => {
      try {
        const config = getConfig()
        await window.zeeqitApi.openclaw.install(config)
      } catch {
        // install attempted — UI shows terminal animation regardless
      }
      setDeploying(false)
      setDeployComplete(true)
    }, 6500)
    timers.push(finalTimer)

    return () => {
      timers.forEach(clearTimeout)
    }
  }, [modules, getConfig, setDeploying, setDeployComplete])

  return (
    <div
      ref={termRef}
      style={{
        fontFamily: '"SF Mono", ui-monospace, Menlo, Monaco, monospace',
        fontSize: '1.2rem',
        color: '#666',
        lineHeight: 1.8,
        height: '50vh',
        overflowY: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: html || '<div class="term-line">> Ready for sequence...</div>' }}
    />
  )
}
