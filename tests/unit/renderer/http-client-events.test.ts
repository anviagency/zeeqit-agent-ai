import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock EventSource (not available in Node)
class MockEventSource {
  url: string
  onmessage: ((ev: { data: string }) => void) | null = null
  readyState = 1
  closeCalled = false

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  close(): void {
    this.closeCalled = true
  }

  static instances: MockEventSource[] = []
  static reset(): void {
    MockEventSource.instances = []
  }
}

vi.stubGlobal('EventSource', MockEventSource)

// Mock fetch so gateway.connect() doesn't fail
const mockFetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true }),
})
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  MockEventSource.reset()
  mockFetch.mockClear()
  vi.resetModules()
})

describe('httpApi.events.onGatewayState', () => {
  it('should create an EventSource for gateway state (NOT be a no-op)', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    const callback = vi.fn()
    const unsub = httpApi.events.onGatewayState(callback)

    // Should have created an EventSource
    expect(MockEventSource.instances.length).toBeGreaterThan(0)

    const es = MockEventSource.instances[MockEventSource.instances.length - 1]
    expect(es.url).toContain('/api/events/gateway-state')

    // Simulate receiving a state change message
    es.onmessage!({ data: JSON.stringify({ state: 'connected' }) })
    expect(callback).toHaveBeenCalledWith({ state: 'connected' })

    // Cleanup
    unsub()
    expect(es.closeCalled).toBe(true)
  })

  it('should ignore malformed gateway state events', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    const callback = vi.fn()
    httpApi.events.onGatewayState(callback)

    const es = MockEventSource.instances[MockEventSource.instances.length - 1]

    // Malformed JSON should not crash or call callback
    es.onmessage!({ data: 'not-json' })
    expect(callback).not.toHaveBeenCalled()

    // "connected" type events (initial SSE handshake) should be filtered
    es.onmessage!({ data: JSON.stringify({ type: 'connected' }) })
    expect(callback).not.toHaveBeenCalled()
  })

  it('should trigger gateway.connect() on subscribe', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    httpApi.events.onGatewayState(vi.fn())

    // Should have called fetch with the gateway connect endpoint
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gateway/connect'),
        expect.objectContaining({ method: 'POST' })
      )
    })
  })
})

describe('httpApi.events.onInstallProgress', () => {
  it('should create EventSource for install progress', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    const callback = vi.fn()
    const unsub = httpApi.events.onInstallProgress(callback)

    const es = MockEventSource.instances[MockEventSource.instances.length - 1]
    expect(es.url).toContain('/api/events/install-progress')

    unsub()
  })
})
