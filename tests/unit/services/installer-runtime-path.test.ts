import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── mocks ───────────────────────────────────────────────────────────

const mockExecFileAsync = vi.fn()

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

vi.mock('util', () => ({
  promisify: () => mockExecFileAsync,
}))

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn(),
  chmodSync: vi.fn(),
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getAppPath: () => '/mock/app', isPackaged: false },
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

vi.mock('../../../src/main/services/platform/app-paths', () => ({
  getCheckpointPath: () => '/mock/checkpoints',
  getOpenClawPath: () => '/mock/openclaw',
  getAppDataPath: () => '/mock/appdata',
}))

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn().mockResolvedValue(undefined),
  atomicReadFile: vi.fn(),
}))

const mockResolve = vi.fn()

vi.mock('../../../src/main/services/openclaw/runtime-resolver', () => ({
  RuntimeResolver: {
    getInstance: () => ({
      resolve: mockResolve,
    }),
  },
}))

vi.mock('../../../src/main/services/openclaw/config-compiler', () => ({
  ConfigCompiler: {
    getInstance: () => ({
      getCurrentConfig: vi.fn().mockResolvedValue({}),
    }),
  },
}))

vi.mock('../../../src/main/services/openclaw/daemon', () => ({
  DaemonManager: {
    getInstance: () => ({
      getStatus: vi.fn().mockResolvedValue({ running: true, pid: 1234 }),
      isRunning: vi.fn().mockResolvedValue(true),
      restart: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('../../../src/main/server/http-api', () => ({
  HttpApiServer: {
    getInstance: () => ({
      broadcastProgress: vi.fn(),
    }),
  },
}))

import { OpenClawInstaller } from '../../../src/main/services/openclaw/installer'

describe('Installer uses resolved runtime PATH for openclaw commands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(OpenClawInstaller as unknown as { instance: null }).instance = null

    // Simulate a downloaded runtime (not on system PATH)
    mockResolve.mockResolvedValue({
      type: 'downloaded',
      path: '/mock/appdata/runtime/darwin-arm64/node',
      version: 'v22.14.0',
      verified: true,
    })
  })

  it('should pass runtime bin dir in PATH when calling openclaw onboard', async () => {
    const installer = OpenClawInstaller.getInstance()

    // Mock: openclaw not yet installed, so first check fails
    mockExecFileAsync
      // stepRuntime: node --version (via resolve)
      // stepOpenClaw: openclaw --version check (not found)
      .mockRejectedValueOnce(new Error('not found'))
      // stepOpenClaw: npm install -g openclaw
      .mockResolvedValueOnce({ stdout: '' })
      // stepOpenClaw: openclaw --version verify
      .mockResolvedValueOnce({ stdout: '2026.2.22\n' })
      // stepConfig: openclaw onboard
      .mockResolvedValueOnce({ stdout: '{"mode":"local"}\n' })
      // stepCredentials: (no external creds)
      // stepDaemon: openclaw gateway install
      .mockResolvedValueOnce({ stdout: '' })
      // stepDaemon: openclaw gateway start
      .mockResolvedValueOnce({ stdout: '' })
      // stepDaemon: openclaw gateway status
      .mockResolvedValueOnce({ stdout: 'Runtime: running\nRPC probe: ok\n' })
      // stepHealth: openclaw doctor
      .mockResolvedValueOnce({ stdout: 'OK\n' })
      // checkpoint writes
      .mockResolvedValue(undefined)

    try {
      await installer.install({ installMethod: 'npm' })
    } catch {
      // May fail due to mock limitations, that's OK
    }

    // Find the call to `openclaw onboard` — it should have PATH containing the runtime dir
    const onboardCall = mockExecFileAsync.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'openclaw' &&
        Array.isArray(call[1]) &&
        (call[1] as string[]).includes('onboard')
    )

    expect(onboardCall).toBeDefined()

    // The env should include the runtime's bin directory in PATH
    const env = (onboardCall![2] as { env?: { PATH?: string } })?.env
    expect(env?.PATH).toContain('/mock/appdata/runtime/darwin-arm64')
  })

  it('should pass runtime bin dir in PATH when calling openclaw gateway commands', async () => {
    const installer = OpenClawInstaller.getInstance()

    mockExecFileAsync
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '2026.2.22\n' })
      .mockResolvedValueOnce({ stdout: '{"mode":"local"}\n' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: '' })
      .mockResolvedValueOnce({ stdout: 'Runtime: running\n' })
      .mockResolvedValueOnce({ stdout: 'OK\n' })
      .mockResolvedValue(undefined)

    try {
      await installer.install({ installMethod: 'npm' })
    } catch {
      // May fail
    }

    // Find any call to `openclaw gateway ...`
    const gatewayCall = mockExecFileAsync.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'openclaw' &&
        Array.isArray(call[1]) &&
        (call[1] as string[])[0] === 'gateway'
    )

    expect(gatewayCall).toBeDefined()

    const env = (gatewayCall![2] as { env?: { PATH?: string } })?.env
    expect(env?.PATH).toContain('/mock/appdata/runtime/darwin-arm64')
  })
})
