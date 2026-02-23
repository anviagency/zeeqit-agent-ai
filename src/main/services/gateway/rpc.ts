/**
 * JSON-RPC client for the OpenClaw gateway.
 *
 * Sends RPC calls over the WebSocket transport and correlates responses
 * by request ID. Rate limiting is enforced by the underlying
 * {@link GatewayWebSocketClient}.
 */

import { randomUUID } from 'crypto'
import { LogRing } from '../diagnostics/log-ring'
import { GatewayWebSocketClient } from './websocket-client'

const RPC_TIMEOUT_MS = 30_000

interface RpcRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params?: Record<string, unknown>
}

interface RpcResponse {
  jsonrpc: '2.0'
  id: string
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface PendingCall {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Singleton RPC client that sends method calls through the gateway WebSocket.
 *
 * @example
 * ```ts
 * const rpc = GatewayRpc.getInstance()
 * const config = await rpc.configGet()
 * await rpc.configPatch({ proxy: { enabled: true } }, 'abc123')
 * ```
 */
export class GatewayRpc {
  private static instance: GatewayRpc | null = null
  private readonly logger = LogRing.getInstance()
  private readonly wsClient = GatewayWebSocketClient.getInstance()
  private readonly pendingCalls = new Map<string, PendingCall>()
  private disposeListener: (() => void) | null = null

  private constructor() {
    this.attachListener()
  }

  /**
   * Returns the singleton GatewayRpc instance.
   */
  static getInstance(): GatewayRpc {
    if (!GatewayRpc.instance) {
      GatewayRpc.instance = new GatewayRpc()
    }
    return GatewayRpc.instance
  }

  /**
   * Sends an RPC call to the gateway and waits for the response.
   *
   * @param method - RPC method name (e.g. 'config.get').
   * @param params - Optional method parameters.
   * @returns Parsed JSON response result.
   * @throws If the call times out or the gateway returns an error.
   */
  async call(method: string, params?: Record<string, unknown>): Promise<unknown> {
    try {
      const id = randomUUID()

      const request: RpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        ...(params !== undefined && { params })
      }

      return await new Promise<unknown>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingCalls.delete(id)
          reject(new Error(`RPC call '${method}' timed out after ${RPC_TIMEOUT_MS}ms`))
        }, RPC_TIMEOUT_MS)

        this.pendingCalls.set(id, { resolve, reject, timer })

        try {
          this.wsClient.send(JSON.stringify(request))
        } catch (err) {
          clearTimeout(timer)
          this.pendingCalls.delete(id)
          reject(
            new Error(
              `Failed to send RPC '${method}': ${err instanceof Error ? err.message : String(err)}`
            )
          )
        }
      })
    } catch (err) {
      this.logger.error(`RPC call failed: ${method}`, {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Retrieves the current gateway configuration.
   *
   * @returns Parsed configuration object.
   */
  async configGet(): Promise<unknown> {
    try {
      return await this.call('config.get')
    } catch (err) {
      this.logger.error('configGet failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Applies a JSON merge patch to the gateway configuration.
   *
   * @param patch - Partial configuration to merge.
   * @param baseHash - Hash of the configuration the patch was computed against.
   * @returns Updated configuration or acknowledgement.
   */
  async configPatch(patch: Record<string, unknown>, baseHash: string): Promise<unknown> {
    try {
      return await this.call('config.patch', { patch, baseHash })
    } catch (err) {
      this.logger.error('configPatch failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Replaces the full gateway configuration.
   *
   * @param fullConfig - Complete configuration object to apply.
   * @returns Acknowledgement from the gateway.
   */
  async configApply(fullConfig: Record<string, unknown>): Promise<unknown> {
    try {
      return await this.call('config.apply', { config: fullConfig })
    } catch (err) {
      this.logger.error('configApply failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw err
    }
  }

  /**
   * Registers a WebSocket message listener to correlate RPC responses.
   */
  private attachListener(): void {
    if (this.disposeListener) return

    this.disposeListener = this.wsClient.onMessage((raw: string) => {
      try {
        const response = JSON.parse(raw) as RpcResponse

        if (!response.id || response.jsonrpc !== '2.0') {
          return
        }

        const pending = this.pendingCalls.get(response.id)
        if (!pending) return

        clearTimeout(pending.timer)
        this.pendingCalls.delete(response.id)

        if (response.error) {
          pending.reject(
            new Error(`RPC error ${response.error.code}: ${response.error.message}`)
          )
        } else {
          pending.resolve(response.result)
        }
      } catch {
        // non-JSON or non-RPC messages are silently ignored
      }
    })
  }
}
