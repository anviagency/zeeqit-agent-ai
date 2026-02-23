import { LogRing } from '../diagnostics/log-ring'
import { EvidenceChain } from '../evidence/chain'
import { DomAnchorBuilder } from '../evidence/dom-anchor'
import type { ExtractionResult } from './extractor'
import type { DomAnchor } from '../evidence/types'

const logger = LogRing.getInstance()

/**
 * Builds evidence records for extraction results, linking them into the
 * tamper-evidence chain for the associated workflow run.
 *
 * Invoked by the routing engine after successful extraction and validation.
 */
export class EvidenceProver {
  private static instance: EvidenceProver | null = null

  private constructor() {}

  /** Returns the singleton EvidenceProver instance. */
  static getInstance(): EvidenceProver {
    if (!EvidenceProver.instance) {
      EvidenceProver.instance = new EvidenceProver()
    }
    return EvidenceProver.instance
  }

  /**
   * Creates evidence records for an extraction result and appends them to the chain.
   *
   * @param workflowRunId - Workflow run ID (used as the chain ID).
   * @param sourceUrl - URL the data was extracted from.
   * @param extraction - Extraction result with items to prove.
   * @returns The evidence chain ID.
   */
  async proveExtraction(
    workflowRunId: string,
    sourceUrl: string,
    extraction: ExtractionResult
  ): Promise<string> {
    try {
      logger.info('Building evidence for extraction', {
        workflowRunId,
        itemCount: extraction.itemCount
      })

      const chain = EvidenceChain.getInstance()
      let chainData = await chain.getChain(workflowRunId)

      if (!chainData) {
        chainData = await chain.createChain(workflowRunId)
      }

      const anchorBuilder = DomAnchorBuilder.getInstance()

      for (const item of extraction.items) {
        const anchors = this.buildAnchorsFromItem(item, anchorBuilder)

        await chain.appendRecord(workflowRunId, {
          sourceUrl,
          extractedValue: item,
          anchors,
          screenshot: null
        })
      }

      logger.info('Evidence records created', {
        workflowRunId,
        recordsAdded: extraction.items.length
      })

      return workflowRunId
    } catch (err) {
      logger.error('Failed to build evidence for extraction', {
        workflowRunId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Verifies the evidence chain for a given workflow run.
   *
   * @param workflowRunId - Workflow run ID (chain ID) to verify.
   * @returns `true` if the chain is intact and valid.
   */
  async verifyEvidence(workflowRunId: string): Promise<boolean> {
    try {
      const result = await EvidenceChain.getInstance().verify(workflowRunId)
      return result.valid
    } catch (err) {
      logger.error('Evidence verification failed', {
        workflowRunId,
        error: err instanceof Error ? err.message : String(err)
      })
      return false
    }
  }

  private buildAnchorsFromItem(
    item: Record<string, unknown>,
    anchorBuilder: DomAnchorBuilder
  ): DomAnchor[] {
    try {
      const anchors: DomAnchor[] = []

      const textContent = JSON.stringify(item).slice(0, 500)

      const anchor = anchorBuilder.build(
        '',
        '',
        textContent
      )

      anchors.push(anchor)
      return anchors
    } catch {
      return []
    }
  }
}
