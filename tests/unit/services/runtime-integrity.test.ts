import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'crypto'

vi.mock('fs/promises', () => ({
  readFile: vi.fn()
}))

vi.mock('electron', () => ({
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

import { verifyBinary } from '../../../src/main/services/openclaw/runtime-integrity'

describe('Runtime integrity - SHA-256 verification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should pass verification when hash matches', async () => {
    const { readFile } = await import('fs/promises')
    const binaryContent = Buffer.from('fake-binary-content-for-testing')
    const expectedHash = createHash('sha256').update(binaryContent).digest('hex')

    vi.mocked(readFile).mockResolvedValue(binaryContent)

    const result = await verifyBinary('/path/to/node', expectedHash)
    expect(result).toBe(true)
  })

  it('should fail verification when hash does not match', async () => {
    const { readFile } = await import('fs/promises')
    const binaryContent = Buffer.from('original-binary')
    vi.mocked(readFile).mockResolvedValue(binaryContent)

    const wrongHash = 'a'.repeat(64)
    const result = await verifyBinary('/path/to/node', wrongHash)
    expect(result).toBe(false)
  })

  it('should return false when file cannot be read', async () => {
    const { readFile } = await import('fs/promises')
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'))

    const result = await verifyBinary('/nonexistent/path', 'abc123')
    expect(result).toBe(false)
  })

  it('should handle case-insensitive hash comparison', async () => {
    const { readFile } = await import('fs/promises')
    const binaryContent = Buffer.from('case-test-binary')
    const expectedHash = createHash('sha256').update(binaryContent).digest('hex').toUpperCase()

    vi.mocked(readFile).mockResolvedValue(binaryContent)

    const result = await verifyBinary('/path/to/node', expectedHash)
    expect(result).toBe(true)
  })
})
