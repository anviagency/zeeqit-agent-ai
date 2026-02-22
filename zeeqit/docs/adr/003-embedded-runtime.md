# ADR 003: Embedded Node.js Runtime

## Status

Accepted

## Context

OpenClaw requires Node.js to execute. Relying on system-installed Node is unreliable:
- Version may be incompatible (e.g., Node 16 vs Node 22)
- PATH may not include Node
- Permissions may restrict execution (corporate lockdown, read-only home)
- Different platforms ship different Node versions or none at all

## Decision

Ship a **private Node.js binary** per platform, verified via:
- **SHA-256** checksums in a manifest
- **Ed25519** manifest signature for authenticity

**Fallback chain**:
1. **Embedded Node** — Preferred; bundled in `resources/runtime/` per platform
2. **System Node 22+** — If embedded binary missing or verification fails
3. **Auto-download** — With integrity verification (SHA-256 + signature check)

## Consequences

- Deterministic execution environment across all user machines
- No dependency on `nvm`, `fnm`, or system package manager
- Manifest enables reproducible builds and supply chain verification
- Slightly larger app bundle; trade-off accepted for reliability
