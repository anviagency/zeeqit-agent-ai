import { LogRing } from '../diagnostics/log-ring'
import { ActorRunner, type ActorExecutionResult } from './actor-runner'
import type { DatasetItem } from './types'

const logger = LogRing.getInstance()

/** Strategy used for the extraction. */
export type FallbackStrategy = 'apify' | 'browser' | 'none'

/** Result of a fallback-aware extraction attempt. */
export interface FallbackResult {
  strategy: FallbackStrategy
  items: DatasetItem[]
  durationMs: number
  apifyAttempted: boolean
  browserAttempted: boolean
  error?: string
}

/**
 * Browser extraction function signature.
 * Implementations should accept a URL, perform CDP-based extraction,
 * and return an array of data items.
 */
export type BrowserExtractFn = (url: string, goal: string) => Promise<DatasetItem[]>

/**
 * Structured Apify -> Browser fallback module.
 *
 * Attempts extraction via Apify actors first. If no suitable actor exists
 * or the Apify run fails, falls back to direct browser-based extraction.
 */
export class ApifyFallback {
  private static instance: ApifyFallback | null = null
  private browserExtractFn: BrowserExtractFn | null = null

  private constructor() {}

  /** Returns the singleton ApifyFallback instance. */
  static getInstance(): ApifyFallback {
    if (!ApifyFallback.instance) {
      ApifyFallback.instance = new ApifyFallback()
    }
    return ApifyFallback.instance
  }

  /**
   * Registers the browser-based extraction function used as a fallback.
   *
   * @param fn - Function that performs browser-based data extraction.
   */
  registerBrowserExtractor(fn: BrowserExtractFn): void {
    this.browserExtractFn = fn
    logger.debug('Browser extraction function registered for fallback')
  }

  /**
   * Executes extraction with automatic Apify -> browser fallback.
   *
   * 1. Attempts to run the specified Apify actor
   * 2. If Apify fails or returns no results, falls back to browser extraction
   * 3. If both fail, returns an error result
   *
   * @param actorId - Apify actor ID to try first.
   * @param url - Target URL for extraction.
   * @param goal - Extraction goal description.
   * @param input - Additional input for the Apify actor.
   * @returns Extraction result with strategy used and items found.
   */
  async extract(
    actorId: string,
    url: string,
    goal: string,
    input?: Record<string, unknown>
  ): Promise<FallbackResult> {
    const startTime = Date.now()

    try {
      logger.info('Starting fallback extraction', { actorId, url })

      const apifyResult = await this.tryApify(actorId, url, input ?? {})

      if (apifyResult && apifyResult.items.length > 0) {
        return {
          strategy: 'apify',
          items: apifyResult.items,
          durationMs: Date.now() - startTime,
          apifyAttempted: true,
          browserAttempted: false
        }
      }

      logger.info('Apify extraction returned no results, falling back to browser', { actorId, url })

      const browserItems = await this.tryBrowser(url, goal)

      if (browserItems && browserItems.length > 0) {
        return {
          strategy: 'browser',
          items: browserItems,
          durationMs: Date.now() - startTime,
          apifyAttempted: true,
          browserAttempted: true
        }
      }

      logger.warn('Both Apify and browser extraction returned no results', { url })

      return {
        strategy: 'none',
        items: [],
        durationMs: Date.now() - startTime,
        apifyAttempted: true,
        browserAttempted: true,
        error: 'Both Apify and browser extraction returned no results'
      }
    } catch (err) {
      logger.error('Fallback extraction failed', {
        actorId,
        url,
        error: err instanceof Error ? err.message : String(err)
      })

      return {
        strategy: 'none',
        items: [],
        durationMs: Date.now() - startTime,
        apifyAttempted: true,
        browserAttempted: true,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  }

  /**
   * Tries extraction via Apify actor. Returns `null` on failure (non-throwing).
   */
  private async tryApify(
    actorId: string,
    url: string,
    input: Record<string, unknown>
  ): Promise<ActorExecutionResult | null> {
    try {
      const runner = ActorRunner.getInstance()
      const fullInput = {
        startUrls: [{ url }],
        ...input
      }

      return await runner.run(actorId, fullInput)
    } catch (err) {
      logger.warn('Apify extraction attempt failed', {
        actorId,
        url,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Tries extraction via browser. Returns `null` if no browser extractor is registered.
   */
  private async tryBrowser(url: string, goal: string): Promise<DatasetItem[] | null> {
    if (!this.browserExtractFn) {
      logger.warn('No browser extraction function registered, skipping browser fallback')
      return null
    }

    try {
      return await this.browserExtractFn(url, goal)
    } catch (err) {
      logger.warn('Browser extraction attempt failed', {
        url,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }
}
