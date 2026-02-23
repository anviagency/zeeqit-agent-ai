/**
 * WebSocket client for the OpenClaw gateway.
 *
 * Maintains a persistent connection to the local gateway daemon at
 * ws://127.0.0.1:18789 with automatic reconnection (exponential backoff),
 * heartbeat monitoring (ping/pong), token-bucket rate limiting, and a
 * bounded event queue. Connection state changes are emitted to the
 * renderer via IPC.
 */

import WebSocket from 'ws'
import { BrowserWindow } from 'electron'
import { IpcChannels } from '@shared/ipc-channels'
import type { GatewayStateEvent } from '@shared/ipc-channels'
import { LogRing } from '../diagnostics/log-ring'

const GATEWAY_URL = 'ws://127.0.0.1:18789'

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

const HEARTBEAT_INTERVAL_MS = 30_000
const HEARTBEAT_TIMEOUT_MS = 10_000

const RATE_LIMIT_TOKENS = 3
const RATE_LIMIT_WINDOW_MS = 60_000

const EVENT_QUEUE_MAX = 1_000

export type GatewayConnectionState = 'connected' | 'disconnected' | 'reconnecting'

interface QueuedMessage {
  data: string
  enqueuedAt: number
}

/**
 * Singleton WebSocket client that connects to the OpenClaw gateway daemon.
 *
 * @example
 * ```ts
 * const client = GatewayWebSocketClient.getInstance()
 * await client.connect()
 * client.send(JSON.stringify({ method: 'config.get', id: 1 }))
 * ```
 */
export class GatewayWebSocketClient {
  private static instance: GatewayWebSocketClient | null = null
  private readonly logger = LogRing.getInstance()

  private ws: WebSocket | null = null
  private state: GatewayConnectionState = 'disconnected'
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null
  private lastHeartbeat: string | null = null
  private intentionalClose = false

  private readonly eventQueue: QueuedMessage[] = []
  private tokenBucket = RATE_LIMIT_TOKENS
  private lastTokenRefill = Date.now()

  /** Registered listeners for incoming messages. */
  private readonly messageListeners = new Set<(data: string) => void>()

  private constructor() {}

  /**
   * Returns the singleton GatewayWebSocketClient instance.
   */
  static getInstance(): GatewayWebSocketClient {
    if (!GatewayWebSocketClient.instance) {
      GatewayWebSocketClient.instance = new GatewayWebSocketClient()
    }
    return GatewayWebSocketClient.instance
  }

  /**
   * Opens a WebSocket connection to the gateway daemon.
   * Resolves when the connection is established, rejects on failure.
   *
   * @throws If the connection cannot be established.
   */
  async connect(): Promise<void> {
    if (this.ws && this.state === 'connected') {
      this.logger.debug('WebSocket already connected')
      return
    }

    this.intentionalClose = false

    return new Promise<void>((resolve, reject) => {
      try {
        this.ws = new WebSocket(GATEWAY_URL, {
          handshakeTimeout: 5_000
        })

        this.ws.on('open', () => {
          this.reconnectAttempt = 0
          this.setState('connected')
          this.startHeartbeat()
          this.drainQueue()
          this.logger.info('WebSocket connected to gateway')
          resolve()
        })

        this.ws.on('message', (raw: WebSocket.RawData) => {
          const data = raw.toString()
          for (const listener of this.messageListeners) {
            try {
              listener(data)
            } catch (err) {
              this.logger.error('Message listener threw', {
                error: err instanceof Error ? err.message : String(err)
              })
            }
          }
        })

        this.ws.on('pong', () => {
          this.lastHeartbeat = new Date().toISOString()
          this.clearHeartbeatTimeout()
        })

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.logger.info('WebSocket closed', {
            code,
            reason: reason.toString()
          })
          this.cleanup()

          if (!this.intentionalClose) {
            this.scheduleReconnect()
          } else {
            this.setState('disconnected')
          }
        })

        this.ws.on('error', (err: Error) => {
          this.logger.error('WebSocket error', { error: err.message })
          if (this.state === 'disconnected') {
            reject(new Error(`WebSocket connection failed: ${err.message}`))
          }
        })
      } catch (err) {
        reject(
          new Error(
            `Failed to create WebSocket: ${err instanceof Error ? err.message : String(err)}`
          )
        )
      }
    })
  }

  /**
   * Gracefully closes the WebSocket connection after draining the send queue.
   */
  disconnect(): void {
    try {
      this.intentionalClose = true
      this.clearReconnectTimer()
      this.cleanup()

      if (this.ws) {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Client disconnect')
        }
        this.ws = null
      }

      this.setState('disconnected')
      this.logger.info('WebSocket disconnected')
    } catch (err) {
      this.logger.error('Error during disconnect', {
        error: err instanceof Error ? err.message : String(err)
      })
    }
  }

  /**
   * Sends a message through the WebSocket with token-bucket rate limiting.
   * If not connected, the message is queued (up to {@link EVENT_QUEUE_MAX}).
   *
   * @param data - String payload to send.
   * @throws If rate limit is exceeded.
   */
  send(data: string): void {
    try {
      this.refillTokens()

      if (this.tokenBucket <= 0) {
        throw new Error('Rate limit exceeded: maximum 3 messages per 60 seconds')
      }

      this.tokenBucket -= 1

      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(data)
        return
      }

      this.enqueue(data)
    } catch (err) {
      this.logger.error('Failed to send message', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Returns the current connection state.
   */
  getState(): GatewayConnectionState {
    return this.state
  }

  /**
   * Returns the ISO timestamp of the last successful heartbeat pong.
   */
  getLastHeartbeat(): string | null {
    return this.lastHeartbeat
  }

  /**
   * Registers a listener that will be called with each incoming message.
   *
   * @param listener - Callback receiving the raw message string.
   * @returns A dispose function to remove the listener.
   */
  onMessage(listener: (data: string) => void): () => void {
    this.messageListeners.add(listener)
    return () => {
      this.messageListeners.delete(listener)
    }
  }

  private setState(newState: GatewayConnectionState): void {
    if (this.state === newState) return

    this.state = newState
    this.logger.debug(`Gateway state: ${newState}`)

    const event: GatewayStateEvent = {
      state: newState,
      attempt: this.reconnectAttempt > 0 ? this.reconnectAttempt : undefined,
      lastHeartbeat: this.lastHeartbeat ?? undefined
    }

    try {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IpcChannels.EVENT_GATEWAY_STATE, event)
      }
    } catch {
      // BrowserWindow may not be available during early startup
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping()
        this.heartbeatTimeout = setTimeout(() => {
          this.logger.warn('Heartbeat timeout, closing connection')
          if (this.ws) {
            this.ws.terminate()
          }
        }, HEARTBEAT_TIMEOUT_MS)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    this.clearHeartbeatTimeout()
  }

  private clearHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1
    this.setState('reconnecting')

    const baseDelay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt - 1),
      RECONNECT_MAX_MS
    )
    const jitter = Math.random() * baseDelay * 0.3
    const delay = Math.floor(baseDelay + jitter)

    this.logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((err) => {
        this.logger.error('Reconnection failed', {
          error: err instanceof Error ? err.message : String(err)
        })
      })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private cleanup(): void {
    this.stopHeartbeat()
  }

  private enqueue(data: string): void {
    if (this.eventQueue.length >= EVENT_QUEUE_MAX) {
      this.eventQueue.shift()
      this.logger.warn('Event queue full, dropped oldest message')
    }
    this.eventQueue.push({ data, enqueuedAt: Date.now() })
  }

  private drainQueue(): void {
    while (this.eventQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.eventQueue.shift()
      if (msg) {
        this.ws.send(msg.data)
      }
    }
  }

  private refillTokens(): void {
    const now = Date.now()
    const elapsed = now - this.lastTokenRefill

    if (elapsed >= RATE_LIMIT_WINDOW_MS) {
      this.tokenBucket = RATE_LIMIT_TOKENS
      this.lastTokenRefill = now
    }
  }
}
