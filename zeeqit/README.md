# Zeeqit

**Local AI Worker Control Plane** — Cross-platform desktop application for managing OpenClaw agents and AI workflows.

## Description

Zeeqit provides a unified desktop shell for orchestrating local AI workers across macOS, Linux, and Windows. It ships with an embedded Node.js runtime, secure credential storage via the OS keychain, and per-platform daemon management for zero-tech onboarding.

## Architecture Overview

- **Electron** shell with electron-vite; main process manages OpenClaw lifecycle
- **Embedded Node.js** per platform for reliable OpenClaw execution
- **OS keychain** (keytar) for AES-256-GCM credential vault
- **Local install** of OpenClaw under app-data; no global npm, no sudo
- **Signed auto-update** via electron-updater (when code signing is configured)

See [docs/adr/](docs/adr/) for Architecture Decision Records.

## Prerequisites

- **Node.js** 22+
- **npm** 9+

## Quick Start

```bash
git clone <repository-url>
cd zeeqit
npm install
npm run dev
```

## Build

| Platform | Command        | Output                    |
|----------|----------------|---------------------------|
| macOS    | `npm run build:mac`   | `.dmg` / `.zip` in `dist/` |
| Linux    | `npm run build:linux` | `.AppImage` / `.deb` in `dist/` |
| Windows  | `npm run build:win`   | `.exe` / `.msi` in `dist/` |

## Project Structure

```
zeeqit/
├── src/
│   ├── main/          # Electron main process (Node.js)
│   ├── preload/       # Preload scripts for renderer
│   └── renderer/      # React UI
├── resources/
│   └── runtime/       # Embedded Node.js manifest (binaries in node-*/)
├── docs/
│   └── adr/           # Architecture Decision Records
├── out/                # Build output (electron-vite)
└── dist/               # Packaged installers (electron-builder)
```

## Key Features

- Cross-platform desktop app (macOS, Linux, Windows)
- Embedded Node.js with integrity verification (SHA-256 + Ed25519)
- Secure credential vault using OS keychain (keytar) or PBKDF2 fallback on Linux
- Local OpenClaw installation; no global npm, no PATH
- Per-user Windows Scheduled Task for daemon (no admin required)
- Signed auto-update when code signing is configured

## Development Commands

| Command           | Description                    |
|-------------------|--------------------------------|
| `npm run dev`     | Start development server       |
| `npm run build`   | Build for current platform     |
| `npm run preview` | Run built app locally          |
| `npm run lint`    | Run ESLint                     |
| `npm run test`    | Run unit tests                 |
| `npm run test:watch` | Run tests in watch mode    |
| `npm run test:smoke` | Run smoke tests             |

## License

MIT
