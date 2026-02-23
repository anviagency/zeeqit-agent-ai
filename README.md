<p align="center">
  <img src="assets/banner.jpeg" alt="Zeeqit Agent AI" width="100%" />
</p>

<h1 align="center">Zeeqit Agent AI</h1>

<p align="center">
  <strong>Visual control plane for local AI workers — install OpenClaw, manage browser identity, extract data, and get cryptographic proof of every action.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-22%2B-green.svg" alt="Node.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-blue.svg" alt="TypeScript" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-35-9FEAF9.svg" alt="Electron" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB.svg" alt="React" /></a>
</p>

<p align="center">
  <a href="#install">Getting Started</a> · <a href="#architecture">Architecture</a> · <a href="#onboarding-flow">Onboarding</a> · <a href="#dashboard">Dashboard</a> · <a href="#security-model">Security</a> · <a href="#testing">Testing</a>
</p>

---

**Zeeqit** is a cross-platform desktop application that sits on top of [OpenClaw](https://github.com/openclaw) (open-source AI agent runtime), adding browser identity management via GoLogin, structured data extraction via Apify, and verifiable proof of execution for every action.

The user never touches CLI, JSON, or terminal. They open the app, configure their AI worker through a cinematic onboarding wizard, and watch it execute real tasks with evidence.

**Core value:** _"Choose a target. We decide whether to use Apify or a real browser with identity. You get results plus proof."_

---

## Install

```bash
git clone https://github.com/anviagency/zeeqit-agent-ai.git
cd zeeqit-agent-ai
npm install
npm run dev
```

That's it. The app opens, walks you through a 4-step onboarding wizard, and silently installs everything — including OpenClaw and a Node.js runtime if needed.

### Don't have Node.js?

| Platform | Command |
|----------|---------|
| **macOS** | `brew install node` |
| **Ubuntu / Debian** | `curl -fsSL https://deb.nodesource.com/setup_22.x \| sudo -E bash - && sudo apt install -y nodejs` |
| **Windows** | Download from [nodejs.org](https://nodejs.org/) |

### Build Installers

| Platform | Command | Output |
|----------|---------|--------|
| macOS | `npm run build:mac` | `.dmg` in `dist/` |
| Linux | `npm run build:linux` | `.AppImage` / `.deb` in `dist/` |
| Windows | `npm run build:win` | `.exe` installer in `dist/` |

---

## How It Works

```
  User opens Zeeqit app
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│                                                          │
│  ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   Main Process    │    │     Renderer (React UI)    │ │
│  │                    │    │                            │ │
│  │  ┌──────────────┐ │    │  Onboarding Wizard         │ │
│  │  │  Installer   │ │◄──►│  Dashboard (Topology,      │ │
│  │  │  + Runtime   │ │IPC │    Skills, Settings,       │ │
│  │  │  Resolver    │ │    │    Integration Store)      │ │
│  │  ├──────────────┤ │    │                            │ │
│  │  │  Credential  │ │    └────────────────────────────┘ │
│  │  │  Vault       │ │                                   │
│  │  │  (AES-256)   │ │    ┌────────────────────────────┐ │
│  │  ├──────────────┤ │    │      Preload Bridge        │ │
│  │  │  Daemon Mgr  │ │    │  contextBridge + IPC       │ │
│  │  │  (launchd /  │ │    └────────────────────────────┘ │
│  │  │  systemd /   │ │                                   │
│  │  │  schtasks)   │ │                                   │
│  │  ├──────────────┤ │                                   │
│  │  │  Gateway WS  │◄────── ws://127.0.0.1:18789        │
│  │  │  Client      │ │            (OpenClaw)             │
│  │  ├──────────────┤ │                                   │
│  │  │  GoLogin /   │ │                                   │
│  │  │  Apify /     │ │                                   │
│  │  │  Evidence    │ │                                   │
│  │  └──────────────┘ │                                   │
│  └──────────────────┘                                    │
└─────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
   ~/Library/Application     OS Keychain
   Support/Zeeqit/           (macOS Keychain /
   ├── openclaw/             Windows DPAPI /
   │   ├── node_modules/     Linux libsecret)
   │   └── openclaw.json
   ├── vault/
   ├── evidence/
   ├── config-history/
   └── logs/
```

---

## Onboarding Flow

A cinematic 4-step split-screen wizard. Left pane shows context, right pane shows controls. Zero terminal exposure.

| Step | Name | What Happens |
|------|------|-------------|
| **01** | Architecture | Toggle modules: Core (always on), Browser Identity (GoLogin), Telegram Ingress |
| **02** | Intelligence | Enter agent persona + API keys (OpenAI, Anthropic) |
| **03** | Authentication | GoLogin API token, Telegram bot token — conditional on Step 1 |
| **04** | Deployment | Silent install: resolve runtime → install OpenClaw → write config → encrypt credentials → install daemon → verify health → **ZEEQIT ONLINE** |

After deployment, the dashboard opens automatically.

---

## Dashboard

| View | Description |
|------|-------------|
| **Topology** | Live network graph with animated data packets. Click nodes to inspect: Ingress, Controller, Memory, Router/API, Playwright. Real-time via Gateway WebSocket. |
| **Skill Library** | Browse and edit skill definitions in a split-pane UI. JSON editor with syntax highlighting. |
| **Integration Store** | Categorized cards for all OpenClaw integrations — Messaging (Telegram, WhatsApp, Discord), Dev & Automation (GitHub, Browser, Cron), LLMs (OpenAI, Anthropic, Ollama). Install/configure directly. |
| **Settings** | Browser engine config (GoLogin API token, profile ID), intelligence providers (OpenAI/Anthropic keys), GoLogin affiliate CTA. |

Includes light/dark theme toggle and real-time system status indicator.

---

## Architecture

Single Electron application with three processes:

| Process | Technology | Role |
|---------|------------|------|
| **Main** | Node.js + TypeScript | OpenClaw lifecycle, vault, daemon, gateway, IPC handlers |
| **Preload** | contextBridge | Type-safe API exposure to renderer |
| **Renderer** | React 19 + Tailwind CSS v4 + Zustand | All UI: onboarding, dashboard, settings |

### Project Structure

```
zeeqit-agent-ai/
├── assets/                     Banner and visual assets
├── docs/adr/                   Architecture Decision Records (7 ADRs)
├── resources/
│   ├── runtime/manifest.json   Runtime integrity manifest (SHA-256)
│   ├── icon.png                Application icon
│   └── entitlements.mac.plist  macOS notarization entitlements
├── src/
│   ├── main/                   Electron main process
│   │   ├── index.ts            App entry, window creation, IPC
│   │   ├── ipc/register.ts     Centralized IPC handler registration
│   │   └── services/
│   │       ├── openclaw/       Installer, daemon, config, runtime, health
│   │       ├── vault/          AES-256-GCM credential store + OS keychain
│   │       ├── gateway/        WebSocket client + RPC for OpenClaw Gateway
│   │       ├── gologin/        GoLogin API client, profiles, session verify
│   │       ├── apify/          Apify actor runner, cache, fallback logic
│   │       ├── evidence/       Hash chain, DOM anchors, screenshots, collector
│   │       ├── routing/        Planner → Extractor → Validator → Prover
│   │       ├── workflow/       Executor, scheduler, types
│   │       ├── diagnostics/    LogRing, diagnostic bundle export
│   │       └── platform/       App paths, atomic filesystem operations
│   ├── preload/                contextBridge API + type-safe invoke/on
│   ├── renderer/               React application
│   │   ├── views/
│   │   │   ├── Onboarding/     4-step wizard (Architecture → Deploy)
│   │   │   ├── Dashboard/      Main layout with sidebar
│   │   │   ├── Topology/       Live network graph + inspector
│   │   │   ├── SkillLibrary/   Skill cards + JSON editor
│   │   │   ├── IntegrationStore/ Categorized integration cards
│   │   │   ├── Settings/       Provider keys, browser engine, daemon
│   │   │   └── Workflows/      Builder, timeline, evidence viewer
│   │   ├── components/         TopBar, Sidebar, TerminalEmulator, UI kit
│   │   ├── hooks/              useGateway, useHealth, useEvidence, useIpc
│   │   ├── store/              Zustand stores (app, onboarding, settings…)
│   │   └── styles/             Tailwind globals, CSS variables, themes
│   └── shared/                 IPC channels, schemas (Zod), health contract
├── tests/
│   ├── unit/                   81 unit tests (services + components)
│   └── smoke/                  8 smoke tests (install, repair, rollback…)
├── electron.vite.config.ts     Build configuration
├── electron-builder.config.ts  Packaging configuration (dmg/AppImage/exe)
├── tsconfig.json               TypeScript project references
├── vitest.config.ts            Unit test configuration
└── package.json                Dependencies and scripts
```

### Key Services

| Service | File | Purpose |
|---------|------|---------|
| **Installer** | `services/openclaw/installer.ts` | Idempotent 7-step install with checkpoint resume |
| **Runtime Resolver** | `services/openclaw/runtime-resolver.ts` | Embedded → System → Download (Node.js v22 from nodejs.org) |
| **Daemon Manager** | `services/openclaw/daemon.ts` | Delegates to `openclaw gateway` CLI for start/stop/status |
| **Config Compiler** | `services/openclaw/config-compiler.ts` | Zeeqit state → openclaw.json, atomic write, schema validation |
| **Config Backup** | `services/openclaw/config-backup.ts` | Last 10 configs, rollback, diff preview |
| **Credential Vault** | `services/vault/credential-store.ts` | AES-256-GCM encryption, per-credential salt+IV, key rotation |
| **Keychain Adapter** | `services/vault/keychain.ts` | macOS Keychain / Windows DPAPI / Linux libsecret + PBKDF2 fallback |
| **Gateway Client** | `services/gateway/websocket-client.ts` | Exponential backoff, heartbeat, rate limiting, bounded event queue |
| **Evidence Chain** | `services/evidence/chain.ts` | SHA-256 hash chain linking every execution step |
| **Routing Engine** | `services/routing/engine.ts` | Planner → Extractor → Validator → Prover pipeline |
| **GoLogin Client** | `services/gologin/client.ts` | Profile CRUD, CDP bridge, session verification |
| **Apify Client** | `services/apify/client.ts` | Actor runner with 60s TTL cache and browser fallback |

---

## Security Model

### Encryption

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key storage | OS Keychain (macOS), DPAPI (Windows), libsecret (Linux) |
| Key fallback | PBKDF2 (100k iterations, SHA-512) + passphrase on Linux headless |
| Salt | Random per credential entry |
| IV | Random per encryption operation |
| Auth tag | 16 bytes (GCM authentication) |
| Key rotation | Supported with automatic re-encryption |

### Threat Mitigation

| Threat | Mitigation |
|--------|------------|
| Credential theft from disk | All secrets AES-256-GCM encrypted. Master key in OS keychain. |
| Network exposure | OpenClaw Gateway binds to `127.0.0.1` only. |
| Corrupt config | Atomic write (tmp → fsync → rename), schema validation, 10-config rollback history. |
| Fake success | Evidence hash chain — every step has `input_hash`, `output_hash`, `prev_hash`. |
| Log leakage | LogRing with structured redaction. |
| Tampered runtime | SHA-256 + Ed25519 signature verification for embedded binaries. |

### Installation Principles

Every installation and config operation is:

1. **Idempotent** — run 10 times, same result
2. **Atomic** — all succeeds or nothing changes
3. **Recoverable** — checkpoint file enables resume after crash; Repair button in dashboard

---

## Testing

104 unit tests + 8 smoke tests across 16 test files.

```bash
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:smoke    # Run smoke tests
```

### Test Coverage

| Area | Tests |
|------|-------|
| Vault encryption round-trips | ✓ |
| Evidence chain integrity | ✓ |
| Config compiler + backup/rollback | ✓ |
| Atomic filesystem operations | ✓ |
| Runtime resolver + integrity | ✓ |
| Keychain adapter (all platforms) | ✓ |
| Health contract validation | ✓ |
| Routing engine pipeline | ✓ |
| Apify actor cache TTL | ✓ |
| Onboarding UI navigation + state | ✓ |
| Settings view rendering | ✓ |
| Daemon management (openclaw CLI delegation) | ✓ |
| Workflow executor CRUD + execution | ✓ |
| IPC handler wiring (all domains) | ✓ |
| Smoke: fresh install, repair, rollback, offline, interrupted | ✓ |

---

## Development

```bash
git clone https://github.com/anviagency/zeeqit-agent-ai.git
cd zeeqit-agent-ai
npm install
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron in development mode (hot reload) |
| `npm run build` | Build all processes (main + preload + renderer) |
| `npm run preview` | Run the built app locally |
| `npm run lint` | Run ESLint across all source files |
| `npm test` | Run the full unit test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:smoke` | Run smoke tests |
| `npm run build:mac` | Build + package for macOS (.dmg) |
| `npm run build:linux` | Build + package for Linux (.AppImage / .deb) |
| `npm run build:win` | Build + package for Windows (.exe) |

### Architecture Decision Records

| ADR | Decision |
|-----|----------|
| [001](docs/adr/001-electron-choice.md) | Electron as the desktop shell |
| [002](docs/adr/002-vault-os-keychain.md) | OS keychain for vault master key |
| [003](docs/adr/003-embedded-runtime.md) | Embedded Node.js runtime |
| [004](docs/adr/004-local-install-no-global.md) | Local OpenClaw install (no global npm) |
| [005](docs/adr/005-windows-daemon-strategy.md) | Windows per-user Scheduled Task |
| [006](docs/adr/006-update-channel-signing.md) | Signed auto-update channel |
| [007](docs/adr/007-linux-passphrase-future.md) | Linux passphrase change (future) |

---

## Data Flow

```
User action in dashboard
    │
    ▼
Zeeqit writes openclaw.json + calls GoLogin/Apify APIs
    │
    ▼
OpenClaw Gateway executes (ws://127.0.0.1:18789)
    │
    ▼
Evidence collected (screenshots, DOM anchors, hash chain)
    │
    ▼
Results + proof displayed in dashboard
```

### Routing Logic

```
IF matching Apify actor exists
    TRY Apify actor
    IF blocked OR empty result OR error
        FALLBACK to GoLogin + AI extraction
ELSE
    USE GoLogin + AI extraction directly
```

---

## Runtime Data

All data is stored locally under the platform-specific app data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/Zeeqit/` |
| Windows | `%APPDATA%\Zeeqit\` |
| Linux | `~/.local/share/zeeqit/` |

```
Zeeqit/
├── openclaw/              OpenClaw runtime + openclaw.json
├── vault/                 Encrypted credential store
├── evidence/              Hash chain + artifacts
├── config-history/        Last 10 config snapshots
├── checkpoints/           Install checkpoint for crash recovery
└── logs/                  Structured log ring buffer
```

---

## Roadmap

- [x] **Phase 1** — Electron shell, onboarding wizard, silent OpenClaw install, credential vault, daemon management, settings UI
- [x] **Phase 2** — Topology view, skill library, GoLogin integration, evidence chain, routing engine
- [x] **Phase 3** — Integration store, channels config, light/dark theme, design polish
- [ ] **Phase 4** — Workflow builder with target + goal + schedule + evidence timeline
- [ ] **Phase 5** — ClawHub skill marketplace, multi-agent routing UI
- [ ] **Phase 6** — Cost analytics, cron scheduling, affiliate attribution

---

## License

MIT

---

## Author

**Built by [Slava Melandovich](https://www.linkedin.com/in/slava-melandovich/)**

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/slava-melandovich/)
[![Instagram](https://img.shields.io/badge/Instagram-E4405F?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/slava_melandovich/)
[![Facebook](https://img.shields.io/badge/Facebook-1877F2?style=for-the-badge&logo=facebook&logoColor=white)](https://www.facebook.com/slava.melandovich)
[![Website](https://img.shields.io/badge/Website-agent.zeeqit.com-00C853?style=for-the-badge&logo=google-chrome&logoColor=white)](https://agent.zeeqit.com)
[![Email](https://img.shields.io/badge/Email-lord@zeeqit.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:lord@zeeqit.com)

---

Built with Electron, React 19, TypeScript, Tailwind CSS v4, Zustand, Zod, Framer Motion, and Vitest.
