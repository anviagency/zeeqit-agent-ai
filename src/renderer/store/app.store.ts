import { create } from 'zustand'
import type { InstallationState } from '@shared/installation-states'
import type { HealthLightState } from '@shared/ipc-channels'

export type AppView = 'onboarding' | 'store' | 'settings' | 'workflows' | 'cost-analytics' | 'multi-agent' | 'openclaw'
export type DashboardView = Exclude<AppView, 'onboarding'>
export type ThemeMode = 'dark' | 'light'

export type GatewayConnectionState = 'connected' | 'disconnected' | 'reconnecting'

export interface HealthLights {
  zeeqitService: HealthLightState
  openclawGateway: HealthLightState
  browserEngine: HealthLightState
}

const defaultHealthLights: HealthLights = {
  zeeqitService: { status: 'yellow', tooltip: 'Checking…', checks: [] },
  openclawGateway: { status: 'yellow', tooltip: 'Checking…', checks: [] },
  browserEngine: { status: 'yellow', tooltip: 'Checking…', checks: [] },
}

interface AppState {
  currentView: AppView
  installationState: InstallationState
  sidebarCollapsed: boolean
  gatewayState: GatewayConnectionState
  healthLights: HealthLights
  theme: ThemeMode

  setCurrentView: (view: AppView) => void
  setInstallationState: (state: InstallationState) => void
  toggleSidebar: () => void
  setGatewayState: (state: GatewayConnectionState) => void
  setHealthLights: (lights: HealthLights) => void
  toggleTheme: () => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'onboarding',
  installationState: 'not_installed',
  sidebarCollapsed: false,
  gatewayState: 'disconnected',
  healthLights: defaultHealthLights,
  theme: 'dark',

  setCurrentView: (view) => set({ currentView: view }),
  setInstallationState: (installationState) => set({ installationState }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setGatewayState: (gatewayState) => set({ gatewayState }),
  setHealthLights: (healthLights) => set({ healthLights }),
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      if (next === 'light') {
        document.body.classList.add('theme-light')
      } else {
        document.body.classList.remove('theme-light')
      }
      return { theme: next }
    }),
}))
