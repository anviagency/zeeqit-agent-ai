# ADR 004: Local Install, Never Global

## Status

Accepted

## Context

`npm install -g` causes numerous issues:
- Requires `sudo` on many Linux/macOS setups
- PATH manipulation conflicts with existing Node version managers
- Permission errors (EACCES) on global npm prefix
- node-gyp failures when system Python/GCC differ from expectations
- Version conflicts between projects sharing global packages

## Decision

Install OpenClaw **locally** under the OS-specific app-data directory:

| OS | App Data Path |
|----|---------------|
| macOS | `~/Library/Application Support/Zeeqit/openclaw/` |
| Linux | `~/.config/zeeqit/openclaw/` |
| Windows | `%APPDATA%\Zeeqit\openclaw\` |

**Execution path**:
```
<embedded-node> <app-data>/openclaw/node_modules/.bin/openclaw
```

## Benefits

| Benefit | Description |
|---------|-------------|
| No sudo | Installation under user directory |
| No PATH | App invokes binary via absolute path |
| No conflicts | Isolated from system/other projects |
| Idempotency | Re-run install anytime; npm dedupes and updates safely |

## Consequences

- First-run setup: `npm install` in app-data directory (may take 30–60 seconds)
- Disk usage: ~50–100 MB for OpenClaw dependencies
- Updates: App triggers `npm install` when OpenClaw version changes
