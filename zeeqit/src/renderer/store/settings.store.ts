import { create } from 'zustand'

export type SettingsTab = 'general' | 'credentials' | 'modules' | 'advanced'

interface SettingsState {
  activeTab: SettingsTab
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: string | null

  setActiveTab: (tab: SettingsTab) => void
  setDirty: (dirty: boolean) => void
  setSaving: (saving: boolean) => void
  markSaved: () => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  activeTab: 'general',
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setDirty: (isDirty) => set({ isDirty }),
  setSaving: (isSaving) => set({ isSaving }),
  markSaved: () => set({ isDirty: false, isSaving: false, lastSavedAt: new Date().toISOString() })
}))
