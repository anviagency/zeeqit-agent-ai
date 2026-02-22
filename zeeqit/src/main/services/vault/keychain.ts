/**
 * OS keychain adapter for secure master key storage.
 *
 * Uses the `keytar` native module to store the vault master key in the
 * platform's credential manager (macOS Keychain, Windows DPAPI, Linux
 * libsecret). On systems where keytar is unavailable (headless Linux,
 * missing D-Bus), falls back to PBKDF2-derived keys from a user passphrase
 * stored in a chmod-600 file.
 */

import { join } from 'path'
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'fs'
import { randomBytes, pbkdf2Sync } from 'crypto'
import { platform } from 'os'
import { getVaultPath } from '../platform/app-paths'
import { LogRing } from '../diagnostics/log-ring'
import type { KeychainType } from './types'

const SERVICE_NAME = 'zeeqit-vault'
const ACCOUNT_NAME = 'master-key'
const PASSPHRASE_FLAG_FILE = 'passphrase-mode.flag'
const PASSPHRASE_SALT_FILE = 'passphrase-salt.bin'
const PASSPHRASE_KEY_FILE = 'passphrase-key.enc'
const PBKDF2_ITERATIONS = 100_000

let keytarModule: typeof import('keytar') | null = null
let keytarLoadAttempted = false

/**
 * Attempts to load the keytar native module.
 * Returns null if keytar is unavailable (e.g. missing native bindings).
 */
function loadKeytar(): typeof import('keytar') | null {
  if (keytarLoadAttempted) return keytarModule

  keytarLoadAttempted = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    keytarModule = require('keytar') as typeof import('keytar')
  } catch {
    keytarModule = null
  }
  return keytarModule
}

/**
 * Singleton adapter that abstracts OS keychain access behind a unified API.
 *
 * @example
 * ```ts
 * const keychain = KeychainAdapter.getInstance()
 * if (await keychain.isAvailable()) {
 *   await keychain.storeMasterKey(masterKey)
 *   const retrieved = await keychain.getMasterKey()
 * }
 * ```
 */
export class KeychainAdapter {
  private static instance: KeychainAdapter | null = null
  private readonly logger = LogRing.getInstance()

  private constructor() {}

  /**
   * Returns the singleton KeychainAdapter instance.
   */
  static getInstance(): KeychainAdapter {
    if (!KeychainAdapter.instance) {
      KeychainAdapter.instance = new KeychainAdapter()
    }
    return KeychainAdapter.instance
  }

  /**
   * Stores the master key in the OS keychain, falling back to
   * passphrase-based file storage on Linux if keytar is unavailable.
   *
   * @param key - 32-byte master key buffer.
   * @throws If both keytar and fallback storage fail.
   */
  async storeMasterKey(key: Buffer): Promise<void> {
    try {
      const keytar = loadKeytar()
      if (keytar) {
        await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, key.toString('hex'))
        this.logger.info('Master key stored in OS keychain')
        return
      }
    } catch (err) {
      this.logger.warn('Keytar store failed, attempting passphrase fallback', {
        error: err instanceof Error ? err.message : String(err)
      })
    }

    await this.storeWithPassphraseFallback(key)
  }

  /**
   * Retrieves the master key from the OS keychain, falling back to
   * passphrase-based file storage if keytar is unavailable.
   *
   * @returns The 32-byte master key buffer, or null if no key is stored.
   * @throws If both keytar and fallback retrieval fail unexpectedly.
   */
  async getMasterKey(): Promise<Buffer | null> {
    try {
      const keytar = loadKeytar()
      if (keytar) {
        const hex = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME)
        if (hex) {
          this.logger.debug('Master key retrieved from OS keychain')
          return Buffer.from(hex, 'hex')
        }
        return null
      }
    } catch (err) {
      this.logger.warn('Keytar retrieval failed, attempting passphrase fallback', {
        error: err instanceof Error ? err.message : String(err)
      })
    }

    return this.getWithPassphraseFallback()
  }

  /**
   * Checks whether the keychain backend is functional.
   *
   * @returns `true` if either keytar or passphrase fallback is available.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const keytar = loadKeytar()
      if (keytar) {
        await keytar.getPassword(SERVICE_NAME, '__availability_check__')
        return true
      }
    } catch {
      // keytar not functional
    }

    return this.isPassphraseFallbackConfigured()
  }

  /**
   * Returns the active keychain backend type for the current platform.
   *
   * @returns The keychain type in use.
   */
  getType(): KeychainType {
    if (this.isPassphraseFallbackConfigured()) {
      return 'passphrase_fallback'
    }

    const keytar = loadKeytar()
    if (!keytar) {
      return 'passphrase_fallback'
    }

    const os = platform()
    switch (os) {
      case 'darwin':
        return 'keychain'
      case 'win32':
        return 'dpapi'
      case 'linux':
        return 'libsecret'
      default:
        return 'passphrase_fallback'
    }
  }

  /**
   * Stores the master key using a PBKDF2-derived wrapping key from a
   * machine-unique salt. Used when keytar/libsecret is unavailable.
   */
  private async storeWithPassphraseFallback(key: Buffer): Promise<void> {
    try {
      const vaultDir = getVaultPath()
      const salt = randomBytes(32)
      const passphrase = this.getMachinePassphrase()
      const wrappingKey = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256')

      const encrypted = Buffer.alloc(key.length)
      for (let i = 0; i < key.length; i++) {
        encrypted[i] = key[i] ^ wrappingKey[i]
      }

      const saltPath = join(vaultDir, PASSPHRASE_SALT_FILE)
      const keyPath = join(vaultDir, PASSPHRASE_KEY_FILE)
      const flagPath = join(vaultDir, PASSPHRASE_FLAG_FILE)

      writeFileSync(saltPath, salt)
      writeFileSync(keyPath, encrypted)
      writeFileSync(flagPath, new Date().toISOString())

      this.setFilePermissions(saltPath)
      this.setFilePermissions(keyPath)
      this.setFilePermissions(flagPath)

      this.logger.info('Master key stored via passphrase fallback')
    } catch (err) {
      throw new Error(
        `Passphrase fallback storage failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Retrieves the master key from passphrase-based file storage.
   */
  private getWithPassphraseFallback(): Buffer | null {
    try {
      const vaultDir = getVaultPath()
      const saltPath = join(vaultDir, PASSPHRASE_SALT_FILE)
      const keyPath = join(vaultDir, PASSPHRASE_KEY_FILE)

      if (!existsSync(saltPath) || !existsSync(keyPath)) {
        return null
      }

      const salt = readFileSync(saltPath)
      const encrypted = readFileSync(keyPath)
      const passphrase = this.getMachinePassphrase()
      const wrappingKey = pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, 'sha256')

      const decrypted = Buffer.alloc(encrypted.length)
      for (let i = 0; i < encrypted.length; i++) {
        decrypted[i] = encrypted[i] ^ wrappingKey[i]
      }

      this.logger.debug('Master key retrieved via passphrase fallback')
      return decrypted
    } catch (err) {
      this.logger.error('Passphrase fallback retrieval failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      return null
    }
  }

  /**
   * Derives a machine-specific passphrase from environment variables.
   * This is not a secret per se; it ties the fallback key to this machine.
   */
  private getMachinePassphrase(): string {
    const parts = [
      process.env['USER'] ?? process.env['USERNAME'] ?? 'unknown',
      process.env['HOME'] ?? process.env['USERPROFILE'] ?? '/tmp',
      SERVICE_NAME
    ]
    return parts.join(':')
  }

  private isPassphraseFallbackConfigured(): boolean {
    try {
      const flagPath = join(getVaultPath(), PASSPHRASE_FLAG_FILE)
      return existsSync(flagPath)
    } catch {
      return false
    }
  }

  /**
   * Restricts file permissions to owner-only (chmod 600) on Unix systems.
   */
  private setFilePermissions(filePath: string): void {
    if (platform() !== 'win32') {
      try {
        chmodSync(filePath, 0o600)
      } catch {
        this.logger.warn(`Failed to set permissions on ${filePath}`)
      }
    }
  }
}
