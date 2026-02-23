import { describe, it, expect } from 'vitest'
import { generateMasterKey, encrypt, decrypt } from '../../../src/main/services/vault/crypto'

describe('Vault crypto', () => {
  describe('generateMasterKey', () => {
    it('should produce a 32-byte key', () => {
      const key = generateMasterKey()
      expect(key).toBeInstanceOf(Buffer)
      expect(key.length).toBe(32)
    })

    it('should produce unique keys on each call', () => {
      const key1 = generateMasterKey()
      const key2 = generateMasterKey()
      expect(key1.equals(key2)).toBe(false)
    })
  })

  describe('encrypt / decrypt roundtrip', () => {
    it('should decrypt to original plaintext', () => {
      const masterKey = generateMasterKey()
      const plaintext = 'my-secret-api-key-12345'

      const encrypted = encrypt(plaintext, masterKey)
      const decrypted = decrypt(encrypted, masterKey)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle empty string', () => {
      const masterKey = generateMasterKey()

      const encrypted = encrypt('', masterKey)
      const decrypted = decrypt(encrypted, masterKey)

      expect(decrypted).toBe('')
    })

    it('should handle unicode content', () => {
      const masterKey = generateMasterKey()
      const plaintext = '🔑 Ключ доступа 密码'

      const encrypted = encrypt(plaintext, masterKey)
      const decrypted = decrypt(encrypted, masterKey)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('ciphertext diversity', () => {
    it('should produce different ciphertexts for the same plaintext with the same key', () => {
      const masterKey = generateMasterKey()
      const plaintext = 'identical-plaintext'

      const enc1 = encrypt(plaintext, masterKey)
      const enc2 = encrypt(plaintext, masterKey)

      expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
      expect(enc1.salt).not.toBe(enc2.salt)
      expect(enc1.iv).not.toBe(enc2.iv)
    })

    it('should produce different ciphertexts with different keys', () => {
      const key1 = generateMasterKey()
      const key2 = generateMasterKey()
      const plaintext = 'same-plaintext'

      const enc1 = encrypt(plaintext, key1)
      const enc2 = encrypt(plaintext, key2)

      expect(enc1.ciphertext).not.toBe(enc2.ciphertext)
    })
  })

  describe('wrong key rejection', () => {
    it('should fail to decrypt with a different key', () => {
      const key1 = generateMasterKey()
      const key2 = generateMasterKey()
      const plaintext = 'secret-value'

      const encrypted = encrypt(plaintext, key1)

      expect(() => decrypt(encrypted, key2)).toThrow('Decryption failed')
    })
  })

  describe('key length validation', () => {
    it('should reject a key shorter than 32 bytes', () => {
      const shortKey = Buffer.alloc(16)
      expect(() => encrypt('test', shortKey)).toThrow('Master key must be 32 bytes')
    })

    it('should reject a key longer than 32 bytes', () => {
      const longKey = Buffer.alloc(64)
      expect(() => encrypt('test', longKey)).toThrow('Master key must be 32 bytes')
    })
  })
})
