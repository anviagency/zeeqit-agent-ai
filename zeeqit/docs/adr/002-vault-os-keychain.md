# ADR 002: OS Keychain over Hardware Derivation

## Status

Accepted

## Context

Need secure master key storage for the AES-256-GCM credential vault. The master key protects all stored credentials and must persist across application restarts without user re-entry.

## Decision

Store a **random master key** in the OS keychain via **keytar**:
- **macOS**: Keychain Access
- **Windows**: DPAPI-backed credential store
- **Linux**: libsecret (GNOME Keyring, KWallet, etc.)

**Linux fallback** (when keytar/libsecret unavailable): PBKDF2-derived key from one-time passphrase, stored in a `chmod 600` file under app data.

## Rejected Alternative: Hardware-Bound Key Derivation

Hardware-bound key derivation (TPM, Secure Enclave, etc.) was considered and rejected because:
- Breaks on OS updates (e.g., major macOS version upgrades)
- Breaks on VM migration or hardware replacement
- Creates support burden for edge cases (recovery, cloud VMs)

## Consequences

- Primary path: No passphrase needed for normal operation; key survives app updates
- Linux fallback: User must enter passphrase once at first run; key file must be backed up
- Credentials are encrypted at rest with AES-256-GCM; master key never leaves secure storage
