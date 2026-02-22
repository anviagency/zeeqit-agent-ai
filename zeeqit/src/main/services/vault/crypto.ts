/**
 * AES-256-GCM encryption and decryption utilities for the credential vault.
 *
 * All operations use the Node.js built-in `crypto` module. Each encryption
 * call generates a unique salt and IV to ensure ciphertext diversity even
 * when encrypting identical plaintext values.
 */

import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto'
import type { EncryptedData } from './types'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32
const IV_LENGTH = 12
const SALT_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const PBKDF2_ITERATIONS = 100_000
const PBKDF2_DIGEST = 'sha256'

/**
 * Generates a cryptographically random 32-byte master key.
 *
 * @returns A 32-byte Buffer suitable for AES-256-GCM encryption.
 *
 * @example
 * ```ts
 * const masterKey = generateMasterKey()
 * // masterKey.length === 32
 * ```
 */
export function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH)
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a unique salt and IV.
 *
 * @param plaintext - The string to encrypt.
 * @param masterKey - 32-byte master key buffer.
 * @param keyVersion - Current master key version number (default 1).
 * @returns An {@link EncryptedData} envelope with hex-encoded fields.
 * @throws If the master key is not exactly 32 bytes.
 *
 * @example
 * ```ts
 * const encrypted = encrypt('my-api-key', masterKey)
 * // { ciphertext, salt, iv, keyVersion, authTag }
 * ```
 */
export function encrypt(plaintext: string, masterKey: Buffer, keyVersion = 1): EncryptedData {
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Master key must be ${KEY_LENGTH} bytes, got ${masterKey.length}`)
  }

  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const derivedKey = pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('hex'),
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    keyVersion,
    authTag: authTag.toString('hex')
  }
}

/**
 * Decrypts an {@link EncryptedData} envelope back to the original plaintext.
 *
 * @param encrypted - The encrypted data envelope.
 * @param masterKey - 32-byte master key buffer (must match the version used for encryption).
 * @returns The original plaintext string.
 * @throws If the master key is invalid, the auth tag fails verification, or the data is corrupted.
 *
 * @example
 * ```ts
 * const plaintext = decrypt(encrypted, masterKey)
 * ```
 */
export function decrypt(encrypted: EncryptedData, masterKey: Buffer): string {
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Master key must be ${KEY_LENGTH} bytes, got ${masterKey.length}`)
  }

  try {
    const salt = Buffer.from(encrypted.salt, 'hex')
    const iv = Buffer.from(encrypted.iv, 'hex')
    const authTag = Buffer.from(encrypted.authTag, 'hex')
    const ciphertext = Buffer.from(encrypted.ciphertext, 'hex')

    const derivedKey = pbkdf2Sync(masterKey, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)

    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, { authTagLength: AUTH_TAG_LENGTH })
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return decrypted.toString('utf8')
  } catch (err) {
    throw new Error(
      `Decryption failed: ${err instanceof Error ? err.message : String(err)}`
    )
  }
}

/**
 * Derives a 32-byte encryption key from a passphrase using PBKDF2.
 *
 * Uses 100,000 iterations of SHA-256 for key stretching.
 *
 * @param passphrase - User-provided passphrase string.
 * @param salt - Unique salt buffer (should be at least 16 bytes).
 * @returns A 32-byte derived key buffer.
 *
 * @example
 * ```ts
 * const salt = randomBytes(16)
 * const key = deriveKeyFromPassphrase('my-strong-passphrase', salt)
 * ```
 */
export function deriveKeyFromPassphrase(passphrase: string, salt: Buffer): Buffer {
  if (!passphrase || passphrase.length === 0) {
    throw new Error('Passphrase must not be empty')
  }
  if (salt.length < SALT_LENGTH) {
    throw new Error(`Salt must be at least ${SALT_LENGTH} bytes, got ${salt.length}`)
  }

  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, KEY_LENGTH, PBKDF2_DIGEST)
}
