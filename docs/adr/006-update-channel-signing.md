# ADR 006: Signed-Only Auto-Update

## Status

Accepted

## Context

Auto-update without code signing creates supply chain vulnerability:
- Unsigned updates can be replaced in transit (MITM)
- No guarantee that the update originates from the official build pipeline
- User has no way to verify authenticity

## Decision

The update channel **requires code signing** per platform:

| Platform | Signing Requirement |
|----------|----------------------|
| **macOS** | Apple Developer ID + notarization |
| **Windows** | Authenticode signing (EV or standard) |
| **Linux** | AppImage signature (GPG or equivalent) |

**Without signing**: Auto-update is **disabled**; users must manually download installers from the official site.

## Consequences

- Supply chain integrity: Only signed builds are distributed via auto-update
- Unsupported builds (e.g., local development): No auto-update; manual upgrade path
- CI/CD must provision signing certificates; Windows EV requires hardware token for release
- Linux distribution packages (deb, rpm) follow distro-specific signing; AppImage is for standalone distribution
