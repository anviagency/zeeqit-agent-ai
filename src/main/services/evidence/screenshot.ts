import { join } from 'path'
import { createHash } from 'crypto'
import { LogRing } from '../diagnostics/log-ring'
import { getEvidencePath } from '../platform/app-paths'
import { atomicWriteFile } from '../platform/atomic-fs'
import type { ScreenshotMeta } from './types'

const logger = LogRing.getInstance()

/** Options for capturing a CDP screenshot. */
export interface ScreenshotOptions {
  /** CDP WebSocket URL of the browser to capture. */
  cdpUrl: string
  /** Evidence chain ID for organizing screenshots. */
  chainId: string
  /** Image format. Defaults to 'png'. */
  format?: 'png' | 'jpeg'
  /** JPEG quality (1-100). Only used when format is 'jpeg'. */
  quality?: number
  /** Whether to capture the full scrollable page. Defaults to `false` (viewport only). */
  fullPage?: boolean
}

/**
 * Captures screenshots via Chrome DevTools Protocol for evidence records.
 *
 * Connects to a running browser instance via CDP WebSocket and takes
 * viewport or full-page screenshots, storing them in the evidence directory.
 */
export class ScreenshotCapture {
  private static instance: ScreenshotCapture | null = null

  private constructor() {}

  /** Returns the singleton ScreenshotCapture instance. */
  static getInstance(): ScreenshotCapture {
    if (!ScreenshotCapture.instance) {
      ScreenshotCapture.instance = new ScreenshotCapture()
    }
    return ScreenshotCapture.instance
  }

  /**
   * Captures a screenshot via CDP and saves it to the evidence directory.
   *
   * @param options - Screenshot capture options including CDP URL and format.
   * @returns Screenshot metadata with hash, path, and dimensions.
   *
   * @remarks
   * Connects to the browser via CDP WebSocket (`Page.captureScreenshot`).
   * The actual CDP connection requires a WebSocket client (e.g., `ws` package)
   * to send/receive CDP protocol messages.
   *
   * @example
   * ```ts
   * const meta = await ScreenshotCapture.getInstance().capture({
   *   cdpUrl: 'ws://127.0.0.1:9222/devtools/page/ABC',
   *   chainId: 'run-123'
   * })
   * ```
   */
  async capture(options: ScreenshotOptions): Promise<ScreenshotMeta> {
    try {
      const { cdpUrl, chainId, format = 'png', quality, fullPage = false } = options
      logger.info('Capturing screenshot via CDP', { cdpUrl: cdpUrl.slice(0, 50), chainId })

      const imageData = await this.captureViaCdp(cdpUrl, format, quality, fullPage)
      const imageBuffer = Buffer.from(imageData, 'base64')

      const hash = createHash('sha256').update(imageBuffer).digest('hex')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `screenshot-${timestamp}.${format}`
      const screenshotDir = join(getEvidencePath(), 'screenshots', chainId)
      const screenshotPath = join(screenshotDir, filename)

      await atomicWriteFile(screenshotPath, imageBuffer)

      const dimensions = this.estimateDimensions(imageBuffer, format)

      const meta: ScreenshotMeta = {
        hash,
        path: `screenshots/${chainId}/${filename}`,
        width: dimensions.width,
        height: dimensions.height,
        capturedAt: new Date().toISOString(),
        format
      }

      logger.info('Screenshot captured', {
        chainId,
        hash: hash.slice(0, 16),
        size: imageBuffer.length
      })

      return meta
    } catch (err) {
      logger.error('Screenshot capture failed', {
        chainId: options.chainId,
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Captures a screenshot using CDP protocol via WebSocket.
   *
   * @remarks
   * Production implementation sends `Page.captureScreenshot` CDP command.
   * Requires an active CDP WebSocket connection to the target page.
   */
  private async captureViaCdp(
    cdpUrl: string,
    format: string,
    quality?: number,
    fullPage?: boolean
  ): Promise<string> {
    try {
      const WebSocket = (await import('ws')).default

      return new Promise<string>((resolve, reject) => {
        const ws = new WebSocket(cdpUrl)
        const timeout = setTimeout(() => {
          ws.close()
          reject(new Error('CDP screenshot timed out after 15 seconds'))
        }, 15_000)

        ws.on('open', () => {
          const params: Record<string, unknown> = { format }
          if (format === 'jpeg' && quality) params['quality'] = quality
          if (fullPage) params['captureBeyondViewport'] = true

          ws.send(JSON.stringify({
            id: 1,
            method: 'Page.captureScreenshot',
            params
          }))
        })

        ws.on('message', (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString())
            if (response.id === 1) {
              clearTimeout(timeout)
              ws.close()

              if (response.error) {
                reject(new Error(`CDP error: ${response.error.message}`))
              } else {
                resolve(response.result.data)
              }
            }
          } catch (parseErr) {
            clearTimeout(timeout)
            ws.close()
            reject(parseErr)
          }
        })

        ws.on('error', (err: Error) => {
          clearTimeout(timeout)
          reject(new Error(`CDP WebSocket error: ${err.message}`))
        })
      })
    } catch (err) {
      throw new Error(
        `CDP screenshot failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Extracts image dimensions from PNG/JPEG headers.
   * Falls back to 0x0 if parsing fails.
   */
  private estimateDimensions(
    buffer: Buffer,
    format: string
  ): { width: number; height: number } {
    try {
      if (format === 'png' && buffer.length >= 24) {
        const width = buffer.readUInt32BE(16)
        const height = buffer.readUInt32BE(20)
        return { width, height }
      }

      if (format === 'jpeg') {
        let offset = 2
        while (offset < buffer.length - 8) {
          if (buffer[offset] !== 0xff) break
          const marker = buffer[offset + 1]
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
            const height = buffer.readUInt16BE(offset + 5)
            const width = buffer.readUInt16BE(offset + 7)
            return { width, height }
          }
          const segmentLength = buffer.readUInt16BE(offset + 2)
          offset += 2 + segmentLength
        }
      }

      return { width: 0, height: 0 }
    } catch {
      return { width: 0, height: 0 }
    }
  }
}
