import { LogRing } from '../diagnostics/log-ring'
import { TaskPlanner, type TaskPlan } from './planner'
import { ExtractionExecutor, type ExtractionResult } from './extractor'
import { ResultValidator, type ValidationResult } from './validator'
import { EvidenceProver } from './prover'

const logger = LogRing.getInstance()

/** Configuration for the routing engine. */
export interface RoutingConfig {
  /** Default extraction mode. */
  defaultMode: 'auto' | 'apify' | 'browser'
  /** Maximum retry attempts for failed extractions. */
  maxRetries: number
  /** Timeout for each extraction attempt in seconds. */
  timeoutSeconds: number
  /** Whether to collect evidence for each extraction. */
  evidenceEnabled: boolean
}

/** Params passed to the routing engine for execution. */
export interface RoutingParams {
  /** Target URL for extraction. */
  url: string
  /** Extraction goal description. */
  goal: string
  /** Extraction mode override. */
  mode?: 'auto' | 'apify' | 'browser'
  /** Workflow run ID for evidence linking. */
  workflowRunId?: string
}

/** Full result of a routed extraction. */
export interface RoutingResult {
  plan: TaskPlan
  extraction: ExtractionResult
  validation: ValidationResult
  evidenceChainId: string | null
  totalDurationMs: number
}

const DEFAULT_CONFIG: RoutingConfig = {
  defaultMode: 'auto',
  maxRetries: 2,
  timeoutSeconds: 300,
  evidenceEnabled: true
}

/**
 * V1 routing engine that orchestrates the extraction pipeline:
 * plan -> extract -> validate -> prove.
 *
 * Uses the fast/cheap tier for planning, then routes to Apify or browser
 * for extraction based on the plan's recommendation.
 */
export class RoutingEngine {
  private static instance: RoutingEngine | null = null
  private config: RoutingConfig = { ...DEFAULT_CONFIG }

  private constructor() {}

  /** Returns the singleton RoutingEngine instance. */
  static getInstance(): RoutingEngine {
    if (!RoutingEngine.instance) {
      RoutingEngine.instance = new RoutingEngine()
    }
    return RoutingEngine.instance
  }

  /**
   * Executes the full extraction pipeline for a given URL and goal.
   *
   * Pipeline: plan -> extract (with retries) -> validate -> prove.
   *
   * @param params - Routing parameters (URL, goal, mode, workflow run ID).
   * @returns Full routing result with plan, extraction, validation, and evidence.
   * @throws If all extraction attempts fail.
   */
  async execute(params: Record<string, unknown>): Promise<RoutingResult> {
    const startTime = Date.now()

    try {
      const routingParams = this.parseParams(params)
      logger.info('Routing engine executing', {
        url: routingParams.url,
        goal: routingParams.goal,
        mode: routingParams.mode ?? this.config.defaultMode
      })

      const planner = TaskPlanner.getInstance()
      const plan = await planner.plan(
        routingParams.url,
        routingParams.goal,
        routingParams.mode ?? this.config.defaultMode
      )

      logger.info('Task plan created', {
        strategy: plan.strategy,
        actorId: plan.apifyActorId
      })

      const extractor = ExtractionExecutor.getInstance()
      let extraction: ExtractionResult | null = null
      let lastError: Error | null = null

      for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
        try {
          extraction = await extractor.execute(plan, routingParams.url, routingParams.goal)
          if (extraction.success) break
          lastError = new Error(extraction.error ?? 'Extraction returned no results')
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          logger.warn(`Extraction attempt ${attempt} failed`, {
            error: lastError.message
          })
        }

        if (attempt <= this.config.maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10_000)
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }

      if (!extraction || !extraction.success) {
        throw lastError ?? new Error('All extraction attempts failed')
      }

      const validator = ResultValidator.getInstance()
      const validation = await validator.validate(extraction, routingParams.goal)

      let evidenceChainId: string | null = null

      if (this.config.evidenceEnabled && routingParams.workflowRunId) {
        const prover = EvidenceProver.getInstance()
        evidenceChainId = await prover.proveExtraction(
          routingParams.workflowRunId,
          routingParams.url,
          extraction
        )
      }

      const result: RoutingResult = {
        plan,
        extraction,
        validation,
        evidenceChainId,
        totalDurationMs: Date.now() - startTime
      }

      logger.info('Routing engine execution complete', {
        strategy: plan.strategy,
        itemCount: extraction.items.length,
        validated: validation.valid,
        durationMs: result.totalDurationMs
      })

      return result
    } catch (err) {
      logger.error('Routing engine execution failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Returns the current routing configuration.
   */
  getConfig(): RoutingConfig {
    return { ...this.config }
  }

  /**
   * Updates the routing configuration.
   *
   * @param config - Partial configuration to merge with current config.
   */
  setConfig(config: Record<string, unknown>): void {
    try {
      this.config = {
        ...this.config,
        ...(config as Partial<RoutingConfig>)
      }
      logger.info('Routing config updated', { config: this.config })
    } catch (err) {
      logger.error('Failed to update routing config', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  private parseParams(raw: Record<string, unknown>): RoutingParams {
    const url = raw['url']
    const goal = raw['goal']

    if (typeof url !== 'string' || url.length === 0) {
      throw new Error('Routing params: "url" is required and must be a non-empty string')
    }
    if (typeof goal !== 'string' || goal.length === 0) {
      throw new Error('Routing params: "goal" is required and must be a non-empty string')
    }

    return {
      url,
      goal,
      mode: raw['mode'] as RoutingParams['mode'],
      workflowRunId: raw['workflowRunId'] as string | undefined
    }
  }
}
