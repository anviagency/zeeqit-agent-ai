# ADR 007: Linux Passphrase Change (Future)

## Status

Proposed (not in v1)

## Context

The Linux passphrase fallback vault (ADR 002) stores the master key encrypted with a PBKDF2-derived key from a user passphrase. Users may need to **change their passphrase** (e.g., compromise, policy rotation, typo at setup).

## Decision

**Architecture**: Store PBKDF2 parameters (salt, iterations) alongside the encrypted master key to enable future passphrase change without data loss.

**v1 scope**:
- Store params in vault metadata
- No "Change passphrase" UI

**Future implementation**:
1. User enters current passphrase (verified)
2. User enters new passphrase
3. Re-derive key from new passphrase
4. Re-encrypt master key with new derived key
5. Zero-out old encrypted blob; write new blob
6. Update vault metadata

## Consequences

- v1: Passphrase cannot be changed; users must re-create vault if passphrase is lost or needs rotation
- Future: One-way migration; old passphrase invalidated after change
- PBKDF2 params (e.g., 100,000 iterations) stored in plaintext; no security impact (salt remains secret until compromise)
