import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { StatusDot } from '@/components/ui/StatusDot'
import { EvidenceTimeline } from './EvidenceTimeline'
import type { WorkflowStatus } from '@/store/workflow.store'

export interface ExecutionEntry {
  id: string
  workflowId: string
  status: WorkflowStatus
  startedAt: string
  completedAt: string | null
  resultCount: number
  durationMs: number | null
}

const STATUS_COLOR: Record<WorkflowStatus, 'green' | 'red' | 'yellow'> = {
  completed: 'green',
  failed: 'red',
  running: 'yellow',
  idle: 'yellow',
  scheduled: 'yellow'
}

const STATUS_LABEL: Record<WorkflowStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  running: 'Running',
  idle: 'Idle',
  scheduled: 'Scheduled'
}

/**
 * Displays a list of past executions for a selected workflow.
 * Expanding an execution reveals its EvidenceTimeline.
 *
 * @param props.workflowId - The ID of the workflow whose executions to display
 * @param props.executions - Array of execution entries
 */
export function WorkflowTimeline({
  workflowId,
  executions
}: {
  workflowId: string
  executions: ExecutionEntry[]
}): React.JSX.Element {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const formatDuration = (ms: number | null): string => {
    if (ms === null) return '—'
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const formatTime = (iso: string): string => {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (executions.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-1 items-center justify-center p-8"
      >
        <div className="text-center">
          <p className="text-sm text-text-muted">No executions yet for this workflow.</p>
          <p className="mt-1 text-xs text-text-muted">
            Run the workflow to see execution history here.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="p-6 space-y-3"
    >
      <h3 className="text-sm font-semibold text-text-main mb-4">Execution History</h3>

      {executions.map((exec) => (
        <div key={exec.id}>
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === exec.id ? null : exec.id)}
            className={[
              'w-full flex items-center gap-4 rounded-lg border px-4 py-3 text-left transition-colors',
              expandedId === exec.id
                ? 'border-accent/40 bg-bg-hover'
                : 'border-border hover:bg-bg-hover'
            ].join(' ')}
          >
            <StatusDot color={STATUS_COLOR[exec.status]} pulse={exec.status === 'running'} />

            <div className="flex-1 min-w-0">
              <span className="text-xs text-text-muted">{formatTime(exec.startedAt)}</span>
            </div>

            <span
              className={[
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                exec.status === 'completed' && 'bg-success/10 text-success',
                exec.status === 'failed' && 'bg-error/10 text-error',
                exec.status === 'running' && 'bg-warning/10 text-warning',
                (exec.status === 'idle' || exec.status === 'scheduled') &&
                  'bg-border text-text-muted'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {STATUS_LABEL[exec.status]}
            </span>

            <span className="shrink-0 text-xs text-text-muted">
              {exec.resultCount} results
            </span>

            <span className="shrink-0 text-xs font-mono text-text-muted">
              {formatDuration(exec.durationMs)}
            </span>

            <ChevronIcon expanded={expandedId === exec.id} />
          </button>

          <AnimatePresence>
            {expandedId === exec.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="mt-2 ml-4 border-l-2 border-border pl-4">
                  <EvidenceTimeline executionId={exec.id} workflowId={workflowId} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }): React.JSX.Element {
  return (
    <motion.svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-text-muted shrink-0"
      animate={{ rotate: expanded ? 180 : 0 }}
      transition={{ duration: 0.15 }}
    >
      <polyline points="6 9 12 15 18 9" />
    </motion.svg>
  )
}
