import { create } from 'zustand'

export interface OnboardingModules {
  core: boolean
  browser: boolean
  telegram: boolean
}

export interface OnboardingIntelligence {
  persona: string
  openaiKey: string
  anthropicKey: string
}

export interface OnboardingAuth {
  gologinToken: string
  telegramToken: string
}

interface OnboardingState {
  currentStep: number
  modules: OnboardingModules
  intelligence: OnboardingIntelligence
  auth: OnboardingAuth
  isDeploying: boolean
  deployComplete: boolean

  nextStep: () => void
  prevStep: () => void
  setStep: (step: number) => void
  setModule: (key: keyof OnboardingModules, value: boolean) => void
  setIntelligence: <K extends keyof OnboardingIntelligence>(key: K, value: OnboardingIntelligence[K]) => void
  setAuth: <K extends keyof OnboardingAuth>(key: K, value: OnboardingAuth[K]) => void
  setDeploying: (v: boolean) => void
  setDeployComplete: (v: boolean) => void
  getConfig: () => Record<string, unknown>
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  currentStep: 1,
  modules: { core: true, browser: false, telegram: false },
  intelligence: { persona: '', openaiKey: '', anthropicKey: '' },
  auth: { gologinToken: '', telegramToken: '' },
  isDeploying: false,
  deployComplete: false,

  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 4) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
  setStep: (step) => set({ currentStep: step }),
  setModule: (key, value) =>
    set((s) => ({ modules: { ...s.modules, [key]: value } })),
  setIntelligence: (key, value) =>
    set((s) => ({ intelligence: { ...s.intelligence, [key]: value } })),
  setAuth: (key, value) =>
    set((s) => ({ auth: { ...s.auth, [key]: value } })),
  setDeploying: (v) => set({ isDeploying: v }),
  setDeployComplete: (v) => set({ deployComplete: v }),

  getConfig: () => {
    const { modules, intelligence, auth } = get()
    return {
      modules: {
        core: true,
        browser: modules.browser,
        telegram: modules.telegram,
      },
      intelligence: {
        persona: intelligence.persona,
        openaiKey: intelligence.openaiKey,
        anthropicKey: intelligence.anthropicKey,
      },
      auth: {
        gologinToken: auth.gologinToken,
        telegramToken: auth.telegramToken,
      },
    }
  },
}))
