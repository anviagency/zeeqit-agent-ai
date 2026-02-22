import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWriteFile = vi.fn()
const mockRename = vi.fn()
const mockReadFile = vi.fn()
const mockOpen = vi.fn()
const mockUnlink = vi.fn()
const mockCopyFile = vi.fn()

vi.mock('fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  rename: (...args: unknown[]) => mockRename(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  open: (...args: unknown[]) => mockOpen(...args),
  unlink: (...args: unknown[]) => mockUnlink(...args),
  copyFile: (...args: unknown[]) => mockCopyFile(...args)
}))

vi.mock('fs', () => ({
  mkdirSync: vi.fn()
}))

const mockLock = vi.fn()

vi.mock('proper-lockfile', () => ({
  default: {
    lock: (...args: unknown[]) => mockLock(...args)
  }
}))

vi.mock('os', () => ({
  platform: vi.fn().mockReturnValue('darwin')
}))

import { atomicWriteFile, atomicReadFile } from '../../../src/main/services/platform/atomic-fs'

describe('atomicWriteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const release = vi.fn().mockResolvedValue(undefined)
    mockLock.mockResolvedValue(release)
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)
    mockUnlink.mockResolvedValue(undefined)
    mockOpen.mockResolvedValue({
      sync: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    })
  })

  it('should write to a tmp file then rename to target', async () => {
    await atomicWriteFile('/data/config.json', '{"key":"value"}')

    expect(mockWriteFile).toHaveBeenCalledTimes(1)
    const tmpPath = mockWriteFile.mock.calls[0][0] as string
    expect(tmpPath).toContain('.tmp-')

    expect(mockRename).toHaveBeenCalledTimes(1)
    const [src, dest] = mockRename.mock.calls[0] as [string, string]
    expect(src).toContain('.tmp-')
    expect(dest).toBe('/data/config.json')
  })

  it('should fsync the tmp file before renaming', async () => {
    const syncFn = vi.fn().mockResolvedValue(undefined)
    const closeFn = vi.fn().mockResolvedValue(undefined)
    mockOpen.mockResolvedValue({ sync: syncFn, close: closeFn })

    await atomicWriteFile('/data/test.json', 'data')

    expect(mockOpen).toHaveBeenCalled()
    expect(syncFn).toHaveBeenCalled()
    expect(closeFn).toHaveBeenCalled()
  })

  it('should not corrupt target when write fails', async () => {
    mockWriteFile.mockRejectedValue(new Error('Disk full'))

    await expect(
      atomicWriteFile('/data/config.json', 'data')
    ).rejects.toThrow('Atomic write')

    expect(mockRename).not.toHaveBeenCalled()
  })

  it('should acquire and release a lock', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    mockLock.mockResolvedValue(release)

    await atomicWriteFile('/data/test.json', 'content')

    expect(mockLock).toHaveBeenCalled()
    expect(release).toHaveBeenCalled()
  })
})

describe('atomicReadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should read file contents as UTF-8', async () => {
    mockReadFile.mockResolvedValue('{"hello":"world"}')

    const result = await atomicReadFile('/data/config.json')
    expect(result).toBe('{"hello":"world"}')
  })

  it('should throw descriptive error for missing file', async () => {
    const err = new Error('ENOENT') as NodeJS.ErrnoException
    err.code = 'ENOENT'
    mockReadFile.mockRejectedValue(err)

    await expect(atomicReadFile('/missing/file.json')).rejects.toThrow('File not found')
  })

  it('should throw descriptive error for permission denied', async () => {
    const err = new Error('EACCES') as NodeJS.ErrnoException
    err.code = 'EACCES'
    mockReadFile.mockRejectedValue(err)

    await expect(atomicReadFile('/restricted/file.json')).rejects.toThrow('Permission denied')
  })
})
