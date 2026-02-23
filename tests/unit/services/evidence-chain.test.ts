import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn()
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('{}'),
  readdir: vi.fn().mockResolvedValue([]),
  writeFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({ sync: vi.fn(), close: vi.fn() }),
  unlink: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('proper-lockfile', () => ({
  default: { lock: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue(undefined)) }
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
  getEvidencePath: () => '/mock/evidence'
}))

const chainStore = new Map<string, string>()

vi.mock('../../../src/main/services/platform/atomic-fs', () => ({
  atomicWriteFile: vi.fn(async (path: string, content: string) => {
    chainStore.set(path, content)
  }),
  atomicReadFile: vi.fn(async (path: string) => {
    const data = chainStore.get(path)
    if (!data) throw new Error(`File not found: "${path}"`)
    return data
  })
}))

import { EvidenceChain } from '../../../src/main/services/evidence/chain'
import { EvidenceCollector } from '../../../src/main/services/evidence/collector'

describe('EvidenceChain integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chainStore.clear()
    ;(EvidenceChain as unknown as { instance: null }).instance = null
    ;(EvidenceCollector as unknown as { instance: null }).instance = null
  })

  it('should create a 5-step chain with valid hash links', async () => {
    const chain = EvidenceChain.getInstance()
    await chain.createChain('chain-5')

    for (let i = 0; i < 5; i++) {
      await chain.appendRecord('chain-5', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { item: i, price: i * 10 },
        anchors: [{
          cssSelector: `.item-${i}`,
          xpath: `/html/body/div[${i + 1}]`,
          textContent: `Item ${i}`,
          primaryTier: 'css' as const
        }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('chain-5')
    expect(fullChain).not.toBeNull()
    expect(fullChain!.records).toHaveLength(5)
    expect(fullChain!.length).toBe(5)
  })

  it('should verify all prevHash links in a 5-step chain', async () => {
    const chain = EvidenceChain.getInstance()
    await chain.createChain('chain-verify-5')

    for (let i = 0; i < 5; i++) {
      await chain.appendRecord('chain-verify-5', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { data: i },
        anchors: [{ cssSelector: 'div', xpath: '/div', textContent: 'x', primaryTier: 'css' as const }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('chain-verify-5')!
    const genesisHash = '0'.repeat(64)

    expect(fullChain!.records[0].previousHash).toBe(genesisHash)

    for (let i = 1; i < fullChain!.records.length; i++) {
      expect(fullChain!.records[i].previousHash).toBe(fullChain!.records[i - 1].recordHash)
    }
  })

  it('should pass verification for an untampered chain', async () => {
    const chain = EvidenceChain.getInstance()
    await chain.createChain('chain-clean')

    for (let i = 0; i < 5; i++) {
      await chain.appendRecord('chain-clean', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { v: i },
        anchors: [{ cssSelector: 'span', xpath: '/span', textContent: 'test', primaryTier: 'css' as const }],
        screenshot: null
      })
    }

    const result = await chain.verify('chain-clean')
    expect(result.valid).toBe(true)
    expect(result.recordCount).toBe(5)
  })

  it('should detect tampering when an outputHash is modified', async () => {
    const chain = EvidenceChain.getInstance()
    await chain.createChain('chain-tamper')

    for (let i = 0; i < 5; i++) {
      await chain.appendRecord('chain-tamper', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { v: i },
        anchors: [{ cssSelector: 'p', xpath: '/p', textContent: 'item', primaryTier: 'css' as const }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('chain-tamper')
    expect(fullChain).not.toBeNull()

    fullChain!.records[2].recordHash = 'f'.repeat(64)

    const chainPath = '/mock/evidence/chain-chain-tamper.json'
    chainStore.set(chainPath, JSON.stringify(fullChain))

    const result = await chain.verify('chain-tamper')
    expect(result.valid).toBe(false)
    expect(result.brokenAt).toBeDefined()
  })

  it('should detect tampering when sourceUrl is altered', async () => {
    const chain = EvidenceChain.getInstance()
    await chain.createChain('urltamper')

    for (let i = 0; i < 3; i++) {
      await chain.appendRecord('urltamper', {
        sourceUrl: `https://example.com/${i}`,
        extractedValue: { v: i },
        anchors: [{ cssSelector: 'div', xpath: '/div', textContent: 'x', primaryTier: 'css' as const }],
        screenshot: null
      })
    }

    const fullChain = await chain.getChain('urltamper')
    expect(fullChain).not.toBeNull()

    fullChain!.records[1].sourceUrl = 'https://evil.com/tampered'

    for (const [key] of chainStore.entries()) {
      if (key.includes('urltamper')) {
        chainStore.set(key, JSON.stringify(fullChain))
      }
    }

    const result = await chain.verify('urltamper')
    expect(result.valid).toBe(false)
  })
})
