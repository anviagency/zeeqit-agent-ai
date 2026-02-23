import { LogRing } from '../diagnostics/log-ring'
import type { ApifyActor, ActorRunInfo, DatasetItem, ActorRunStatus } from './types'

const logger = LogRing.getInstance()

const APIFY_API_BASE = 'https://api.apify.com/v2'
const ACTOR_LIST_CACHE_TTL_MS = 60_000
const REQUEST_TIMEOUT_MS = 30_000

interface ActorListCache {
  actors: ApifyActor[]
  cachedAt: number
}

/**
 * Apify API client for actor discovery, execution, and dataset retrieval.
 *
 * Provides token validation, cached actor listing, run management, and
 * dataset item fetching against the Apify REST API.
 *
 * @remarks
 * All API calls require a valid Apify token set via {@link validateToken}.
 */
export class ApifyService {
  private static instance: ApifyService | null = null
  private token: string | null = null
  private actorListCache: ActorListCache | null = null

  private constructor() {}

  /** Returns the singleton ApifyService instance. */
  static getInstance(): ApifyService {
    if (!ApifyService.instance) {
      ApifyService.instance = new ApifyService()
    }
    return ApifyService.instance
  }

  /**
   * Validates an Apify API token by fetching the user account info.
   *
   * @param token - Apify API token to validate.
   * @returns `true` if the token is valid.
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      logger.info('Validating Apify API token')

      const response = await this.fetchWithTimeout(`${APIFY_API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        this.token = token
        this.actorListCache = null
        logger.info('Apify token validated successfully')
        return true
      }

      logger.warn('Apify token validation failed', { status: response.status })
      return false
    } catch (err) {
      logger.error('Apify token validation error', {
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Lists available actors from the user's Apify account with TTL caching.
   *
   * @returns Array of actor descriptors.
   * @throws If no token is set or the API call fails.
   */
  async listActors(): Promise<ApifyActor[]> {
    try {
      this.ensureToken()

      if (this.actorListCache && Date.now() - this.actorListCache.cachedAt < ACTOR_LIST_CACHE_TTL_MS) {
        logger.debug('Returning cached Apify actors', { count: this.actorListCache.actors.length })
        return this.actorListCache.actors
      }

      logger.info('Fetching Apify actors from API')

      const response = await this.fetchWithTimeout(`${APIFY_API_BASE}/acts?limit=100`, {
        headers: { Authorization: `Bearer ${this.token}` }
      })

      if (!response.ok) {
        throw new Error(`Apify API returned ${response.status}: ${response.statusText}`)
      }

      const data = (await response.json()) as { data?: { items?: Record<string, unknown>[] } }
      const rawActors = data.data?.items ?? []

      const actors: ApifyActor[] = rawActors.map((a) => ({
        id: String(a['id'] ?? ''),
        name: String(a['name'] ?? 'Unnamed'),
        description: String(a['description'] ?? ''),
        version: String(a['version']?.toString() ?? '0.0.0'),
        capabilities: [],
        allowed: true
      }))

      this.actorListCache = { actors, cachedAt: Date.now() }
      logger.info('Apify actors fetched', { count: actors.length })
      return actors
    } catch (err) {
      logger.error('Failed to list Apify actors', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Starts an actor run with the given input.
   *
   * @param actorId - Apify actor ID to run.
   * @param input - Input configuration for the run.
   * @returns Run information including the run ID.
   */
  async runActor(actorId: string, input: Record<string, unknown>): Promise<ActorRunInfo> {
    try {
      this.ensureToken()
      logger.info('Starting Apify actor run', { actorId })

      const response = await this.fetchWithTimeout(
        `${APIFY_API_BASE}/acts/${actorId}/runs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(input)
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to start actor run: ${response.status} ${response.statusText}`)
      }

      const result = (await response.json()) as { data?: Record<string, unknown> }
      const run = result.data ?? {}

      const runInfo: ActorRunInfo = {
        runId: String(run['id'] ?? ''),
        actorId,
        status: (run['status'] as ActorRunStatus) ?? 'RUNNING',
        startedAt: String(run['startedAt'] ?? new Date().toISOString()),
        finishedAt: run['finishedAt'] ? String(run['finishedAt']) : null,
        datasetItemCount: Number(run['stats']?.['datasetItemCount'] ?? 0) || 0,
        defaultDatasetId: run['defaultDatasetId'] ? String(run['defaultDatasetId']) : null
      }

      logger.info('Apify actor run started', { runId: runInfo.runId, actorId })
      return runInfo
    } catch (err) {
      logger.error('Failed to start Apify actor run', {
        actorId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Gets the current status of an actor run.
   *
   * @param runId - Apify run ID to check.
   * @returns Current run status information.
   */
  async getRunStatus(runId: string): Promise<ActorRunInfo> {
    try {
      this.ensureToken()

      const response = await this.fetchWithTimeout(
        `${APIFY_API_BASE}/actor-runs/${runId}`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      )

      if (!response.ok) {
        throw new Error(`Failed to get run status: ${response.status}`)
      }

      const result = (await response.json()) as { data?: Record<string, unknown> }
      const run = result.data ?? {}

      return {
        runId,
        actorId: String(run['actId'] ?? ''),
        status: (run['status'] as ActorRunStatus) ?? 'RUNNING',
        startedAt: String(run['startedAt'] ?? ''),
        finishedAt: run['finishedAt'] ? String(run['finishedAt']) : null,
        datasetItemCount: Number(run['stats']?.['datasetItemCount'] ?? 0) || 0,
        defaultDatasetId: run['defaultDatasetId'] ? String(run['defaultDatasetId']) : null
      }
    } catch (err) {
      logger.error('Failed to get Apify run status', {
        runId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Fetches items from an actor run's default dataset.
   *
   * @param datasetId - Apify dataset ID.
   * @param limit - Maximum number of items to fetch (default: 100).
   * @returns Array of dataset items.
   */
  async getDatasetItems(datasetId: string, limit = 100): Promise<DatasetItem[]> {
    try {
      this.ensureToken()

      const response = await this.fetchWithTimeout(
        `${APIFY_API_BASE}/datasets/${datasetId}/items?limit=${limit}`,
        { headers: { Authorization: `Bearer ${this.token}` } }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch dataset: ${response.status}`)
      }

      const items = (await response.json()) as DatasetItem[]
      logger.info('Dataset items fetched', { datasetId, count: items.length })
      return items
    } catch (err) {
      logger.error('Failed to fetch dataset items', {
        datasetId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  private ensureToken(): void {
    if (!this.token) {
      throw new Error('Apify API token not set — call validateToken() first')
    }
  }

  private async fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      return await fetch(url, { ...init, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
  }
}
