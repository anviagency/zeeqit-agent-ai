import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mocks ───────────────────────────────────────────────────────────

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getAppPath: () => '/mock/app', isPackaged: false }
}))

vi.mock('../../../src/main/services/diagnostics/log-ring', () => ({
  LogRing: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('../../../src/main/services/platform/app-paths', () => ({
  getAppDataPath: () => '/mock/appdata'
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

const mockRouterExecute = vi.fn()

vi.mock('../../../src/main/services/routing/engine', () => ({
  RoutingEngine: {
    getInstance: () => ({
      execute: mockRouterExecute
    })
  }
}))

import { WorkflowExecutor } from '../../../src/main/services/workflow/executor'

describe('WorkflowExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(WorkflowExecutor as unknown as { instance: null }).instance = null
  })

  describe('create', () => {
    it('should validate and persist a new workflow', async () => {
      const { atomicWriteFile } = await import('../../../src/main/services/platform/atomic-fs')

      const executor = WorkflowExecutor.getInstance()
      const workflow = await executor.create({
        name: 'Test Workflow',
        targetUrl: 'https://example.com',
        extractionGoal: 'Extract all prices',
        mode: 'auto'
      })

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe('Test Workflow')
      expect(workflow.targetUrl).toBe('https://example.com')
      expect(vi.mocked(atomicWriteFile)).toHaveBeenCalled()
    })

    it('should reject invalid workflow data', async () => {
      const executor = WorkflowExecutor.getInstance()

      await expect(
        executor.create({
          name: '', // empty name
          targetUrl: 'not-a-url',
          extractionGoal: ''
        })
      ).rejects.toThrow('Invalid workflow')
    })
  })

  describe('execute', () => {
    it('should delegate to RoutingEngine and return execution result', async () => {
      const { existsSync } = await import('fs')
      const { atomicReadFile } = await import('../../../src/main/services/platform/atomic-fs')

      const testWorkflow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Price Scraper',
        targetUrl: 'https://example.com/products',
        extractionGoal: 'Extract prices',
        mode: 'auto',
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(atomicReadFile).mockResolvedValue(JSON.stringify(testWorkflow))

      mockRouterExecute.mockResolvedValue({
        extraction: { items: [{ price: '9.99' }], itemCount: 1 },
        validation: { valid: true, summary: 'OK' },
        evidenceChainId: 'evidence-123'
      })

      const executor = WorkflowExecutor.getInstance()
      const result = await executor.execute(testWorkflow.id)

      expect(result.status).toBe('completed')
      expect(result.itemCount).toBe(1)
      expect(result.evidenceChainId).toBe('evidence-123')
      expect(mockRouterExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          url: testWorkflow.targetUrl,
          goal: testWorkflow.extractionGoal,
          mode: testWorkflow.mode
        })
      )
    })

    it('should return failed status when workflow not found', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const executor = WorkflowExecutor.getInstance()
      const result = await executor.execute('00000000-0000-0000-0000-000000000000')

      expect(result.status).toBe('failed')
      expect(result.error).toContain('not found')
    })

    it('should prevent concurrent execution of the same workflow', async () => {
      const { existsSync } = await import('fs')
      const { atomicReadFile } = await import('../../../src/main/services/platform/atomic-fs')

      const testWorkflow = {
        id: '660e8400-e29b-41d4-a716-446655440000',
        name: 'Slow Workflow',
        targetUrl: 'https://example.com',
        extractionGoal: 'Extract data',
        mode: 'auto',
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(atomicReadFile).mockResolvedValue(JSON.stringify(testWorkflow))

      // First call never resolves (simulates long-running)
      mockRouterExecute.mockImplementation(
        () => new Promise(() => {/* never resolves */})
      )

      const executor = WorkflowExecutor.getInstance()
      // Start first execution (don't await)
      const first = executor.execute(testWorkflow.id)

      // Wait a tick for the activeWorkflows map to be populated
      await new Promise((r) => setTimeout(r, 10))

      // Second execution of same workflow should fail
      const second = await executor.execute(testWorkflow.id)
      expect(second.status).toBe('failed')
      expect(second.error).toContain('already running')

      // Cleanup: abort the hanging first execution
      executor.abort(testWorkflow.id)
    })
  })

  describe('listWorkflows', () => {
    it('should return empty array when directory does not exist', async () => {
      const { existsSync } = await import('fs')
      vi.mocked(existsSync).mockReturnValue(false)

      const executor = WorkflowExecutor.getInstance()
      const list = await executor.listWorkflows()

      expect(list).toEqual([])
    })
  })

  describe('abort', () => {
    it('should remove workflow from active map', () => {
      const executor = WorkflowExecutor.getInstance()
      // Should not throw even if not found
      executor.abort('non-existent')
    })
  })
})
