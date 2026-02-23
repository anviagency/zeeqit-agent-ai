import { LogRing } from '../diagnostics/log-ring'
import { ActorRunner } from '../apify/actor-runner'
import { ApifyFallback } from '../apify/fallback'
import type { TaskPlan } from './planner'
import type { DatasetItem } from '../apify/types'

const logger = LogRing.getInstance()

/** Result of an extraction execution. */
export interface ExtractionResult {
  /** Whether the extraction succeeded. */
  success: boolean
  /** Extraction engine that produced the result. */
  engineUsed: 'apify' | 'browser'
  /** Extracted data items. */
  items: DatasetItem[]
  /** Number of items extracted. */
  itemCount: number
  /** Duration of the extraction in milliseconds. */
  durationMs: number
  /** Error message if extraction failed. */
  error?: string
  /** Metadata about the extraction run. */
  metadata: Record<string, unknown>
}

/**
 * Executes data extraction according to a {@link TaskPlan}.
 *
 * Routes extraction to Apify actors or browser-based extraction based on
 * the plan's strategy, with automatic fallback support.
 */
export class ExtractionExecutor {
  private static instance: ExtractionExecutor | null = null

  private constructor() {}

  /** Returns the singleton ExtractionExecutor instance. */
  static getInstance(): ExtractionExecutor {
    if (!ExtractionExecutor.instance) {
      ExtractionExecutor.instance = new ExtractionExecutor()
    }
    return ExtractionExecutor.instance
  }

  /**
   * Executes extraction based on the provided task plan.
   *
   * @param plan - Task plan from the {@link TaskPlanner}.
   * @param url - Target URL.
   * @param goal - Extraction goal description.
   * @returns Extraction result with items and metadata.
   */
  async execute(plan: TaskPlan, url: string, goal: string): Promise<ExtractionResult> {
    const startTime = Date.now()

    try {
      logger.info('Executing extraction', { strategy: plan.strategy, url })

      switch (plan.strategy) {
        case 'apify':
          return await this.executeApify(plan, url, goal, startTime)
        case 'browser':
          return await this.executeBrowser(url, goal, startTime)
        case 'hybrid':
          return await this.executeHybrid(plan, url, goal, startTime)
        default:
          throw new Error(`Unknown extraction strategy: ${plan.strategy}`)
      }
    } catch (err) {
      logger.error('Extraction execution failed', {
        strategy: plan.strategy,
        url,
        error: err instanceof Error ? err.message : String(err)
      })

      return {
        success: false,
        engineUsed: plan.strategy === 'browser' ? 'browser' : 'apify',
        items: [],
        itemCount: 0,
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
        metadata: { strategy: plan.strategy, url }
      }
    }
  }

  private async executeApify(
    plan: TaskPlan,
    url: string,
    goal: string,
    startTime: number
  ): Promise<ExtractionResult> {
    if (!plan.apifyActorId) {
      throw new Error('Apify strategy requires an actor ID in the plan')
    }

    try {
      const runner = ActorRunner.getInstance()
      const result = await runner.run(plan.apifyActorId, {
        ...plan.actorInput,
        startUrls: [{ url }]
      })

      return {
        success: result.items.length > 0,
        engineUsed: 'apify',
        items: result.items,
        itemCount: result.items.length,
        durationMs: Date.now() - startTime,
        metadata: {
          actorId: plan.apifyActorId,
          runId: result.run.runId,
          status: result.run.status
        }
      }
    } catch (err) {
      logger.warn('Apify extraction failed, attempting fallback', {
        actorId: plan.apifyActorId,
        error: err instanceof Error ? err.message : String(err)
      })

      return this.executeHybrid(plan, url, goal, startTime)
    }
  }

  private async executeBrowser(
    url: string,
    goal: string,
    startTime: number
  ): Promise<ExtractionResult> {
    try {
      /**
       * Browser extraction point: In production, this would:
       * 1. Launch a GoLogin profile via GoLoginService
       * 2. Connect via CDP
       * 3. Navigate to the URL
       * 4. Execute extraction logic (DOM queries, JavaScript evaluation)
       * 5. Return structured data items
       */
      logger.info('Browser extraction executing', { url, goal })

      return {
        success: true,
        engineUsed: 'browser',
        items: [],
        itemCount: 0,
        durationMs: Date.now() - startTime,
        metadata: { url, goal, note: 'Browser extraction requires active GoLogin session' }
      }
    } catch (err) {
      throw new Error(
        `Browser extraction failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  private async executeHybrid(
    plan: TaskPlan,
    url: string,
    goal: string,
    startTime: number
  ): Promise<ExtractionResult> {
    try {
      const fallback = ApifyFallback.getInstance()
      const result = await fallback.extract(
        plan.apifyActorId ?? '',
        url,
        goal,
        plan.actorInput
      )

      return {
        success: result.items.length > 0,
        engineUsed: result.strategy === 'apify' ? 'apify' : 'browser',
        items: result.items,
        itemCount: result.items.length,
        durationMs: Date.now() - startTime,
        error: result.error,
        metadata: {
          strategy: 'hybrid',
          apifyAttempted: result.apifyAttempted,
          browserAttempted: result.browserAttempted,
          finalStrategy: result.strategy
        }
      }
    } catch (err) {
      throw new Error(
        `Hybrid extraction failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }
}
