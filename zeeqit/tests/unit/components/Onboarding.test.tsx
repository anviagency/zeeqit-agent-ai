/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
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

import { useOnboardingStore } from '../../../src/renderer/store/onboarding.store'
import { OnboardingLayout } from '../../../src/renderer/views/Onboarding/OnboardingLayout'

vi.mock('../../../src/renderer/store/app.store', () => ({
  useAppStore: (selector: Function) =>
    selector({
      setCurrentView: vi.fn()
    })
}))

Object.defineProperty(window, 'zeeqitApi', {
  value: {
    openclaw: { install: vi.fn().mockResolvedValue({ success: true }) },
    events: { onInstallProgress: vi.fn(() => () => {}) }
  },
  writable: true
})

describe('OnboardingLayout', () => {
  beforeEach(() => {
    act(() => {
      useOnboardingStore.setState({
        currentStep: 1,
        modules: { core: true, browser: false, telegram: false },
        intelligence: { persona: '', openaiKey: '', anthropicKey: '' },
        auth: { gologinToken: '', telegramToken: '' },
        isDeploying: false,
        deployComplete: false
      })
    })
  })

  describe('step navigation', () => {
    it('should render step 1 (Architecture) by default', () => {
      render(<OnboardingLayout />)
      expect(screen.getByText('Architecture')).toBeInTheDocument()
    })

    it('should navigate forward with Continue button', () => {
      render(<OnboardingLayout />)
      const continueBtn = screen.getByText('Continue')
      fireEvent.click(continueBtn)

      expect(useOnboardingStore.getState().currentStep).toBe(2)
    })

    it('should navigate backward with Back button on step 2', () => {
      act(() => {
        useOnboardingStore.setState({ currentStep: 2 })
      })

      render(<OnboardingLayout />)
      const backBtn = screen.getByText('Back')
      fireEvent.click(backBtn)

      expect(useOnboardingStore.getState().currentStep).toBe(1)
    })

    it('should show Back button with opacity 0 on step 1', () => {
      render(<OnboardingLayout />)
      const backBtn = screen.getByText('Back')
      expect(backBtn.style.opacity).toBe('0')
      expect(backBtn.style.pointerEvents).toBe('none')
    })

    it('should show Initialize text on step 3', () => {
      act(() => {
        useOnboardingStore.setState({ currentStep: 3 })
      })

      render(<OnboardingLayout />)
      expect(screen.getByText('Initialize')).toBeInTheDocument()
    })
  })

  describe('module toggles', () => {
    it('should update store when a module toggle is changed', () => {
      act(() => {
        useOnboardingStore.getState().setModule('browser', true)
      })

      expect(useOnboardingStore.getState().modules.browser).toBe(true)
    })

    it('should keep core module always on', () => {
      expect(useOnboardingStore.getState().modules.core).toBe(true)
    })
  })

  describe('conditional auth fields', () => {
    it('should show no-deps message when no external modules selected', () => {
      act(() => {
        useOnboardingStore.setState({
          currentStep: 3,
          modules: { core: true, browser: false, telegram: false }
        })
      })

      render(<OnboardingLayout />)
      expect(screen.getByText(/No external dependencies/i)).toBeInTheDocument()
    })

    it('should show GoLogin token field when browser module is enabled', () => {
      act(() => {
        useOnboardingStore.setState({
          currentStep: 3,
          modules: { core: true, browser: true, telegram: false }
        })
      })

      render(<OnboardingLayout />)
      expect(screen.getByText(/GoLogin API Token/i)).toBeInTheDocument()
    })

    it('should show Telegram token field when telegram module is enabled', () => {
      act(() => {
        useOnboardingStore.setState({
          currentStep: 3,
          modules: { core: true, browser: false, telegram: true }
        })
      })

      render(<OnboardingLayout />)
      expect(screen.getByText(/Telegram Bot Token/i)).toBeInTheDocument()
    })
  })
})
