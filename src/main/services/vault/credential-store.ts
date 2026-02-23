/**
 * Credential CRUD store backed by an encrypted vault file.
 *
 * On first use the vault is initialized: a master key is generated and
 * stored in the OS keychain, and an empty vault file is created. All
 * credential values are encrypted with AES-256-GCM before being persisted.
 * Writes are atomic (via {@link atomicWriteFile}) to prevent corruption.
 */

import { join } from 'path'
import { existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { getVaultPath } from '../platform/app-paths'
import { atomicWriteFile, atomicReadFile } from '../platform/atomic-fs'
import { LogRing } from '../diagnostics/log-ring'
import { KeychainAdapter } from './keychain'
import { generateMasterKey, encrypt, decrypt } from './crypto'
import type { VaultStatus, EncryptedData } from './types'
import type { CredentialVault, CredentialEntry } from '@shared/schemas/credentials.schema'

const VAULT_FILE_NAME = 'credentials.json'
const INITIAL_KEY_VERSION = 1

/**
 * Singleton credential store providing encrypted CRUD operations.
 *
 * @example
 * ```ts
 * const store = CredentialStore.getInstance()
 * await store.store('openai', 'api-key', 'sk-...')
 * const key = await store.get('openai', 'api-key')
 * ```
 */
export class CredentialStore {
  private static instance: CredentialStore | null = null
  private readonly logger = LogRing.getInstance()
  private readonly keychain = KeychainAdapter.getInstance()
  private keyVersion = INITIAL_KEY_VERSION
  private initialized = false

  private constructor() {}

  /**
   * Returns the singleton CredentialStore instance.
   */
  static getInstance(): CredentialStore {
    if (!CredentialStore.instance) {
      CredentialStore.instance = new CredentialStore()
    }
    return CredentialStore.instance
  }

  /**
   * Stores an encrypted credential in the vault.
   *
   * @param service - Service identifier (e.g. 'openai', 'gologin').
   * @param key - Credential label / key name.
   * @param value - Plaintext credential value to encrypt and store.
   * @throws If vault initialization or file I/O fails.
   */
  async store(service: string, key: string, value: string): Promise<void> {
    try {
      await this.ensureInitialized()
      const masterKey = await this.requireMasterKey()
      const vault = await this.readVault()

      const existing = vault.credentials.findIndex(
        (c) => c.service === service && c.label === key
      )

      const encrypted = encrypt(value, masterKey, this.keyVersion)
      const now = new Date().toISOString()

      const entry: CredentialEntry = {
        id: existing >= 0 ? vault.credentials[existing].id : randomUUID(),
        service: service as CredentialEntry['service'],
        label: key,
        encryptedValue: this.packCiphertextAndTag(encrypted.ciphertext, encrypted.authTag),
        salt: encrypted.salt,
        iv: encrypted.iv,
        keyVersion: encrypted.keyVersion,
        createdAt: existing >= 0 ? vault.credentials[existing].createdAt : now,
        updatedAt: now
      }

      if (existing >= 0) {
        vault.credentials[existing] = entry
      } else {
        vault.credentials.push(entry)
      }

      await this.writeVault(vault)
      this.logger.info(`Credential stored: ${service}/${key}`)

      // Sync to OpenClaw config for services that need it
      await this.syncToOpenClawConfig(service, key, value)
    } catch (err) {
      this.logger.error(`Failed to store credential ${service}/${key}`, {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Failed to store credential: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Retrieves and decrypts a credential from the vault.
   *
   * @param service - Service identifier.
   * @param key - Credential label / key name.
   * @returns Decrypted credential value, or null if not found.
   */
  async get(service: string, key: string): Promise<string | null> {
    try {
      await this.ensureInitialized()
      const masterKey = await this.requireMasterKey()
      const vault = await this.readVault()

      const entry = vault.credentials.find(
        (c) => c.service === service && c.label === key
      )

      if (!entry) {
        return null
      }

      const { ciphertext, authTag } = this.unpackCiphertextAndTag(entry.encryptedValue)
      const encrypted: EncryptedData = {
        ciphertext,
        salt: entry.salt,
        iv: entry.iv,
        keyVersion: entry.keyVersion,
        authTag
      }

      return decrypt(encrypted, masterKey)
    } catch (err) {
      this.logger.error(`Failed to retrieve credential ${service}/${key}`, {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Failed to retrieve credential: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Removes a credential from the vault.
   *
   * @param service - Service identifier.
   * @param key - Credential label / key name.
   * @throws If the credential is not found or file I/O fails.
   */
  async delete(service: string, key: string): Promise<void> {
    try {
      await this.ensureInitialized()
      const vault = await this.readVault()

      const index = vault.credentials.findIndex(
        (c) => c.service === service && c.label === key
      )

      if (index < 0) {
        throw new Error(`Credential not found: ${service}/${key}`)
      }

      vault.credentials.splice(index, 1)
      await this.writeVault(vault)
      this.logger.info(`Credential deleted: ${service}/${key}`)
    } catch (err) {
      this.logger.error(`Failed to delete credential ${service}/${key}`, {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Failed to delete credential: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Lists all credential entries without decrypted values.
   *
   * @returns Array of credential metadata (service, label, timestamps).
   */
  async list(): Promise<Omit<CredentialEntry, 'encryptedValue' | 'salt' | 'iv'>[]> {
    try {
      await this.ensureInitialized()
      const vault = await this.readVault()

      return vault.credentials.map(({ encryptedValue: _ev, salt: _s, iv: _iv, ...rest }) => rest)
    } catch (err) {
      this.logger.error('Failed to list credentials', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Failed to list credentials: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Rotates the master key: generates a new key, re-encrypts all credentials,
   * and updates the key version.
   *
   * @throws If re-encryption or keychain storage fails.
   */
  async rotateKey(): Promise<void> {
    try {
      await this.ensureInitialized()
      const oldMasterKey = await this.requireMasterKey()
      const newMasterKey = generateMasterKey()
      const vault = await this.readVault()

      this.keyVersion += 1
      this.logger.info(`Rotating master key to version ${this.keyVersion}`)

      const reEncrypted: CredentialEntry[] = []

      for (const entry of vault.credentials) {
        const { ciphertext, authTag } = this.unpackCiphertextAndTag(entry.encryptedValue)
        const oldEncrypted: EncryptedData = {
          ciphertext,
          salt: entry.salt,
          iv: entry.iv,
          keyVersion: entry.keyVersion,
          authTag
        }

        const plaintext = decrypt(oldEncrypted, oldMasterKey)
        const newEncrypted = encrypt(plaintext, newMasterKey, this.keyVersion)

        reEncrypted.push({
          ...entry,
          encryptedValue: this.packCiphertextAndTag(newEncrypted.ciphertext, newEncrypted.authTag),
          salt: newEncrypted.salt,
          iv: newEncrypted.iv,
          keyVersion: newEncrypted.keyVersion,
          updatedAt: new Date().toISOString()
        })
      }

      vault.credentials = reEncrypted
      vault.version = this.keyVersion

      await this.keychain.storeMasterKey(newMasterKey)
      await this.writeVault(vault)

      this.logger.info(`Key rotation complete, ${reEncrypted.length} credentials re-encrypted`)
    } catch (err) {
      this.logger.error('Key rotation failed', {
        error: err instanceof Error ? err.message : String(err)
      })
      throw new Error(
        `Key rotation failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  /**
   * Returns the current vault status snapshot.
   *
   * @returns {@link VaultStatus} describing initialization state, key version, and credential count.
   */
  async getStatus(): Promise<VaultStatus> {
    try {
      const vaultPath = this.getVaultFilePath()
      const vaultExists = existsSync(vaultPath)

      let credentialCount = 0
      if (vaultExists) {
        try {
          const vault = await this.readVault()
          credentialCount = vault.credentials.length
        } catch {
          credentialCount = 0
        }
      }

      return {
        initialized: vaultExists && this.initialized,
        keyVersion: this.keyVersion,
        credentialCount,
        keychainType: this.keychain.getType()
      }
    } catch (err) {
      this.logger.error('Failed to get vault status', {
        error: err instanceof Error ? err.message : String(err)
      })
      return {
        initialized: false,
        keyVersion: this.keyVersion,
        credentialCount: 0,
        keychainType: this.keychain.getType()
      }
    }
  }

  /**
   * Ensures the vault is initialized: master key exists and vault file is present.
   * Creates both on first use.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return

    const vaultPath = this.getVaultFilePath()
    let existingKey = await this.keychain.getMasterKey()

    if (!existingKey) {
      this.logger.info('No master key found, initializing new vault')
      const newKey = generateMasterKey()
      await this.keychain.storeMasterKey(newKey)
      existingKey = newKey
    }

    if (!existsSync(vaultPath)) {
      const emptyVault: CredentialVault = {
        version: INITIAL_KEY_VERSION,
        credentials: []
      }
      await this.writeVault(emptyVault)
      this.logger.info('Empty vault file created')
    } else {
      try {
        const vault = await this.readVault()
        this.keyVersion = vault.version
      } catch {
        this.logger.warn('Failed to read existing vault version, using default')
      }
    }

    this.initialized = true
    this.logger.info('Credential store initialized')
  }

  private async requireMasterKey(): Promise<Buffer> {
    const key = await this.keychain.getMasterKey()
    if (!key) {
      throw new Error('Master key not available - vault may not be initialized')
    }
    return key
  }

  private async readVault(): Promise<CredentialVault> {
    const raw = await atomicReadFile(this.getVaultFilePath())
    return JSON.parse(raw) as CredentialVault
  }

  private async writeVault(vault: CredentialVault): Promise<void> {
    await atomicWriteFile(this.getVaultFilePath(), JSON.stringify(vault, null, 2))
  }

  /**
   * Syncs credential changes to the OpenClaw config file for services that
   * require config-level integration (LLM API keys, Telegram bot token).
   * Services like gologin/apify stay vault-only.
   */
  private async syncToOpenClawConfig(service: string, key: string, value: string): Promise<void> {
    // Only sync credentials that OpenClaw config needs
    const CONFIG_SYNC_KEYS = new Set([
      'anthropic/api-key',
      'openai/api-key',
      'telegram/bot-token',
    ])

    const credKey = `${service}/${key}`
    if (!CONFIG_SYNC_KEYS.has(credKey)) return

    try {
      const { join } = await import('path')
      const { existsSync } = await import('fs')
      const { getOpenClawPath } = await import('../platform/app-paths')
      const { atomicWriteFile, atomicReadFile } = await import('../platform/atomic-fs')

      const configPath = join(getOpenClawPath(), 'openclaw.json')
      if (!existsSync(configPath)) {
        this.logger.debug('OpenClaw config not found, skipping credential sync')
        return
      }

      const raw = await atomicReadFile(configPath)
      const config = JSON.parse(raw) as Record<string, unknown>

      // Inject credential at the appropriate config path
      if (credKey === 'anthropic/api-key' || credKey === 'openai/api-key') {
        const auth = (config['auth'] as Record<string, unknown>) ?? {}
        const profiles = (auth['profiles'] as Record<string, unknown>) ?? {}
        const profileKey = credKey === 'anthropic/api-key' ? 'anthropic:default' : 'openai:default'
        profiles[profileKey] = { key: value }
        auth['profiles'] = profiles
        config['auth'] = auth
      } else if (credKey === 'telegram/bot-token') {
        const channels = (config['channels'] as Record<string, unknown>) ?? {}
        const telegram = (channels['telegram'] as Record<string, unknown>) ?? {}
        telegram['botToken'] = value
        channels['telegram'] = telegram
        config['channels'] = channels
      }

      await atomicWriteFile(configPath, JSON.stringify(config, null, 2))
      this.logger.info(`Synced credential ${credKey} to OpenClaw config`)
    } catch (err) {
      // Non-fatal: credential is in vault, config sync is best-effort
      this.logger.warn(`Failed to sync credential to OpenClaw config`, {
        credKey,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private getVaultFilePath(): string {
    return join(getVaultPath(), VAULT_FILE_NAME)
  }

  /** GCM auth tag is 16 bytes = 32 hex chars, appended to ciphertext for storage. */
  private packCiphertextAndTag(ciphertext: string, authTag: string): string {
    return ciphertext + authTag
  }

  private unpackCiphertextAndTag(packed: string): { ciphertext: string; authTag: string } {
    const AUTH_TAG_HEX_LENGTH = 32
    if (packed.length < AUTH_TAG_HEX_LENGTH) {
      throw new Error('Encrypted value is too short to contain an auth tag')
    }
    return {
      ciphertext: packed.slice(0, -AUTH_TAG_HEX_LENGTH),
      authTag: packed.slice(-AUTH_TAG_HEX_LENGTH)
    }
  }
}
