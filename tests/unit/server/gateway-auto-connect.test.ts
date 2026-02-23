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

  it('should auto-connect WebSocket after successful install', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/openclaw/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installMethod: 'npm' }),
    })
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(mockWsConnect).toHaveBeenCalled()
  })

  it('should NOT auto-connect if install fails', async () => {
    mockInstall.mockRejectedValueOnce(new Error('install failed'))

    const res = await fetch(`http://127.0.0.1:${port}/api/openclaw/install`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installMethod: 'npm' }),
    })
    const data = await res.json()

    expect(data.success).toBe(false)
    expect(mockWsConnect).not.toHaveBeenCalled()
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

  it('should broadcast gateway state changes to SSE clients', async () => {
    const controller = new AbortController()
    const res = await fetch(`http://127.0.0.1:${port}/api/events/gateway-state`, {
      signal: controller.signal,
    })

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    const { value: chunk1 } = await reader.read()
    const initial = decoder.decode(chunk1)
    expect(initial).toContain('"type":"connected"')

    server.broadcastGatewayState({ state: 'connected' })

    const { value: chunk2 } = await reader.read()
    const stateUpdate = decoder.decode(chunk2)
    expect(stateUpdate).toContain('"state":"connected"')

    controller.abort()
  })
})
