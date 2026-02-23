import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── mocks ───────────────────────────────────────────────────────────

const mockWsConnect = vi.fn().mockResolvedValue(undefined)
const mockWsGetState = vi.fn().mockReturnValue('disconnected')

vi.mock('../../../src/main/services/gateway/websocket-client', () => ({
  GatewayWebSocketClient: {
    getInstance: () => ({
      connect: mockWsConnect,
      disconnect: vi.fn(),
      getState: mockWsGetState,
      onMessage: vi.fn(() => () => {}),
    }),
  },
}))

const mockInstall = vi.fn().mockResolvedValue(undefined)

vi.mock('../../../src/main/services/openclaw/installer', () => ({
  OpenClawInstaller: {
    getInstance: () => ({
      install: mockInstall,
      getCheckpoint: vi.fn().mockReturnValue({ step: 'complete' }),
      repair: vi.fn().mockResolvedValue({ steps: [] }),
    }),
  },
}))

vi.mock('../../../src/main/services/diagnostics/log-ring', () => ({
  LogRing: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getAppPath: () => '/mock/app', isPackaged: false },
}))

import { HttpApiServer } from '../../../src/main/server/http-api'

describe('Gateway auto-connect after install', () => {
  let server: HttpApiServer
  let port: number

  beforeEach(async () => {
    vi.clearAllMocks()
    mockInstall.mockResolvedValue(undefined)
    ;(HttpApiServer as unknown as { instance: null }).instance = null
    server = HttpApiServer.getInstance()
    port = await server.start()
  })

  afterEach(() => {
    server.stop()
  })

  it('should return success after successful install', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/openclaw/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installMethod: 'npm' }),
    })
    const data = await res.json()

    expect(data.success).toBe(true)
  })

  it('should accept install request with config body', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/openclaw/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installMethod: 'npm', runtime: 'node' }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveProperty('success')
  })
})

describe('/api/events/gateway-state SSE endpoint', () => {
  let server: HttpApiServer
  let port: number

  beforeEach(async () => {
    vi.clearAllMocks()
    ;(HttpApiServer as unknown as { instance: null }).instance = null
    server = HttpApiServer.getInstance()
    port = await server.start()
  })

  afterEach(() => {
    server.stop()
  })

  it('should expose an SSE endpoint at /api/events/gateway-state', async () => {
    const controller = new AbortController()
    const res = await fetch(`http://127.0.0.1:${port}/api/events/gateway-state`, {
      signal: controller.signal,
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/event-stream')

    controller.abort()
  })

  it('should send SSE handshake message on connect', async () => {
    const controller = new AbortController()
    const res = await fetch(`http://127.0.0.1:${port}/api/events/gateway-state`, {
      signal: controller.signal,
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const { value } = await reader.read()
    const initial = decoder.decode(value)

    expect(initial).toContain('"type":"connected"')

    controller.abort()
  })

  it('should have broadcastGatewayState method available', () => {
    expect(typeof server.broadcastGatewayState).toBe('function')
    // Should not throw when called with no connected clients
    expect(() => server.broadcastGatewayState({ state: 'connected' })).not.toThrow()
    expect(() => server.broadcastGatewayState({ state: 'disconnected' })).not.toThrow()
    expect(() => server.broadcastGatewayState({ state: 'reconnecting' })).not.toThrow()
  })
})
