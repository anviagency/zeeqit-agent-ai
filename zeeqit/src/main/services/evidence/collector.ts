import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { LogRing } from '../diagnostics/log-ring'
import type { EvidenceRecord, DomAnchor, ScreenshotMeta } from './types'

const logger = LogRing.getInstance()
const GENESIS_HASH = '0'.repeat(64)

/**
 * Builds individual evidence records for the evidence chain.
 *
 * Each record captures the extracted data, DOM anchors, screenshot metadata,
 * and links to the previous record via hash chaining.
 */
export class EvidenceCollector {
  private static instance: EvidenceCollector | null = null

  private constructor() {}

  /** Returns the singleton EvidenceCollector instance. */
  static getInstance(): EvidenceCollector {
    if (!EvidenceCollector.instance) {
      EvidenceCollector.instance = new EvidenceCollector()
    }
    return EvidenceCollector.instance
  }

  /**
   * Creates a new evidence record with hash linking.
   *
   * @param params - Record creation parameters.
   * @param params.workflowRunId - Workflow run that produced this evidence.
   * @param params.sourceUrl - URL the data was extracted from.
   * @param params.extractedValue - The raw extracted data.
   * @param params.anchors - DOM anchors for the extracted element(s).
   * @param params.screenshot - Optional screenshot metadata.
   * @param params.previousHash - Hash of the previous record in the chain.
   * @returns A fully-formed evidence record with computed hash.
   */
  createRecord(params: {
    workflowRunId: string
    sourceUrl: string
    extractedValue: unknown
    anchors: DomAnchor[]
    screenshot: ScreenshotMeta | null
    previousHash?: string
  }): EvidenceRecord {
    try {
      const id = randomUUID()
      const extractedAt = new Date().toISOString()
      const previousHash = params.previousHash ?? GENESIS_HASH

      const record: Omit<EvidenceRecord, 'recordHash'> = {
        id,
        workflowRunId: params.workflowRunId,
        sourceUrl: params.sourceUrl,
        extractedAt,
        extractedValue: params.extractedValue,
        anchors: params.anchors,
        screenshot: params.screenshot,
        previousHash
      }

      const recordHash = this.computeHash(record)

      const fullRecord: EvidenceRecord = {
        ...record,
        recordHash
      }

      logger.debug('Evidence record created', {
        id,
        workflowRunId: params.workflowRunId,
        hash: recordHash.slice(0, 16)
      })

      return fullRecord
    } catch (err) {
      logger.error('Failed to create evidence record', {
        workflowRunId: params.workflowRunId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Verifies that a record's hash matches its content.
   *
   * @param record - Evidence record to verify.
   * @returns `true` if the computed hash matches the stored hash.
   */
  verifyRecord(record: EvidenceRecord): boolean {
    try {
      const { recordHash, ...rest } = record
      const computedHash = this.computeHash(rest)
      return computedHash === recordHash
    } catch (err) {
      logger.error('Record verification failed', {
        recordId: record.id,
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  /**
   * Computes SHA-256 hash of a record's canonical JSON representation.
   *
   * @param data - Record data (excluding the recordHash field).
   * @returns Hex-encoded SHA-256 digest.
   */
  computeHash(data: Omit<EvidenceRecord, 'recordHash'>): string {
    const canonical = JSON.stringify(data, Object.keys(data).sort())
    return createHash('sha256').update(canonical).digest('hex')
  }
}
