/**
 * Apify service type definitions.
 *
 * Describes actor metadata, run lifecycle, dataset results, and
 * capability-based caching for the Apify integration layer.
 */

/** Status of an Apify actor run. */
export type ActorRunStatus =
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMED-OUT'
  | 'ABORTED'

/** Capability tags for categorizing actors by what they can extract. */
export type ActorCapability =
  | 'scrape-html'
  | 'scrape-spa'
  | 'scrape-api'
  | 'structured-data'
  | 'screenshot'
  | 'pdf'
  | 'social-media'
  | 'e-commerce'

/** An Apify actor descriptor. */
export interface ApifyActor {
  /** Unique actor ID (e.g., "apify/web-scraper"). */
  id: string
  /** Human-readable actor name. */
  name: string
  /** Actor description. */
  description: string
  /** Semantic version of the actor build. */
  version: string
  /** Capability tags describing what this actor can do. */
  capabilities: ActorCapability[]
  /** Whether this actor is on the user's allowlist. */
  allowed: boolean
}

/** Input configuration for an actor run. */
export interface ActorInput {
  /** Target URL(s) for the actor. */
  startUrls?: { url: string }[]
  /** Additional actor-specific input fields. */
  [key: string]: unknown
}

/** Status and metadata of a running or completed actor execution. */
export interface ActorRunInfo {
  /** Unique run identifier. */
  runId: string
  /** Actor ID that was executed. */
  actorId: string
  /** Current run status. */
  status: ActorRunStatus
  /** ISO timestamp of when the run started. */
  startedAt: string
  /** ISO timestamp of when the run finished, or `null` if still running. */
  finishedAt: string | null
  /** Number of dataset items produced so far. */
  datasetItemCount: number
  /** Default dataset ID for fetching results. */
  defaultDatasetId: string | null
}

/** A single item from an actor's output dataset. */
export interface DatasetItem {
  [key: string]: unknown
}

/** Cache entry for actor metadata with TTL. */
export interface ActorCacheEntry {
  actor: ApifyActor
  cachedAt: number
}
