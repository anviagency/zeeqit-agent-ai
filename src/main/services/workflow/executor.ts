import { randomUUID } from 'crypto'
import { join } from 'path'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { BrowserWindow } from 'electron'
import { LogRing } from '../diagnostics/log-ring'
import { getAppDataPath } from '../platform/app-paths'
import { atomicWriteFile, atomicReadFile } from '../platform/atomic-fs'
import { RoutingEngine } from '../routing/engine'
import { IpcChannels } from '@shared/ipc-channels'
import { WorkflowSchema, WorkflowRunSchema } from '@shared/schemas/workflow.schema'
import type {
  Workflow,
  WorkflowRun,
  WorkflowExecutionResult,
  ActiveWorkflow,
  WorkflowProgressEvent
} from './types'

const logger = LogRing.getInstance()
const WORKFLOWS_DIR = 'workflows'

/**
 * Workflow execution engine that manages workflow CRUD, execution, and progress tracking.
 *
 * Coordinates with the {@link RoutingEngine} for actual data extraction and
 * emits progress events to the renderer process.
 */
export class WorkflowExecutor {
  private static instance: WorkflowExecutor | null = null
  private readonly activeWorkflows = new Map<string, ActiveWorkflow>()

  private constructor() {}

  /** Returns the singleton WorkflowExecutor instance. */
  static getInstance(): WorkflowExecutor {
    if (!WorkflowExecutor.instance) {
      WorkflowExecutor.instance = new WorkflowExecutor()
    }
    return WorkflowExecutor.instance
  }

  /**
   * Creates a new workflow and persists it to disk.
   *
   * @param params - Workflow creation parameters.
   * @returns The created workflow.
   */
  async create(params: Record<string, unknown>): Promise<Workflow> {
    try {
      const now = new Date().toISOString()
      const raw = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...params
      }

      const result = WorkflowSchema.safeParse(raw)
      if (!result.success) {
        const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
        throw new Error(`Invalid workflow: ${issues.join(', ')}`)
      }

      const workflow = result.data
      await this.saveWorkflow(workflow)

      logger.info('Workflow created', { id: workflow.id, name: workflow.name })
      return workflow
    } catch (err) {
      logger.error('Failed to create workflow', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Executes a workflow by its ID.
   *
   * @param workflowId - ID of the workflow to execute.
   * @returns Execution result with item count and evidence chain.
   * @throws If the workflow is not found or execution fails.
   */
  async execute(workflowId: string): Promise<WorkflowExecutionResult> {
    const startTime = Date.now()

    try {
      const workflow = await this.getWorkflow(workflowId)
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`)
      }

      if (this.activeWorkflows.has(workflowId)) {
        throw new Error(`Workflow ${workflowId} is already running`)
      }

      logger.info('Executing workflow', { id: workflowId, name: workflow.name })

      const runId = randomUUID()
      const run: WorkflowRun = WorkflowRunSchema.parse({
        id: runId,
        workflowId,
        status: 'running',
        mode: workflow.mode,
        startedAt: new Date().toISOString()
      })

      const abortController = new AbortController()
      this.activeWorkflows.set(workflowId, {
        workflow,
        run,
        startedAt: new Date(),
        abortController
      })

      this.emitProgress({
        workflowId,
        runId,
        status: 'running',
        currentStep: 'extraction',
        progress: 0,
        message: 'Starting extraction',
        timestamp: new Date().toISOString()
      })

      const router = RoutingEngine.getInstance()
      const routingResult = await router.execute({
        url: workflow.targetUrl,
        goal: workflow.extractionGoal,
        mode: workflow.mode,
        workflowRunId: runId
      })

      this.activeWorkflows.delete(workflowId)

      const completedAt = new Date().toISOString()
      const durationMs = Date.now() - startTime

      const result: WorkflowExecutionResult = {
        runId,
        workflowId,
        status: routingResult.validation.valid ? 'completed' : 'failed',
        itemCount: routingResult.extraction.itemCount,
        evidenceChainId: routingResult.evidenceChainId,
        startedAt: run.startedAt,
        completedAt,
        durationMs,
        error: routingResult.validation.valid ? undefined : routingResult.validation.summary
      }

      this.emitProgress({
        workflowId,
        runId,
        status: result.status === 'completed' ? 'completed' : 'failed',
        currentStep: 'done',
        progress: 100,
        message: `Workflow ${result.status}: ${routingResult.extraction.itemCount} items extracted`,
        timestamp: completedAt
      })

      logger.info('Workflow execution complete', {
        workflowId,
        runId,
        status: result.status,
        itemCount: result.itemCount,
        durationMs
      })

      return result
    } catch (err) {
      this.activeWorkflows.delete(workflowId)

      logger.error('Workflow execution failed', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })

      return {
        runId: randomUUID(),
        workflowId,
        status: 'failed',
        itemCount: 0,
        evidenceChainId: null,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * Lists all saved workflows.
   *
   * @returns Array of workflow objects.
   */
  async listWorkflows(): Promise<Workflow[]> {
    try {
      const dir = this.getWorkflowsDir()
      if (!existsSync(dir)) return []

      const files = await readdir(dir)
      const workflows: Workflow[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const raw = await atomicReadFile(join(dir, file))
          const parsed = JSON.parse(raw)
          const result = WorkflowSchema.safeParse(parsed)
          if (result.success) {
            workflows.push(result.data)
          }
        } catch {
          logger.warn('Failed to read workflow file', { file })
        }
      }

      return workflows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch (err) {
      logger.error('Failed to list workflows', {
        error: err instanceof Error ? err.message : String(err)
      })
      return []
    }
  }

  /**
   * Retrieves a single workflow by ID.
   *
   * @param workflowId - Workflow ID.
   * @returns The workflow, or `null` if not found.
   */
  async getWorkflow(workflowId: string): Promise<Workflow | null> {
    try {
      const filePath = join(this.getWorkflowsDir(), `${workflowId}.json`)
      if (!existsSync(filePath)) return null

      const raw = await atomicReadFile(filePath)
      const parsed = JSON.parse(raw)
      const result = WorkflowSchema.safeParse(parsed)
      return result.success ? result.data : null
    } catch (err) {
      logger.error('Failed to get workflow', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Aborts a running workflow.
   *
   * @param workflowId - ID of the workflow to abort.
   */
  abort(workflowId: string): void {
    try {
      const active = this.activeWorkflows.get(workflowId)
      if (!active) {
        logger.warn('No active workflow to abort', { workflowId })
        return
      }

      active.abortController.abort()
      this.activeWorkflows.delete(workflowId)
      logger.info('Workflow aborted', { workflowId })
    } catch (err) {
      logger.error('Failed to abort workflow', {
        workflowId,
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private getWorkflowsDir(): string {
    return join(getAppDataPath(), WORKFLOWS_DIR)
  }

  private async saveWorkflow(workflow: Workflow): Promise<void> {
    const filePath = join(this.getWorkflowsDir(), `${workflow.id}.json`)
    await atomicWriteFile(filePath, JSON.stringify(workflow, null, 2))
  }

  private emitProgress(event: WorkflowProgressEvent): void {
    try {
      const windows = BrowserWindow.getAllWindows()
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(IpcChannels.EVENT_WORKFLOW_PROGRESS, event)
        }
      }
    } catch (err) {
      logger.debug('Failed to emit workflow progress', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }
}
