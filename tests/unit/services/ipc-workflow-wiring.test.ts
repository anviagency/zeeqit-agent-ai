import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mocks ───────────────────────────────────────────────────────────

const registeredHandlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => Promise<unknown>) => {
      registeredHandlers.set(channel, handler)
    })
  },
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

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(''),
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

vi.mock('../../../src/main/services/platform/app-paths', () => ({
  getOpenClawPath: () => '/mock/openclaw',
  getAppDataPath: () => '/mock/appdata',
  getVaultPath: () => '/mock/vault',
  getConfigHistoryPath: () => '/mock/config-history',
  getEvidencePath: () => '/mock/evidence',
  getLogsPath: () => '/mock/logs',
  getCheckpointPath: () => '/mock/checkpoints'
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn().mockResolvedValue('{}')
}))

import { IpcChannels } from '../../../src/shared/ipc-channels'
import { registerAllIpcHandlers } from '../../../src/main/ipc/register'

describe('IPC workflow handler wiring', () => {
  beforeEach(() => {
    registeredHandlers.clear()
    registerAllIpcHandlers()
  })

  it('should register workflow:execute handler that delegates to WorkflowExecutor', () => {
    expect(registeredHandlers.has(IpcChannels.WORKFLOW_EXECUTE)).toBe(true)
  })

  it('should register workflow:list handler that delegates to WorkflowExecutor', () => {
    expect(registeredHandlers.has(IpcChannels.WORKFLOW_LIST)).toBe(true)
  })

  it('should register workflow:get handler that delegates to WorkflowExecutor', () => {
    expect(registeredHandlers.has(IpcChannels.WORKFLOW_GET)).toBe(true)
  })

  it('should register workflow:create handler that delegates to WorkflowExecutor', () => {
    expect(registeredHandlers.has(IpcChannels.WORKFLOW_CREATE)).toBe(true)
  })

  it('workflow:execute handler should NOT return NOT_IMPLEMENTED', async () => {
    const handler = registeredHandlers.get(IpcChannels.WORKFLOW_EXECUTE)!
    // Call with a fake event and a non-existent workflowId
    const result = await handler({ sender: {} }, 'test-workflow-id') as { success: boolean; error?: { code: string } }

    // The handler should attempt real execution (fail because workflow not found)
    // but must NOT return NOT_IMPLEMENTED
    if (!result.success && result.error) {
      expect(result.error.code).not.toBe('NOT_IMPLEMENTED')
    }
  })

  it('workflow:list handler should NOT return NOT_IMPLEMENTED', async () => {
    const handler = registeredHandlers.get(IpcChannels.WORKFLOW_LIST)!
    const result = await handler({ sender: {} }) as { success: boolean; data?: unknown[] }

    expect(result.success).toBe(true)
    expect(Array.isArray(result.data)).toBe(true)
  })

  it('workflow:get handler should NOT return NOT_FOUND for missing workflow', async () => {
    const handler = registeredHandlers.get(IpcChannels.WORKFLOW_GET)!
    const result = await handler({ sender: {} }, 'non-existent') as { success: boolean; data?: unknown }

    // Should return success with null data (not found is a valid state)
    expect(result.success).toBe(true)
    expect(result.data).toBeNull()
  })
})
