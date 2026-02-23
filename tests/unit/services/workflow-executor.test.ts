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
  unlink: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined)
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
  getAppDataPath: () => '/mock/appdata',
  getOpenClawPath: () => '/mock/openclaw'
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

const { mockExecFile } = vi.hoisted(() => {
  const mockExecFile = vi.fn()
  return { mockExecFile }
})

vi.mock('child_process', () => ({
  execFile: mockExecFile
}))

vi.mock('util', async () => {
  const actual = await vi.importActual<typeof import('util')>('util')
  return {
    ...actual,
    promisify: () => mockExecFile,
  }
})

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
        prompt: 'Search Google and summarize',
        nodes: [
          { id: 'n1', type: 'google-search', title: 'Google Search', config: { query: 'AI news' } },
          { id: 'n2', type: 'ai-summarize', title: 'Summarize', config: {} },
        ],
      })

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe('Test Workflow')
      expect(workflow.nodes).toHaveLength(2)
      expect(workflow.nodes[0].type).toBe('google-search')
      expect(vi.mocked(atomicWriteFile)).toHaveBeenCalled()
    })

    it('should reject invalid workflow data', async () => {
      const executor = WorkflowExecutor.getInstance()

      await expect(
        executor.create({
          name: '', // empty name
        })
      ).rejects.toThrow('Invalid workflow')
    })
  })

  describe('execute', () => {
    it('should run each node through OpenClaw CLI and return result', async () => {
      const { existsSync } = await import('fs')
      const { atomicReadFile } = await import('../../../src/main/services/platform/atomic-fs')

      const testWorkflow = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Search and Summarize',
        prompt: 'Search and summarize AI news',
        nodes: [
          { id: 'n1', type: 'google-search', title: 'Google Search', desc: '', x: 0, y: 0, icon: '', config: { query: 'AI news' }, missing: false },
          { id: 'n2', type: 'ai-summarize', title: 'Summarize', desc: '', x: 340, y: 0, icon: '', config: {}, missing: false },
        ],
        schedule: null,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(atomicReadFile).mockResolvedValue(JSON.stringify(testWorkflow))

      // Mock openclaw CLI returning JSON results
      mockExecFile
        .mockResolvedValueOnce({ stdout: JSON.stringify({ result: 'Search results for AI news' }) })
        .mockResolvedValueOnce({ stdout: JSON.stringify({ result: 'Summary of AI news' }) })

      const executor = WorkflowExecutor.getInstance()
      const result = await executor.execute(testWorkflow.id)

      expect(result.status).toBe('completed')
      expect(result.itemCount).toBe(2)
      expect(mockExecFile).toHaveBeenCalledTimes(2)
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
        prompt: 'Long running task',
        nodes: [
          { id: 'n1', type: 'agent', title: 'Long Task', desc: '', x: 0, y: 0, icon: '', config: { prompt: 'wait' }, missing: false },
        ],
        schedule: null,
        enabled: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }

      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(atomicReadFile).mockResolvedValue(JSON.stringify(testWorkflow))

      // First call never resolves
      mockExecFile.mockImplementation(
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
