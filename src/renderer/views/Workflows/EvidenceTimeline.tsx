import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { api } from '@/api'

interface EvidenceStep {
  timestamp: string
  description: string
  status: 'success' | 'failure' | 'pending'
  screenshotPath?: string
  hash: string
  prevHash: string | null
  anchor?: {
    selector: string
    visualHash: string
    semanticDescription: string
  }
}

interface ChainVerification {
  valid: boolean
  brokenAt?: number
}

/**
 * Evidence timeline for a single workflow execution.
 * Displays each step as a vertical timeline with hash chain integrity checks.
 *
 * @param props.executionId - The execution ID to load evidence for
 * @param props.workflowId - The parent workflow ID
 */
export function EvidenceTimeline({
  executionId,
  workflowId: _workflowId
}: {
  executionId: string
  workflowId: string
}): React.JSX.Element {
  const [steps, setSteps] = useState<EvidenceStep[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [verification, setVerification] = useState<ChainVerification | null>(null)
  const [hoveredScreenshot, setHoveredScreenshot] = useState<string | null>(null)

  const loadChain = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      const result = await api.evidence.getChain(executionId)
      if (result.success && result.data) {
        setSteps(result.data as EvidenceStep[])
      }
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setLoading(false)
    }
  }, [executionId])

  useEffect(() => {
    void loadChain()
  }, [loadChain])

  const handleVerify = async (): Promise<void> => {
    try {
      setVerifying(true)
      const result = await api.evidence.verify(executionId)
      if (result.success && result.data) {
        setVerification(result.data as ChainVerification)
      }
    } catch {
      // error handling delegated to global error boundary
    } finally {
      setVerifying(false)
    }
  }

  const formatTime = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const truncateHash = (hash: string): string =>
    hash.length > 12 ? `${hash.slice(0, 6)}...${hash.slice(-6)}` : hash

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-xs text-text-muted">Loading evidence chain…</span>
      </div>
    )
  }

  if (steps.length === 0) {
    return (
      <p className="py-4 text-xs text-text-muted">No evidence steps recorded for this execution.</p>
    )
  }

  return (
    <div className="py-4 space-y-4">
      {/* Header with verify controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">Evidence Chain</span>
          {verification !== null && <ChainBadge valid={verification.valid} />}
        </div>
        <Button variant="secondary" size="sm" loading={verifying} onClick={handleVerify}>
          Verify Chain
        </Button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

        {steps.map((step, idx) => (
          <motion.div
            key={`${step.hash}-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.05 }}
            className="relative flex gap-4 pb-5 last:pb-0"
          >
            {/* Dot */}
            <div className="relative z-10 mt-1 shrink-0">
              <StepStatusIcon status={step.status} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-muted">{formatTime(step.timestamp)}</span>
                <span className="text-xs text-text-main">{step.description}</span>
              </div>

              {/* Screenshot hover preview */}
              {step.screenshotPath && (
                <div
                  className="relative inline-block"
                  onMouseEnter={() => setHoveredScreenshot(step.screenshotPath!)}
                  onMouseLeave={() => setHoveredScreenshot(null)}
                >
                  <span className="cursor-pointer text-[10px] text-accent underline underline-offset-2">
                    View screenshot
                  </span>
                  {hoveredScreenshot === step.screenshotPath && (
                    <div className="absolute left-0 top-5 z-50 rounded-lg border border-border bg-bg-surface p-2 shadow-xl">
                      <span className="block text-[10px] font-mono text-text-muted max-w-[200px] truncate">
                        {step.screenshotPath}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Hash chain display */}
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                <span className="text-text-muted">hash:</span>
                <span className="rounded bg-bg-hover px-1.5 py-0.5 text-text-main">
                  {truncateHash(step.hash)}
                </span>
                {step.prevHash && (
                  <>
                    <span className="text-text-muted">prev:</span>
                    <span className="rounded bg-bg-hover px-1.5 py-0.5 text-text-muted">
                      {truncateHash(step.prevHash)}
                    </span>
                  </>
                )}
                {verification !== null && (
                  <HashIntegrityIcon
                    valid={!verification.brokenAt || idx < verification.brokenAt}
                  />
                )}
              </div>

              {/* 3-tier DOM anchor */}
              {step.anchor && (
                <div className="rounded-lg border border-border bg-bg-base p-2.5 space-y-1">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-text-muted">Selector:</span>
                    <code className="text-text-main font-mono">{step.anchor.selector}</code>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-text-muted">Visual hash:</span>
                    <code className="text-text-main font-mono">
                      {truncateHash(step.anchor.visualHash)}
                    </code>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-text-muted">Semantic:</span>
                    <span className="text-text-main">{step.anchor.semanticDescription}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function StepStatusIcon({ status }: { status: 'success' | 'failure' | 'pending' }): React.JSX.Element {
  const colors = {
    success: 'bg-success border-success/30',
    failure: 'bg-error border-error/30',
    pending: 'bg-warning border-warning/30'
  }
  return (
    <span
      className={`block h-[15px] w-[15px] rounded-full border-2 ${colors[status]}`}
    />
  )
}

function ChainBadge({ valid }: { valid: boolean }): React.JSX.Element {
  if (valid) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Valid
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-error/10 px-2 py-0.5 text-[10px] font-medium text-error">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      Broken
    </span>
  )
}

function HashIntegrityIcon({ valid }: { valid: boolean }): React.JSX.Element {
  if (valid) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-success">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-error">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
