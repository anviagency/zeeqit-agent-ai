# ADR 001: Electron over Tauri

## Status

Accepted

## Context

Need a desktop shell for cross-platform deployment (macOS, Linux, Windows) with embedded Node.js runtime. The application requires full access to the Node.js ecosystem for OpenClaw management and system integration.

## Decision

Use **Electron 34+** with **electron-vite** as the build toolchain.

## Rationale

- **Mature ecosystem**: Electron provides proven cross-platform support and extensive documentation
- **Full Node.js integration**: Native Node.js APIs for OpenClaw process management, file system access, and system calls
- **keytar/keychain support**: First-class integration with OS credential stores (macOS Keychain, Windows DPAPI, Linux libsecret)
- **electron-builder**: Reliable packaging for all target platforms with native installers

## Trade-offs

| Aspect | Impact |
|--------|--------|
| Binary size | Larger binaries (~150MB+ per platform) vs Tauri's smaller footprint |
| Benefit | Complete control over runtime environment; no reliance on system Node.js or WebView variants |

## Consequences

- Application ships with Chromium renderer and Node.js runtime
- Disk footprint is acceptable given the requirement for embedded Node and credential storage
- Tauri considered but rejected due to limited Node.js integration and keytar support
