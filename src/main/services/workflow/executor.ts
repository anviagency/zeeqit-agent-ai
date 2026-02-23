import { randomUUID } from 'crypto'
import { join } from 'path'
import { existsSync } from 'fs'
import { readdir, mkdir } from 'fs/promises'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { BrowserWindow } from 'electron'
import { LogRing } from '../diagnostics/log-ring'
import { getAppDataPath, getOpenClawPath } from '../platform/app-paths'
import { atomicWriteFile, atomicReadFile } from '../platform/atomic-fs'
import { IpcChannels } from '@shared/ipc-channels'
import { WorkflowSchema, WorkflowRunSchema } from '@shared/schemas/workflow.schema'
import type { WorkflowNode } from '@shared/schemas/workflow.schema'
import type {
  Workflow,
  WorkflowRun,
  WorkflowExecutionResult,
  ActiveWorkflow,
  WorkflowProgressEvent
} from './types'

const logger = LogRing.getInstance()
const execFileAsync = promisify(execFile)
const WORKFLOWS_DIR = 'workflows'

/** Result from executing a single node. */
interface NodeResult {
  nodeId: string
  nodeType: string
  status: 'completed' | 'failed'
  output: string
  error?: string
}

/**
 * Workflow execution engine that manages workflow CRUD and executes
 * each node through the OpenClaw agent CLI.
 */
export class WorkflowExecutor {
  private static instance: WorkflowExecutor | null = null
  private readonly activeWorkflows = new Map<string, ActiveWorkflow>()

  private constructor() {}

  static getInstance(): WorkflowExecutor {
    if (!WorkflowExecutor.instance) {
      WorkflowExecutor.instance = new WorkflowExecutor()
    }
    return WorkflowExecutor.instance
  }

  /**
   * Creates a new workflow, persists it to disk, and syncs to OpenClaw workspace.
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
      await this.syncToOpenClawWorkspace(workflow)

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
   * Executes a workflow by running each node through the OpenClaw agent CLI.
   * Nodes run sequentially, with each node's output passed as context to the next.
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

      logger.info('Executing workflow', { id: workflowId, name: workflow.name, nodeCount: workflow.nodes.length })

      const runId = randomUUID()
      const run: WorkflowRun = WorkflowRunSchema.parse({
        id: runId,
        workflowId,
        status: 'running',
        mode: 'openclaw',
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
        currentStep: 'starting',
        progress: 0,
        message: `Running workflow "${workflow.name}" (${workflow.nodes.length} nodes)`,
        timestamp: new Date().toISOString()
      })

      // Execute nodes sequentially, passing context forward
      const nodeResults: NodeResult[] = []
      let previousOutput = ''
      let completedNodes = 0

      for (const node of workflow.nodes) {
        if (abortController.signal.aborted) {
          throw new Error('Workflow aborted')
        }

        this.emitProgress({
          workflowId,
          runId,
          status: 'running',
          currentStep: node.title,
          progress: Math.round((completedNodes / workflow.nodes.length) * 100),
          message: `Running: ${node.title}`,
          timestamp: new Date().toISOString()
        })

        const nodeResult = await this.executeNode(node, previousOutput)
        nodeResults.push(nodeResult)

        if (nodeResult.status === 'completed') {
          previousOutput = nodeResult.output
        }

        completedNodes++
      }

      this.activeWorkflows.delete(workflowId)

      const failedNodes = nodeResults.filter((r) => r.status === 'failed')
      const completedAt = new Date().toISOString()
      const durationMs = Date.now() - startTime

      const result: WorkflowExecutionResult = {
        runId,
        workflowId,
        status: failedNodes.length === 0 ? 'completed' : 'failed',
        itemCount: nodeResults.filter((r) => r.status === 'completed').length,
        evidenceChainId: null,
        startedAt: run.startedAt,
        completedAt,
        durationMs,
        error: failedNodes.length > 0
          ? `${failedNodes.length} node(s) failed: ${failedNodes.map((n) => n.nodeId).join(', ')}`
          : undefined
      }

      this.emitProgress({
        workflowId,
        runId,
        status: result.status === 'completed' ? 'completed' : 'failed',
        currentStep: 'done',
        progress: 100,
        message: `Workflow ${result.status}: ${completedNodes}/${workflow.nodes.length} nodes completed`,
        timestamp: completedAt
      })

      logger.info('Workflow execution complete', {
        workflowId,
        runId,
        status: result.status,
        nodesCompleted: completedNodes,
        nodesFailed: failedNodes.length,
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
   * Executes a single workflow node via the OpenClaw agent CLI.
   * Translates the node type + config into an appropriate prompt.
   */
  private async executeNode(node: WorkflowNode, previousOutput: string): Promise<NodeResult> {
    try {
      const prompt = this.buildNodePrompt(node, previousOutput)

      logger.info('Executing node', { nodeId: node.id, type: node.type, prompt: prompt.substring(0, 100) })

      const args = ['agent', '--message', prompt, '--local', '--json']

      const { stdout } = await execFileAsync('openclaw', args, {
        timeout: 120_000,
        env: { ...process.env },
      })

      let output = stdout.trim()
      try {
        const parsed = JSON.parse(output)
        output = parsed?.result ?? parsed?.output ?? output
      } catch {
        // stdout is plain text, use as-is
      }

      logger.info('Node completed', { nodeId: node.id, outputLength: output.length })

      return {
        nodeId: node.id,
        nodeType: node.type,
        status: 'completed',
        output,
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      logger.error('Node execution failed', { nodeId: node.id, error: errorMsg })

      return {
        nodeId: node.id,
        nodeType: node.type,
        status: 'failed',
        output: '',
        error: errorMsg,
      }
    }
  }

  /**
   * Builds the OpenClaw agent prompt for a given node type and config.
   */
  private buildNodePrompt(node: WorkflowNode, previousOutput: string): string {
    const config = node.config
    const context = previousOutput
      ? `\n\nContext from previous step:\n${previousOutput.substring(0, 2000)}`
      : ''

    switch (node.type) {
      case 'google-search':
        return `Search Google for: ${config.query || node.title}. Return the top ${config.maxResults || '10'} results with titles, URLs, and snippets.${context}`

      case 'web-scrape':
        return `Scrape the web page at ${config.url || 'the URL from the previous step'} and extract the main content.${context}`

      case 'screenshot':
        return `Take a screenshot of the page at ${config.url || 'the URL from the previous step'} and describe what you see.${context}`

      case 'navigate':
        return `Navigate to ${config.url || 'the URL'} and describe the page content.${context}`

      case 'instagram-post':
        return `Create an Instagram post with the following content: ${config.caption || config.message || 'based on previous step results'}.${context}`

      case 'telegram-send':
        return `Send a Telegram message: ${config.message || config.text || 'summary of previous results'}.${context}`

      case 'tiktok-upload':
        return `Prepare content for TikTok upload: ${config.caption || 'based on previous step'}.${context}`

      case 'whatsapp-send':
        return `Send a WhatsApp message to ${config.recipient || 'the target'}: ${config.message || 'based on previous results'}.${context}`

      case 'openai-generate':
      case 'anthropic-generate':
        return `${config.prompt || config.message || node.desc || 'Generate content based on the following context'}.${context}`

      case 'ai-analyze':
        return `Analyze the following data and provide insights: ${config.prompt || ''}.${context}`

      case 'ai-summarize':
        return `Summarize the following content concisely: ${config.prompt || ''}.${context}`

      case 'nanobanano-upload':
      case 's3-upload':
      case 'gdrive-upload':
        return `Upload the content to ${node.type.replace('-upload', '')} storage at ${config.path || config.bucket || 'the configured location'}.${context}`

      case 'nanobanano-download':
      case 's3-download':
      case 'gdrive-download':
        return `Download content from ${node.type.replace('-download', '')} at ${config.path || config.url || 'the configured location'}.${context}`

      case 'api':
        return `Make an API call to ${config.url || 'the endpoint'} with method ${config.method || 'GET'}.${context}`

      case 'agent':
        return `${config.prompt || config.message || node.desc || 'Process the following task'}.${context}`

      case 'channel':
        return `Send the following through the configured channel: ${config.message || 'results from previous step'}.${context}`

      default:
        return `${node.title}: ${node.desc || config.prompt || config.message || 'Execute this step'}.${context}`
    }
  }

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

  /**
   * Syncs a saved workflow to `~/.openclaw/workspace/workflows/` so
   * OpenClaw's native workspace can see it.
   */
  private async syncToOpenClawWorkspace(workflow: Workflow): Promise<void> {
    try {
      const ocDir = join(getOpenClawPath(), 'workspace', 'workflows')
      if (!existsSync(ocDir)) {
        await mkdir(ocDir, { recursive: true })
      }

      const safeName = workflow.name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      const filePath = join(ocDir, `${safeName}.json`)

      const ocWorkflow = {
        name: workflow.name,
        prompt: workflow.prompt,
        nodes: workflow.nodes.map((n) => ({
          type: n.type,
          title: n.title,
          config: n.config,
        })),
        schedule: workflow.schedule,
        createdAt: workflow.createdAt,
      }

      await atomicWriteFile(filePath, JSON.stringify(ocWorkflow, null, 2))
      logger.info('Workflow synced to OpenClaw workspace', { name: workflow.name, path: filePath })
    } catch (err) {
      // Non-fatal: Zeeqit storage always succeeds, OpenClaw sync is best-effort
      logger.warn('Failed to sync workflow to OpenClaw workspace', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  private getWorkflowsDir(): string {
    return join(getAppDataPath(), WORKFLOWS_DIR)
  }

  private async saveWorkflow(workflow: Workflow): Promise<void> {
    const dir = this.getWorkflowsDir()
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
    const filePath = join(dir, `${workflow.id}.json`)
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
