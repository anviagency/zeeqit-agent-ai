/**
 * Evidence service type definitions.
 *
 * Defines the tamper-evidence chain data structures used to prove
 * data provenance, integrity, and extraction authenticity.
 */

/** DOM anchor tier indicating the specificity of an element locator. */
export type AnchorTier = 'css' | 'xpath' | 'text-content'

/**
 * A 3-tier DOM anchor for locating an extracted element.
 *
 * Multiple anchor tiers provide redundancy: if CSS selectors break due to
 * page restructuring, XPath or text-content anchors can still locate the data.
 */
export interface DomAnchor {
  /** CSS selector path to the element. */
  cssSelector: string
  /** Full XPath expression to the element. */
  xpath: string
  /** Text content of the element (trimmed, first 500 chars). */
  textContent: string
  /** Which tier was used as the primary match. */
  primaryTier: AnchorTier
  /** Bounding box of the element at capture time (optional). */
  boundingBox?: {
    x: number
    y: number
    width: number
    height: number
  }
}

/** Screenshot capture metadata. */
export interface ScreenshotMeta {
  /** SHA-256 hash of the screenshot image data. */
  hash: string
  /** Relative path to the screenshot file within the evidence directory. */
  path: string
  /** Width of the captured viewport in pixels. */
  width: number
  /** Height of the captured viewport in pixels. */
  height: number
  /** ISO timestamp of when the screenshot was taken. */
  capturedAt: string
  /** Format of the screenshot image. */
  format: 'png' | 'jpeg'
}

/**
 * A single evidence record linking extracted data to its source.
 *
 * Each record captures what was extracted, from where, how it was located in the DOM,
 * and a screenshot proving the data was visible on screen at extraction time.
 */
export interface EvidenceRecord {
  /** Unique identifier for this evidence record. */
  id: string
  /** ID of the workflow run that produced this evidence. */
  workflowRunId: string
  /** URL of the page the data was extracted from. */
  sourceUrl: string
  /** ISO timestamp of extraction. */
  extractedAt: string
  /** The raw extracted value. */
  extractedValue: unknown
  /** DOM anchor(s) for re-locating the extracted data. */
  anchors: DomAnchor[]
  /** Screenshot metadata proving the data was visible. */
  screenshot: ScreenshotMeta | null
  /** SHA-256 hash of this record's canonical JSON representation. */
  recordHash: string
  /** Hash of the previous record in the chain (or genesis hash). */
  previousHash: string
}

/**
 * A hash chain of evidence records providing tamper detection.
 *
 * Each record's hash includes the previous record's hash, forming an
 * append-only chain. Modifying any record invalidates all subsequent hashes.
 */
export interface EvidenceChainData {
  /** Unique chain identifier (matches the workflow run ID). */
  chainId: string
  /** ISO timestamp of chain creation. */
  createdAt: string
  /** Ordered list of evidence records. */
  records: EvidenceRecord[]
  /** SHA-256 hash of the genesis (first) record. */
  genesisHash: string
  /** SHA-256 hash of the most recent record. */
  headHash: string
  /** Total number of records in the chain. */
  length: number
}

/** Result of chain integrity verification. */
export interface ChainVerificationResult {
  chainId: string
  valid: boolean
  recordCount: number
  brokenAt?: number
  message: string
  verifiedAt: string
}
