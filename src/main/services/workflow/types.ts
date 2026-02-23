/**
 * Workflow service type definitions.
 *
 * Extends the shared workflow schemas with runtime execution types
 * used exclusively in the main process.
 */

import type { Workflow, WorkflowRun } from '@shared/schemas/workflow.schema'

export type { Workflow, WorkflowRun }

/** Status of a workflow in the execution lifecycle. */
export type WorkflowExecutionStatus = 'idle' | 'queued' | 'running' | 'paused' | 'completed' | 'failed'

/** Progress event emitted during workflow execution. */
export interface WorkflowProgressEvent {
  workflowId: string
  runId: string
  status: WorkflowExecutionStatus
  currentStep: string
  progress: number
  message: string
  timestamp: string
}

/** Cron schedule entry for a workflow. */
export interface ScheduleEntry {
  workflowId: string
  cronExpression: string
  enabled: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  timezone: string
}

/** Result of a single workflow execution. */
export interface WorkflowExecutionResult {
  runId: string
  workflowId: string
  status: 'completed' | 'failed'
  itemCount: number
  evidenceChainId: string | null
  startedAt: string
  completedAt: string
  durationMs: number
  error?: string
}

/** In-memory state of a running workflow. */
export interface ActiveWorkflow {
  workflow: Workflow
  run: WorkflowRun
  startedAt: Date
  abortController: AbortController
}
