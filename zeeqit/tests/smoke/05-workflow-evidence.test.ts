import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  readFileSync: vi.fn().mockReturnValue('{}'),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  readdir: vi.fn().mockResolvedValue([]),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
}))

vi.mock('electron', () => ({
  app: { getAppPath: () => '/mock/app', isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] }
}))

vi.mock('../../src/main/services/diagnostics/log-ring', () => ({
  LogRing: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    })
  }
}))

vi.mock('../../src/main/services/platform/app-paths', () => ({
  getAppDataPath: () => '/mock/appdata',
  getEvidencePath: () => '/mock/evidence',
  getOpenClawPath: () => '/mock/openclaw'
}))

const storedChains = new Map<string, string>()

vi.mock('../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn(async (path: string, content: string) => {
    storedChains.set(path, content)
  }),
  atomicReadFile: vi.fn(async (path: string) => {
    const data = storedChains.get(path)
    if (!data) throw new Error(`File not found: "${path}"`)
    return data
  })
}))

import { EvidenceChain } from '../../src/main/services/evidence/chain'
import { EvidenceCollector } from '../../src/main/services/evidence/collector'

describe('Smoke: Workflow with evidence chain', () => {
  let chain: EvidenceChain
  let collector: EvidenceCollector

  beforeEach(() => {
    vi.clearAllMocks()
    storedChains.clear()
    ;(EvidenceChain as unknown as { instance: null }).instance = null
    ;(EvidenceCollector as unknown as { instance: null }).instance = null
    chain = EvidenceChain.getInstance()
    collector = EvidenceCollector.getInstance()
  })

  it('should create a chain, append records, and verify integrity', async () => {
    const chainData = await chain.createChain('workflow-run-1')
    expect(chainData.chainId).toBe('workflow-run-1')
    expect(chainData.length).toBe(0)

    for (let i = 0; i < 3; i++) {
      await chain.appendRecord('workflow-run-1', {
        sourceUrl: `https://example.com/page-${i}`,
        extractedValue: { data: `value-${i}` },
        anchors: [
          {
            cssSelector: `#item-${i}`,
            xpath: `/html/body/div[${i}]`,
            textContent: `Item ${i}`,
            primaryTier: 'css'
          }
        ],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('workflow-run-1')
    expect(fullChain).not.toBeNull()
    expect(fullChain!.records.length).toBeGreaterThanOrEqual(3)
  })

  it('should have valid prevHash links across all records', async () => {
    await chain.createChain('chain-links-test')

    for (let i = 0; i < 3; i++) {
      await chain.appendRecord('chain-links-test', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { step: i },
        anchors: [{ cssSelector: 'div', xpath: '/div', textContent: 'x', primaryTier: 'css' }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('chain-links-test')
    expect(fullChain).not.toBeNull()

    const genesisHash = '0'.repeat(64)
    expect(fullChain!.records[0].previousHash).toBe(genesisHash)

    for (let i = 1; i < fullChain!.records.length; i++) {
      expect(fullChain!.records[i].previousHash).toBe(fullChain!.records[i - 1].recordHash)
    }
  })

  it('should pass chain verification for an untampered chain', async () => {
    await chain.createChain('verify-clean')

    for (let i = 0; i < 3; i++) {
      await chain.appendRecord('verify-clean', {
        sourceUrl: `https://test.com/${i}`,
        extractedValue: { v: i },
        anchors: [{ cssSelector: 'span', xpath: '/span', textContent: 't', primaryTier: 'css' }],
        screenshot: null
      })
    }

    const result = await chain.verify('verify-clean')
    expect(result.valid).toBe(true)
    expect(result.recordCount).toBe(3)
  })

  it('should detect tampering when a record sourceUrl is modified', async () => {
    await chain.createChain('verify-tamper')

    for (let i = 0; i < 3; i++) {
      await chain.appendRecord('verify-tamper', {
        sourceUrl: `https://test.com/${i}`,
        extractedValue: { v: i },
        anchors: [{ cssSelector: 'p', xpath: '/p', textContent: 'test', primaryTier: 'css' }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('verify-tamper')
    expect(fullChain).not.toBeNull()

    fullChain!.records[1].sourceUrl = 'https://evil.com/tampered'

    for (const [key] of storedChains.entries()) {
      if (key.includes('verify-tamper')) {
        storedChains.set(key, JSON.stringify(fullChain))
      }
    }

    const result = await chain.verify('verify-tamper')
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBeDefined()
  })
})
