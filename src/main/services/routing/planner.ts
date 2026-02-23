import { LogRing } from '../diagnostics/log-ring'
import { ActorCache } from '../apify/actor-cache'

const logger = LogRing.getInstance()

/** Extraction strategy determined by the planner. */
export type ExtractionStrategy = 'apify' | 'browser' | 'hybrid'

/** Task plan produced by the planner for the routing engine. */
export interface TaskPlan {
  /** Recommended extraction strategy. */
  strategy: ExtractionStrategy
  /** Apify actor ID to use (null if strategy is 'browser'). */
  apifyActorId: string | null
  /** Actor input overrides. */
  actorInput: Record<string, unknown>
  /** Estimated cost tier for the plan. */
  costTier: 'free' | 'cheap' | 'standard'
  /** Confidence score (0-1) in the plan's effectiveness. */
  confidence: number
  /** Human-readable reasoning for the plan. */
  reasoning: string
}

/**
 * URL pattern matchers for common sites with known Apify actors.
 * Used for fast, cheap planning without LLM calls.
 */
const SITE_PATTERNS: Array<{
  pattern: RegExp
  actorId: string
  strategy: ExtractionStrategy
}> = [
  { pattern: /amazon\.\w+/i, actorId: 'apify/amazon-scraper', strategy: 'apify' },
  { pattern: /google\.com\/maps/i, actorId: 'apify/google-maps-scraper', strategy: 'apify' },
  { pattern: /twitter\.com|x\.com/i, actorId: 'apify/twitter-scraper', strategy: 'apify' },
  { pattern: /instagram\.com/i, actorId: 'apify/instagram-scraper', strategy: 'apify' },
  { pattern: /linkedin\.com/i, actorId: 'apify/linkedin-scraper', strategy: 'apify' },
  { pattern: /youtube\.com/i, actorId: 'apify/youtube-scraper', strategy: 'apify' },
  { pattern: /tripadvisor\.\w+/i, actorId: 'apify/tripadvisor-scraper', strategy: 'apify' }
]

/**
 * Fast/cheap task planner that determines the best extraction strategy.
 *
 * Uses URL pattern matching and actor capability lookup to create an execution
 * plan without requiring LLM calls. Falls back to browser-based extraction
 * when no suitable actor is found.
 */
export class TaskPlanner {
  private static instance: TaskPlanner | null = null

  private constructor() {}

  /** Returns the singleton TaskPlanner instance. */
  static getInstance(): TaskPlanner {
    if (!TaskPlanner.instance) {
      TaskPlanner.instance = new TaskPlanner()
    }
    return TaskPlanner.instance
  }

  /**
   * Creates an extraction plan for a given URL and goal.
   *
   * @param url - Target URL to extract data from.
   * @param goal - Description of what data to extract.
   * @param mode - Extraction mode preference ('auto', 'apify', 'browser').
   * @returns Task plan with strategy, actor selection, and confidence score.
   */
  async plan(url: string, goal: string, mode: 'auto' | 'apify' | 'browser'): Promise<TaskPlan> {
    try {
      logger.info('Planning extraction task', { url, goal, mode })

      if (mode === 'browser') {
        return this.buildBrowserPlan('User requested browser-only mode')
      }

      if (mode === 'apify') {
        const apifyPlan = await this.planApify(url, goal)
        if (apifyPlan) return apifyPlan
        throw new Error('Apify mode requested but no suitable actor found')
      }

      const patternMatch = this.matchSitePattern(url)
      if (patternMatch) {
        const isAllowed = await ActorCache.getInstance().isAllowed(patternMatch.actorId)
        if (isAllowed) {
          logger.info('Site pattern matched to known actor', {
            actorId: patternMatch.actorId
          })
          return {
            strategy: patternMatch.strategy,
            apifyActorId: patternMatch.actorId,
            actorInput: this.buildActorInput(url, goal),
            costTier: 'cheap',
            confidence: 0.85,
            reasoning: `Matched known site pattern for ${patternMatch.actorId}`
          }
        }
      }

      const apifyPlan = await this.planApify(url, goal)
      if (apifyPlan) return apifyPlan

      return this.buildBrowserPlan('No suitable Apify actor found, using browser extraction')
    } catch (err) {
      logger.error('Task planning failed', {
        url,
        error: err instanceof Error ? err.message : String(err)
      })
      return this.buildBrowserPlan(
        `Planning error: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  private async planApify(url: string, goal: string): Promise<TaskPlan | null> {
    try {
      const cache = ActorCache.getInstance()
      const scrapers = await cache.findByCapability('scrape-html')
      const spaScrapers = await cache.findByCapability('scrape-spa')
      const allScrapers = [...scrapers, ...spaScrapers]

      if (allScrapers.length === 0) return null

      const bestActor = allScrapers[0]

      return {
        strategy: 'apify',
        apifyActorId: bestActor.id,
        actorInput: this.buildActorInput(url, goal),
        costTier: 'standard',
        confidence: 0.7,
        reasoning: `Selected Apify actor "${bestActor.name}" based on capability match`
      }
    } catch (err) {
      logger.debug('Apify planning failed, will fall back', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  private matchSitePattern(url: string): (typeof SITE_PATTERNS)[number] | null {
    for (const pattern of SITE_PATTERNS) {
      if (pattern.pattern.test(url)) {
        return pattern
      }
    }
    return null
  }

  private buildBrowserPlan(reasoning: string): TaskPlan {
    return {
      strategy: 'browser',
      apifyActorId: null,
      actorInput: {},
      costTier: 'free',
      confidence: 0.6,
      reasoning
    }
  }

  private buildActorInput(url: string, goal: string): Record<string, unknown> {
    return {
      startUrls: [{ url }],
      extractionGoal: goal,
      maxItems: 100
    }
  }
}
