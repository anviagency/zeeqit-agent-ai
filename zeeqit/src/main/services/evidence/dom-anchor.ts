import { LogRing } from '../diagnostics/log-ring'
import type { DomAnchor, AnchorTier } from './types'

const logger = LogRing.getInstance()

const MAX_TEXT_LENGTH = 500

/**
 * CDP evaluation parameters for extracting DOM anchor data from a page element.
 *
 * These JavaScript expressions are sent to the browser via `Runtime.evaluate`
 * to compute selectors, XPaths, and bounding boxes for a target element.
 */

/** Result of a CDP DOM query for anchor extraction. */
export interface CdpAnchorResult {
  cssSelector: string
  xpath: string
  textContent: string
  boundingBox: { x: number; y: number; width: number; height: number } | null
}

/**
 * Builds 3-tier DOM anchors for extracted elements.
 *
 * Provides CSS selector, XPath, and text-content anchors with redundancy
 * so that evidence records can reliably re-locate extracted data even after
 * page structure changes.
 */
export class DomAnchorBuilder {
  private static instance: DomAnchorBuilder | null = null

  private constructor() {}

  /** Returns the singleton DomAnchorBuilder instance. */
  static getInstance(): DomAnchorBuilder {
    if (!DomAnchorBuilder.instance) {
      DomAnchorBuilder.instance = new DomAnchorBuilder()
    }
    return DomAnchorBuilder.instance
  }

  /**
   * Builds a DomAnchor from a CDP anchor result.
   *
   * @param cdpResult - Raw anchor data from CDP evaluation.
   * @returns Structured DOM anchor with all three tiers.
   */
  buildFromCdpResult(cdpResult: CdpAnchorResult): DomAnchor {
    try {
      const primaryTier = this.determinePrimaryTier(cdpResult)

      const anchor: DomAnchor = {
        cssSelector: cdpResult.cssSelector,
        xpath: cdpResult.xpath,
        textContent: cdpResult.textContent.slice(0, MAX_TEXT_LENGTH),
        primaryTier,
        boundingBox: cdpResult.boundingBox ?? undefined
      }

      logger.debug('DOM anchor built', {
        primaryTier,
        hasSelector: !!cdpResult.cssSelector,
        hasXpath: !!cdpResult.xpath,
        textLength: cdpResult.textContent.length
      })

      return anchor
    } catch (err) {
      logger.error('Failed to build DOM anchor', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Builds a DomAnchor from raw component values.
   *
   * @param cssSelector - CSS selector for the element.
   * @param xpath - XPath expression for the element.
   * @param textContent - Text content of the element.
   * @param boundingBox - Optional bounding box coordinates.
   * @returns Structured DOM anchor.
   */
  build(
    cssSelector: string,
    xpath: string,
    textContent: string,
    boundingBox?: { x: number; y: number; width: number; height: number }
  ): DomAnchor {
    try {
      const cdpResult: CdpAnchorResult = {
        cssSelector,
        xpath,
        textContent,
        boundingBox: boundingBox ?? null
      }
      return this.buildFromCdpResult(cdpResult)
    } catch (err) {
      logger.error('Failed to build DOM anchor from components', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Generates the CDP JavaScript expression for extracting anchor data from an element.
   *
   * @param cssSelector - CSS selector to locate the target element.
   * @returns JavaScript code string to evaluate via `Runtime.evaluate`.
   *
   * @example
   * ```ts
   * const js = DomAnchorBuilder.getInstance().getCdpExtractionScript('div.price')
   * // Send to browser: Runtime.evaluate({ expression: js })
   * ```
   */
  getCdpExtractionScript(cssSelector: string): string {
    return `
      (() => {
        const el = document.querySelector(${JSON.stringify(cssSelector)});
        if (!el) return null;

        function getCssPath(element) {
          const parts = [];
          let current = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
              selector = '#' + current.id;
              parts.unshift(selector);
              break;
            }
            const parent = current.parentElement;
            if (parent) {
              const siblings = Array.from(parent.children).filter(
                c => c.tagName === current.tagName
              );
              if (siblings.length > 1) {
                const index = siblings.indexOf(current) + 1;
                selector += ':nth-child(' + index + ')';
              }
            }
            parts.unshift(selector);
            current = parent;
          }
          return parts.join(' > ');
        }

        function getXPath(element) {
          const parts = [];
          let current = element;
          while (current && current.nodeType === Node.ELEMENT_NODE) {
            let index = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) index++;
              sibling = sibling.previousElementSibling;
            }
            parts.unshift(current.tagName.toLowerCase() + '[' + index + ']');
            current = current.parentElement;
          }
          return '/' + parts.join('/');
        }

        const rect = el.getBoundingClientRect();
        return {
          cssSelector: getCssPath(el),
          xpath: getXPath(el),
          textContent: (el.textContent || '').trim().slice(0, 500),
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          }
        };
      })()
    `.trim()
  }

  /**
   * Determines the most reliable anchor tier based on available data.
   *
   * Priority: CSS selector (most specific) > XPath > text content (least specific).
   */
  private determinePrimaryTier(result: CdpAnchorResult): AnchorTier {
    if (result.cssSelector && result.cssSelector.includes('#')) {
      return 'css'
    }

    if (result.cssSelector && result.cssSelector.length > 0) {
      return 'css'
    }

    if (result.xpath && result.xpath.length > 0) {
      return 'xpath'
    }

    return 'text-content'
  }
}
