import { LogRing } from '../diagnostics/log-ring'
import { ApifyService } from './client'
import { ActorCache } from './actor-cache'
import type { ActorRunInfo, DatasetItem, ActorRunStatus } from './types'

const logger = LogRing.getInstance()

const POLL_INTERVAL_MS = 5_000
const MAX_POLL_DURATION_MS = 600_000

/** Result of a completed actor execution including extracted data. */
export interface ActorExecutionResult {
  run: ActorRunInfo
  items: DatasetItem[]
  durationMs: number
}

/**
 * Orchestrates Apify actor execution with polling, caching, and result retrieval.
 *
 * Provides a high-level `run()` method that starts an actor, polls until completion,
 * and returns the dataset items. Uses {@link ActorCache} for actor metadata.
 */
export class ActorRunner {
  private static instance: ActorRunner | null = null
  private readonly activeRuns = new Map<string, ActorRunInfo>()

  private constructor() {}

  /** Returns the singleton ActorRunner instance. */
  static getInstance(): ActorRunner {
    if (!ActorRunner.instance) {
      ActorRunner.instance = new ActorRunner()
    }
    return ActorRunner.instance
  }

  /**
   * Runs an Apify actor, polls until completion, and returns the results.
   *
   * @param actorId - Apify actor ID to execute.
   * @param input - Input configuration for the run.
   * @returns Execution result with run info, dataset items, and duration.
   * @throws If the actor run fails or times out.
   */
  async run(actorId: string, input: Record<string, unknown>): Promise<ActorExecutionResult> {
    const startTime = Date.now()

    try {
      logger.info('Starting actor execution', { actorId })

      const cache = ActorCache.getInstance()
      const isAllowed = await cache.isAllowed(actorId)
      if (!isAllowed) {
        throw new Error(`Actor "${actorId}" is not on the allowlist`)
      }

      const apify = ApifyService.getInstance()
      const runInfo = await apify.runActor(actorId, input)
      this.activeRuns.set(runInfo.runId, runInfo)

      const completedRun = await this.pollUntilComplete(runInfo.runId)
      this.activeRuns.delete(runInfo.runId)

      if (completedRun.status === 'FAILED' || completedRun.status === 'ABORTED') {
        throw new Error(`Actor run ${completedRun.runId} ended with status: ${completedRun.status}`)
      }

      if (completedRun.status === 'TIMED-OUT') {
        throw new Error(`Actor run ${completedRun.runId} timed out`)
      }

      let items: DatasetItem[] = []
      if (completedRun.defaultDatasetId) {
        items = await apify.getDatasetItems(completedRun.defaultDatasetId)
      }

      const durationMs = Date.now() - startTime

      logger.info('Actor execution completed', {
        actorId,
        runId: completedRun.runId,
        itemCount: items.length,
        durationMs
      })

      return { run: completedRun, items, durationMs }
    } catch (err) {
      logger.error('Actor execution failed', {
        actorId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Gets the current status of an active or completed run.
   *
   * @param runId - Apify run ID.
   * @returns Current run status information.
   */
  async getRunStatus(runId: string): Promise<ActorRunInfo> {
    try {
      return await ApifyService.getInstance().getRunStatus(runId)
    } catch (err) {
      logger.error('Failed to get run status', {
        runId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Returns the number of currently active (polling) runs.
   */
  getActiveRunCount(): number {
    return this.activeRuns.size
  }

  private async pollUntilComplete(runId: string): Promise<ActorRunInfo> {
    const deadline = Date.now() + MAX_POLL_DURATION_MS
    const terminalStatuses: ActorRunStatus[] = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED']

    while (Date.now() < deadline) {
      const status = await ApifyService.getInstance().getRunStatus(runId)

      if (terminalStatuses.includes(status.status)) {
        return status
      }

      logger.debug('Polling actor run', { runId, status: status.status })
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    throw new Error(`Actor run ${runId} exceeded maximum poll duration of ${MAX_POLL_DURATION_MS}ms`)
  }
}
