import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkflowStore, type WorkflowSummary } from '@/store/workflow.store'
import { StatusDot } from '@/components/ui/StatusDot'
import { Button } from '@/components/ui/Button'
import { WorkflowBuilder } from './WorkflowBuilder'
import { WorkflowTimeline, type ExecutionEntry } from './WorkflowTimeline'

type PanelMode = 'empty' | 'builder' | 'detail'

const STATUS_COLOR: Record<string, 'green' | 'red' | 'yellow'> = {
  completed: 'green',
  failed: 'red',
  running: 'yellow',
  idle: 'yellow',
  scheduled: 'yellow'
}

/**
 * Workflows split view: workflow list (left, 300px) + detail/builder (right).
 * Replaces the Phase 2 placeholder with a full builder and execution timeline.
 */
export function WorkflowsView(): React.JSX.Element {
  const workflows = useWorkflowStore((s) => s.workflows)
  const setWorkflows = useWorkflowStore((s) => s.setWorkflows)
  const selectedId = useWorkflowStore((s) => s.selectedWorkflowId)
  const selectWorkflow = useWorkflowStore((s) => s.selectWorkflow)

  const [panelMode, setPanelMode] = useState<PanelMode>('empty')
  const [executions, setExecutions] = useState<ExecutionEntry[]>([])
  const [loadingExecs, setLoadingExecs] = useState(false)

  const loadWorkflows = useCallback(async (): Promise<void> => {
    try {
      const result = await window.zeeqitApi.workflow.list()
      if (result.success && result.data) {
        setWorkflows(result.data as WorkflowSummary[])
      }
    } catch {
      // error handling delegated to global error boundary
    }
  }, [setWorkflows])

  useEffect(() => {
    void loadWorkflows()
  }, [loadWorkflows])

  const handleSelectWorkflow = async (wf: WorkflowSummary): Promise<void> => {
    selectWorkflow(wf.id)
    setPanelMode('detail')
    try {
      setLoadingExecs(true)
      const result = await window.zeeqitApi.workflow.get(wf.id)
      if (result.success && result.data) {
        const data = result.data as { executions?: ExecutionEntry[] }
        setExecutions(data.executions ?? [])
      }
    } catch {
      setExecutions([])
    } finally {
      setLoadingExecs(false)
    }
  }

  const handleNewWorkflow = (): void => {
    selectWorkflow(null)
    setPanelMode('builder')
  }

  const handleCreated = (): void => {
    setPanelMode('empty')
    void loadWorkflows()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold text-text-main">Workflows</h1>
          <p className="mt-1 text-sm text-text-muted">
            Create, manage, and monitor extraction workflows.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleNewWorkflow}>
          New Workflow
        </Button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left panel - workflow list */}
        <div className="w-[300px] shrink-0 border-r border-border overflow-y-auto">
          {workflows.length === 0 ? (
            <div className="flex items-center justify-center h-full p-6">
              <p className="text-xs text-text-muted text-center">
                No workflows yet. Click &quot;New Workflow&quot; to get started.
              </p>
            </div>
          ) : (
            <div className="py-2">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => void handleSelectWorkflow(wf)}
                  className={[
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                    selectedId === wf.id
                      ? 'bg-bg-hover border-l-2 border-accent'
                      : 'hover:bg-bg-hover border-l-2 border-transparent'
                  ].join(' ')}
                >
                  <StatusDot
                    color={STATUS_COLOR[wf.status] ?? 'yellow'}
                    pulse={wf.status === 'running'}
                    size={8}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-text-main truncate">
                      {wf.name}
                    </span>
                    <span className="block text-[10px] text-text-muted mt-0.5">
                      {wf.lastRunAt
                        ? `Last run: ${new Date(wf.lastRunAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                        : 'Never run'}
                    </span>
                  </div>
                  {wf.schedule && (
                    <span className="shrink-0 rounded bg-bg-surface px-1.5 py-0.5 text-[9px] font-mono text-text-muted border border-border">
                      cron
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right panel - detail or builder */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {panelMode === 'empty' && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full items-center justify-center"
              >
                <div className="text-center max-w-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-bg-surface">
                    <WorkflowIcon />
                  </div>
                  <p className="text-sm text-text-muted">
                    Select a workflow from the list or create a new one.
                  </p>
                </div>
              </motion.div>
            )}

            {panelMode === 'builder' && (
              <motion.div
                key="builder"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                <WorkflowBuilder onCreated={handleCreated} />
              </motion.div>
            )}

            {panelMode === 'detail' && selectedId && (
              <motion.div
                key={`detail-${selectedId}`}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.25 }}
              >
                {loadingExecs ? (
                  <div className="flex items-center justify-center h-full py-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  </div>
                ) : (
                  <WorkflowTimeline workflowId={selectedId} executions={executions} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function WorkflowIcon(): React.JSX.Element {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  )
}
