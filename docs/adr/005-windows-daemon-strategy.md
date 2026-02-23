# ADR 005: Windows Per-User Scheduled Task

## Status

Accepted

## Context

On Windows, running a persistent daemon (e.g., OpenClaw agent) typically requires either:
- **Windows Service**: Needs admin (UAC elevation) for installation
- **HKCU Run key**: Starts at logon but has no restart-on-failure support

Admin-elevated installation blocks zero-tech onboarding: non-admin users cannot self-install.

## Decision

Use a **per-user Scheduled Task** via `schtasks.exe` with:
- **/RL LIMITED** — Runs with limited privileges; no admin required
- **/SC ONLOGON** — Triggers at user logon
- **/TN "Zeeqit OpenClaw"** — Unique task name
- **Restart on failure** — Built-in retry policy for crash recovery

## Rejected: HKCU Run Key

The Registry Run key was rejected because:
- No built-in restart-on-failure; daemon crash leaves user without service
- Less control over execution context (working directory, environment)
- Harder to uninstall cleanly (orphaned entries)

## Optional: Admin Windows Service

An **optional** admin-installed Windows service remains available as an explicit user choice for:
- Enterprise deployments with centralized management
- Users who prefer service semantics (runs before user logon if configured)

## Consequences

- Zero-tech onboarding: non-admin users can complete setup without elevation
- Daemon survives reboot and restarts on crash (per Task Scheduler policy)
- Slightly higher resource use than a true service; acceptable for desktop use case
