/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

vi.mock('framer-motion', () => {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      return ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
        const tag = String(prop)
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(props)) {
          if (!['initial', 'animate', 'exit', 'transition', 'whileTap', 'whileHover', 'layout', 'variants'].includes(k)) {
            clean[k] = v
          }
        }
        return React.createElement(tag, clean, children)
      }
    }
  }
  return {
    motion: new Proxy({}, handler),
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>
  }
})

vi.mock('../../../src/renderer/api', () => ({
  api: {
    config: {
      diff: vi.fn().mockResolvedValue({ success: true, data: '{"changes": []}' }),
      apply: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue({ success: true, data: {} }),
      rollback: vi.fn(),
      listBackups: vi.fn()
    },
    vault: {
      store: vi.fn().mockResolvedValue({ success: true }),
      get: vi.fn().mockResolvedValue({ success: true }),
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      status: vi.fn().mockResolvedValue({ success: true })
    },
    gologin: {
      validate: vi.fn().mockResolvedValue({ success: true }),
      listProfiles: vi.fn(),
      launch: vi.fn(),
      stop: vi.fn(),
      testSession: vi.fn()
    },
    daemon: {
      start: vi.fn().mockResolvedValue({ success: true }),
      stop: vi.fn().mockResolvedValue({ success: true }),
      restart: vi.fn().mockResolvedValue({ success: true }),
      status: vi.fn().mockResolvedValue({ success: true, data: { running: false } }),
      logs: vi.fn().mockResolvedValue({ success: true, data: [] })
    },
    events: {
      onInstallProgress: vi.fn(() => () => {}),
      onHealthUpdate: vi.fn(() => () => {}),
      onGatewayState: vi.fn(() => () => {}),
      onDaemonLog: vi.fn(() => () => {}),
      onWorkflowProgress: vi.fn(() => () => {})
    }
  }
}))

vi.mock('../../../src/renderer/views/Settings/ConfigDiffModal', () => ({
  ConfigDiffModal: ({
    isOpen,
    diff,
    onConfirm,
    onCancel,
    loading
  }: {
    isOpen: boolean
    diff: string
    onConfirm: () => void
    onCancel: () => void
    loading: boolean
  }) =>
    isOpen ? (
      <div data-testid="config-diff-modal">
        <pre>{diff}</pre>
        <button onClick={onConfirm} disabled={loading}>
          Apply
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null
}))

vi.mock('../../../src/renderer/store/app.store', () => ({
  useAppStore: () => ({
    theme: 'dark',
    toggleTheme: vi.fn()
  })
}))

import { api } from '../../../src/renderer/api'
import { SettingsView } from '../../../src/renderer/views/Settings/SettingsView'

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('card rendering', () => {
    it('should render Browser Engine and Intelligence Providers cards', () => {
      render(<SettingsView />)
      expect(screen.getByText('Browser Engine')).toBeInTheDocument()
      expect(screen.getByText('Intelligence Providers')).toBeInTheDocument()
    })

    it('should render the System Configuration header', () => {
      render(<SettingsView />)
      expect(screen.getByText('System Configuration')).toBeInTheDocument()
      expect(
        screen.getByText(/Manage providers, authentication, and security gates/)
      ).toBeInTheDocument()
    })
  })

  describe('input interactions', () => {
    it('should have a Preview Config Diff button', () => {
      render(<SettingsView />)
      const diffBtn = screen.getByText('Preview Config Diff')
      expect(diffBtn).toBeInTheDocument()
    })

    it('should call config.diff when Preview Config Diff is clicked', async () => {
      render(<SettingsView />)
      const diffBtn = screen.getByText('Preview Config Diff')
      fireEvent.click(diffBtn)

      expect(api.config.diff).toHaveBeenCalled()
    })
  })
})
