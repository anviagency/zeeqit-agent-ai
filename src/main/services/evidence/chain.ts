import { join } from 'path'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import { LogRing } from '../diagnostics/log-ring'
import { getEvidencePath } from '../platform/app-paths'
import { atomicWriteFile, atomicReadFile } from '../platform/atomic-fs'
import { EvidenceCollector } from './collector'
import type {
  EvidenceChainData,
  EvidenceRecord,
  DomAnchor,
  ScreenshotMeta,
  ChainVerificationResult
} from './types'

const logger = LogRing.getInstance()
const GENESIS_HASH = '0'.repeat(64)

/**
 * Manages append-only hash chains of evidence records for tamper detection.
 *
 * Each chain corresponds to a workflow run. Records are appended with hash links,
 * and the chain can be verified at any time by recomputing all hashes.
 */
export class EvidenceChain {
  private static instance: EvidenceChain | null = null

  private constructor() {}

  /** Returns the singleton EvidenceChain instance. */
  static getInstance(): EvidenceChain {
    if (!EvidenceChain.instance) {
      EvidenceChain.instance = new EvidenceChain()
    }
    return EvidenceChain.instance
  }

  /**
   * Creates a new evidence chain for a workflow run.
   *
   * @param chainId - Unique chain identifier (typically the workflow run ID).
   * @returns The newly created (empty) chain.
   */
  async createChain(chainId: string): Promise<EvidenceChainData> {
    try {
      logger.info('Creating evidence chain', { chainId })

      const chain: EvidenceChainData = {
        chainId,
        createdAt: new Date().toISOString(),
        records: [],
        genesisHash: GENESIS_HASH,
        headHash: GENESIS_HASH,
        length: 0
      }

      await this.saveChain(chain)
      return chain
    } catch (err) {
      logger.error('Failed to create evidence chain', {
        chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Appends an evidence record to an existing chain.
   *
   * @param chainId - Chain to append to.
   * @param params - Record data (URL, value, anchors, screenshot).
   * @returns The appended evidence record.
   */
  async appendRecord(
    chainId: string,
    params: {
      sourceUrl: string
      extractedValue: unknown
      anchors: DomAnchor[]
      screenshot: ScreenshotMeta | null
    }
  ): Promise<EvidenceRecord> {
    try {
      const chain = await this.getChain(chainId)
      if (!chain) {
        throw new Error(`Evidence chain not found: ${chainId}`)
      }

      const collector = EvidenceCollector.getInstance()
      const record = collector.createRecord({
        workflowRunId: chainId,
        sourceUrl: params.sourceUrl,
        extractedValue: params.extractedValue,
        anchors: params.anchors,
        screenshot: params.screenshot,
        previousHash: chain.headHash
      })

      chain.records.push(record)
      chain.headHash = record.recordHash
      chain.length = chain.records.length

      if (chain.records.length === 1) {
        chain.genesisHash = record.recordHash
      }

      await this.saveChain(chain)

      logger.info('Evidence record appended', {
        chainId,
        recordId: record.id,
        chainLength: chain.length
      })

      return record
    } catch (err) {
      logger.error('Failed to append evidence record', {
        chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Loads an evidence chain from disk.
   *
   * @param chainId - Chain identifier.
   * @returns The chain data, or `null` if not found.
   */
  async getChain(chainId: string): Promise<EvidenceChainData | null> {
    try {
      const chainPath = this.getChainPath(chainId)

      if (!existsSync(chainPath)) {
        return null
      }

      const raw = await atomicReadFile(chainPath)
      return JSON.parse(raw) as EvidenceChainData
    } catch (err) {
      logger.error('Failed to load evidence chain', {
        chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Verifies the integrity of an entire evidence chain by recomputing all hashes.
   *
   * @param chainId - Chain to verify.
   * @returns Verification result indicating validity and any broken links.
   */
  async verify(chainId: string): Promise<ChainVerificationResult> {
    try {
      const chain = await this.getChain(chainId)

      if (!chain) {
        return {
          chainId,
          valid: false,
          recordCount: 0,
          message: 'Chain not found',
          verifiedAt: new Date().toISOString()
        }
      }

      const collector = EvidenceCollector.getInstance()
      let previousHash = GENESIS_HASH

      for (let i = 0; i < chain.records.length; i++) {
        const record = chain.records[i]

        if (record.previousHash !== previousHash) {
          return {
            chainId,
            valid: false,
            recordCount: chain.records.length,
            brokenAt: i,
            message: `Chain broken at record ${i}: previousHash mismatch`,
            verifiedAt: new Date().toISOString()
          }
        }

        if (!collector.verifyRecord(record)) {
          return {
            chainId,
            valid: false,
            recordCount: chain.records.length,
            brokenAt: i,
            message: `Chain broken at record ${i}: record hash mismatch`,
            verifiedAt: new Date().toISOString()
          }
        }

        previousHash = record.recordHash
      }

      logger.info('Evidence chain verified', { chainId, recordCount: chain.records.length })

      return {
        chainId,
        valid: true,
        recordCount: chain.records.length,
        message: 'Chain integrity verified',
        verifiedAt: new Date().toISOString()
      }
    } catch (err) {
      logger.error('Chain verification failed', {
        chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        chainId,
        valid: false,
        recordCount: 0,
        message: `Verification error: ${err instanceof Error ? err.message : String(err)}`,
        verifiedAt: new Date().toISOString()
      }
    }
  }

  /**
   * Exports a chain to a standalone JSON file for external verification.
   *
   * @param chainId - Chain to export.
   * @returns Absolute path to the exported file.
   */
  async exportChain(chainId: string): Promise<string> {
    try {
      const chain = await this.getChain(chainId)
      if (!chain) {
        throw new Error(`Evidence chain not found: ${chainId}`)
      }

      const exportDir = join(getEvidencePath(), 'exports')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const exportPath = join(exportDir, `chain-${chainId}-${timestamp}.json`)

      await atomicWriteFile(exportPath, JSON.stringify(chain, null, 2))

      logger.info('Evidence chain exported', { chainId, path: exportPath })
      return exportPath
    } catch (err) {
      logger.error('Failed to export evidence chain', {
        chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Lists all available evidence chain IDs.
   *
   * @returns Array of chain identifiers.
   */
  async listChains(): Promise<string[]> {
    try {
      const evidenceDir = getEvidencePath()

      if (!existsSync(evidenceDir)) return []

      const files = await readdir(evidenceDir)
      return files
        .filter((f) => f.startsWith('chain-') && f.endsWith('.json'))
        .map((f) => f.slice('chain-'.length, -'.json'.length))
    } catch (err) {
      logger.error('Failed to list evidence chains', {
        error: err instanceof Error ? err.message : String(err)
      })
      return []
    }
  }

  private getChainPath(chainId: string): string {
    return join(getEvidencePath(), `chain-${chainId}.json`)
  }

  private async saveChain(chain: EvidenceChainData): Promise<void> {
    const chainPath = this.getChainPath(chain.chainId)
    await atomicWriteFile(chainPath, JSON.stringify(chain, null, 2))
  }
}
