/**
 * Vault type definitions for the encrypted credential storage system.
 *
 * These types are used by the keychain adapter, crypto module, and
 * credential store to describe vault state and encrypted payloads.
 */

/** Supported OS keychain backend types. */
export type KeychainType = 'keychain' | 'dpapi' | 'libsecret' | 'passphrase_fallback'

/** Runtime status snapshot of the credential vault. */
export interface VaultStatus {
  /** Whether the vault has been initialized with a master key. */
  initialized: boolean
  /** Current master key version (incremented on rotation). */
  keyVersion: number
  /** Number of credentials stored in the vault. */
  credentialCount: number
  /** Which OS keychain backend is in use. */
  keychainType: KeychainType
}

/**
 * Envelope for an AES-256-GCM encrypted payload.
 *
 * All fields are hex-encoded strings for safe JSON serialization.
 */
export interface EncryptedData {
  /** Hex-encoded ciphertext. */
  ciphertext: string
  /** Hex-encoded 16-byte salt used for key derivation. */
  salt: string
  /** Hex-encoded 12-byte initialization vector. */
  iv: string
  /** Master key version that produced this ciphertext. */
  keyVersion: number
  /** Hex-encoded GCM authentication tag. */
  authTag: string
}
