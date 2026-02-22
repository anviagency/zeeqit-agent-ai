import { LogRing } from '../diagnostics/log-ring'
import type { ExtractionResult } from './extractor'

const logger = LogRing.getInstance()

/** Individual validation check result. */
export interface ValidationCheck {
  name: string
  passed: boolean
  message: string
}

/** Result of extraction result validation. */
export interface ValidationResult {
  /** Overall validity of the extraction result. */
  valid: boolean
  /** Individual check results. */
  checks: ValidationCheck[]
  /** Confidence score (0-1) in the result quality. */
  confidence: number
  /** Human-readable summary. */
  summary: string
}

/**
 * Validates extraction results for completeness, consistency, and quality.
 *
 * Runs a series of checks on the extracted data to determine whether the
 * extraction was successful and the data meets quality thresholds.
 */
export class ResultValidator {
  private static instance: ResultValidator | null = null

  private constructor() {}

  /** Returns the singleton ResultValidator instance. */
  static getInstance(): ResultValidator {
    if (!ResultValidator.instance) {
      ResultValidator.instance = new ResultValidator()
    }
    return ResultValidator.instance
  }

  /**
   * Validates an extraction result against the extraction goal.
   *
   * @param result - Extraction result to validate.
   * @param goal - Original extraction goal for relevance checking.
   * @returns Validation result with individual checks and overall verdict.
   */
  async validate(result: ExtractionResult, goal: string): Promise<ValidationResult> {
    try {
      logger.info('Validating extraction result', {
        itemCount: result.itemCount,
        engine: result.engineUsed
      })

      const checks: ValidationCheck[] = []

      checks.push(this.checkNotEmpty(result))
      checks.push(this.checkExtractionSuccess(result))
      checks.push(this.checkItemStructure(result))
      checks.push(this.checkDataFreshness(result))
      checks.push(this.checkGoalRelevance(result, goal))

      const passedCount = checks.filter((c) => c.passed).length
      const confidence = checks.length > 0 ? passedCount / checks.length : 0
      const valid = confidence >= 0.6

      const summary = valid
        ? `Validation passed: ${passedCount}/${checks.length} checks passed (confidence: ${(confidence * 100).toFixed(0)}%)`
        : `Validation failed: only ${passedCount}/${checks.length} checks passed (confidence: ${(confidence * 100).toFixed(0)}%)`

      logger.info('Validation complete', { valid, confidence, passedCount, totalChecks: checks.length })

      return { valid, checks, confidence, summary }
    } catch (err) {
      logger.error('Validation failed with error', {
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        valid: false,
        checks: [],
        confidence: 0,
        summary: `Validation error: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }

  private checkNotEmpty(result: ExtractionResult): ValidationCheck {
    return {
      name: 'non-empty-result',
      passed: result.items.length > 0,
      message: result.items.length > 0
        ? `Extraction returned ${result.items.length} items`
        : 'Extraction returned no items'
    }
  }

  private checkExtractionSuccess(result: ExtractionResult): ValidationCheck {
    return {
      name: 'extraction-success',
      passed: result.success,
      message: result.success
        ? 'Extraction completed successfully'
        : `Extraction failed: ${result.error ?? 'unknown error'}`
    }
  }

  private checkItemStructure(result: ExtractionResult): ValidationCheck {
    if (result.items.length === 0) {
      return { name: 'item-structure', passed: false, message: 'No items to validate structure' }
    }

    const firstItem = result.items[0]
    const keys = Object.keys(firstItem)
    const hasContent = keys.length > 0

    const allHaveKeys = result.items.every((item) => {
      const itemKeys = Object.keys(item)
      return itemKeys.length > 0
    })

    return {
      name: 'item-structure',
      passed: hasContent && allHaveKeys,
      message: hasContent && allHaveKeys
        ? `Items have consistent structure (${keys.length} fields)`
        : 'Items have inconsistent or empty structure'
    }
  }

  private checkDataFreshness(result: ExtractionResult): ValidationCheck {
    const durationThreshold = 300_000
    return {
      name: 'data-freshness',
      passed: result.durationMs < durationThreshold,
      message: result.durationMs < durationThreshold
        ? `Data extracted in ${(result.durationMs / 1000).toFixed(1)}s`
        : `Extraction took too long: ${(result.durationMs / 1000).toFixed(1)}s (threshold: ${durationThreshold / 1000}s)`
    }
  }

  private checkGoalRelevance(result: ExtractionResult, goal: string): ValidationCheck {
    if (result.items.length === 0) {
      return { name: 'goal-relevance', passed: false, message: 'No items to check relevance' }
    }

    const goalTokens = goal.toLowerCase().split(/\s+/).filter((t) => t.length > 3)

    if (goalTokens.length === 0) {
      return { name: 'goal-relevance', passed: true, message: 'Goal too short for relevance check' }
    }

    const sampleItems = result.items.slice(0, 5)
    const itemText = JSON.stringify(sampleItems).toLowerCase()

    const matchCount = goalTokens.filter((token) => itemText.includes(token)).length
    const relevanceScore = goalTokens.length > 0 ? matchCount / goalTokens.length : 0
    const isRelevant = relevanceScore >= 0.3

    return {
      name: 'goal-relevance',
      passed: isRelevant,
      message: isRelevant
        ? `Data appears relevant to goal (${(relevanceScore * 100).toFixed(0)}% token match)`
        : `Data may not match goal (${(relevanceScore * 100).toFixed(0)}% token match)`
    }
  }
}
