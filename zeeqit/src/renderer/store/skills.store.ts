import { create } from 'zustand'

export interface Skill {
  id: string
  name: string
  description: string
  category: string
  enabled: boolean
  version: string
}

interface SkillsState {
  skills: Skill[]
  selectedSkillId: string | null
  searchQuery: string
  categoryFilter: string | null
  isLoading: boolean

  setSkills: (skills: Skill[]) => void
  selectSkill: (skillId: string | null) => void
  setSearchQuery: (query: string) => void
  setCategoryFilter: (category: string | null) => void
  setLoading: (loading: boolean) => void
  getSelectedSkill: () => Skill | undefined
  getFilteredSkills: () => Skill[]
}

export const useSkillsStore = create<SkillsState>()((set, get) => ({
  skills: [],
  selectedSkillId: null,
  searchQuery: '',
  categoryFilter: null,
  isLoading: false,

  setSkills: (skills) => set({ skills }),
  selectSkill: (selectedSkillId) => set({ selectedSkillId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setLoading: (isLoading) => set({ isLoading }),

  getSelectedSkill: () => {
    const { skills, selectedSkillId } = get()
    return skills.find((s) => s.id === selectedSkillId)
  },

  getFilteredSkills: () => {
    const { skills, searchQuery, categoryFilter } = get()
    return skills.filter((skill) => {
      const matchesSearch =
        !searchQuery ||
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !categoryFilter || skill.category === categoryFilter
      return matchesSearch && matchesCategory
    })
  }
}))
