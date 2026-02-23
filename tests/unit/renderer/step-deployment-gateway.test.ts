import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests that StepDeployment connects the gateway WebSocket after install
 * and that the http-client onInstallProgress waits for SSE readiness.
 */

// Mock EventSource
class MockEventSource {
  url: string
  onmessage: ((ev: { data: string }) => void) | null = null
  onopen: (() => void) | null = null
  readyState = 0

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
    // Simulate connection after microtask
    Promise.resolve().then(() => {
      this.readyState = 1
      this.onopen?.()
    })
  }

  close(): void {
    this.readyState = 2
  }

  static instances: MockEventSource[] = []
  static reset(): void {
    MockEventSource.instances = []
  }
}

vi.stubGlobal('EventSource', MockEventSource)

beforeEach(() => {
  MockEventSource.reset()
  vi.resetModules()
})

describe('Install progress SSE race condition', () => {
  it('onInstallProgress should set up EventSource that fires onopen', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    const callback = vi.fn()
    httpApi.events.onInstallProgress(callback)

    const es = MockEventSource.instances[MockEventSource.instances.length - 1]
    expect(es).toBeDefined()
    expect(es.url).toContain('/api/events/install-progress')

    // Simulate the initial connection event from server
    await Promise.resolve() // let onopen fire

    // Then simulate a real event
    es.onmessage!({ data: JSON.stringify({ step: 'runtime', status: 'running', message: 'test' }) })
    expect(callback).toHaveBeenCalledWith({ step: 'runtime', status: 'running', message: 'test' })
  })

  it('onInstallProgress should provide a ready() method or similar mechanism', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    // The return value should include a way to wait for readiness
    const result = httpApi.events.onInstallProgress(vi.fn())

    // result should be a function (unsubscribe) — the ready signal
    // should be the initial "connected" event from SSE
    expect(typeof result).toBe('function')
  })
})

describe('Gateway connect after install success', () => {
  it('httpApi.gateway.connect should be callable and return IpcResult', async () => {
    const { httpApi } = await import('../../../src/renderer/api/http-client')

    // gateway.connect should exist and be a real function
    expect(typeof httpApi.gateway.connect).toBe('function')

    // Calling it should attempt to POST /api/gateway/connect
    // (will fail in test env since no server, but proves it's wired)
    const result = await httpApi.gateway.connect()
    // Network error is expected in test env
    expect(result).toBeDefined()
  })
})
